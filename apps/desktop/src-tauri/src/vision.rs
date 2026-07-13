use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use std::{fs, process::Command};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionField {
    pub field: String,
    pub value: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisionResult {
    pub raw_text: String,
    #[serde(default)]
    pub fields: Vec<VisionField>,
    #[serde(default)]
    pub barcodes: Vec<String>,
    pub engine: String,
}

const SWIFT_VISION: &str = r#"
import Foundation
import Vision
import AppKit

let path = CommandLine.arguments[1]
guard let image = NSImage(contentsOfFile: path),
      let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let cgImage = bitmap.cgImage else {
  fputs("Unable to decode image\n", stderr)
  exit(2)
}

let textRequest = VNRecognizeTextRequest()
textRequest.recognitionLevel = .accurate
textRequest.usesLanguageCorrection = true
textRequest.recognitionLanguages = ["en-US"]
let barcodeRequest = VNDetectBarcodesRequest()
let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([textRequest, barcodeRequest])

let lines = (textRequest.results ?? []).compactMap { observation in
  observation.topCandidates(1).first?.string
}
let codes = (barcodeRequest.results ?? []).compactMap { $0.payloadStringValue }
let result: [String: Any] = [
  "rawText": lines.joined(separator: "\n"),
  "fields": [],
  "barcodes": codes,
  "engine": "Apple Vision (local)"
]
let data = try JSONSerialization.data(withJSONObject: result, options: [])
FileHandle.standardOutput.write(data)
"#;

pub fn analyze_data_url(data_url: &str) -> Result<VisionResult, String> {
    let (header, payload) = data_url
        .split_once(',')
        .ok_or_else(|| "Invalid image data URL".to_string())?;
    let extension = if header.contains("png") { "png" } else if header.contains("webp") { "webp" } else { "jpg" };
    let bytes = STANDARD.decode(payload).map_err(|error| format!("Image decode failed: {error}"))?;
    let stem = format!("vault-vision-{}", Uuid::new_v4());
    let image_path = std::env::temp_dir().join(format!("{stem}.{extension}"));
    let script_path = std::env::temp_dir().join(format!("{stem}.swift"));
    fs::write(&image_path, bytes).map_err(|error| format!("Unable to write temporary image: {error}"))?;
    fs::write(&script_path, SWIFT_VISION).map_err(|error| format!("Unable to write Vision script: {error}"))?;
    let output = Command::new("swift")
        .arg(&script_path)
        .arg(&image_path)
        .output()
        .map_err(|error| format!("Unable to launch Apple Vision: {error}"));
    let _ = fs::remove_file(&image_path);
    let _ = fs::remove_file(&script_path);
    let output = output?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    serde_json::from_slice::<VisionResult>(&output.stdout)
        .map_err(|error| format!("Invalid Apple Vision response: {error}"))
}

#[cfg(test)]
mod tests {
    use super::analyze_data_url;
    #[test]
    fn rejects_invalid_data_url() {
        assert!(analyze_data_url("not-an-image").is_err());
    }
}

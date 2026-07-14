package com.wolfe.vaultcollector;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.util.Locale;

@CapacitorPlugin(name = "VaultVision")
public class VaultVisionPlugin extends Plugin {
    @PluginMethod
    public void analyze(PluginCall call) {
        JSArray images = call.getArray("images");
        if (images == null || images.length() == 0) { call.reject("Native vision needs at least one image."); return; }
        getActivity().runOnUiThread(() -> new Thread(() -> analyzeImages(call, images)).start());
    }

    private void analyzeImages(PluginCall call, JSArray images) {
        JSArray signals = new JSArray(); JSArray barcodes = new JSArray(); JSArray warnings = new JSArray(); StringBuilder rawText = new StringBuilder();
        try {
            for (int index = 0; index < images.length(); index++) {
                JSObject source = JSObject.fromJSONObject(images.getJSONObject(index));
                String id = source.getString("id", "image-" + index);
                Bitmap bitmap = decode(source.getString("dataUrl", ""));
                InputImage image = InputImage.fromBitmap(bitmap, 0);
                try {
                    var text = Tasks.await(TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS).process(image));
                    if (!text.getText().isBlank()) { if (rawText.length() > 0) rawText.append("\n"); rawText.append(text.getText()); addKnownBrand(text.getText(), id, signals); }
                } catch (Exception error) { warnings.put("Android OCR failed: " + error.getMessage()); }
                try { for (var barcode : Tasks.await(BarcodeScanning.getClient().process(image))) if (barcode.getRawValue() != null) barcodes.put(barcode.getRawValue()); }
                catch (Exception error) { warnings.put("Android barcode scan failed: " + error.getMessage()); }
                try {
                    for (var label : Tasks.await(ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS).process(image))) {
                        if (label.getConfidence() < 0.45f) continue;
                        signals.put(signal("object", "category", normalizeCategory(label.getText()), label.getConfidence(), id, "Google ML Kit image labeling"));
                    }
                } catch (Exception error) { warnings.put("Android object classification failed: " + error.getMessage()); }
            }
            JSObject result = new JSObject(); result.put("rawText", rawText.toString()); result.put("barcodes", barcodes); result.put("signals", signals); result.put("warnings", warnings); call.resolve(result);
        } catch (Exception error) { call.reject("Unable to decode native vision image", error); }
    }

    private Bitmap decode(String dataUrl) {
        String payload = dataUrl.contains(",") ? dataUrl.substring(dataUrl.indexOf(',') + 1) : dataUrl;
        byte[] bytes = Base64.decode(payload, Base64.DEFAULT); return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
    }
    private JSObject signal(String kind, String field, String value, double confidence, String sourceId, String engine) { JSObject row = new JSObject(); row.put("kind",kind);row.put("field",field);row.put("value",value);row.put("confidence",confidence);row.put("sourceImageId",sourceId);row.put("engine",engine);return row; }
    private String normalizeCategory(String label) { String value=label.toLowerCase(Locale.US); if(value.contains("tool"))return "tools";if(value.contains("shoe")||value.contains("fashion"))return "shoes";if(value.contains("electronic")||value.contains("device"))return "electronics";if(value.contains("jewel"))return "jewelry";return value; }
    private void addKnownBrand(String text, String id, JSArray signals) { for(String brand:new String[]{"DeWalt","Milwaukee","Makita","Bosch","Ryobi","Craftsman","Apple","Samsung","Sony","Nike","Adidas","Jordan","Panini","Topps"}) if(text.toLowerCase(Locale.US).contains(brand.toLowerCase(Locale.US))) signals.put(signal("logo","brand",brand,0.68,id,"ML Kit OCR brand resolver")); }
}

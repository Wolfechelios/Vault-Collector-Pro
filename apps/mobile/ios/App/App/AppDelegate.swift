import UIKit
import Capacitor
import Vision

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

@objc(VaultVisionPlugin)
public class VaultVisionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VaultVisionPlugin"
    public let jsName = "VaultVision"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "analyze", returnType: CAPPluginReturnPromise)]

    @objc func analyze(_ call: CAPPluginCall) {
        guard let images = call.getArray("images", JSObject.self), !images.isEmpty else { call.reject("Native vision needs at least one image."); return }
        DispatchQueue.global(qos: .userInitiated).async {
            var allText: [String] = []; var barcodes: [String] = []; var signals: [JSObject] = []; var warnings: [String] = []
            for (index, source) in images.enumerated() {
                let sourceId = source["id"] as? String ?? "image-\(index)"
                guard let dataUrl = source["dataUrl"] as? String, let comma = dataUrl.firstIndex(of: ","), let data = Data(base64Encoded: String(dataUrl[dataUrl.index(after: comma)...])), let image = UIImage(data: data), let cgImage = image.cgImage else { warnings.append("Unable to decode \(sourceId)"); continue }
                let text = VNRecognizeTextRequest(); text.recognitionLevel = .accurate; text.usesLanguageCorrection = true
                let barcode = VNDetectBarcodesRequest(); let classify = VNClassifyImageRequest()
                do { try VNImageRequestHandler(cgImage: cgImage).perform([text, barcode, classify]) }
                catch { warnings.append("Apple Vision failed for \(sourceId): \(error.localizedDescription)"); continue }
                let recognized = (text.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
                if !recognized.isEmpty { allText.append(recognized); signals.append(contentsOf: self.brandSignals(recognized, sourceId)) }
                barcodes.append(contentsOf: (barcode.results ?? []).compactMap { $0.payloadStringValue })
                for observation in (classify.results ?? []).prefix(8) where observation.confidence >= 0.45 {
                    signals.append(["kind":"object","field":"category","value":self.category(observation.identifier),"confidence":Double(observation.confidence),"sourceImageId":sourceId,"engine":"Apple Vision classification"])
                }
            }
            call.resolve(["rawText":allText.joined(separator:"\n"),"barcodes":barcodes,"signals":signals,"warnings":warnings])
        }
    }

    private func category(_ label: String) -> String { let value=label.lowercased(); if value.contains("tool") { return "tools" }; if value.contains("shoe") || value.contains("fashion") { return "shoes" }; if value.contains("electronic") || value.contains("device") { return "electronics" }; if value.contains("jewel") { return "jewelry" }; return value }
    private func brandSignals(_ text: String, _ sourceId: String) -> [JSObject] { let brands=["DeWalt","Milwaukee","Makita","Bosch","Ryobi","Craftsman","Apple","Samsung","Sony","Nike","Adidas","Jordan","Panini","Topps"]; return brands.filter { text.localizedCaseInsensitiveContains($0) }.map { ["kind":"logo","field":"brand","value":$0,"confidence":0.68,"sourceImageId":sourceId,"engine":"Apple Vision OCR brand resolver"] } }
}

public class VaultBridgeViewController: CAPBridgeViewController {
    public override func capacitorDidLoad() {
        bridge?.registerPluginType(VaultVisionPlugin.self)
    }
}

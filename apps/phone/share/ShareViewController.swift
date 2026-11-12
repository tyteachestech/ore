// Ore's Share Extension (spike): a link or page shared from Safari or any app becomes one inbox item,
// `inbox/<ulid>.link.json` (packages/core/src/inbox.ts, D223), in the App Group the app reads at launch.
// No web view and no import here: Apple caps an extension's memory (~120 MB), so the app imports it.
import UIKit
import UniformTypeIdentifiers

let group = "group.com.tylerpoelking.ore"

func ulid() -> String {
  let a = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
  var t = UInt64(Date().timeIntervalSince1970 * 1000)
  var time = ""
  for _ in 0..<10 { time = String(a[Int(t % 32)]) + time; t /= 32 }
  return time + String((0..<16).map { _ in a[Int.random(in: 0..<32)] })
}

@objc(ShareViewController)
class ShareViewController: UIViewController {
  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    Task { await save(); extensionContext?.completeRequest(returningItems: nil) }
  }

  func link() async -> String? {
    let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
    for p in providers where p.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
      if let u = try? await p.loadItem(forTypeIdentifier: UTType.url.identifier) as? URL, u.scheme?.hasPrefix("http") == true { return u.absoluteString }
    }
    for p in providers where p.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
      if let s = try? await p.loadItem(forTypeIdentifier: UTType.plainText.identifier) as? String,
         let m = s.range(of: #"https?://\S+"#, options: .regularExpression) { return String(s[m]) }
    }
    return nil
  }

  /// The App Group's folder. The Simulator's build drops the App Group entitlement, so there both sides use
  /// the same folder beside their own containers instead (lib.rs `group`).
  func groupDir() -> URL? {
    if let u = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) { return u }
    #if targetEnvironment(simulator)
    return URL(fileURLWithPath: NSHomeDirectory()).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Shared/AppGroup/\(group)")
    #else
    return nil
    #endif
  }

  func save() async {
    guard let url = await link(), let root = groupDir() else { return }
    let dir = root.appendingPathComponent("inbox", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let id = ulid()
    let item: [String: Any] = ["id": id, "url": url, "skills": [], "added": ISO8601DateFormatter().string(from: Date()), "device": "iphone"]
    guard let data = try? JSONSerialization.data(withJSONObject: item, options: [.prettyPrinted, .sortedKeys]) else { return }
    try? (data + Data("\n".utf8)).write(to: dir.appendingPathComponent("\(id).link.json"), options: .atomic)
  }
}

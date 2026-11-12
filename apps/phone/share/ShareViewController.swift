// Ore's Share Extension: a link or page shared from Safari or any app becomes one inbox item,
// `inbox/<ulid>.link.json` (packages/core/src/inbox.ts, D223, D227), in Ore's iCloud folder, or in the App
// Group the app reads when it opens. A file (a PDF from Files, a photo) is copied to `inbox/<ulid>/<name>`
// with `inbox/<ulid>.file.json` written after it. It is saved the moment the card appears; the card then offers his skills to file it under,
// one tap each, under a preview of what was shared (its picture, title and site in one row, Raindrop's confirmation: the title Safari
// hands over at once, the picture when Apple's LinkPresentation has fetched it), from the top of the sheet iOS gives it, and stays until Done, a tap above it or a swipe down (closing by itself after 3 s read as a glitch, Tyler 2026-11-12).
// With no skills to offer it goes by itself.
// No web view and no import here: Apple caps an extension's memory (~120 MB), so the app imports it.
import LinkPresentation
import UIKit
import UniformTypeIdentifiers

let group = "group.com.tylerpoelking.ore"
let cloudId = "iCloud.com.tylerpoelking.ore"

func ulid() -> String {
  let a = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")
  var t = UInt64(Date().timeIntervalSince1970 * 1000)
  var time = ""
  for _ in 0..<10 { time = String(a[Int(t % 32)]) + time; t /= 32 }
  return time + String((0..<16).map { _ in a[Int.random(in: 0..<32)] })
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

/// `dots` is x, y, x, y… of the lit cells of its icon on the app's 16 grid, `color` its `#rrggbb`
/// (apps/desktop/src/phone/share-skills.ts); an older app wrote neither.
struct Skill: Decodable {
  let id: String
  let name: String
  let dots: [Int]?
  let color: String?
}

/// A skill's icon as the app draws it: one round dot per cell, 0.38 of a cell in radius (dots.ts), at 20 pt.
func dotIcon(_ dots: [Int], _ color: UIColor) -> UIImage {
  let size: CGFloat = 20
  let cell = size / 16
  return UIGraphicsImageRenderer(size: CGSize(width: size, height: size)).image { ctx in
    color.setFill()
    var i = 0
    while i + 1 < dots.count {
      let x = (CGFloat(dots[i]) + 0.5) * cell, y = (CGFloat(dots[i + 1]) + 0.5) * cell, r = 0.38 * cell
      ctx.cgContext.fillEllipse(in: CGRect(x: x - r, y: y - r, width: 2 * r, height: 2 * r))
      i += 2
    }
  }.withRenderingMode(.alwaysOriginal)
}

func hexColor(_ hex: String?) -> UIColor? {
  guard let hex, hex.count == 7, hex.hasPrefix("#"), let v = UInt32(hex.dropFirst(), radix: 16) else { return nil }
  return UIColor(red: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
}

@objc(ShareViewController)
class ShareViewController: UIViewController {
  private var file: URL?
  private var item: [String: Any] = [:]
  private var picked: [String] = []
  private var closing: DispatchWorkItem?
  private let card = UIView()
  private let titleLabel = UILabel()
  private let opener = UIButton(type: .system)
  private let preview = UIStackView()
  private let thumb = UIImageView()
  private let pageTitle = UILabel()
  private let site = UILabel()
  private var fetching: LPMetadataProvider?
  private let chips = UIStackView()

  private let paper = UIColor(white: 0.93, alpha: 1)
  private let muted = UIColor(white: 0.62, alpha: 1)
  private let line = UIColor(white: 0.24, alpha: 1)

  override func viewDidLoad() {
    super.viewDidLoad()
    // iOS shows a share extension in its own sheet, so a see-through view left the sheet's grey above the card
    view.backgroundColor = UIColor(white: 0.11, alpha: 1)
    view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(outside(_:))))
    // A swipe down anywhere closes it, as Done does (the sheet's own swipe can spring back).
    let down = UISwipeGestureRecognizer(target: self, action: #selector(finish))
    down.direction = .down
    view.addGestureRecognizer(down)

    card.backgroundColor = UIColor(white: 0.11, alpha: 1)
    card.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(card)

    titleLabel.font = .preferredFont(forTextStyle: .headline)
    titleLabel.adjustsFontForContentSizeCategory = true
    titleLabel.numberOfLines = 0
    titleLabel.textColor = paper
    titleLabel.text = "Adding to Ore…"

    let done = UIButton(type: .system)
    done.setTitle("Done", for: .normal)
    done.titleLabel?.font = .preferredFont(forTextStyle: .headline)
    done.titleLabel?.adjustsFontForContentSizeCategory = true
    done.tintColor = paper
    done.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
    done.widthAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
    done.addTarget(self, action: #selector(finish), for: .touchUpInside)
    done.setContentHuggingPriority(.required, for: .horizontal)

    // Open: on to the source in Ore now (ChatGPT's share goes straight to its app); Done stays in Safari.
    opener.setTitle("Open", for: .normal)
    opener.titleLabel?.font = .preferredFont(forTextStyle: .body)
    opener.titleLabel?.adjustsFontForContentSizeCategory = true
    opener.tintColor = muted
    opener.isHidden = true
    opener.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
    opener.widthAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
    opener.addTarget(self, action: #selector(openInOre), for: .touchUpInside)
    opener.setContentHuggingPriority(.required, for: .horizontal)

    let head = UIStackView(arrangedSubviews: [titleLabel, opener, done])
    head.axis = .horizontal
    head.alignment = .center
    head.spacing = 12

    chips.axis = .vertical
    chips.spacing = 8
    chips.alignment = .leading

    // What was shared, so he sees it took the right thing. Hidden until there is something to show.
    // One row of a fixed height, drawn here on the card's dark (Apple's own preview view tints itself from the
    // site's icon and waits seconds for its title): the picture arrives later without moving the chips under his thumb.
    preview.isHidden = true
    preview.axis = .horizontal
    preview.spacing = 12
    preview.alignment = .center
    thumb.isHidden = true
    thumb.contentMode = .scaleAspectFill
    thumb.clipsToBounds = true
    thumb.layer.cornerRadius = 8
    thumb.backgroundColor = line
    pageTitle.font = .preferredFont(forTextStyle: .subheadline)
    pageTitle.adjustsFontForContentSizeCategory = true
    pageTitle.textColor = paper
    pageTitle.numberOfLines = 2
    site.font = .preferredFont(forTextStyle: .footnote)
    site.adjustsFontForContentSizeCategory = true
    site.textColor = muted
    let words = UIStackView(arrangedSubviews: [pageTitle, site])
    words.axis = .vertical
    words.spacing = 2
    preview.addArrangedSubview(thumb)
    preview.addArrangedSubview(words)
    NSLayoutConstraint.activate([
      thumb.widthAnchor.constraint(equalToConstant: 64),
      thumb.heightAnchor.constraint(equalToConstant: 64),
      preview.heightAnchor.constraint(greaterThanOrEqualToConstant: 64),
    ])

    let stack = UIStackView(arrangedSubviews: [head, preview, chips])
    stack.axis = .vertical
    stack.spacing = 14
    stack.translatesAutoresizingMaskIntoConstraints = false
    card.addSubview(stack)

    NSLayoutConstraint.activate([
      card.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      card.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      // From the sheet's top, as any sheet's content: iOS sizes the sheet, so content at its foot left it mostly empty above.
      card.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
      card.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor),
      stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 10),
      stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 20),
      stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -20),
      stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -18),
      head.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
    ])
  }

  /// The view appears again when a swipe on the sheet starts to put it away and springs back: the link is
  /// saved, and the chips laid out, once.
  private var started = false

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    guard !started else { return }
    started = true
    Task { @MainActor in
      if let url = await link() {
        guard save(url) else { return fail("Open Ore once first, then share again.") }
        show(link: url)
      } else if let p = fileProvider() {
        guard await save(file: p) else { return fail("Couldn’t save that file. Open Ore once first, then share again.") }
        showFile()
      } else {
        return fail("Ore adds links and files. This isn’t one.")
      }
      titleLabel.text = "Added to Ore"
      opener.isHidden = false
      layoutChips(skills())
      // With skills to pick it stays until he closes it; with none there is nothing to do here, so it goes by itself.
      guard shown.isEmpty else { return }
      let work = DispatchWorkItem { [weak self] in self?.finish() }
      closing = work
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: work)
    }
  }

  /// The title Safari hands over with the share, and the site, at once; the page's picture, and its title if
  /// Safari gave none, when Apple's fetch has them (no page is loaded here).
  private func show(link: String) {
    guard let url = URL(string: link) else { return }
    let given = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).compactMap { $0.attributedTitle?.string ?? $0.attributedContentText?.string }
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.first { !$0.isEmpty && !$0.hasPrefix("http") }
    let host = (url.host ?? link).replacingOccurrences(of: #"^www\."#, with: "", options: .regularExpression)
    pageTitle.text = given ?? host
    site.text = given == nil ? nil : host
    site.isHidden = given == nil
    // The picture's slot shows from the start, so the title doesn't slide over when the picture comes.
    thumb.isHidden = false
    preview.isHidden = false
    let provider = LPMetadataProvider()
    provider.timeout = 10
    fetching = provider
    provider.startFetchingMetadata(for: url) { [weak self] got, _ in
      guard let got else { self?.noPicture(); return }
      let title = got.title
      DispatchQueue.main.async {
        guard let self, given == nil, let title, !title.isEmpty else { return }
        self.pageTitle.text = title
        self.site.text = host
        self.site.isHidden = false
      }
      // A page with no picture of its own shows its site's icon in the slot instead.
      self?.picture(from: got.imageProvider ?? got.iconProvider, icon: got.imageProvider == nil)
    }
  }

  private func picture(from provider: NSItemProvider?, icon: Bool = false) {
    guard let provider, provider.canLoadObject(ofClass: UIImage.self) else { return noPicture() }
    _ = provider.loadObject(ofClass: UIImage.self) { [weak self] image, _ in
      // Drawn small before it is kept: a page's picture can be thousands of pixels wide, and an extension has little memory.
      // In its own shape (its short side 192 px), so the slot crops it and never squashes it.
      guard let full = image as? UIImage, full.size.width > 0, full.size.height > 0 else { self?.noPicture(); return }
      let k = 192 / min(full.size.width, full.size.height)
      guard let small = full.preparingThumbnail(of: CGSize(width: full.size.width * k, height: full.size.height * k)) else { self?.noPicture(); return }
      DispatchQueue.main.async {
        self?.thumb.contentMode = icon ? .center : .scaleAspectFill
        self?.thumb.image = icon ? small.preparingThumbnail(of: CGSize(width: 32, height: 32)) : small
        self?.thumb.isHidden = false
      }
    }
  }

  /// Offline, or a page with neither picture nor icon: the empty slot goes, and the words take its place.
  private func noPicture() {
    DispatchQueue.main.async { [weak self] in
      guard let self, self.thumb.image == nil else { return }
      self.thumb.isHidden = true
    }
  }

  /// A shared file under its name, with the picture itself when it is one.
  private func showFile() {
    guard let file, let rel = item["file"] as? String else { return }
    let at = file.deletingLastPathComponent().appendingPathComponent(rel)
    pageTitle.text = at.lastPathComponent
    site.isHidden = true
    preview.isHidden = false
    if UTType(filenameExtension: at.pathExtension)?.conforms(to: .image) == true { picture(from: NSItemProvider(contentsOf: at)) }
  }

  private func link() async -> String? {
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

  /// The first thing shared that is a file and not a web link (a file's own URL is a file URL).
  private func fileProvider() -> NSItemProvider? {
    let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? []).flatMap { $0.attachments ?? [] }
    return providers.first { $0.hasItemConformingToTypeIdentifier(UTType.data.identifier) }
  }

  /// Ore's iCloud folder first, so the Mac sees it without the app opening; the App Group when iCloud
  /// Drive is off or the folder isn't there yet (the app moves it in when it opens, lib.rs `share_inbox`).
  private func inboxes() -> [URL] {
    var roots: [URL] = []
    if let cloud = FileManager.default.url(forUbiquityContainerIdentifier: cloudId) { roots.append(cloud.appendingPathComponent("Documents", isDirectory: true)) }
    if let g = groupDir() { roots.append(g) }
    return roots.map { $0.appendingPathComponent("inbox", isDirectory: true) }
  }

  private func stamp() -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.string(from: Date())
  }

  private func save(_ url: String) -> Bool {
    let id = ulid()
    item = ["id": id, "url": url, "skills": [String](), "added": stamp(), "device": "iphone"]
    for dir in inboxes() {
      try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      file = dir.appendingPathComponent("\(id).link.json")
      if write() { return true }
    }
    file = nil
    return false
  }

  /// The file under the name it had, then its item, so no device sees the item before the file (inbox.ts `queueFile`).
  /// Copied, never read into memory: an extension has little.
  private func save(file p: NSItemProvider) async -> Bool {
    let id = ulid()
    let dirs = inboxes()
    let saved: (dir: URL, name: String)? = await withCheckedContinuation { done in
      // The file Apple hands over is gone when this block returns, so the copy is made inside it.
      _ = p.loadFileRepresentation(forTypeIdentifier: UTType.data.identifier) { tmp, _ in
        guard let tmp else { return done.resume(returning: nil) }
        var name = tmp.lastPathComponent.replacingOccurrences(of: #"[/\\:]"#, with: "-", options: .regularExpression)
        while name.hasPrefix(".") { name.removeFirst() }
        if name.isEmpty { name = "file" }
        for dir in dirs {
          let into = dir.appendingPathComponent(id, isDirectory: true)
          do {
            try FileManager.default.createDirectory(at: into, withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: tmp, to: into.appendingPathComponent(name))
            return done.resume(returning: (dir, name))
          } catch {
            try? FileManager.default.removeItem(at: into)
          }
        }
        done.resume(returning: nil)
      }
    }
    guard let saved else { return false }
    item = ["id": id, "url": saved.name, "file": "\(id)/\(saved.name)", "skills": [String](), "added": stamp(), "device": "iphone"]
    file = saved.dir.appendingPathComponent("\(id).file.json")
    if write() { return true }
    try? FileManager.default.removeItem(at: saved.dir.appendingPathComponent(id, isDirectory: true))
    file = nil
    return false
  }

  private func write() -> Bool {
    guard let file, let data = try? JSONSerialization.data(withJSONObject: item, options: [.prettyPrinted, .sortedKeys]) else { return false }
    return (try? (data + Data("\n".utf8)).write(to: file, options: .atomic)) != nil
  }

  /// His skills in the sidebar's order, as the app last wrote them (lib.rs `share_skills`).
  private func skills() -> [Skill] {
    guard let root = groupDir(), let data = try? Data(contentsOf: root.appendingPathComponent("skills.json")) else { return [] }
    return (try? JSONDecoder().decode([Skill].self, from: data)) ?? []
  }

  /// Chips in rows that wrap to the card's width: the first dozen skills, which is two or three rows.
  private func layoutChips(_ all: [Skill]) {
    let width = view.bounds.width - 40
    var row = UIStackView()
    var used: CGFloat = 0
    func newRow() {
      row = UIStackView()
      row.axis = .horizontal
      row.spacing = 8
      chips.addArrangedSubview(row)
      used = 0
    }
    newRow()
    shown = Array(all.prefix(12))
    for (i, s) in shown.enumerated() {
      var conf = UIButton.Configuration.plain()
      conf.title = s.name
      conf.imagePadding = 6
      conf.contentInsets = NSDirectionalEdgeInsets(top: 10, leading: 14, bottom: 10, trailing: 14)
      conf.titleLineBreakMode = .byTruncatingTail
      let font = UIFontMetrics(forTextStyle: .subheadline).scaledFont(for: .systemFont(ofSize: 15, weight: .medium))
      conf.titleTextAttributesTransformer = UIConfigurationTextAttributesTransformer { a in
        var a = a
        a.font = font
        return a
      }
      let b = UIButton(configuration: conf)
      b.tag = i
      b.titleLabel?.numberOfLines = 1
      b.accessibilityTraits.insert(.button)
      b.addTarget(self, action: #selector(toggle(_:)), for: .touchUpInside)
      style(b, on: false)
      // Its own width on one line, never wider than the card; at least 44 pt each way to tap.
      let w = min(max(b.sizeThatFits(CGSize(width: CGFloat.greatestFiniteMagnitude, height: 44)).width, 44), width)
      if used > 0 && used + w > width { newRow() }
      b.widthAnchor.constraint(equalToConstant: w).isActive = true
      b.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true
      row.addArrangedSubview(b)
      used += w + 8
    }
  }
  private var shown: [Skill] = []

  private func style(_ b: UIButton, on: Bool) {
    // Drawn by the configuration, as a full pill: `isSelected` would tint it the system's blue.
    var conf = b.configuration ?? .plain()
    conf.cornerStyle = .capsule
    conf.background.backgroundColor = on ? paper : .clear
    conf.background.strokeColor = on ? paper : line
    conf.background.strokeWidth = 1
    let ink = UIColor(white: 0.07, alpha: 1)
    conf.baseForegroundColor = on ? ink : muted
    // Its icon in the skill's colour, as in the app's lists; in the chip's ink once picked, where a pastel would wash out.
    if let dots = shown[b.tag].dots, !dots.isEmpty { conf.image = dotIcon(dots, on ? ink : hexColor(shown[b.tag].color) ?? muted) }
    b.configuration = conf
    if on { b.accessibilityTraits.insert(.selected) } else { b.accessibilityTraits.remove(.selected) }
  }

  @objc private func toggle(_ b: UIButton) {
    closing?.cancel()
    let id = shown[b.tag].id
    if let at = picked.firstIndex(of: id) { picked.remove(at: at) } else { picked.append(id) }
    style(b, on: picked.contains(id))
    item["skills"] = picked
    _ = write()
    UISelectionFeedbackGenerator().selectionChanged()
  }

  @objc private func outside(_ g: UITapGestureRecognizer) {
    if card.frame.contains(g.location(in: view)) { closing?.cancel() } else { finish() }
  }

  private func fail(_ why: String) {
    titleLabel.text = why
    titleLabel.numberOfLines = 0
  }

  /// Leaves the item's id for the app (lib.rs `share_open`) and brings Ore forward, which imports it and opens it.
  /// Apple gives a share extension no call for opening its app: this walks up to the host's UIApplication, as
  /// other apps' share extensions do, so an iOS update may stop it. Then the card just closes, as Done.
  @objc private func openInOre() {
    if let id = item["id"] as? String, let root = groupDir(), let url = URL(string: "ore://open") {
      try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
      try? Data(id.utf8).write(to: root.appendingPathComponent("open"), options: .atomic)
      var next: UIResponder? = self
      while let r = next {
        if let app = r as? UIApplication {
          app.open(url, options: [:], completionHandler: nil)
          break
        }
        next = r.next
      }
    }
    finish()
  }

  @objc private func finish() {
    closing?.cancel()
    fetching?.cancel()
    extensionContext?.completeRequest(returningItems: nil)
  }
}

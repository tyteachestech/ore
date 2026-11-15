// Text recognition for scanned PDFs and images (D96 phase 3), with Apple's Vision framework, on
// the Mac. Usage: ocr <file.pdf|image>. Prints JSON: {"pages":[{"lines":[{"t","x","y","w","h"}]}]},
// boxes as fractions of the page with y from the top. Compiled on first use by `ocr.ts`.
import AppKit
import Foundation
import PDFKit
import Vision

struct Line: Encodable { let t: String; let x, y, w, h: Double }
struct Page: Encodable { let lines: [Line] }
struct Out: Encodable { let pages: [Page] }

func fail(_ msg: String) -> Never {
  FileHandle.standardError.write((msg + "\n").data(using: .utf8)!)
  exit(1)
}

func recognize(_ image: CGImage) -> [Line] {
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = .accurate
  request.usesLanguageCorrection = true
  if #available(macOS 13.0, *) { request.automaticallyDetectsLanguage = true }
  do { try VNImageRequestHandler(cgImage: image).perform([request]) } catch { return [] }
  return (request.results ?? []).compactMap { o in
    guard let c = o.topCandidates(1).first else { return nil }
    let b = o.boundingBox
    return Line(t: c.string, x: b.minX, y: 1 - b.maxY, w: b.width, h: b.height)
  }
}

// Vision reads an image scaled down to a size of its own, so the words in a very tall or very wide one
// (a full-page capture, 900×10,000) come out too small to read (F188). Such an image is read in bands
// along its long side, each twice as long as the short side (at least 2,048 px), each starting half a
// band after the last; a line is kept from the band whose middle half holds its centre, so a line cut
// by one band's edge is read whole in the next. Two bands can place the same line a few pixels apart,
// so each middle half reaches a little past its edges and a line whose box mostly covers one already
// kept is the same line read twice: neither lost nor doubled on a boundary.
func same(_ a: Line, _ b: Line) -> Bool {
  let iw = min(a.x + a.w, b.x + b.w) - max(a.x, b.x), ih = min(a.y + a.h, b.y + b.h) - max(a.y, b.y)
  return iw > 0 && ih > 0 && iw * ih > 0.5 * min(a.w * a.h, b.w * b.h)
}

func lines(_ image: CGImage) -> [Line] {
  let w = Double(image.width), h = Double(image.height)
  let long = max(w, h), short = min(w, h)
  guard long > 4096, long / short > 2 else { return recognize(image) }
  let tall = h >= w
  let band = max(short * 2, 2048)
  var out: [Line] = []
  var start = 0.0
  while true {
    let end = min(start + band, long)
    let rect = tall ? CGRect(x: 0, y: start, width: w, height: end - start) : CGRect(x: start, y: 0, width: end - start, height: h)
    // A band that can't be cut out: the whole image in one pass, never part of its text.
    guard let tile = image.cropping(to: rect.integral) else { return recognize(image) }
    let margin = band / 16
    let lo = start == 0 ? 0 : start + band / 4 - margin
    let hi = end >= long ? long + 1 : start + band * 3 / 4 + margin
    let size = end - start
    for l in recognize(tile) {
      // Back to fractions of the whole image, y still from the top.
      let line = tall
        ? Line(t: l.t, x: l.x, y: (start + l.y * size) / h, w: l.w, h: l.h * size / h)
        : Line(t: l.t, x: (start + l.x * size) / w, y: l.y, w: l.w * size / w, h: l.h)
      let centre = tall ? (line.y + line.h / 2) * h : (line.x + line.w / 2) * w
      if centre >= lo && centre < hi && !out.contains(where: { same($0, line) }) { out.append(line) }
    }
    if end >= long { break }
    start += band / 2
  }
  return out
}

guard CommandLine.arguments.count == 2 else { fail("usage: ocr <file>") }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
var pages: [Page] = []
if url.pathExtension.lowercased() == "pdf" {
  guard let doc = PDFDocument(url: url) else { fail("can't open the PDF") }
  for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    // About 2,000 px across: small print stays legible without slowing a long scan down.
    let box = page.bounds(for: .mediaBox)
    let scale = 2000 / max(box.width, 1)
    let thumb = page.thumbnail(of: CGSize(width: box.width * scale, height: box.height * scale), for: .mediaBox)
    guard let cg = thumb.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    pages.append(Page(lines: lines(cg)))
  }
} else {
  guard let image = NSImage(contentsOf: url), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fail("can't open the image") }
  pages.append(Page(lines: lines(cg)))
}
FileHandle.standardOutput.write(try! JSONEncoder().encode(Out(pages: pages)))

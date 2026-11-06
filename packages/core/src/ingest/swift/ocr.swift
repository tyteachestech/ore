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
    pages.append(Page(lines: recognize(cg)))
  }
} else {
  guard let image = NSImage(contentsOf: url), let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { fail("can't open the image") }
  pages.append(Page(lines: recognize(cg)))
}
FileHandle.standardOutput.write(try! JSONEncoder().encode(Out(pages: pages)))

// Speech to text for audio files and podcast episodes (D96 phase 3), on the Mac, with Apple's
// on-device SpeechAnalyzer (macOS 26). Usage: transcribe <audio file>. Prints WebVTT; on stderr,
// `progress <0..1>` lines while it works. Exits 3 on an older macOS. Compiled on first use by `audio.ts`.
import AVFoundation
import CoreMedia
import Foundation
import Speech

func err(_ s: String) { FileHandle.standardError.write((s + "\n").data(using: .utf8)!) }
func fail(_ s: String, _ code: Int32 = 1) -> Never {
  err(s)
  exit(code)
}

func stamp(_ t: Double) -> String {
  let ms = Int((t * 1000).rounded())
  return String(format: "%02d:%02d:%02d.%03d", ms / 3_600_000, ms / 60000 % 60, ms / 1000 % 60, ms % 1000)
}

guard CommandLine.arguments.count == 2 else { fail("usage: transcribe <audio file>") }
guard #available(macOS 26.0, *) else { fail("Transcription needs macOS 26 or later.", 3) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
do {
  guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: Locale.current) else {
    fail("No speech model for \(Locale.current.identifier).")
  }
  let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: [.audioTimeRange])
  if let install = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
    err("status Downloading the speech model (once)…")
    try await install.downloadAndInstall()
  }
  let analyzer = SpeechAnalyzer(modules: [transcriber])
  let file = try AVAudioFile(forReading: url)
  let duration = max(Double(file.length) / file.processingFormat.sampleRate, 1)
  let collect = Task { () throws -> [(Double, Double, String)] in
    var cues: [(Double, Double, String)] = []
    for try await r in transcriber.results {
      let text = String(r.text.characters).trimmingCharacters(in: .whitespacesAndNewlines)
      if text.isEmpty { continue }
      cues.append((r.range.start.seconds, r.range.end.seconds, text))
      err("progress \(min(r.range.end.seconds / duration, 1))")
    }
    return cues
  }
  if let last = try await analyzer.analyzeSequence(from: file) {
    try await analyzer.finalizeAndFinish(through: last)
  } else {
    await analyzer.cancelAndFinishNow()
  }
  var vtt = "WEBVTT\n\n"
  for (start, end, text) in try await collect.value { vtt += "\(stamp(start)) --> \(stamp(end))\n\(text)\n\n" }
  FileHandle.standardOutput.write(vtt.data(using: .utf8)!)
} catch {
  fail("\(error.localizedDescription)")
}

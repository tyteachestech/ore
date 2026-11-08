// Speech to text for audio files and podcast episodes (D96 phase 3), on the Mac, with Apple's
// on-device SpeechAnalyzer (macOS 26). Usage: transcribe <audio or video file> [language]; with no
// language, the one the file's sound is tagged with, else the Mac's. Prints
// WebVTT; on stderr, `progress <0..1>` and `status <line>` lines while it works. Exits 3 on an older
// macOS, 4 when there is no speech model for the language. A video (or audio AVAudioFile can't open)
// is first exported to an m4a of its sound. Compiled on first use by `audio.ts`.
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

/** The file itself when AVAudioFile reads it, else its sound exported to a temporary m4a. */
@available(macOS 26.0, *)
func soundOf(_ url: URL) async throws -> (URL, Bool) {
  if (try? AVAudioFile(forReading: url)) != nil { return (url, false) }
  let asset = AVURLAsset(url: url)
  guard try await !asset.loadTracks(withMediaType: .audio).isEmpty else { fail("that file has no sound") }
  guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else { fail("can’t read the sound in that file") }
  let out = FileManager.default.temporaryDirectory.appendingPathComponent("ore-sound-\(UUID().uuidString).m4a")
  err("status Reading the video’s sound…")
  try await export.export(to: out, as: .m4a)
  return (out, true)
}

/** The language a file's sound is tagged with ("spa", "es-MX"), if any: a recording made on a Spanish
 *  Mac, or a downloaded course, says what it speaks. */
func taggedLanguage(_ url: URL) async -> Locale? {
  guard let track = try? await AVURLAsset(url: url).loadTracks(withMediaType: .audio).first else { return nil }
  let tag = (try? await track.load(.extendedLanguageTag)) ?? nil
  let code = (try? await track.load(.languageCode)) ?? nil
  guard let id = tag ?? code, !id.isEmpty, id != "und" else { return nil }
  return Locale(identifier: Locale.canonicalLanguageIdentifier(from: id))
}

let args = CommandLine.arguments
guard args.count == 2 || args.count == 3 else { fail("usage: transcribe <audio or video file> [language]") }
guard #available(macOS 26.0, *) else { fail("Transcription needs macOS 26 or later.", 3) }
var wanted = args.count == 3 ? Locale(identifier: args[2]) : await taggedLanguage(URL(fileURLWithPath: args[1])) ?? Locale.current
// Speech in the Mac's own language is heard with its own dialect's model, already downloaded.
if wanted.language.languageCode == Locale.current.language.languageCode { wanted = Locale.current }
do {
  guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: wanted) else {
    fail("No speech model for \(wanted.identifier).", 4)
  }
  let (url, temporary) = try await soundOf(URL(fileURLWithPath: args[1]))
  defer { if temporary { try? FileManager.default.removeItem(at: url) } }
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

// Speech to text on the iPhone (D96, the phone's half of packages/core/src/ingest/swift/transcribe.swift):
// Apple's on-device SpeechAnalyzer and SpeechTranscriber (iOS 26), called from the Rust shell (src-tauri/src/
// lib.rs `transcribe`) through two C functions. It gives WebVTT in the Mac helper's cue format, or why not
// in the phone's own words.
import AVFoundation
import Foundation
import Speech
import UIKit

private func stamp(_ t: Double) -> String {
  let ms = Int((t * 1000).rounded())
  return String(format: "%02d:%02d:%02d.%03d", ms / 3_600_000, ms / 60000 % 60, ms / 1000 % 60, ms % 1000)
}

/// Whether this iPhone can hear speech at all: iOS 26 and Apple's speech model on this device (the
/// Simulator has none). Whether it has a model for a given language is only known by trying.
@_cdecl("ore_can_transcribe")
public func oreCanTranscribe() -> Bool {
  if #available(iOS 26.0, *) { return SpeechTranscriber.isAvailable }
  return false
}

@available(iOS 26.0, *)
private func hear(_ url: URL, _ language: String?) async -> (Bool, String) {
  let wanted = language.map { Locale(identifier: $0) } ?? Locale.current
  guard let locale = await SpeechTranscriber.supportedLocale(equivalentTo: wanted) else {
    let name = Locale.current.localizedString(forLanguageCode: wanted.language.languageCode?.identifier ?? "") ?? wanted.identifier
    return (false, "This iPhone has no speech model for \(name) yet.")
  }
  let transcriber = SpeechTranscriber(locale: locale, transcriptionOptions: [], reportingOptions: [], attributeOptions: [.audioTimeRange])
  do {
    if let install = try await AssetInventory.assetInstallationRequest(supporting: [transcriber]) {
      do { try await install.downloadAndInstall() } catch { return (false, "Couldn’t download the speech model. Check your connection and try again.") }
    }
    let file: AVAudioFile
    do { file = try AVAudioFile(forReading: url) } catch { return (false, "Can’t read the sound in that file.") }
    let analyzer = SpeechAnalyzer(modules: [transcriber])
    let collect = Task { () throws -> [(Double, Double, String)] in
      var cues: [(Double, Double, String)] = []
      for try await r in transcriber.results {
        let text = String(r.text.characters).trimmingCharacters(in: .whitespacesAndNewlines)
        if !text.isEmpty { cues.append((r.range.start.seconds, r.range.end.seconds, text)) }
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
    return (true, vtt)
  } catch {
    return (false, "Couldn’t hear that audio: \(error.localizedDescription)")
  }
}

/// The audio file at `path` as WebVTT (`ok` true), or why not (`ok` false). Blocks until done: the shell
/// calls it off the main thread. The string is malloc'd; the caller frees it with `free`.
@_cdecl("ore_transcribe")
public func oreTranscribe(_ path: UnsafePointer<CChar>, _ language: UnsafePointer<CChar>?, _ ok: UnsafeMutablePointer<Bool>) -> UnsafeMutablePointer<CChar>? {
  let url = URL(fileURLWithPath: String(cString: path))
  let lang = language.map { String(cString: $0) }.flatMap { $0.isEmpty ? nil : $0 }
  var result = (false, "Hearing speech needs iOS 26 or later.")
  if #available(iOS 26.0, *) {
    // A little time to finish if he leaves the app mid-way; iOS pauses the rest until he's back.
    var task = UIBackgroundTaskIdentifier.invalid
    DispatchQueue.main.sync { task = UIApplication.shared.beginBackgroundTask(withName: "Hearing audio") { UIApplication.shared.endBackgroundTask(task) } }
    let done = DispatchSemaphore(value: 0)
    Task.detached {
      result = await hear(url, lang)
      done.signal()
    }
    done.wait()
    DispatchQueue.main.async { if task != .invalid { UIApplication.shared.endBackgroundTask(task) } }
  }
  ok.pointee = result.0
  return strdup(result.1)
}

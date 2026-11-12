import XCTest

// Plays commands from a folder on the installed Ore app as real touches, so an agent can use the
// phone app the way a person does. The folder is ORE_SIM_DIR (passed as TEST_RUNNER_ORE_SIM_DIR):
// the client writes cmd.json ({"seq": n, "op": ..., ...}); the driver answers in out.json with the
// same seq, and saves a screenshot after every action. Points are iPhone points from the top left.
final class Driver: XCTestCase {
  let dir = ProcessInfo.processInfo.environment["ORE_SIM_DIR"] ?? "/tmp/ore-sim"
  let bundle = ProcessInfo.processInfo.environment["ORE_SIM_BUNDLE"] ?? "com.tylerpoelking.ore.phone"

  func testDrive() throws {
    continueAfterFailure = true
    let app = XCUIApplication(bundleIdentifier: bundle)
    let fm = FileManager.default
    try? fm.createDirectory(atPath: dir + "/shots", withIntermediateDirectories: true)
    var last = -1
    var idleSince = Date()
    write(["ready": true, "seq": -1])
    while Date().timeIntervalSince(idleSince) < 1800 {
      guard let data = fm.contents(atPath: dir + "/cmd.json"),
            let cmd = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let seq = cmd["seq"] as? Int, seq > last else {
        Thread.sleep(forTimeInterval: 0.05)
        continue
      }
      last = seq
      idleSince = Date()
      let op = cmd["op"] as? String ?? ""
      if op == "stop" { write(["seq": seq, "ok": true]); return }
      var out: [String: Any] = ["seq": seq, "ok": true]
      do {
        try run(op, cmd, app, &out)
      } catch {
        out["ok"] = false
        out["error"] = "\(error)"
      }
      if op != "shot" && op != "tree" {
        Thread.sleep(forTimeInterval: (cmd["settle"] as? Double) ?? 0.4)
        let path = "\(dir)/shots/\(seq).png"
        fm.createFile(atPath: path, contents: XCUIScreen.main.screenshot().pngRepresentation)
        out["shot"] = path
      }
      write(out)
    }
  }

  struct Bad: Error, CustomStringConvertible { let description: String }

  func num(_ cmd: [String: Any], _ key: String, _ fallback: Double? = nil) throws -> Double {
    if let n = cmd[key] as? Double { return n }
    if let n = cmd[key] as? Int { return Double(n) }
    if let f = fallback { return f }
    throw Bad(description: "missing \(key)")
  }

  func point(_ app: XCUIApplication, _ x: Double, _ y: Double) -> XCUICoordinate {
    app.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: x, dy: y))
  }

  func run(_ op: String, _ cmd: [String: Any], _ app: XCUIApplication, _ out: inout [String: Any]) throws {
    switch op {
    case "launch":
      app.terminate()
      app.launch()
    case "activate":
      app.activate()
    case "terminate":
      app.terminate()
    case "home":
      XCUIDevice.shared.press(.home)
    case "tap":
      point(app, try num(cmd, "x"), try num(cmd, "y")).tap()
    case "doubletap":
      point(app, try num(cmd, "x"), try num(cmd, "y")).doubleTap()
    case "longpress":
      point(app, try num(cmd, "x"), try num(cmd, "y")).press(forDuration: try num(cmd, "secs", 0.8))
    case "drag", "swipe":
      let from = point(app, try num(cmd, "x"), try num(cmd, "y"))
      let to = point(app, try num(cmd, "x2"), try num(cmd, "y2"))
      let hold = try num(cmd, "hold", op == "drag" ? 0.5 : 0.02)
      let dx = try num(cmd, "x2") - num(cmd, "x"), dy = try num(cmd, "y2") - num(cmd, "y")
      let secs = try num(cmd, "secs", 0.25)
      let speed = max(50, (dx * dx + dy * dy).squareRoot() / secs)
      from.press(forDuration: hold, thenDragTo: to, withVelocity: XCUIGestureVelocity(speed), thenHoldForDuration: 0.05)
    case "type":
      app.typeText(cmd["text"] as? String ?? "")
    case "key":
      let keys: [String: String] = [
        "return": "\n", "delete": XCUIKeyboardKey.delete.rawValue, "tab": "\t",
      ]
      guard let k = keys[cmd["key"] as? String ?? ""] else { throw Bad(description: "unknown key") }
      app.typeText(k)
    case "rotate":
      XCUIDevice.shared.orientation = (cmd["to"] as? String) == "landscape" ? .landscapeLeft : .portrait
    case "wait":
      Thread.sleep(forTimeInterval: try num(cmd, "secs", 1))
    case "shot":
      let path = "\(dir)/shots/\(cmd["seq"] as? Int ?? 0).png"
      FileManager.default.createFile(atPath: path, contents: XCUIScreen.main.screenshot().pngRepresentation)
      out["shot"] = path
    case "tree":
      // What a screen reader sees: every element's type, label and frame in points.
      let path = "\(dir)/tree.txt"
      try app.debugDescription.write(toFile: path, atomically: true, encoding: .utf8)
      out["tree"] = path
    default:
      throw Bad(description: "unknown op \(op)")
    }
  }

  func write(_ obj: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: obj) else { return }
    let tmp = dir + "/out.tmp"
    FileManager.default.createFile(atPath: tmp, contents: data)
    rename(tmp, dir + "/out.json")
  }
}

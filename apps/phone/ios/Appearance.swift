// The reading page's Auto (D299). Ore's window is held dark (tauri.conf.json "theme"), so the
// web view always sees Dark; the screen's own traits still say which mode the iPhone is in. And the status bar's
// text follows the window's style, so a light reading page sets the window light while it shows, for a dark clock.
import UIKit

private func onMain<T>(_ f: () -> T) -> T { Thread.isMainThread ? f() : DispatchQueue.main.sync(execute: f) }

@_cdecl("ore_system_dark")
public func oreSystemDark() -> Bool {
  onMain {
    let screen = UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.screen }.first
    return (screen?.traitCollection.userInterfaceStyle ?? .dark) != .light
  }
}

@_cdecl("ore_light_bars")
public func oreLightBars(_ light: Bool) {
  DispatchQueue.main.async {
    for case let scene as UIWindowScene in UIApplication.shared.connectedScenes {
      for window in scene.windows { window.overrideUserInterfaceStyle = light ? .light : .dark }
    }
  }
}

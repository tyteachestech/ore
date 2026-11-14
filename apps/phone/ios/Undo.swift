// The iPhone's undo gestures for the app's own history (F161, Tyler 2026-11-14: "for iOS use shake and 3 finger
// swipe"): shake to undo (UIKit's "Undo …" alert, with Redo), and a three-finger swipe left to undo and right to
// redo. UIKit sends both to the first responder's undo manager, which in a web view is WKContentView's, and that
// one only holds the page's typing. So WKContentView answers with `AppUndo`, which mirrors the window's history
// (apps/desktop/src/phone/native-undo.ts tells it the next step each way through lib.rs `undo_state`) and runs a
// step by calling back into the page. While he types in a field that has its own typing to undo, the field's
// manager answers instead, as ⌘Z does there (`ownsUndo`).
import ObjectiveC
import UIKit
import WebKit

final class AppUndo: UndoManager {
  var undoName: String?
  var redoName: String?
  weak var web: WKWebView?

  override var canUndo: Bool { undoName != nil }
  override var canRedo: Bool { redoName != nil }
  override var undoActionName: String { undoName ?? "" }
  override var redoActionName: String { redoName ?? "" }
  override func undo() { web?.evaluateJavaScript("window.__oreUndo && window.__oreUndo()", completionHandler: nil) }
  override func redo() { web?.evaluateJavaScript("window.__oreRedo && window.__oreRedo()", completionHandler: nil) }
}

private let app = AppUndo()
/// Focus is in a text field or the note editor.
private var inField = false
private var installed = false
private var theirUndo: IMP?
private var theirEditing: IMP?

private func webView(of view: AnyObject) -> WKWebView? {
  var v = (view as? UIView)?.superview
  while let s = v {
    if let w = s as? WKWebView { return w }
    v = s.superview
  }
  return nil
}

/// Puts `block` in place of `cls`'s own `sel` (added there when it only inherits it, so UIResponder itself is
/// never changed) and returns what answered before.
private func replace(_ cls: AnyClass, _ sel: Selector, _ block: Any) -> IMP? {
  guard let m = class_getInstanceMethod(cls, sel) else { return nil }
  let imp = imp_implementationWithBlock(block)
  let before = method_getImplementation(m)
  if class_addMethod(cls, sel, imp, method_getTypeEncoding(m)) { return before }
  return method_setImplementation(m, imp)
}

private func install() {
  guard !installed, let cls = NSClassFromString("WKContentView") else { return }
  installed = true
  typealias UndoGetter = @convention(c) (AnyObject, Selector) -> UndoManager?
  let undoSel = #selector(getter: UIResponder.undoManager)
  let undo: @convention(block) (AnyObject) -> UndoManager? = { this in
    let theirs = theirUndo.map { unsafeBitCast($0, to: UndoGetter.self)(this, undoSel) } ?? nil
    if inField, let t = theirs, t.canUndo || t.canRedo { return t }
    if app.web == nil { app.web = webView(of: this) }
    return app
  }
  theirUndo = replace(cls, undoSel, undo)
  // The three-finger gestures only run where editing is on: away from a field, they still undo the app's steps.
  typealias EditingGetter = @convention(c) (AnyObject, Selector) -> UIEditingInteractionConfiguration
  let editingSel = #selector(getter: UIResponder.editingInteractionConfiguration)
  let editing: @convention(block) (AnyObject) -> UIEditingInteractionConfiguration = { this in
    if inField, let f = theirEditing { return unsafeBitCast(f, to: EditingGetter.self)(this, editingSel) }
    return .default
  }
  theirEditing = replace(cls, editingSel, editing)
}

/// What Undo and Redo would do now (nil: nothing), and whether focus is in a field; from lib.rs `undo_state`.
@_cdecl("ore_undo_state")
public func oreUndoState(_ undo: UnsafePointer<CChar>?, _ redo: UnsafePointer<CChar>?, _ field: Bool) {
  let u = undo.map { String(cString: $0) }
  let r = redo.map { String(cString: $0) }
  DispatchQueue.main.async {
    install()
    app.undoName = u
    app.redoName = r
    inField = field
  }
}

fn main() {
    // The app's Swift (apps/phone/ios: Hear.swift, Undo.swift) defines ore_transcribe, ore_can_transcribe and ore_undo_state; they exist
    // only once Xcode links the app, so the iOS dynamic library (built alongside the static one) leaves them open.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("ios") {
        println!("cargo:rustc-cdylib-link-arg=-Wl,-U,_ore_transcribe");
        println!("cargo:rustc-cdylib-link-arg=-Wl,-U,_ore_can_transcribe");
        println!("cargo:rustc-cdylib-link-arg=-Wl,-U,_ore_undo_state");
    }
    tauri_build::build()
}

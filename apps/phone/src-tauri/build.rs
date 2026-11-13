fn main() {
    // The app's Swift (apps/phone/ios/Hear.swift) defines ore_transcribe and ore_can_transcribe; they exist
    // only once Xcode links the app, so the iOS dynamic library (built alongside the static one) leaves them open.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("ios") {
        println!("cargo:rustc-cdylib-link-arg=-Wl,-U,_ore_transcribe");
        println!("cargo:rustc-cdylib-link-arg=-Wl,-U,_ore_can_transcribe");
    }
    tauri_build::build()
}

// The iPhone app is only a web view: the core runs inside it (apps/desktop/src/phone/core.ts).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Links and "Open original" open in Safari.
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Ore");
}

// The iPhone app is a web view: the core runs inside it (apps/desktop/src/phone/core.ts). This shell
// gives it the library's files in Ore's iCloud Drive folder, which the Mac's library is (D78.6, D222).
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use base64::Engine;
use serde::Serialize;

/// What the phone loads: the text files, and a source's small picture as a data URL (as the snapshot did).
fn wanted(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    [".md", ".yaml", ".yml", ".json", ".jsonl", ".excalidraw", ".vtt"].iter().any(|e| lower.ends_with(e)) || picture(&lower).is_some()
}
fn picture(name: &str) -> Option<&'static str> {
    let (stem, ext) = name.rsplit_once('.')?;
    if stem != "thumbnail" && stem != "course-cover" {
        return None;
    }
    Some(match ext {
        "jpg" | "jpeg" => "jpeg",
        "png" => "png",
        "webp" => "webp",
        "gif" => "gif",
        _ => return None,
    })
}

/// A path the web view names inside the library, never outside it.
fn inside(root: &str, rel: &str) -> Result<PathBuf, String> {
    let p = Path::new(rel);
    if p.components().all(|c| matches!(c, Component::Normal(_))) {
        Ok(Path::new(root).join(p))
    } else {
        Err(format!("not a library path: {rel}"))
    }
}

/// "mtime:size", which tells the web view a file changed on the Mac since it last read it.
fn stamp(p: &Path) -> Option<(f64, String)> {
    let m = fs::metadata(p).ok()?;
    let ms = m.modified().ok()?.duration_since(UNIX_EPOCH).ok()?.as_millis() as f64;
    Some((ms, format!("{ms}:{}", m.len())))
}

#[derive(Serialize)]
struct Scan {
    /// [path, mtime ms, stamp] for every file the phone loads.
    files: Vec<(String, f64, String)>,
    /// Files iCloud hasn't downloaded yet; each has been asked for.
    waiting: Vec<String>,
    /// Every other file (a source's audio, PDF, images): listed, so the core sees it, but not read.
    other: Vec<String>,
}

/// Ore's folder in iCloud Drive, or None when iCloud Drive is off for Ore.
#[tauri::command]
async fn library_dir(app: tauri::AppHandle) -> Option<String> {
    use tauri::Manager;
    let dir = container()?.join("Documents");
    fs::create_dir_all(&dir).ok()?;
    // A source's saved images, audio and PDF load from the folder through the asset protocol: only this folder.
    let _ = app.asset_protocol_scope().allow_directory(&dir, true);
    Some(dir.to_string_lossy().into_owned())
}

#[tauri::command]
async fn library_scan(root: String) -> Scan {
    let mut out = Scan { files: vec![], waiting: vec![], other: vec![] };
    // Asks iCloud for the folder itself too, so new files the Mac added come down.
    download(Path::new(&root));
    walk(Path::new(&root), "", &mut out);
    out
}

fn walk(dir: &Path, rel: &str, out: &mut Scan) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        let path = e.path();
        let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
        // A file iCloud hasn't downloaded shows as ".<name>.icloud": ask for it.
        if !is_dir && name.starts_with('.') && name.ends_with(".icloud") {
            let real = &name[1..name.len() - ".icloud".len()];
            if wanted(real) {
                download(&dir.join(real));
                out.waiting.push(if rel.is_empty() { real.to_string() } else { format!("{rel}/{real}") });
            }
            continue;
        }
        // Dot folders are per device (.index, .ore, .git: the Mac keeps them out of iCloud).
        if name.starts_with('.') {
            continue;
        }
        let r = if rel.is_empty() { name.clone() } else { format!("{rel}/{name}") };
        if is_dir {
            walk(&path, &r, out);
        } else if wanted(&name) {
            if let Some((ms, s)) = stamp(&path) {
                out.files.push((r, ms, s));
            }
        } else {
            out.other.push(r);
        }
    }
}

/// Each file's text (a picture as a data URL), or None if it went away.
#[tauri::command]
async fn library_read(root: String, paths: Vec<String>) -> Vec<Option<String>> {
    paths
        .iter()
        .map(|rel| {
            let p = inside(&root, rel).ok()?;
            let name = p.file_name()?.to_string_lossy().to_ascii_lowercase();
            match picture(&name) {
                Some(kind) => Some(format!("data:image/{kind};base64,{}", base64::engine::general_purpose::STANDARD.encode(fs::read(&p).ok()?))),
                None => fs::read_to_string(&p).ok(),
            }
        })
        .collect()
}

/// A write lands whole: written beside the app, then moved in (straight in when the move can't be made).
fn land(p: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(d) = p.parent() {
        fs::create_dir_all(d)?;
    }
    let tmp = std::env::temp_dir().join(format!("ore-{}", std::process::id()));
    if fs::write(&tmp, bytes).and_then(|_| fs::rename(&tmp, p)).is_err() {
        fs::write(p, bytes)?;
    }
    Ok(())
}

/// A header's value as the web view percent-encoded it (a header holds ASCII only; a path need not be).
fn unpercent(s: &str) -> Option<String> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' {
            out.push(u8::from_str_radix(s.get(i + 1..i + 3)?, 16).ok()?);
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

/// One binary file (a source's audio, PDF or picture) written from the request's raw bytes, its place in
/// the `x-root` and `x-path` headers: as text in `library_apply` an hour's audio cost several times its size.
/// Returns its new stamp, as `library_apply` does.
#[tauri::command]
async fn library_write(request: tauri::ipc::Request<'_>) -> Result<(String, f64, String), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("no bytes came with that write".into()) };
    let header = |k: &str| request.headers().get(k).and_then(|v| v.to_str().ok()).and_then(unpercent).ok_or(format!("library_write: no {k}"));
    let (root, rel) = (header("x-root")?, header("x-path")?);
    let p = inside(&root, &rel)?;
    land(&p, bytes).map_err(|e| format!("{rel}: {e}"))?;
    let (ms, s) = stamp(&p).ok_or(format!("{rel}: written, but can’t be read back"))?;
    Ok((rel, ms, s))
}

/// Writes (text, or base64 for a picture) and deletes (None; a folder goes whole) in order; returns
/// each written file's new stamp. A write lands whole: written beside the app, then moved in.
#[tauri::command]
async fn library_apply(root: String, ops: Vec<(String, Option<String>, bool)>) -> Result<Vec<(String, f64, String)>, String> {
    let mut stamps = vec![];
    for (rel, text, b64) in ops {
        let p = inside(&root, &rel)?;
        let fail = |e: std::io::Error| format!("{rel}: {e}");
        match text {
            Some(t) => {
                let bytes = if b64 { base64::engine::general_purpose::STANDARD.decode(t).map_err(|e| format!("{rel}: {e}"))? } else { t.into_bytes() };
                land(&p, &bytes).map_err(fail)?;
                if let Some((ms, s)) = stamp(&p) {
                    stamps.push((rel, ms, s));
                }
            }
            None => {
                let gone = if p.is_dir() { fs::remove_dir_all(&p) } else { fs::remove_file(&p) };
                match gone {
                    Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(fail(e)),
                    _ => {}
                }
                // A folder emptied by the delete goes too (a source's folder), as on the Mac.
                let mut d = p.parent();
                while let Some(dir) = d {
                    if dir == Path::new(&root) || fs::remove_dir(dir).is_err() {
                        break;
                    }
                    d = dir.parent();
                }
            }
        }
    }
    Ok(stamps)
}

#[derive(Serialize)]
struct Fetched {
    status: u16,
    url: String,
    headers: Vec<(String, String)>,
}

/// Fetches another site for an import, as the Mac's fetch would: redirects followed, the final URL and
/// every status (a 404 too) handed back. The answer is raw bytes, never base64 text (an hour's podcast
/// as text cost the web view eleven times its size): four bytes of length, that much JSON (`Fetched`),
/// then the body.
#[tauri::command]
async fn http_fetch(url: String, method: Option<String>, headers: Vec<(String, String)>) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // A connect limit and a quiet-line limit, not one for the whole download: an hour's podcast is 60 to
        // 100 MB, which a slow line takes minutes over while still moving.
        let agent = ureq::AgentBuilder::new().timeout_connect(std::time::Duration::from_secs(20)).timeout_read(std::time::Duration::from_secs(60)).build();
        let mut req = agent.request(method.as_deref().unwrap_or("GET"), &url);
        for (k, v) in &headers {
            req = req.set(k, v);
        }
        let res = match req.call() {
            Ok(r) => r,
            Err(ureq::Error::Status(_, r)) => r,
            Err(e) => return Err(e.to_string()),
        };
        let status = res.status();
        let final_url = res.get_url().to_string();
        let headers = res.headers_names().into_iter().filter_map(|n| res.header(&n).map(|v| (n.clone(), v.to_string()))).collect();
        let of = res.header("content-length").and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0);
        let head = serde_json::to_vec(&Fetched { status, url: final_url, headers }).map_err(|e| e.to_string())?;
        let mut out = (head.len() as u32).to_be_bytes().to_vec();
        out.extend_from_slice(&head);
        // Read in pieces, so a long download (an episode's audio) says how far it is, every megabyte.
        let mut reader = std::io::Read::take(res.into_reader(), 200 << 20);
        let mut buf = vec![0u8; 256 << 10];
        let (mut got, mut told) = (0usize, 0usize);
        loop {
            let n = std::io::Read::read(&mut reader, &mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            out.extend_from_slice(&buf[..n]);
            got += n;
            if of > 0.0 && got - told >= 1 << 20 {
                told = got;
                progress("download-progress", got as f64, of);
            }
        }
        Ok(tauri::ipc::Response::new(out))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// The app, for the progress of a long wait: set once at start.
static APP: std::sync::OnceLock<tauri::AppHandle> = std::sync::OnceLock::new();

/// How far a long wait is, to the web view as an event: `download-progress` in bytes, `hear-progress` in
/// seconds of audio, each as [done, of]. The app shows it where the source will be (Filling.tsx).
fn progress(event: &str, done: f64, of: f64) {
    use tauri::Emitter;
    if let Some(app) = APP.get() {
        let _ = app.emit(event, (done, of));
    }
}

/// Whether this iPhone hears speech itself (apps/phone/ios/Hear.swift): iOS 26 with Apple's speech model.
#[tauri::command]
fn can_transcribe() -> bool {
    #[cfg(target_os = "ios")]
    return unsafe { ore_can_transcribe() };
    #[cfg(not(target_os = "ios"))]
    false
}

/// Audio (the raw request body, its kind in `x-ext`, a language in `x-language`) to WebVTT with Apple's
/// on-device speech, or why not in the phone's words. Written to a temporary file for AVAudioFile.
#[tauri::command]
async fn transcribe(request: tauri::ipc::Request<'_>) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else { return Err("No audio came with that.".into()) };
    let header = |k: &str| request.headers().get(k).and_then(|v| v.to_str().ok()).map(str::to_string);
    let ext = header("x-ext").filter(|e| e.chars().all(|c| c.is_ascii_alphanumeric()) && !e.is_empty()).unwrap_or_else(|| "m4a".into());
    let language = header("x-language").unwrap_or_default();
    // Its own file per call: two episodes heard at once must not share one.
    static NEXT: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);
    let n = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let path = std::env::temp_dir().join(format!("ore-hear-{}-{n}.{ext}", std::process::id()));
    fs::write(&path, bytes).map_err(|_| "Couldn’t save the audio to hear it.".to_string())?;
    let run = path.clone();
    let out = tauri::async_runtime::spawn_blocking(move || hear(&run, &language)).await;
    let _ = fs::remove_file(&path);
    out.map_err(|e| e.to_string())?
}

#[cfg(target_os = "ios")]
extern "C" {
    fn ore_can_transcribe() -> bool;
    fn ore_transcribe(path: *const std::ffi::c_char, language: *const std::ffi::c_char, ok: *mut bool, progress: Option<extern "C" fn(f64, f64)>) -> *mut std::ffi::c_char;
    fn free(p: *mut std::ffi::c_void);
}

/// Called by Hear.swift as it goes: seconds of audio heard, of how many.
#[cfg(target_os = "ios")]
extern "C" fn heard(done: f64, of: f64) {
    progress("hear-progress", done, of);
}

#[cfg(target_os = "ios")]
fn hear(path: &Path, language: &str) -> Result<String, String> {
    let path = std::ffi::CString::new(path.to_string_lossy().as_bytes()).map_err(|e| e.to_string())?;
    let language = std::ffi::CString::new(language).map_err(|e| e.to_string())?;
    let mut ok = false;
    let out = unsafe { ore_transcribe(path.as_ptr(), language.as_ptr(), &mut ok, Some(heard)) };
    if out.is_null() {
        return Err("Couldn’t hear that audio.".into());
    }
    let text = unsafe { std::ffi::CStr::from_ptr(out) }.to_string_lossy().into_owned();
    unsafe { free(out.cast()) };
    if ok { Ok(text) } else { Err(text) }
}
#[cfg(not(target_os = "ios"))]
fn hear(_: &Path, _: &str) -> Result<String, String> {
    Err("Hearing speech needs an iPhone with iOS 26.".into())
}

/// Links the Share Extension (apps/phone/share) left in the App Group move into the library's inbox
/// (D223), where the app shows them. Returns how many came in.
#[tauri::command]
async fn share_inbox(root: String) -> usize {
    let Some(from) = group().map(|g| g.join("inbox")) else { return 0 };
    let to = Path::new(&root).join("inbox");
    let Ok(entries) = fs::read_dir(&from) else { return 0 };
    let _ = fs::create_dir_all(&to);
    let entries: Vec<_> = entries.flatten().collect();
    // A shared file's folder goes before its item, so the item never arrives without its file.
    for e in entries.iter().filter(|e| e.path().is_dir()) {
        let _ = fs::rename(e.path(), to.join(e.file_name()));
    }
    let item = |e: &&fs::DirEntry| {
        let n = e.file_name().to_string_lossy().to_string();
        n.ends_with(".link.json") || (n.ends_with(".file.json") && !from.join(n.trim_end_matches(".file.json")).exists())
    };
    entries.iter().filter(item).filter(|e| fs::rename(e.path(), to.join(e.file_name())).is_ok()).count()
}

/// One file's bytes as base64: a file the share sheet saved to the inbox, read when the phone imports it.
#[tauri::command]
async fn library_bytes(root: String, path: String) -> Option<String> {
    Some(base64::engine::general_purpose::STANDARD.encode(fs::read(inside(&root, &path).ok()?).ok()?))
}

/// His skills, as JSON, for the share card's chips: the extension can't read the library itself.
#[tauri::command]
async fn share_skills(json: String) -> bool {
    let Some(dir) = group() else { return false };
    fs::create_dir_all(&dir).is_ok() && fs::write(dir.join("skills.json"), json).is_ok()
}

/// The inbox item the share card's Open asked for (apps/phone/share writes its id to `open` in the App Group
/// before bringing the app forward): read once, then gone. One left over a minute ago is from an Open that
/// never brought the app forward, and isn't followed on some later launch.
#[tauri::command]
async fn share_open() -> Option<String> {
    let at = group()?.join("open");
    let id = fs::read_to_string(&at).ok()?;
    let fresh = fs::metadata(&at).and_then(|m| m.modified()).ok().and_then(|t| t.elapsed().ok()).is_some_and(|d| d.as_secs() < 60);
    let _ = fs::remove_file(&at);
    if !fresh {
        return None;
    }
    let id = id.trim();
    (!id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric())).then(|| id.to_string())
}

#[cfg(target_os = "ios")]
#[allow(unused_unsafe)]
fn group() -> Option<PathBuf> {
    use objc2_foundation::{NSFileManager, NSString};
    const GROUP: &str = "group.com.tylerpoelking.ore";
    match unsafe { NSFileManager::defaultManager().containerURLForSecurityApplicationGroupIdentifier(&NSString::from_str(GROUP)) } {
        Some(url) => Some(PathBuf::from(unsafe { url.path() }?.to_string())),
        // The Simulator's build drops the App Group entitlement: the Share Extension writes beside the containers.
        None if cfg!(target_abi = "sim") => Some(PathBuf::from(std::env::var_os("HOME")?).parent()?.parent()?.join("Shared/AppGroup").join(GROUP)),
        None => None,
    }
}
#[cfg(not(target_os = "ios"))]
fn group() -> Option<PathBuf> {
    None
}

#[cfg(target_os = "ios")]
#[allow(unused_unsafe)]
fn container() -> Option<PathBuf> {
    use objc2_foundation::NSFileManager;
    let Some(url) = (unsafe { NSFileManager::defaultManager().URLForUbiquityContainerIdentifier(None) }) else {
        // The Simulator has no iCloud: its library is the app's own Documents, which
        // `apps/phone/scripts/sim.ts` fills with a scratch library for testing.
        return if cfg!(target_abi = "sim") { std::env::var_os("HOME").map(PathBuf::from) } else { None };
    };
    Some(PathBuf::from(unsafe { url.path() }?.to_string()))
}
#[cfg(target_os = "ios")]
#[allow(unused_unsafe)]
fn download(p: &Path) {
    use objc2_foundation::{NSFileManager, NSString, NSURL};
    let url = unsafe { NSURL::fileURLWithPath(&NSString::from_str(&p.to_string_lossy())) };
    let _ = unsafe { NSFileManager::defaultManager().startDownloadingUbiquitousItemAtURL_error(&url) };
}
// `cargo check` on the Mac: no iCloud container there.
#[cfg(not(target_os = "ios"))]
fn container() -> Option<PathBuf> {
    None
}
#[cfg(not(target_os = "ios"))]
fn download(_: &Path) {}

// The YouTube embed refuses tauri://localhost as its embedder (error 153), so it sits in a relay page served
// on 127.0.0.1, as on the Mac (apps/desktop/src-tauri/src/main.rs, Video.tsx).
const PLAYER_HTML: &str = include_str!("../../../desktop/src-tauri/src/player.html");
static PLAYER_PORT: std::sync::OnceLock<Option<u16>> = std::sync::OnceLock::new();

#[tauri::command]
fn player_port() -> Option<u16> {
    *PLAYER_PORT.get_or_init(|| {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").ok()?;
        let port = listener.local_addr().ok()?.port();
        std::thread::spawn(move || {
            for mut s in listener.incoming().flatten() {
                std::thread::spawn(move || {
                    let _ = s.set_read_timeout(Some(std::time::Duration::from_secs(5)));
                    let mut buf = [0u8; 4096];
                    let n = s.read(&mut buf).unwrap_or(0);
                    let req = String::from_utf8_lossy(&buf[..n]);
                    let ok = req.starts_with("GET /player?") || req.starts_with("GET /player ");
                    let (status, body) = if ok { ("200 OK", PLAYER_HTML) } else { ("404 Not Found", "") };
                    let _ = write!(s, "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}", body.len());
                });
            }
        });
        Some(port)
    })
}

/// iOS puts its own Previous / Next / Done bar over the keyboard of a web view, which stacks above the note's own
/// keyboard bar (KeyboardBar.tsx). WKContentView, the view that takes the keyboard, asks for that bar through
/// `inputAccessoryView`; answering nil drops it for every field in the app, as Notion's and Bear's editors have none.
#[cfg(target_os = "ios")]
fn hide_keyboard_accessory() {
    use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
    unsafe extern "C-unwind" fn none(_this: *mut AnyObject, _cmd: Sel) -> *mut AnyObject {
        std::ptr::null_mut()
    }
    let Some(cls) = AnyClass::get(c"WKContentView") else { return };
    unsafe {
        let imp: Imp = std::mem::transmute(none as unsafe extern "C-unwind" fn(*mut AnyObject, Sel) -> *mut AnyObject);
        objc2::ffi::class_replaceMethod(cls as *const AnyClass as *mut AnyClass, objc2::sel!(inputAccessoryView), imp, c"@@:".as_ptr());
    }
}
#[cfg(not(target_os = "ios"))]
fn hide_keyboard_accessory() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Links and "Open original" open in Safari.
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let _ = APP.set(app.handle().clone());
            hide_keyboard_accessory();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![library_dir, library_scan, library_read, library_bytes, library_apply, library_write, http_fetch, can_transcribe, transcribe, share_inbox, share_skills, share_open, player_port])
        .run(tauri::generate_context!())
        .expect("error while running Ore");
}

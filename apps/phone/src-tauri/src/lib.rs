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
    [".md", ".yaml", ".yml", ".json", ".jsonl", ".excalidraw"].iter().any(|e| lower.ends_with(e)) || picture(&lower).is_some()
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
}

/// Ore's folder in iCloud Drive, or None when iCloud Drive is off for Ore.
#[tauri::command]
async fn library_dir() -> Option<String> {
    let dir = container()?.join("Documents");
    fs::create_dir_all(&dir).ok()?;
    Some(dir.to_string_lossy().into_owned())
}

#[tauri::command]
async fn library_scan(root: String) -> Scan {
    let mut out = Scan { files: vec![], waiting: vec![] };
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
                if let Some(d) = p.parent() {
                    fs::create_dir_all(d).map_err(fail)?;
                }
                let tmp = std::env::temp_dir().join(format!("ore-{}", std::process::id()));
                if fs::write(&tmp, &bytes).and_then(|_| fs::rename(&tmp, &p)).is_err() {
                    fs::write(&p, &bytes).map_err(fail)?;
                }
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
    body: String,
}

/// Fetches another site for an import, as the Mac's fetch would: redirects followed, the final URL and
/// every status (a 404 too) handed back, the body as base64.
#[tauri::command]
async fn http_fetch(url: String, method: Option<String>, headers: Vec<(String, String)>) -> Result<Fetched, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let agent = ureq::AgentBuilder::new().timeout(std::time::Duration::from_secs(30)).build();
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
        let mut body = vec![];
        std::io::Read::read_to_end(&mut std::io::Read::take(res.into_reader(), 200 << 20), &mut body).map_err(|e| e.to_string())?;
        Ok(Fetched { status, url: final_url, headers, body: base64::engine::general_purpose::STANDARD.encode(body) })
    })
    .await
    .map_err(|e| e.to_string())?
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Links and "Open original" open in Safari.
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![library_dir, library_scan, library_read, library_apply, http_fetch])
        .run(tauri::generate_context!())
        .expect("error while running Ore");
}

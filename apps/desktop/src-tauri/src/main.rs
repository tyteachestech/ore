// Ore shell. All library reads and writes go through the installed `ore` CLI (D30).
// An app opened from Finder or Raycast has launchd's minimal PATH, so, like the Raycast
// extension, we resolve ore explicitly and give it the user's interactive-login PATH (where
// bun, nvm and ~/.local/bin live) so its `#!/usr/bin/env bun` shebang and the AI CLIs are found.
// ORE_LIBRARY, ORE_AI and ORE_NO_ENRICH pass through from the app's own environment.

use serde_json::Value;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::collections::HashMap;
use std::os::unix::process::CommandExt;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, LogicalPosition, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_window_state::StateFlags;

fn home() -> PathBuf {
    PathBuf::from(env::var("HOME").unwrap_or_default())
}

/// The library folder, as the CLI resolves it: `$ORE_LIBRARY`, else ~/Ore.
fn library() -> PathBuf {
    env::var("ORE_LIBRARY").map(PathBuf::from).unwrap_or_else(|_| home().join("Ore"))
}

/// PATH from `$SHELL -ilc`, resolved once. rc files may exit non-zero without a tty; we only
/// need the marker line. Gives up after 5 s so a hanging rc file cannot block the app.
fn login_path() -> &'static str {
    static PATH: OnceLock<String> = OnceLock::new();
    PATH.get_or_init(|| {
        let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
        let Ok(mut child) = Command::new(shell)
            .args(["-ilc", r#"printf "__ORE_PATH__%s" "$PATH""#])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
        else {
            return String::new();
        };
        let started = Instant::now();
        while matches!(child.try_wait(), Ok(None)) {
            if started.elapsed() > Duration::from_secs(5) {
                let _ = child.kill();
                break;
            }
            thread::sleep(Duration::from_millis(20));
        }
        let out = child.wait_with_output().map(|o| o.stdout).unwrap_or_default();
        let out = String::from_utf8_lossy(&out);
        out.split("__ORE_PATH__").nth(1).unwrap_or("").trim().to_string()
    })
}

/// (ore binary, PATH for the child). `$ORE_BIN`, then the compiled one the app carries, then
/// `~/.bun/bin/ore`, then the login PATH.
fn resolve() -> Result<(PathBuf, String), String> {
    let path = login_path();
    let home = home();
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(bin) = env::var("ORE_BIN") {
        if !bin.trim().is_empty() {
            candidates.push(PathBuf::from(bin.trim()));
        }
    }
    // The CLI an installed build carries beside the app as ore-cli (tauri.release.json, which
    // app:install uses too; the app itself is MacOS/ore), compiled to bytecode: a call starts in
    // ~25 ms against ~75 ms from source (D30). `tauri dev` carries none, so it runs the linked checkout.
    if let Some(dir) = env::current_exe().ok().and_then(|e| e.parent().map(Path::to_path_buf)) {
        candidates.push(dir.join("ore-cli"));
    }
    candidates.push(home.join(".bun/bin/ore"));
    candidates.extend(path.split(':').filter(|d| !d.is_empty()).map(|d| Path::new(d).join("ore")));
    let bin = candidates
        .into_iter()
        .find(|p| p.is_file())
        .ok_or("ore CLI not found. Reinstall Ore, or run `bun link` in packages/cli.")?;
    // The CLI's folder goes first on the child's PATH, so an AI the CLI starts finds the same `ore`;
    // not the bundled one's, where `ore` is the app itself, so there `~/.bun/bin` gives the checkout's.
    let dir = match bin.file_name() {
        Some(n) if n == "ore-cli" => String::new(),
        _ => bin.parent().map(|d| d.display().to_string()).unwrap_or_default(),
    };
    let child_path = [
        dir,
        home.join(".bun/bin").display().to_string(),
        home.join(".local/bin").display().to_string(),
        path.to_string(),
        "/opt/homebrew/bin:/usr/local/bin".into(),
        env::var("PATH").unwrap_or_default(),
        "/usr/bin:/bin:/usr/sbin:/sbin".into(),
    ]
    .into_iter()
    .filter(|s| !s.is_empty())
    .collect::<Vec<_>>()
    .join(":");
    Ok((bin, child_path))
}

/// The CLI's one-line error ("ore: …" on stderr), without the "ore: " prefix. When ore could not
/// start or crashed before it could say why (Bun missing, a broken install, a signal), the line says
/// what happened and what to run to see the whole error, never a bare "ore failed".
fn one_line_error(stderr: &[u8], code: Option<i32>, command: &str) -> String {
    let text = String::from_utf8_lossy(stderr);
    let lines: Vec<&str> = text.lines().map(str::trim).filter(|l| !l.is_empty()).collect();
    if let Some(line) = lines.iter().find(|l| l.starts_with("ore:")) {
        return line["ore:".len()..].trim().to_string();
    }
    if lines.iter().any(|l| l.contains("bun: No such file") || l.contains("bun: not found")) {
        return "Ore can't run its `ore` command: Bun isn't installed or isn't on your PATH. Install Bun from bun.sh, then reopen Ore.".into();
    }
    let see = format!("Run `ore {command}` in Terminal to see the whole error.");
    // Bun's report of an uncaught error ("error: Cannot find module …") comes after the source lines it quotes.
    let line = lines.iter().find(|l| l.starts_with("error:")).or(lines.first()).map(|l| l.strip_prefix("error:").unwrap_or(l).trim());
    match (line, code) {
        (Some(line), _) => format!("ore crashed: {}. {see}", line.trim_end_matches('.')),
        (None, Some(code)) => format!("ore stopped without saying why (exit code {code}). {see}"),
        (None, None) => format!("ore was stopped before it finished. {see}"),
    }
}

#[cfg(test)]
mod tests {
    use super::one_line_error;

    #[test]
    fn says_what_failed_and_what_to_do() {
        assert_eq!(one_line_error(b"ore: no such source\n", Some(1), "show"), "no such source");
        assert!(one_line_error(b"env: bun: No such file or directory\n", Some(127), "ls").contains("Install Bun"));
        let crash = one_line_error(b"1 | import x from 'y'\nerror: Cannot find module 'y'\n    at /a.ts:1\n", Some(1), "ls");
        assert_eq!(crash, "ore crashed: Cannot find module 'y'. Run `ore ls` in Terminal to see the whole error.");
        assert!(one_line_error(b"", Some(3), "ls").contains("exit code 3"));
        assert!(one_line_error(b"", None, "ls").starts_with("ore was stopped"));
    }
}

/// Runs `ore <args> --json`. A long step's `{"progress":…}` lines on stderr (`ore add --course`) go to
/// the window as `ore-progress` events while it runs; the rest of stderr is kept for the error line.
/// Runs that can be cancelled (an add), by the job name the window gave: the process group of each.
fn jobs() -> &'static Mutex<HashMap<String, u32>> {
    static JOBS: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();
    JOBS.get_or_init(Default::default)
}

fn run(args: Vec<String>, stdin: Option<String>, app: Option<AppHandle>, job: Option<String>) -> Result<Value, String> {
    let (bin, path) = resolve()?;
    let mut cmd = Command::new(&bin);
    cmd.args(&args)
        .arg("--json")
        .env("PATH", path)
        .stdin(if stdin.is_some() { Stdio::piped() } else { Stdio::null() })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    // Its own process group, so Cancel stops the tools it runs too (yt-dlp, the transcriber).
    if job.is_some() {
        cmd.process_group(0);
    }
    let mut child = cmd.spawn().map_err(|e| format!("could not run {}: {e}", bin.display()))?;
    if let Some(j) = &job {
        jobs().lock().unwrap().insert(j.clone(), child.id());
    }
    // `ore diagram <item> <name> --set` reads the scene from stdin; dropping the pipe closes it.
    if let (Some(text), Some(mut pipe)) = (stdin, child.stdin.take()) {
        pipe.write_all(text.as_bytes()).map_err(|e| format!("could not write to ore: {e}"))?;
    }
    let stderr = child.stderr.take().map(|pipe| {
        thread::spawn(move || {
            let mut rest = String::new();
            for line in BufReader::new(pipe).lines().map_while(Result::ok) {
                match (serde_json::from_str::<Value>(&line).ok().and_then(|v| v.get("progress").cloned()), &app) {
                    (Some(p), Some(app)) => drop(app.emit("ore-progress", p)),
                    (Some(_), None) => {}
                    _ => rest.push_str(&(line + "\n")),
                }
            }
            rest
        })
    });
    let out = child.wait_with_output().map_err(|e| format!("could not run {}: {e}", bin.display()));
    if let Some(j) = &job {
        jobs().lock().unwrap().remove(j);
    }
    let out = out?;
    let err = stderr.and_then(|t| t.join().ok()).unwrap_or_default();
    if !out.status.success() {
        return Err(one_line_error(err.as_bytes(), out.status.code(), args.first().map_or("", String::as_str)));
    }
    if out.stdout.iter().all(u8::is_ascii_whitespace) {
        return Ok(Value::Null);
    }
    serde_json::from_slice(&out.stdout).map_err(|e| format!("unreadable output from ore {}: {e}", args.join(" ")))
}

/// Starts ore detached (long AI jobs such as `enrich <id>`), logging to the library's
/// `.ore/logs/<args>.log` like the CLI's own background enrich.
fn spawn(args: Vec<String>) -> Result<(), String> {
    let (bin, path) = resolve()?;
    let logs = library().join(".ore/logs");
    let name: String = args.join("-").chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '_' }).collect();
    let log = fs::create_dir_all(&logs)
        .and_then(|_| OpenOptions::new().create(true).append(true).open(logs.join(format!("{name}.log"))));
    let (stdout, stderr) = match log.and_then(|f| Ok((f.try_clone()?, f))) {
        Ok((a, b)) => (Stdio::from(a), Stdio::from(b)),
        Err(_) => (Stdio::null(), Stdio::null()),
    };
    let mut child = Command::new(&bin)
        .args(&args)
        .env("PATH", path)
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|e| format!("could not run {}: {e}", bin.display()))?;
    thread::spawn(move || child.wait()); // reap; the job outlives nothing but itself
    Ok(())
}

/// Runs `ore <args> --json` off the main thread, with `stdin` piped in when given; returns parsed stdout or the CLI's error line.
/// `job` names a run `ore_cancel` can stop.
#[tauri::command]
async fn ore(app: AppHandle, args: Vec<String>, stdin: Option<String>, job: Option<String>) -> Result<Value, String> {
    tauri::async_runtime::spawn_blocking(move || run(args, stdin, Some(app), job)).await.map_err(|e| e.to_string())?
}

/// Stops the run named `job` (Cancel on an add): SIGTERM to its process group; `ore` takes out what it
/// wrote before it exits. Nothing running under that name is not an error: it just finished.
#[tauri::command]
fn ore_cancel(job: String) {
    if let Some(pid) = jobs().lock().unwrap().get(&job) {
        let _ = Command::new("kill").args(["-s", "TERM", "--", &format!("-{pid}")]).status();
    }
}

/// Fire-and-forget `ore <args>`; returns once the process has started.
#[tauri::command]
async fn ore_detached(args: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || spawn(args)).await.map_err(|e| e.to_string())?
}

/// The daily reminder (D67) is a LaunchAgent that runs this binary with `--remind` at his time, so
/// it fires with the app closed, and on wake if the Mac slept through it. That run asks
/// `ore remind` whether to notify (time set, goal unmet, cards waiting), posts one notification
/// as Ore (a click opens the app) and exits without a window.
const REMINDER_LABEL: &str = "com.tylerpoelking.ore.reminder";

fn reminder_plist() -> PathBuf {
    home().join("Library/LaunchAgents").join(format!("{REMINDER_LABEL}.plist"))
}

fn xml(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

fn launchctl(args: &[&str]) -> Result<(), String> {
    let uid = Command::new("id").arg("-u").output().map_err(|e| e.to_string())?;
    let domain = format!("gui/{}", String::from_utf8_lossy(&uid.stdout).trim());
    let out = Command::new("launchctl").arg(args[0]).arg(&domain).args(&args[1..]).output().map_err(|e| e.to_string())?;
    if out.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&out.stderr).trim().to_string()) }
}

/// Installs the reminder's LaunchAgent for "HH:MM", or removes it for None or "".
#[tauri::command]
fn set_reminder(time: Option<String>) -> Result<(), String> {
    let plist = reminder_plist();
    let plist_str = plist.display().to_string();
    if plist.exists() {
        let _ = launchctl(&["bootout", &plist_str]);
    }
    let Some((h, m)) = time.as_deref().and_then(|t| t.split_once(':')) else {
        let _ = fs::remove_file(&plist);
        return Ok(());
    };
    let (hour, minute): (u32, u32) = (h.parse().map_err(|_| "bad hour")?, m.parse().map_err(|_| "bad minute")?);
    let exe = env::current_exe().map_err(|e| e.to_string())?;
    let body = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>{REMINDER_LABEL}</string>
  <key>ProgramArguments</key><array><string>{}</string><string>--remind</string></array>
  <key>EnvironmentVariables</key><dict><key>ORE_LIBRARY</key><string>{}</string></dict>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>{hour}</integer><key>Minute</key><integer>{minute}</integer></dict>
</dict>
</plist>
"#,
        xml(&exe.display().to_string()),
        xml(&library().display().to_string()),
    );
    fs::create_dir_all(plist.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&plist, body).map_err(|e| e.to_string())?;
    launchctl(&["bootstrap", &plist_str])
}

/// Open at login: a LaunchAgent that opens this app when he logs in, so the quick quiz's shortcut
/// and menu bar item (D76) work after a restart. `on` sets it; the reply says whether it is set.
const LOGIN_LABEL: &str = "com.tylerpoelking.ore.login";

#[tauri::command]
fn login_item(on: Option<bool>) -> Result<bool, String> {
    let plist = home().join("Library/LaunchAgents").join(format!("{LOGIN_LABEL}.plist"));
    let Some(on) = on else { return Ok(plist.exists()) };
    if !on {
        let _ = fs::remove_file(&plist);
        return Ok(false);
    }
    let exe = env::current_exe().map_err(|e| e.to_string())?.display().to_string();
    let Some(end) = exe.find(".app/") else { return Err("Only the installed app can open at login.".into()) };
    let body = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>{LOGIN_LABEL}</string>
  <key>ProgramArguments</key><array><string>/usr/bin/open</string><string>-g</string><string>{}</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
"#,
        xml(&exe[..end + 4]),
    );
    fs::create_dir_all(plist.parent().unwrap()).map_err(|e| e.to_string())?;
    fs::write(&plist, body).map_err(|e| e.to_string())?;
    Ok(true)
}

/// Points a set reminder at this app and library when either has moved, so it keeps firing. Only from an installed bundle, never a dev build.
fn refresh_reminder() {
    let (Ok(text), Ok(exe)) = (fs::read_to_string(reminder_plist()), env::current_exe()) else { return };
    let exe = exe.display().to_string();
    if !exe.contains(".app/") || (text.contains(&xml(&exe)) && text.contains(&xml(&library().display().to_string()))) {
        return;
    }
    let num = |key: &str| text.split(&format!("<key>{key}</key><integer>")).nth(1)?.split('<').next()?.parse::<u32>().ok();
    if let (Some(h), Some(m)) = (num("Hour"), num("Minute")) {
        let _ = set_reminder(Some(format!("{h:02}:{m:02}")));
    }
}

fn remind() {
    let Ok(note) = run(vec!["remind".into()], None, None, None) else { return };
    if note["notify"] != Value::Bool(true) {
        return;
    }
    let (title, body) = (note["title"].as_str().unwrap_or("Ore"), note["body"].as_str().unwrap_or(""));
    #[cfg(target_os = "macos")]
    {
        let _ = mac_notification_sys::set_application("com.tylerpoelking.ore");
        let _ = mac_notification_sys::send_notification(title, None, body, None);
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (title, body);
}

/// The YouTube player page (D48), served at http://127.0.0.1:<port>/player because the embed
/// refuses pages without an http(s) origin (error 153). Static, and the only thing served.
const PLAYER_HTML: &str = include_str!("player.html");
static PLAYER_PORT: OnceLock<Option<u16>> = OnceLock::new();

fn serve_player() -> Option<u16> {
    let listener = TcpListener::bind("127.0.0.1:0").ok()?;
    let port = listener.local_addr().ok()?.port();
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            thread::spawn(move || respond(stream));
        }
    });
    Some(port)
}

fn respond(mut s: TcpStream) {
    let _ = s.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buf = [0u8; 4096];
    let n = s.read(&mut buf).unwrap_or(0);
    let req = String::from_utf8_lossy(&buf[..n]);
    let ok = req.starts_with("GET /player?") || req.starts_with("GET /player ");
    let (status, body) = if ok { ("200 OK", PLAYER_HTML) } else { ("404 Not Found", "") };
    let _ = write!(
        s,
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
}

/// The player page's port, or null when it could not start.
#[tauri::command]
fn player_port() -> Option<u16> {
    *PLAYER_PORT.get_or_init(serve_player)
}

/// Look Up (D83): the word's entry in the macOS dictionary (Dictionary Services, offline), or null
/// when it has none. One C call, so no helper process (D11 is for what needs a Swift API).
#[cfg(target_os = "macos")]
#[tauri::command]
fn define(word: String) -> Option<String> {
    dictionary::define(&word)
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn define(_word: String) -> Option<String> {
    None
}

#[cfg(target_os = "macos")]
mod dictionary {
    use std::ffi::c_void;
    type CFStringRef = *const c_void;

    #[repr(C)]
    struct CFRange {
        location: isize,
        length: isize,
    }

    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn DCSCopyTextDefinition(dictionary: *const c_void, text: CFStringRef, range: CFRange) -> CFStringRef;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFStringCreateWithCharacters(alloc: *const c_void, chars: *const u16, len: isize) -> CFStringRef;
        fn CFStringGetLength(s: CFStringRef) -> isize;
        fn CFStringGetCharacters(s: CFStringRef, range: CFRange, buffer: *mut u16);
        fn CFRelease(cf: *const c_void);
    }

    pub fn define(word: &str) -> Option<String> {
        let chars: Vec<u16> = word.trim().encode_utf16().collect();
        if chars.is_empty() {
            return None;
        }
        // SAFETY: CF calls on strings we create and release here; the copy rule gives us the result.
        unsafe {
            let text = CFStringCreateWithCharacters(std::ptr::null(), chars.as_ptr(), chars.len() as isize);
            if text.is_null() {
                return None;
            }
            let found = DCSCopyTextDefinition(std::ptr::null(), text, CFRange { location: 0, length: chars.len() as isize });
            CFRelease(text);
            if found.is_null() {
                return None;
            }
            let len = CFStringGetLength(found);
            let mut out = vec![0u16; len as usize];
            CFStringGetCharacters(found, CFRange { location: 0, length: len }, out.as_mut_ptr());
            CFRelease(found);
            Some(String::from_utf16_lossy(&out))
        }
    }
}

/// The clipboard's change count: it says something new was copied without reading it, so it never
/// raises macOS's paste prompt. Read when the window loses and gains focus (copied.ts), never polled.
#[cfg(target_os = "macos")]
#[tauri::command]
fn clipboard_count() -> Option<isize> {
    Some(objc2_app_kit::NSPasteboard::generalPasteboard().changeCount())
}

/// What was copied, when the add box opens: a copied file as its path, else the text.
#[cfg(target_os = "macos")]
#[tauri::command]
fn clipboard_text() -> Option<String> {
    use objc2_app_kit::{NSPasteboard, NSPasteboardTypeString};
    // SAFETY: AppKit's constant pasteboard type name, set for the life of the process.
    let text = unsafe { NSPasteboardTypeString };
    clipboard_files().into_iter().next().or_else(|| NSPasteboard::generalPasteboard().stringForType(text).map(|s| s.to_string()))
}

/// The paths of the files copied in Finder (⌘C), for a paste: the webview gets only their names.
/// Finder copies file reference URLs (file:///.file/id=…), so each is turned into its path.
#[cfg(target_os = "macos")]
#[tauri::command]
fn clipboard_files() -> Vec<String> {
    use objc2_app_kit::{NSPasteboard, NSPasteboardTypeFileURL};
    use objc2_foundation::NSURL;
    // SAFETY: AppKit's constant pasteboard type name, set for the life of the process.
    let file = unsafe { NSPasteboardTypeFileURL };
    let Some(items) = NSPasteboard::generalPasteboard().pasteboardItems() else { return vec![] };
    items
        .iter()
        .filter_map(|item| {
            let url = NSURL::URLWithString(&*item.stringForType(file)?)?;
            url.filePathURL()?.path().map(|p| p.to_string())
        })
        .collect()
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn clipboard_count() -> Option<isize> {
    None
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn clipboard_text() -> Option<String> {
    None
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn clipboard_files() -> Vec<String> {
    vec![]
}

/// The quick quiz (D76): a small window over whatever app he is in, from a system-wide shortcut or
/// the menu bar. It was made hidden at launch, so it opens at once; putting it away hands focus back
/// to the app he came from.
static FROM_APP: AtomicBool = AtomicBool::new(false);

fn toggle_quiz(app: &AppHandle) {
    let Some(w) = app.get_webview_window("quiz") else { return };
    if w.is_visible().unwrap_or(false) {
        let _ = w.emit("quiz-away", ());
        return;
    }
    FROM_APP.store(app.get_webview_window("main").is_some_and(|m| m.is_focused().unwrap_or(false)), Ordering::Relaxed);
    place_quiz(app, &w);
    let _ = w.show();
    let _ = w.set_focus();
    let _ = w.emit("quiz-open", ());
}

/// Centres the quiz a third of the way down the screen the pointer is on, like Spotlight. All in
/// logical points: a window never shown yet reports a scale factor of 1, so physical units land it
/// off screen on a Retina display. tao's cursor y is unreliable on macOS (it mixes pixels and
/// points), so the screen is picked by the pointer's x alone, then the primary one.
fn place_quiz(app: &AppHandle, w: &tauri::WebviewWindow) {
    let monitors = app.available_monitors().unwrap_or_default();
    let primary = app.primary_monitor().ok().flatten();
    let cursor_x = app.cursor_position().ok().map(|p| p.x / primary.as_ref().map_or(1.0, |m| m.scale_factor()));
    let logical = |m: &tauri::Monitor| {
        let sf = m.scale_factor();
        (m.position().x as f64 / sf, m.position().y as f64 / sf, m.size().width as f64 / sf, m.size().height as f64 / sf)
    };
    let screen = cursor_x
        .and_then(|cx| monitors.iter().map(logical).find(|(x, _, width, _)| cx >= *x && cx < x + width))
        .or_else(|| primary.as_ref().map(logical));
    let (Some((x, y, width, height)), Ok(size)) = (screen, w.outer_size()) else {
        let _ = w.center();
        return;
    };
    let size = size.to_logical::<f64>(w.scale_factor().unwrap_or(1.0));
    let left = x + ((width - size.width) / 2.0).max(0.0);
    let top = y + ((height - size.height) / 3.0).max(0.0);
    let _ = w.set_position(LogicalPosition::new(left, top));
}

/// Puts the quiz away. `back`: he dismissed it (Esc, Done), so focus returns to where he was; on a
/// click elsewhere focus has already moved.
#[tauri::command]
fn quiz_hide(app: AppHandle, back: bool) {
    if let Some(w) = app.get_webview_window("quiz") {
        let _ = w.hide();
    }
    let _ = app.emit_to("main", "quiz-closed", ());
    if !back {
        return;
    }
    if FROM_APP.load(Ordering::Relaxed) {
        if let Some(m) = app.get_webview_window("main") {
            let _ = m.set_focus();
        }
    } else {
        #[cfg(target_os = "macos")]
        let _ = app.hide(); // macOS gives focus back to the app he was in
    }
}

fn show_main(app: &AppHandle) {
    if let Some(m) = app.get_webview_window("main") {
        let _ = m.unminimize();
        let _ = m.show();
        let _ = m.set_focus();
    }
}

/// "Open in source" from the quiz: the main window opens that source, at that highlight.
#[tauri::command]
fn quiz_open_source(app: AppHandle, item: String, at: Option<String>) {
    if let Some(w) = app.get_webview_window("quiz") {
        let _ = w.hide();
    }
    show_main(&app);
    let _ = app.emit_to("main", "open-source", serde_json::json!({ "item": item, "at": at }));
}

/// Sets the quiz's system-wide shortcut, a combo as keys.ts writes it ("Ctrl+Alt+KeyQ"), or none.
/// Fails when another app already holds it.
#[tauri::command]
fn set_quiz_shortcut(app: AppHandle, combo: Option<String>) -> Result<(), String> {
    let gs = app.global_shortcut();
    gs.unregister_all().map_err(|e| e.to_string())?;
    let Some(combo) = combo.filter(|c| !c.is_empty()) else { return Ok(()) };
    let accel = combo.split('+').map(|p| if p == "Meta" { "Super" } else { p }).collect::<Vec<_>>().join("+");
    gs.on_shortcut(accel.as_str(), |app, _, e| {
        if e.state == ShortcutState::Pressed {
            toggle_quiz(app);
        }
    })
    .map_err(|e| e.to_string())
}

/// The menu bar item: a click opens the quiz; its menu also opens the app or quits.
#[tauri::command]
fn set_tray(app: AppHandle, on: bool, tip: String) -> Result<(), String> {
    if let Some(t) = app.tray_by_id("quiz") {
        if on {
            return t.set_tooltip(Some(tip)).map_err(|e| e.to_string());
        }
        app.remove_tray_by_id("quiz");
        return Ok(());
    }
    if !on {
        return Ok(());
    }
    let item = |id: &str, text: &str| MenuItem::with_id(&app, id, text, true, None::<&str>);
    let menu = Menu::with_items(
        &app,
        &[
            &item("quiz", "Quick quiz").map_err(|e| e.to_string())?,
            &item("open", "Open Ore").map_err(|e| e.to_string())?,
            &PredefinedMenuItem::separator(&app).map_err(|e| e.to_string())?,
            &item("quit", "Quit Ore").map_err(|e| e.to_string())?,
        ],
    )
    .map_err(|e| e.to_string())?;
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png")).map_err(|e| e.to_string())?;
    TrayIconBuilder::with_id("quiz")
        .icon(icon)
        .icon_as_template(true)
        .tooltip(tip)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "quiz" => toggle_quiz(app),
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|t, e| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e {
                toggle_quiz(t.app_handle());
            }
        })
        .build(&app)
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// The Mac menu bar, as `menu.ts` describes it: menus of command items (`ore:<binding>`, shown
/// with their shortcut, run in the page as that shortcut) and standard macOS items by name.
#[tauri::command]
fn set_app_menu(app: AppHandle, menus: Vec<Value>) -> Result<(), String> {
    let e = |e: tauri::Error| e.to_string();
    let bar = Menu::new(&app).map_err(e)?;
    for m in &menus {
        let sub = Submenu::new(&app, m["title"].as_str().unwrap_or(""), true).map_err(e)?;
        for it in m["items"].as_array().into_iter().flatten() {
            if let Some(id) = it["id"].as_str() {
                let item = MenuItem::with_id(&app, id, it["label"].as_str().unwrap_or(id), it["enabled"].as_bool().unwrap_or(true), it["accel"].as_str()).map_err(e)?;
                sub.append(&item).map_err(e)?;
                continue;
            }
            let p = match it["predef"].as_str().unwrap_or("") {
                "separator" => PredefinedMenuItem::separator(&app),
                "about" => PredefinedMenuItem::about(&app, None, None),
                "services" => PredefinedMenuItem::services(&app, None),
                "hide" => PredefinedMenuItem::hide(&app, None),
                "hide_others" => PredefinedMenuItem::hide_others(&app, None),
                "show_all" => PredefinedMenuItem::show_all(&app, None),
                "quit" => PredefinedMenuItem::quit(&app, None),
                "close_window" => PredefinedMenuItem::close_window(&app, None),
                "undo" => PredefinedMenuItem::undo(&app, None),
                "redo" => PredefinedMenuItem::redo(&app, None),
                "cut" => PredefinedMenuItem::cut(&app, None),
                "copy" => PredefinedMenuItem::copy(&app, None),
                "paste" => PredefinedMenuItem::paste(&app, None),
                "select_all" => PredefinedMenuItem::select_all(&app, None),
                "fullscreen" => PredefinedMenuItem::fullscreen(&app, None),
                "minimize" => PredefinedMenuItem::minimize(&app, None),
                "maximize" => PredefinedMenuItem::maximize(&app, None),
                other => return Err(format!("unknown menu item {other}")),
            }
            .map_err(e)?;
            sub.append(&p).map_err(e)?;
        }
        #[cfg(target_os = "macos")]
        match m["role"].as_str() {
            Some("window") => sub.set_as_windows_menu_for_nsapp().map_err(e)?,
            Some("help") => sub.set_as_help_menu_for_nsapp().map_err(e)?,
            _ => {}
        }
        bar.append(&sub).map_err(e)?;
    }
    app.set_menu(bar).map_err(e)?;
    Ok(())
}

/// Red underlines and autocorrect in every text field and the note editor. WKWebView reads them
/// from the app's defaults, where nothing turns spell checking on (Safari does it for itself), and
/// autocorrect only runs where spell checking does. Set once, if he has not chosen; autocorrect then
/// follows his Mac's own setting (System Settings > Keyboard > Text Input).
#[cfg(target_os = "macos")]
fn spelling_on() {
    use objc2_foundation::{ns_string, NSUserDefaults};
    let defaults = NSUserDefaults::standardUserDefaults();
    let key = ns_string!("WebContinuousSpellCheckingEnabled");
    if defaults.objectForKey(key).is_none() {
        defaults.setBool_forKey(true, key);
    }
}

fn main() {
    if env::args().any(|a| a == "--remind") {
        return remind();
    }
    #[cfg(target_os = "macos")]
    spelling_on();
    refresh_reminder();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // The main window reopens at the size and place he left it (on a screen that still exists);
        // the quick quiz places itself each time. Visibility is ours: closing only hides the window.
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&["quiz"])
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![ore, ore_cancel, ore_detached, player_port, define, clipboard_count, clipboard_text, clipboard_files, set_reminder, login_item, quiz_hide, quiz_open_source, set_quiz_shortcut, set_tray, set_app_menu])
        .on_menu_event(|app, e| {
            let id = e.id().as_ref();
            if !id.starts_with("ore:") {
                return; // the menu bar item's own menu
            }
            if id != "ore:quick-quiz" {
                show_main(app);
            }
            let _ = app.emit_to("main", "menu", id);
        })
        // Images in notes (D38) load from the library through the asset protocol; nothing else on disk does.
        .setup(|app| Ok(app.asset_protocol_scope().allow_directory(library(), true)?))
        // Closing the main window hides it, as in Mail or Safari: the app keeps running so the quiz
        // shortcut works, and the Dock icon brings the window back. ⌘Q quits.
        // The quick quiz is never closed either (File ▸ Close Window, ⌘W, reaches it while it is the key
        // window): a closed quiz would leave the shortcut and menu bar item dead until a relaunch, so it
        // is put away as Esc does.
        .on_window_event(|w, e| {
            if let WindowEvent::CloseRequested { api, .. } = e {
                match w.label() {
                    "main" => {
                        api.prevent_close();
                        let _ = w.hide();
                    }
                    "quiz" => {
                        api.prevent_close();
                        let _ = w.emit("quiz-away", ());
                    }
                    _ => {}
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running Ore")
        .run(|app, e| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = e {
                show_main(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, e);
        });
}

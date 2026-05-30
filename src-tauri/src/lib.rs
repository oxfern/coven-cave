use std::net::TcpListener;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

struct SidecarState(Mutex<Option<Child>>);

fn find_free_port() -> Option<u16> {
    TcpListener::bind("127.0.0.1:0")
        .ok()
        .and_then(|l| l.local_addr().ok())
        .map(|a| a.port())
}

fn wait_for_port(port: u16, timeout: Duration) -> bool {
    use std::net::TcpStream;
    let addr = format!("127.0.0.1:{}", port);
    let parsed = addr.parse().expect("valid sidecar addr");
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect_timeout(&parsed, Duration::from_millis(200)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(150));
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidecarState(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let server_js = app
                .path()
                .resource_dir()?
                .join("resources")
                .join("server")
                .join("server.js");

            if !server_js.exists() {
                return Err(format!(
                    "standalone server not found at {}",
                    server_js.display()
                )
                .into());
            }

            let port = find_free_port().ok_or("no free local port")?;
            log::info!("[cave] starting sidecar on port {}", port);

            let child = Command::new("node")
                .arg(&server_js)
                .env("PORT", port.to_string())
                .env("HOSTNAME", "127.0.0.1")
                .env("NODE_ENV", "production")
                .env("COVEN_CAVE_BUNDLE", "1")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| {
                    format!("failed to spawn node sidecar (is `node` on PATH?): {}", e)
                })?;

            *app
                .state::<SidecarState>()
                .0
                .lock()
                .expect("sidecar lock") = Some(child);

            if !wait_for_port(port, Duration::from_secs(15)) {
                return Err("sidecar did not become ready within 15s".into());
            }

            let url = format!("http://127.0.0.1:{}/", port);
            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(url.parse().expect("valid url")),
            )
            .title("CovenCave")
            .inner_size(1320.0, 820.0)
            .min_inner_size(960.0, 600.0)
            .resizable(true)
            .build()?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(state) = window.app_handle().try_state::<SidecarState>() {
                    if let Some(mut child) = state.0.lock().expect("sidecar lock").take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

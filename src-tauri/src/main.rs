#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{io::Write, path::PathBuf, sync::Mutex};
use tauri::State;

#[derive(Default)]
struct ProjectFile(Mutex<Option<PathBuf>>);

#[derive(Default)]
struct PendingFile(Mutex<Option<PathBuf>>);

#[derive(serde::Serialize)]
struct OpenedFile {
    name: String,
    bytes: Vec<u8>,
}

fn read_project(path: PathBuf, pending: &PendingFile) -> Result<OpenedFile, String> {
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or_default().to_lowercase();
    if !matches!(ext.as_str(), "rackplan" | "xlsx" | "json") {
        return Err("Choose a .rackplan or .xlsx file.".into());
    }
    if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > 32 * 1024 * 1024 {
        return Err("This file exceeds the 32 MB project limit.".into());
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let name = path.file_name().ok_or("Invalid filename")?.to_string_lossy().into_owned();
    *pending.0.lock().map_err(|e| e.to_string())? = (ext == "rackplan").then_some(path);
    Ok(OpenedFile { name, bytes })
}

#[tauri::command]
async fn choose_project(pending: State<'_, PendingFile>) -> Result<Option<OpenedFile>, String> {
    let handle = rfd::AsyncFileDialog::new()
        .add_filter("Rack projects and workbooks", &["rackplan", "xlsx", "json"])
        .pick_file().await;
    handle.map(|file| read_project(file.path().into(), &pending)).transpose()
}

#[tauri::command]
fn startup_project(pending: State<PendingFile>) -> Result<Option<OpenedFile>, String> {
    std::env::args_os().nth(1).map(|path| read_project(path.into(), &pending)).transpose()
}

#[tauri::command]
fn accept_file(state: State<ProjectFile>, pending: State<PendingFile>) -> Result<bool, String> {
    let chosen = pending.0.lock().map_err(|e| e.to_string())?.take();
    let has_path = chosen.is_some();
    *state.0.lock().map_err(|e| e.to_string())? = chosen;
    Ok(has_path)
}

#[tauri::command]
async fn save_project(
    content: String, name: String, choose: bool, state: State<'_, ProjectFile>
) -> Result<bool, String> {
    let previous = state.0.lock().map_err(|e| e.to_string())?.clone();
    let path = match previous.filter(|_| !choose) {
        Some(path) => path,
        None => match rfd::AsyncFileDialog::new()
            .set_file_name(&name).add_filter("Patchbay project", &["rackplan"]).save_file().await {
            Some(handle) => handle.path().to_path_buf(),
            None => return Ok(false),
        }
    };
    let folder = path.parent().ok_or("Invalid project folder")?;
    let mut temp = tempfile::NamedTempFile::new_in(folder).map_err(|e| e.to_string())?;
    temp.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(&path).map_err(|e| e.to_string())?;
    *state.0.lock().map_err(|e| e.to_string())? = Some(path);
    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .manage(ProjectFile::default())
        .manage(PendingFile::default())
        .invoke_handler(tauri::generate_handler![save_project, choose_project, startup_project, accept_file])
        .run(tauri::generate_context!())
        .expect("Could not start Patchbay");
}

//! 桌面客户端壳：把 src/ 里的 React UI 装进系统 WebView，
//! 并把数据落到「文档/NovelUI/<作品>/」目录里。
//!
//! 与前端 src/storage/tauri.js 约定的命令：
//!   novel_state_path()              -> String            当前状态文件路径（给 UI 显示）
//!   novel_load_state()              -> Option<LoadResult> 读 project.json
//!   novel_save_state({ data })      -> SaveResult          写 project.json + 自动备份
//!   novel_export_file({ payload })  -> Option<String>      导出到 exports/
//!   novel_pick_project()            -> Option<LoadResult>  原生对话框选一个 json 读入

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

const APP_DIR: &str = "NovelUI";
const BACKUP_KEEP: usize = 10;

#[derive(Debug, Serialize)]
struct LoadResult {
    data: serde_json::Value,
    path: String,
    updated_at: u64,
}

#[derive(Debug, Serialize)]
struct SaveResult {
    ok: bool,
    path: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProjectMeta {
    /// 作品名（目录名），默认 default
    slug: Option<String>,
}

/// 作品根目录：<文档>/NovelUI/<slug>
///
/// 也支持「项目 = 任意文件夹」：current-project.txt 里存的是绝对路径时，直接用那个文件夹。
fn project_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let documents = app
        .path()
        .document_dir()
        .map_err(|error| format!("找不到文档目录：{error}"))?;

    let slug_file = documents.join(APP_DIR).join("current-project.txt");
    let saved = fs::read_to_string(&slug_file)
        .ok()
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty());

    let dir = match saved {
        Some(text) if Path::new(&text).is_absolute() => PathBuf::from(text),
        Some(text) => documents.join(APP_DIR).join(text),
        None => documents.join(APP_DIR).join("default"),
    };
    fs::create_dir_all(dir.join("backups")).map_err(|error| error.to_string())?;
    fs::create_dir_all(dir.join("exports")).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn state_file(dir: &Path) -> PathBuf {
    dir.join("project.json")
}

fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

/// 写之前先把旧文件挪进 backups/，只保留最近 BACKUP_KEEP 份
fn rotate_backup(dir: &Path) -> Result<(), String> {
    let current = state_file(dir);
    if !current.exists() {
        return Ok(());
    }
    let backups = dir.join("backups");
    let target = backups.join(format!("project-{}.json", now_millis()));
    fs::copy(&current, &target).map_err(|error| error.to_string())?;

    let mut entries: Vec<PathBuf> = fs::read_dir(&backups)
        .map_err(|error| error.to_string())?
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|path| {
            path.extension().map(|ext| ext == "json").unwrap_or(false)
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.starts_with("project-"))
                    .unwrap_or(false)
        })
        .collect();

    entries.sort();
    while entries.len() > BACKUP_KEEP {
        if let Some(oldest) = entries.first().cloned() {
            let _ = fs::remove_file(oldest);
            entries.remove(0);
        } else {
            break;
        }
    }
    Ok(())
}

#[tauri::command]
fn novel_state_path(app: AppHandle) -> Result<String, String> {
    let dir = project_dir(&app)?;
    Ok(state_file(&dir).to_string_lossy().to_string())
}

#[tauri::command]
fn novel_load_state(app: AppHandle) -> Result<Option<LoadResult>, String> {
    let dir = project_dir(&app)?;
    let file = state_file(&dir);
    if !file.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&file).map_err(|error| error.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&text).map_err(|error| error.to_string())?;
    let updated_at = fs::metadata(&file)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    Ok(Some(LoadResult {
        data,
        path: file.to_string_lossy().to_string(),
        updated_at,
    }))
}

#[tauri::command]
fn novel_save_state(app: AppHandle, data: serde_json::Value) -> Result<SaveResult, String> {
    let dir = project_dir(&app)?;
    rotate_backup(&dir)?;

    let file = state_file(&dir);
    // 先写临时文件再改名，避免写到一半断电把主文件写坏
    let temp = dir.join("project.json.tmp");
    let text = serde_json::to_string_pretty(&data).map_err(|error| error.to_string())?;
    fs::write(&temp, text).map_err(|error| error.to_string())?;
    fs::rename(&temp, &file).map_err(|error| error.to_string())?;

    Ok(SaveResult {
        ok: true,
        path: file.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn novel_export_file(app: AppHandle, payload: serde_json::Value) -> Result<Option<String>, String> {
    let dir = project_dir(&app)?;
    let file = dir.join("exports").join(format!("novel-{}.json", now_millis()));
    let text = serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())?;
    fs::write(&file, text).map_err(|error| error.to_string())?;
    Ok(Some(file.to_string_lossy().to_string()))
}

#[tauri::command]
fn novel_pick_project(app: AppHandle) -> Result<Option<LoadResult>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("小说数据", &["json"])
        .blocking_pick_file();

    let Some(picked) = picked else { return Ok(None) };
    let path = picked
        .into_path()
        .map_err(|error| format!("无法读取所选路径：{error}"))?;

    let text = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&text).map_err(|error| error.to_string())?;

    Ok(Some(LoadResult {
        data,
        path: path.to_string_lossy().to_string(),
        updated_at: 0,
    }))
}

/// 当前作品名（默认 default），供界面显示
#[tauri::command]
fn novel_project_slug(app: AppHandle) -> Result<String, String> {
    let dir = project_dir(&app)?;
    Ok(dir
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("default")
        .to_string())
}

/// 切换作品：写 current-project.txt，下次读写就走新目录
#[tauri::command]
fn novel_switch_project(app: AppHandle, slug: String) -> Result<String, String> {
    let cleaned: String = slug
        .chars()
        .filter(|ch| ch.is_alphanumeric() || *ch == '-' || *ch == '_' || *ch == ' ' || *ch > '\u{4e00}')
        .collect();
    let name = if cleaned.trim().is_empty() {
        "default".to_string()
    } else {
        cleaned.trim().to_string()
    };

    let documents = app
        .path()
        .document_dir()
        .map_err(|error| format!("找不到文档目录：{error}"))?;
    let root = documents.join(APP_DIR);
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    fs::write(root.join("current-project.txt"), &name).map_err(|error| error.to_string())?;
    let dir = root.join(&name);
    fs::create_dir_all(dir.join("backups")).map_err(|error| error.to_string())?;
    fs::create_dir_all(dir.join("exports")).map_err(|error| error.to_string())?;
    Ok(name)
}

/// 素材库：<文档>/NovelUI/_library/library.json，独立于任何作品
fn library_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let documents = app
        .path()
        .document_dir()
        .map_err(|error| format!("找不到文档目录：{error}"))?;
    let dir = documents.join(APP_DIR).join("_library");
    fs::create_dir_all(dir.join("backups")).map_err(|error| error.to_string())?;
    Ok(dir)
}

#[tauri::command]
fn novel_load_library(app: AppHandle) -> Result<Option<LoadResult>, String> {
    let dir = library_dir(&app)?;
    let file = dir.join("library.json");
    if !file.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(&file).map_err(|error| error.to_string())?;
    let data: serde_json::Value = serde_json::from_str(&text).map_err(|error| error.to_string())?;
    let updated_at = fs::metadata(&file)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    Ok(Some(LoadResult {
        data,
        path: file.to_string_lossy().to_string(),
        updated_at,
    }))
}

#[tauri::command]
fn novel_save_library(app: AppHandle, data: serde_json::Value) -> Result<SaveResult, String> {
    let dir = library_dir(&app)?;
    let file = dir.join("library.json");

    // 写前备份，保留最近 BACKUP_KEEP 份
    if file.exists() {
        let backups = dir.join("backups");
        let stamp = now_millis();
        let _ = fs::copy(&file, backups.join(format!("library-{stamp}.json")));
        let mut entries: Vec<PathBuf> = fs::read_dir(&backups)
            .map_err(|error| error.to_string())?
            .filter_map(|entry| entry.ok().map(|item| item.path()))
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.starts_with("library-"))
                    .unwrap_or(false)
            })
            .collect();
        entries.sort();
        while entries.len() > BACKUP_KEEP {
            if let Some(oldest) = entries.first().cloned() {
                let _ = fs::remove_file(oldest);
                entries.remove(0);
            } else {
                break;
            }
        }
    }

    let temp = dir.join("library.json.tmp");
    let text = serde_json::to_string_pretty(&data).map_err(|error| error.to_string())?;
    fs::write(&temp, text).map_err(|error| error.to_string())?;
    fs::rename(&temp, &file).map_err(|error| error.to_string())?;

    Ok(SaveResult {
        ok: true,
        path: file.to_string_lossy().to_string(),
    })
}

#[derive(Debug, Serialize)]
struct ProjectDirResult {
    dir: String,
    cancelled: bool,
}

impl ProjectDirResult {
    fn cancelled() -> Self {
        Self {
            dir: String::new(),
            cancelled: true,
        }
    }
}

/// 记住项目文件夹（存绝对路径，下次启动接着打开）
fn remember_project(app: &AppHandle, dir: &Path) -> Result<(), String> {
    let documents = app
        .path()
        .document_dir()
        .map_err(|error| format!("找不到文档目录：{error}"))?;
    let root = documents.join(APP_DIR);
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    fs::write(root.join("current-project.txt"), dir.to_string_lossy().as_bytes())
        .map_err(|error| error.to_string())
}

/// 弹原生文件夹选择框，选中后存成当前项目
#[tauri::command]
async fn novel_pick_folder(app: AppHandle) -> Result<ProjectDirResult, String> {
    let picked = app.dialog().file().blocking_pick_folder();
    let Some(folder) = picked else {
        return Ok(ProjectDirResult::cancelled());
    };
    let path = folder
        .into_path()
        .map_err(|error| format!("选的文件夹不可用：{error}"))?;
    fs::create_dir_all(path.join("backups")).map_err(|error| error.to_string())?;
    fs::create_dir_all(path.join("exports")).map_err(|error| error.to_string())?;
    remember_project(&app, &path)?;
    Ok(ProjectDirResult {
        dir: path.to_string_lossy().to_string(),
        cancelled: false,
    })
}

/// 直接指定项目文件夹（UI 里手填路径时用）
#[tauri::command]
fn novel_open_project(app: AppHandle, dir: String) -> Result<ProjectDirResult, String> {
    let path = PathBuf::from(dir.trim());
    if !path.is_absolute() {
        return Err("请给一个绝对路径".to_string());
    }
    fs::create_dir_all(path.join("backups")).map_err(|error| error.to_string())?;
    fs::create_dir_all(path.join("exports")).map_err(|error| error.to_string())?;
    remember_project(&app, &path)?;
    Ok(ProjectDirResult {
        dir: path.to_string_lossy().to_string(),
        cancelled: false,
    })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            novel_state_path,
            novel_load_state,
            novel_save_state,
            novel_export_file,
            novel_pick_project,
            novel_project_slug,
            novel_switch_project,
            novel_load_library,
            novel_save_library,
            novel_pick_folder,
            novel_open_project
        ])
        .run(tauri::generate_context!())
        .expect("启动客户端失败");
}

#[allow(dead_code)]
fn _unused(_: ProjectMeta) {}

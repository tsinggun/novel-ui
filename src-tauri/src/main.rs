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

/// 数据文件：默认 <文档>/NovelUI/default/project.json。
/// 「载入数据」后 last-file.txt 里记着那个 json 的绝对路径，之后所有读写都走它。
fn state_file(app: &AppHandle) -> Result<PathBuf, String> {
    let documents = app
        .path()
        .document_dir()
        .map_err(|error| format!("找不到文档目录：{error}"))?;

    let record = documents.join(APP_DIR).join("last-file.txt");
    let saved = fs::read_to_string(&record)
        .ok()
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty());

    let file = match saved {
        Some(text) if Path::new(&text).is_absolute() => PathBuf::from(text),
        _ => documents.join(APP_DIR).join("default").join("project.json"),
    };

    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    Ok(file)
}

/// 数据文件旁边的备份目录：<同目录>/_novelui-backups
fn backup_dir(file: &Path) -> PathBuf {
    let parent = file.parent().map(Path::to_path_buf).unwrap_or_default();
    parent.join("_novelui-backups")
}

fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

/// 写之前先把旧文件备份到同目录 _novelui-backups，只保留最近 BACKUP_KEEP 份
fn rotate_backup(file: &Path) -> Result<(), String> {
    if !file.exists() {
        return Ok(());
    }
    let backups = backup_dir(file);
    fs::create_dir_all(&backups).map_err(|error| error.to_string())?;
    let base = file
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("project")
        .to_string();
    let target = backups.join(format!("{}-{}.json", base, now_millis()));
    fs::copy(file, &target).map_err(|error| error.to_string())?;

    let mut entries: Vec<PathBuf> = fs::read_dir(&backups)
        .map_err(|error| error.to_string())?
        .filter_map(|entry| entry.ok().map(|item| item.path()))
        .filter(|path| {
            path.extension().map(|ext| ext == "json").unwrap_or(false)
                && path
                    .file_name()
                    .and_then(|name| name.to_str())
                    .map(|name| name.starts_with(&format!("{base}-")))
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
    Ok(state_file(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn novel_load_state(app: AppHandle) -> Result<Option<LoadResult>, String> {
    let file = state_file(&app)?;
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
    let file = state_file(&app)?;
    rotate_backup(&file)?;

    // 先写临时文件再改名，避免写到一半断电把主文件写坏
    let temp = file.with_extension("json.tmp");
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
    let file = state_file(&app)?;
    let parent = file.parent().map(Path::to_path_buf).unwrap_or_default();
    let dir = parent.join("_novelui-exports");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let target = dir.join(format!("novel-{}.json", now_millis()));
    let text = serde_json::to_string_pretty(&payload).map_err(|error| error.to_string())?;
    fs::write(&target, text).map_err(|error| error.to_string())?;
    Ok(Some(target.to_string_lossy().to_string()))
}

/// 从对话框里挑一个 json 读进来（只是导入，不改变当前数据文件）
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

/// 当前数据文件名（给界面显示）
#[tauri::command]
fn novel_project_slug(app: AppHandle) -> Result<String, String> {
    let file = state_file(&app)?;
    Ok(file
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("project.json")
        .to_string())
}

/// 把任何一个 json 设成当前数据文件：之后所有读写都落到它上面
fn adopt_data_file(app: &AppHandle, path: &Path) -> Result<LoadResult, String> {
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let parsed: serde_json::Value = serde_json::from_str(&text).map_err(|error| error.to_string())?;
    let data = match parsed.get("data") {
        Some(inner) if inner.is_object() => inner.clone(),
        _ => parsed,
    };

    let documents = app
        .path()
        .document_dir()
        .map_err(|error| format!("找不到文档目录：{error}"))?;
    let root = documents.join(APP_DIR);
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    fs::write(root.join("last-file.txt"), path.to_string_lossy().as_bytes())
        .map_err(|error| error.to_string())?;

    Ok(LoadResult {
        data,
        path: path.to_string_lossy().to_string(),
        updated_at: 0,
    })
}

#[tauri::command]
fn novel_pick_data_file(app: AppHandle) -> Result<Option<LoadResult>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("小说数据", &["json"])
        .blocking_pick_file();

    let Some(picked) = picked else { return Ok(None) };
    let path = picked
        .into_path()
        .map_err(|error| format!("无法读取所选路径：{error}"))?;
    Ok(Some(adopt_data_file(&app, &path)?))
}

#[tauri::command]
fn novel_open_data_file(app: AppHandle, path: String) -> Result<LoadResult, String> {
    let target = PathBuf::from(path.trim());
    if !target.is_absolute() {
        return Err("请给一个绝对路径".to_string());
    }
    adopt_data_file(&app, &target)
}

/// 切换到内置作品目录：<文档>/NovelUI/<名字>/project.json（等价于载入那个文件）
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
    let file = root.join(&name).join("project.json");
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(root.join("last-file.txt"), file.to_string_lossy().as_bytes())
        .map_err(|error| error.to_string())?;
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

#[allow(dead_code)]
fn _unused(_: ProjectMeta) {}
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
            novel_pick_data_file,
            novel_open_data_file
        ])
        .run(tauri::generate_context!())
        .expect("启动客户端失败");
}

#[allow(dead_code)]
fn _unused(_: ProjectMeta) {}

/**
 * 存储对外门面。
 *
 * 业务层只从这里取 loadRemoteState / saveRemoteState / exportToDisk，
 * 具体落到 HTTP 桥还是本地文件，由 src/storage/index.js 按运行环境选择：
 *   - 网页 / Harness：/plot-api/*（失败退回 localStorage）
 *   - Tauri 客户端：本地作品目录（project.json + backups/）
 *
 * 换存储只需要改 storage 实现，业务代码一行不动。
 */

export {
  loadRemoteState,
  saveRemoteState,
  exportToDisk,
  importFromDisk,
  readLocalInfo,
  openDataFile,
  openWorkspace,
  migrateToWorkspace,
  loadLibrary,
  saveLibrary,
  storage,
  storageName,
  platform,
} from './storage'

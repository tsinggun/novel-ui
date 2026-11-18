/**
 * 存储适配层 —— 网页 / Harness / Tauri 客户端共用同一套业务代码。
 *
 * 业务层只认 persist.js 暴露的三个函数（loadRemoteState / saveRemoteState / exportToDisk），
 * 具体落到哪由这里决定：
 *   - web：Harness 的 HTTP 桥（/plot-api/*），失败时退回 localStorage；
 *   - tauri：客户端里的本地文件（Rust 侧命令 novel_load_state / novel_save_state …）。
 *
 * 判断方式：Tauri 2 会在 window 上挂 __TAURI_INTERNALS__，网页端没有。
 */

import { createWebStorage } from './web'
import { createTauriStorage } from './tauri'

const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const storageName = isTauri() ? 'tauri' : 'web'

export const storage = isTauri() ? createTauriStorage() : createWebStorage()

/** 客户端形态标记：UI 上可以据此显示「本地文件」之类的提示 */
export const platform = {
  name: storageName,
  isDesktop: storageName === 'tauri',
}

export const loadRemoteState = (...args) => storage.loadState(...args)
export const saveRemoteState = (...args) => storage.saveState(...args)
export const exportToDisk = (...args) => storage.exportFile(...args)
export const importFromDisk = (...args) => storage.importFile(...args)

/** 本机运行信息（便携版/客户端才有；网页端返回 null） */
export const readLocalInfo = (...args) => storage.localInfo(...args)

/** 载入数据 = 选一个 json 文件，客户端的修改会写回这个文件 */
export const openDataFile = (...args) => storage.openDataFile(...args)

/** 作品目录（一卡一文件）：打开 / 把现有 json 拆成目录 */
export const openWorkspace = (...args) =>
  storage.openWorkspace
    ? storage.openWorkspace(...args)
    : Promise.resolve({ ok: false, error: '当前环境不支持作品目录' })

export const migrateToWorkspace = (...args) =>
  storage.migrateToWorkspace
    ? storage.migrateToWorkspace(...args)
    : Promise.resolve({ ok: false, error: '当前环境不支持作品目录' })

/** 素材库：一台机器一份，独立于任何作品，也不会传到线上 */
export const loadLibrary = (...args) => storage.loadLibrary(...args)
export const saveLibrary = (...args) => storage.saveLibrary(...args)

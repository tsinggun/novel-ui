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

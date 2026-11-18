/**
 * Tauri 客户端形态的存储实现（目录式作品存储）。
 *
 * 数据布局（每部作品一个目录）：
 *   <作品目录>/
 *     project.json          当前状态（卡片库 + 构造器）
 *     backups/project-<时间>.json   自动备份，保留最近 N 份
 *     chapters/             章节草稿（后续功能）
 *     exports/*.json        手动导出
 *
 * Rust 侧需要实现这几个命令（还没接上时 invoke 会失败，本层自动降级为 null/false，
 * 业务层会退回 localStorage，所以网页端行为完全不受影响）：
 *   novel_load_state()            -> { data, path, updatedAt } | null
 *   novel_save_state({ data })    -> { ok, path }
 *   novel_export_file({ payload })-> { path } | null
 *   novel_pick_project()          -> { path } | null      选一个作品目录
 *   novel_read_json({ path })     -> { data } | null      从对话框选的 json 读入
 */

const invoke = async (cmd, args) => {
  const tauri = window.__TAURI_INTERNALS__
  if (!tauri || typeof tauri.invoke !== 'function') return null
  try {
    return await tauri.invoke(cmd, args)
  } catch (error) {
    const detail = { state: 'error', message: (error && String(error)) || '本地文件读写失败' }
    try {
      window.dispatchEvent(new CustomEvent('novel-ui:persist', { detail }))
    } catch {
      /* ignore */
    }
    return null
  }
}

const notify = (detail) => {
  try {
    window.dispatchEvent(new CustomEvent('novel-ui:persist', { detail }))
  } catch {
    /* ignore */
  }
}

export function createTauriStorage() {
  let timer = null

  return {
    name: 'tauri',

    async loadState() {
      const res = await invoke('novel_load_state')
      if (!res || !res.data) return null
      notify({ state: 'loaded', path: res.path || '', updatedAt: res.updatedAt || 0 })
      return { data: res.data, updatedAt: Number(res.updatedAt) || 0, path: res.path || '' }
    },

    saveState(data) {
      if (timer) clearTimeout(timer)
      notify({ state: 'saving' })
      return new Promise((resolve) => {
        timer = setTimeout(async () => {
          timer = null
          const res = await invoke('novel_save_state', { data })
          if (!res || res.ok === false) {
            notify({ state: 'error', message: '本地写入失败' })
            resolve({ ok: false, path: '' })
            return
          }
          notify({ state: 'saved', path: res.path || '', at: Date.now() })
          resolve({ ok: true, path: res.path || '' })
        }, 600)
      })
    },

    async exportFile(payload) {
      const res = await invoke('novel_export_file', { payload })
      return res && res.path ? res.path : null
    },

    /** 客户端可以从原生对话框里挑一个 json 读进来 */
    async importFile() {
      const res = await invoke('novel_pick_project')
      if (!res || !res.data) return null
      return res
    },

    /** 原生窗口里本来就在本地跑，直接视为「可读写本机素材库」 */
    async localInfo() {
      return { platform: 'tauri', dir: '', library: '' }
    },

    /** 打开项目：不传 dir 时用原生文件夹对话框 */
    async openProject(dir) {
      const res = dir
        ? await invoke('novel_open_project', { dir })
        : await invoke('novel_pick_folder')
      if (!res || res.cancelled) return { ok: false, cancelled: true, dir: '' }
      return { ok: true, cancelled: false, dir: res.dir || '' }
    },

    async loadLibrary() {
      const res = await invoke('novel_load_library')
      if (!res || !res.data) return null
      return res
    },

    async saveLibrary(data) {
      const res = await invoke('novel_save_library', { data })
      if (!res || res.ok === false) return { ok: false, path: '' }
      return { ok: true, path: res.path || '' }
    },
  }
}

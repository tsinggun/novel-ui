/**
 * 网页 / Harness 形态的存储实现。
 *
 * Harness 里数据一律落本地磁盘（Host 路由 /plot-api/state）：
 *   读：GET  /plot-api/state  → <root>/novel-ui.json
 *   写：POST /plot-api/state（debounce 600ms）
 *   导出：POST /plot-api/export → <root>/exports/*.json
 *
 * localStorage 只在磁盘不可用时兜底（例如脱离 Harness 直接跑 vite dev）。
 */

const STATE_URL = '/plot-api/state'
const EXPORT_URL = '/plot-api/export'
const LIBRARY_URL = '/plot-api/library'
const INFO_URL = '/plot-api/info'
const DATA_FILE_URL = '/plot-api/data-file'
const WORKSPACE_URL = '/plot-api/workspace'

const notify = (detail) => {
  try {
    window.dispatchEvent(new CustomEvent('novel-ui:persist', { detail }))
  } catch {
    /* ignore */
  }
}

export function createWebStorage() {
  let timer = null

  return {
    name: 'web',

    async loadState() {
      try {
        const res = await fetch(STATE_URL + '?t=' + Date.now(), { cache: 'no-store' })
        if (!res.ok) return null
        const json = await res.json()
        if (!json || !json.data) return null
        notify({ state: 'loaded', path: json.path || '', updatedAt: json.updatedAt || 0 })
        return { data: json.data, updatedAt: Number(json.updatedAt) || 0, path: json.path || '' }
      } catch {
        return null
      }
    },

    saveState(data) {
      if (timer) clearTimeout(timer)
      notify({ state: 'saving' })
      return new Promise((resolve) => {
        timer = setTimeout(async () => {
          timer = null
          try {
            const res = await fetch(STATE_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data }),
            })
            if (!res.ok) throw new Error('HTTP ' + res.status)
            const json = await res.json()
            notify({ state: 'saved', path: json.path || '', at: Date.now() })
            resolve({ ok: true, path: json.path || '' })
          } catch (error) {
            notify({ state: 'error', message: (error && error.message) || '写入失败' })
            resolve({ ok: false, path: '' })
          }
        }, 600)
      })
    },

    /** 导出到磁盘；成功返回文件绝对路径，失败返回 null */
    async exportFile(payload) {
      try {
        const res = await fetch(EXPORT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload }),
        })
        if (!res.ok) return null
        const json = await res.json()
        return json && json.path ? json.path : null
      } catch {
        return null
      }
    },

    /** 网页端导入靠 <input type="file">，这里不提供 */
    async importFile() {
      return null
    },

    /** 本地运行信息：只有便携版 / 客户端才应答，应答即代表「可以读写本机素材库」 */
    async localInfo() {
      try {
        const res = await fetch(INFO_URL + '?t=' + Date.now(), { cache: 'no-store' })
        if (!res.ok) return null
        const json = await res.json()
        return json || null
      } catch {
        return null
      }
    },

    /** 素材库：整份读写，不跟作品数据混在一起 */
    /**
     * 载入数据：
     *   - 选 .json 文件 → 单文件模式
     *   - 选作品文件夹（kind='dir'）→ 目录模式（一卡一文件）
     * 不传 path 就让系统弹窗
     */
    async openDataFile(pathIn, kind, extra = {}) {
      try {
        const payload = { ...extra }
        if (pathIn) payload.path = pathIn
        if (kind === 'dir') payload.kind = 'dir'
        const res = await fetch(DATA_FILE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) return { ok: false, cancelled: false, error: 'HTTP ' + res.status }
        const json = await res.json()
        return {
          ok: Boolean(json.ok),
          cancelled: Boolean(json.cancelled),
          path: json.path || '',
          mode: json.mode === 'dir' ? 'dir' : 'file',
          fresh: Boolean(json.fresh),
          data: json.data || null,
          error: json.error || '',
        }
      } catch (error) {
        return { ok: false, cancelled: false, error: String(error) }
      }
    },

    /** 作品目录：打开 / 新建 / 把 json 拆成目录 */
    async openWorkspace(pathIn) {
      try {
        const res = await fetch(WORKSPACE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'open', ...(pathIn ? { path: pathIn } : {}) }),
        })
        if (!res.ok) return { ok: false, error: 'HTTP ' + res.status }
        const json = await res.json()
        return {
          ok: Boolean(json.ok),
          cancelled: Boolean(json.cancelled),
          path: json.path || '',
          data: json.data || null,
          fresh: Boolean(json.fresh),
          error: json.error || '',
        }
      } catch (error) {
        return { ok: false, error: String(error) }
      }
    },

    /** 把当前（或指定）的 json 拆成作品目录；attach=true 拆完直接切过去 */
    async migrateToWorkspace({ jsonPath, targetDir, attach = true } = {}) {
      try {
        const res = await fetch(WORKSPACE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'migrate', jsonPath, targetDir, attach }),
        })
        if (!res.ok) return { ok: false, error: 'HTTP ' + res.status }
        const json = await res.json()
        return {
          ok: Boolean(json.ok),
          dir: json.dir || '',
          counts: json.counts || null,
          attached: Boolean(json.attached),
          data: json.data || null,
          error: json.error || '',
        }
      } catch (error) {
        return { ok: false, error: String(error) }
      }
    },

    async loadLibrary() {
      try {
        const res = await fetch(LIBRARY_URL + '?t=' + Date.now(), { cache: 'no-store' })
        if (!res.ok) return null
        const json = await res.json()
        return json && json.data ? json : null
      } catch {
        return null
      }
    },

    async saveLibrary(data) {
      try {
        const res = await fetch(LIBRARY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data }),
        })
        if (!res.ok) return { ok: false, path: '' }
        const json = await res.json()
        return { ok: true, path: json.path || '' }
      } catch {
        return { ok: false, path: '' }
      }
    },
  }
}

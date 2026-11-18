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
const PROJECT_URL = '/plot-api/project'

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
    /** 打开项目 = 选一个文件夹；不传 dir 就让系统弹选择框 */
    async openProject(dir) {
      try {
        const res = await fetch(PROJECT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dir ? { dir } : {}),
        })
        if (!res.ok) return { ok: false, cancelled: false, dir: '', error: 'HTTP ' + res.status }
        const json = await res.json()
        return {
          ok: Boolean(json.ok),
          cancelled: Boolean(json.cancelled),
          dir: json.dir || '',
          error: json.error || '',
        }
      } catch (error) {
        return { ok: false, cancelled: false, dir: '', error: String(error) }
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

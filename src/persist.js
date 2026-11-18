/**
 * 本地文件持久化。
 *
 * Harness 里数据一律落本地磁盘（Host 路由 /plot-api/state），不以浏览器存储为主：
 *   读：GET  /plot-api/state  → <root>/novel-ui.json
 *   写：POST /plot-api/state（debounce 600ms）
 *   导出：POST /plot-api/export → <root>/exports/*.json
 *
 * localStorage 只在磁盘不可用时兜底（例如脱离 Harness 直接跑 vite dev）。
 */

const STATE_URL = '/plot-api/state'
const EXPORT_URL = '/plot-api/export'

const notify = (detail) => {
  try {
    window.dispatchEvent(new CustomEvent('novel-ui:persist', { detail }))
  } catch {
    /* ignore */
  }
}

export async function loadRemoteState() {
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
}

let timer = null
export function saveRemoteState(data) {
  if (timer) clearTimeout(timer)
  notify({ state: 'saving' })
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
      return true
    } catch (error) {
      notify({ state: 'error', message: (error && error.message) || '写入失败' })
      return false
    }
  }, 600)
}

/** 导出到磁盘；成功返回文件绝对路径，失败返回 null */
export async function exportToDisk(payload) {
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
}

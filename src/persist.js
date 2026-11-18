/**
 * Harness 持久化桥接。
 *
 * 浏览器里的 localStorage 按「源」隔离（端口一变就是另一份），所以这里再加一层：
 * 把整份构造器状态写到磁盘 <root>/novel-ui.json，由 Host 路由 /plot-api/state 承担。
 * 读：localStorage 为空或磁盘更新时，用磁盘那份。
 * 写：数据变化后 debounce 落盘（失败静默，localStorage 仍在兜底）。
 */

const STATE_URL = '/plot-api/state'
const EXPORT_URL = '/plot-api/export'

export async function loadRemoteState() {
  try {
    const res = await fetch(STATE_URL + '?t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    if (!json || !json.data) return null
    return { data: json.data, updatedAt: Number(json.updatedAt) || 0, path: json.path || '' }
  } catch {
    return null
  }
}

let timer = null
export function saveRemoteState(data) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(async () => {
    timer = null
    try {
      await fetch(STATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
    } catch {
      /* 落盘失败不打扰用户，localStorage 仍有一份 */
    }
  }, 600)
}

/** 导出到磁盘；成功返回文件绝对路径，失败返回 null（调用方退回浏览器下载） */
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

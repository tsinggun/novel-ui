import { useCallback, useEffect, useState } from 'react'
import { loadLibrary, readLocalInfo, saveLibrary } from './persist'

/**
 * 素材库：本机一份卡片池（人物/场景/技法），用来跨作品复用。
 *
 * - 只有便携版 / 客户端这类「本地运行」形态能读写（网页端 readLocalInfo 返回 null → 不显示入口）
 * - 存在 <文档>/NovelUI/_library/library.json，不跟任何作品混在一起，也不随作品导出
 */

const empty = { characters: [], scenes: [], techniques: [] }

const normalize = (raw) => ({
  characters: Array.isArray(raw?.characters) ? raw.characters : [],
  scenes: Array.isArray(raw?.scenes) ? raw.scenes : [],
  techniques: Array.isArray(raw?.techniques) ? raw.techniques : [],
})

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `lib-${Date.now()}-${Math.random().toString(16).slice(2)}`

/** 同名 + 同内容视为同一份素材，避免重复存 */
const sameItem = (a, b) =>
  String(a.name || '').trim() === String(b.name || '').trim() &&
  String(a.detail || '').trim() === String(b.detail || '').trim()

export function useLibrary() {
  const [available, setAvailable] = useState(false)
  const [libraryPath, setLibraryPath] = useState('')
  const [library, setLibrary] = useState(empty)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const info = await readLocalInfo()
      if (!alive) return
      if (!info) return
      setAvailable(true)
      setLibraryPath(info.library || '')
      const res = await loadLibrary()
      if (!alive) return
      if (res && res.data) setLibrary(normalize(res.data))
      if (res && res.path) setLibraryPath(res.path)
      setLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [])

  /* 变了就落盘，600ms 合并一次写入 */
  useEffect(() => {
    if (!available || !loaded) return
    let alive = true
    const timer = setTimeout(async () => {
      setBusy(true)
      await saveLibrary(library)
      if (alive) setBusy(false)
    }, 600)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [library, available, loaded])

  /** 把当前作品里的某张卡存进素材库 */
  const keep = useCallback((kind, item) => {
    setLibrary((prev) => {
      const list = prev[kind] || []
      if (list.some((one) => sameItem(one, item))) return prev
      const copy = {
        id: uid(),
        name: item.name,
        detail: item.detail || '',
        createdAt: Date.now(),
      }
      if (kind === 'techniques') copy.tags = Array.isArray(item.tags) ? [...item.tags] : []
      return { ...prev, [kind]: [...list, copy] }
    })
  }, [])

  const drop = useCallback((kind, id) => {
    setLibrary((prev) => ({
      ...prev,
      [kind]: (prev[kind] || []).filter((item) => item.id !== id),
    }))
  }, [])

  return {
    available,
    loaded,
    busy,
    libraryPath,
    library,
    keep,
    drop,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { loadRemoteState, saveRemoteState } from './persist'

const STORAGE_KEY = 'novel-ui.builder.v1'

const emptyData = {
  characters: [],
  scenes: [],
  techniques: [],
  plots: [],
  inBuilder: { characters: [], scenes: [] },
  /** 已在上下文里的人/景：提示词里只留名字和备注，不再贴卡片描述，省 token */
  inContext: { characters: [], scenes: [] },
  notes: { character: '', scene: '' },
  /** 构造器里每个人物独立的本章备注（衣服、心情、状态……），按人物 id 存 */
  characterNotes: {},
  /** 自定义的开头提示词；null 表示用默认那句 */
  promptIntro: null,
  /** 情节内容的字号（px），阅读和编辑共用 */
  plotFontSize: 14,
  /** 前情提要：上一章结尾或必要前情，留空则不输出 */
  previousRecap: '',
}

const PLOT_FONT_MIN = 12
const PLOT_FONT_MAX = 22

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now()}-${Math.random().toString(16).slice(2)}`

const normalize = (raw) => {
  const base = {
    ...emptyData,
    inBuilder: { ...emptyData.inBuilder },
    inContext: { ...emptyData.inContext },
    notes: { ...emptyData.notes },
  }
  if (!raw || typeof raw !== 'object') return base

  return {
    ...base,
    characters: Array.isArray(raw.characters) ? raw.characters : [],
    scenes: Array.isArray(raw.scenes) ? raw.scenes : [],
    techniques: (Array.isArray(raw.techniques) ? raw.techniques : []).map((item) => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags : [],
    })),
    plots: Array.isArray(raw.plots) ? raw.plots : [],
    inBuilder: { ...base.inBuilder, ...(raw.inBuilder || {}) },
    inContext: { ...base.inContext, ...(raw.inContext || {}) },
    notes: { ...base.notes, ...(raw.notes || {}) },
    characterNotes: { ...(raw.characterNotes || {}) },
    promptIntro: typeof raw.promptIntro === 'string' ? raw.promptIntro : null,
    plotFontSize: Number(raw.plotFontSize) || 14,
    previousRecap: typeof raw.previousRecap === 'string' ? raw.previousRecap : '',
  }
}

/** 只在读取本地兜底时用；磁盘可用时不会用到 */
const loadLocal = () => {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'))
  } catch {
    return normalize(null)
  }
}

const isBlank = (d) =>
  d.characters.length === 0 &&
  d.scenes.length === 0 &&
  d.techniques.length === 0 &&
  d.plots.length === 0

export function useNovelData() {
  /* 先空着，等磁盘那份回来再铺数据，避免用空状态覆盖磁盘 */
  const [data, setData] = useState(() => normalize(null))
  const [loaded, setLoaded] = useState(false)
  /** 换项目文件夹时 +1，触发重新从新目录读一遍 */
  const [epoch, setEpoch] = useState(0)
  /** 换了项目就不能拿上一个项目的 localStorage 兜底，否则会把旧卡片写进新文件夹 */
  const freshRef = useRef(false)

  /* 启动 / 换项目：磁盘优先，磁盘没有才用 localStorage 兜底 */
  useEffect(() => {
    let alive = true
    ;(async () => {
      const remote = await loadRemoteState()
      if (!alive) return
      if (remote && remote.data) {
        const next = normalize(remote.data)
        if (!isBlank(next) || isBlank(loadLocal())) setData(next)
        else setData(loadLocal())
        setLoaded(true)
        return
      }
      if (freshRef.current) {
        // 新项目文件夹里还没有 project.json：从空库开始
        setData(normalize(null))
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* ignore */
        }
        freshRef.current = false
        setLoaded(true)
        return
      }
      setData(loadLocal())
      setLoaded(true)
    })()
    return () => {
      alive = false
    }
  }, [epoch])

  /** 换项目文件夹后重新读：先把 loaded 关掉，免得旧数据被写进新目录 */
  const reload = useCallback(() => {
    freshRef.current = true
    setLoaded(false)
    setEpoch((value) => value + 1)
  }, [])

  /* 数据变化 → 落本地文件；磁盘写不了才退回 localStorage */
  useEffect(() => {
    if (!loaded) return
    let alive = true
    ;(async () => {
      const saved = await saveRemoteState(data)
      const ok = saved === true || Boolean(saved && saved.ok)
      if (!alive) return
      if (!ok) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        } catch {
          /* ignore */
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [data, loaded])

  /** 新建或更新人物卡（draft 带 id 即为编辑） */
  const saveCharacter = useCallback((draft) => {
    const name = draft.name.trim() || '未命名人物'
    const detail = draft.detail.trim()
    setData((prev) => {
      if (draft.id) {
        return {
          ...prev,
          characters: prev.characters.map((item) =>
            item.id === draft.id ? { ...item, name, detail } : item,
          ),
        }
      }
      return {
        ...prev,
        characters: [
          ...prev.characters,
          { id: uid(), name, detail, createdAt: Date.now() },
        ],
      }
    })
  }, [])

  const saveScene = useCallback((draft) => {
    const name = draft.name.trim() || '未命名场景'
    const detail = draft.detail.trim()
    setData((prev) => {
      if (draft.id) {
        return {
          ...prev,
          scenes: prev.scenes.map((item) =>
            item.id === draft.id ? { ...item, name, detail } : item,
          ),
        }
      }
      return {
        ...prev,
        scenes: [
          ...prev.scenes,
          { id: uid(), name, detail, createdAt: Date.now() },
        ],
      }
    })
  }, [])

  const saveTechnique = useCallback((draft) => {
    const name = draft.name.trim() || '未命名技法'
    const detail = draft.detail.trim()
    const tags = Array.isArray(draft.tags)
      ? draft.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : []
    setData((prev) => {
      if (draft.id) {
        return {
          ...prev,
          techniques: prev.techniques.map((item) =>
            item.id === draft.id ? { ...item, name, detail, tags } : item,
          ),
        }
      }
      return {
        ...prev,
        techniques: [
          ...prev.techniques,
          { id: uid(), name, detail, tags, createdAt: Date.now() },
        ],
      }
    })
  }, [])

  /** 删除实体时一并从构建器里摘掉（人物还顺手清掉它的本章备注） */
  const removeEntity = useCallback((kind, id) => {
    setData((prev) => {
      const next = {
        ...prev,
        [kind]: prev[kind].filter((item) => item.id !== id),
        inBuilder: {
          ...prev.inBuilder,
          [kind]: (prev.inBuilder[kind] || []).filter((itemId) => itemId !== id),
        },
        inContext: {
          ...prev.inContext,
          [kind]: (prev.inContext[kind] || []).filter((itemId) => itemId !== id),
        },
      }

      if (kind === 'characters' && id in prev.characterNotes) {
        const notesCopy = { ...prev.characterNotes }
        delete notesCopy[id]
        next.characterNotes = notesCopy
      }

      if (kind === 'techniques') {
        next.plots = prev.plots.map((plot) => ({
          ...plot,
          techniqueIds: (plot.techniqueIds || []).filter((techId) => techId !== id),
        }))
      }

      return next
    })
  }, [])

  const toggleInBuilder = useCallback((kind, id) => {
    setData((prev) => {
      const list = prev.inBuilder[kind]
      const has = list.includes(id)
      const nextList = has ? list.filter((itemId) => itemId !== id) : [...list, id]
      return {
        ...prev,
        inBuilder: {
          ...prev.inBuilder,
          [kind]: nextList,
        },
        // 移出构建器时，顺手取消「已在上下文」标记
        inContext: has
          ? prev.inContext
          : {
              ...prev.inContext,
              [kind]: (prev.inContext[kind] || []).filter((itemId) => itemId !== id),
            },
      }
    })
  }, [])

  /** 勾选「已在上下文」：提示词不再贴这张卡的描述，只留名字与备注 */
  const toggleInContext = useCallback((kind, id) => {
    setData((prev) => {
      const list = prev.inContext[kind] || []
      const has = list.includes(id)
      return {
        ...prev,
        inContext: {
          ...prev.inContext,
          [kind]: has ? list.filter((itemId) => itemId !== id) : [...list, id],
        },
      }
    })
  }, [])

  const addPlot = useCallback(({ content, wordCount, techniqueIds = [] }) => {
    const text = content.trim()
    if (!text) return
    setData((prev) => ({
      ...prev,
      plots: [
        ...prev.plots,
        {
          id: uid(),
          content: text,
          wordCount: Math.max(0, Number(wordCount) || 0),
          techniqueIds,
          createdAt: Date.now(),
        },
      ],
    }))
  }, [])

  const removePlot = useCallback((id) => {
    setData((prev) => ({
      ...prev,
      plots: prev.plots.filter((plot) => plot.id !== id),
    }))
  }, [])

  /** 编辑一条情节：内容、字数、技法（技法可多条） */
  const updatePlot = useCallback((id, patch) => {
    const content = (patch.content || '').trim()
    if (!content) return
    const nextTechniqueIds = Array.isArray(patch.techniqueIds)
      ? patch.techniqueIds.filter(Boolean)
      : patch.techniqueId
        ? [patch.techniqueId]
        : []
    setData((prev) => ({
      ...prev,
      plots: prev.plots.map((plot) =>
        plot.id === id
          ? {
              ...plot,
              content,
              wordCount: Math.max(0, Number(patch.wordCount) || 0),
              techniqueIds: nextTechniqueIds,
            }
          : plot,
      ),
    }))
  }, [])

  /** 上移 / 下移一条情节（delta = -1 | 1） */
  const movePlot = useCallback((id, delta) => {
    setData((prev) => {
      const index = prev.plots.findIndex((plot) => plot.id === id)
      const target = index + delta
      if (index < 0 || target < 0 || target >= prev.plots.length) return prev
      const plots = [...prev.plots]
      const [moved] = plots.splice(index, 1)
      plots.splice(target, 0, moved)
      return { ...prev, plots }
    })
  }, [])

  /** 导入整份数据（覆盖当前） */
  const importData = useCallback((raw) => {
    setData(normalize(raw))
  }, [])

  /** 清空构造器：只清这一章的组装，卡片库（人物/场景/技法）保留 */
  const clearBuilder = useCallback(() => {
    setData((prev) => ({
      ...prev,
      plots: [],
      inBuilder: { characters: [], scenes: [] },
      inContext: { characters: [], scenes: [] },
      notes: { character: '', scene: '' },
      characterNotes: {},
    }))
  }, [])

  const setNote = useCallback((key, value) => {
    setData((prev) => ({
      ...prev,
      notes: { ...prev.notes, [key]: value },
    }))
  }, [])

  /** 按人物 id 写入本章备注，删人物时顺手清掉 */
  const setCharacterNote = useCallback((id, value) => {
    setData((prev) => ({
      ...prev,
      characterNotes: { ...prev.characterNotes, [id]: value },
    }))
  }, [])

  /** 开头提示词：null 表示恢复默认 */
  const setPromptIntro = useCallback((value) => {
    setData((prev) => ({ ...prev, promptIntro: value }))
  }, [])

  /** 情节内容字号，夹在 12–22px 之间 */
  const setPlotFontSize = useCallback((size) => {
    setData((prev) => ({
      ...prev,
      plotFontSize: Math.min(PLOT_FONT_MAX, Math.max(PLOT_FONT_MIN, Number(size) || 14)),
    }))
  }, [])

  /** 前情提要（可为空） */
  const setPreviousRecap = useCallback((value) => {
    setData((prev) => ({ ...prev, previousRecap: value }))
  }, [])

  return {
    data,
    loaded,
    reload,
    saveCharacter,
    saveScene,
    saveTechnique,
    removeEntity,
    toggleInBuilder,
    toggleInContext,
    addPlot,
    removePlot,
    updatePlot,
    movePlot,
    importData,
    clearBuilder,
    setNote,
    setCharacterNote,
    setPromptIntro,
    setPlotFontSize,
    setPreviousRecap,
  }
}

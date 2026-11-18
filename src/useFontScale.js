import { useCallback, useEffect, useState } from 'react'

const KEY = 'novel-ui.fontScale.v1'

export const FS_MIN = 0.85
export const FS_MAX = 1.5
export const FS_STEP = 0.05

const clamp = (value) => Math.min(FS_MAX, Math.max(FS_MIN, Math.round(value * 100) / 100))

const readStored = () => {
  try {
    const raw = Number(localStorage.getItem(KEY))
    return Number.isFinite(raw) && raw > 0 ? clamp(raw) : 1
  } catch {
    return 1
  }
}

/**
 * 全局字号缩放：把比例写进根元素上的 `--fs`，所有字号都是 calc(Npx * var(--fs))。
 * 只影响文字，不影响边框/间距；比例存在 localStorage，刷新后保留。
 */
export function useFontScale() {
  const [scale, setScaleState] = useState(readStored)

  useEffect(() => {
    document.documentElement.style.setProperty('--fs', String(scale))
    try {
      localStorage.setItem(KEY, String(scale))
    } catch {
      /* 存不上也无所谓，本次会话仍然生效 */
    }
  }, [scale])

  const setScale = useCallback((value) => setScaleState(clamp(value)), [])
  const step = useCallback((delta) => setScaleState((prev) => clamp(prev + delta)), [])
  const reset = useCallback(() => setScaleState(1), [])

  return { scale, setScale, step, reset }
}

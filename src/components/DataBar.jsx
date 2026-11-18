import { useEffect, useState } from 'react'
import { openDataFile, readLocalInfo } from '../persist'
import './ProjectBar.css'

/**
 * 数据文件条（只在本地运行时出现）。
 *
 * 点「浏览文件…」用系统对话框选一个 json，把里面的卡片装进界面；
 * 之后在客户端里的所有改动都会自动写回这个文件（写前备份到同目录 _novelui-backups）。
 */
export default function DataBar({ onLoadData }) {
  const [local, setLocal] = useState(false)
  const [file, setFile] = useState('')
  const [fresh, setFresh] = useState(false)
  const [freshHidden, setFreshHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const info = await readLocalInfo()
      if (!alive || !info) return
      setLocal(true)
      setFile(info.path || info.file || '')
      setFresh(Boolean(info.fresh))
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!local) return null

  const load = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await openDataFile()
      if (res.cancelled) return
      if (!res.ok) {
        setError(res.error || '这个文件读不了，确认是 json 格式')
        return
      }
      setFile(res.path)
      setFresh(false)
      onLoadData?.(res.data, res.path)
    } finally {
      setBusy(false)
    }
  }

  const name = file ? file.split(/[\\/]/).filter(Boolean).pop() : '未选择'

  return (
    <div className="project-bar">
      <span className="project-bar__label">数据文件</span>
      <span className="project-bar__name" title={file}>
        {name}
      </span>

      <button
        type="button"
        className="btn btn--solid btn--sm topbar__btn"
        onClick={load}
        disabled={busy}
        title="用系统对话框选一个 json 数据文件"
      >
        {busy ? '处理中…' : '浏览文件…'}
      </button>

      {error && <span className="project-bar__error">{error}</span>}

      {fresh && !freshHidden && (
        <div className="project-bar__fresh">
          <span>
            第一次使用：已经帮你建好空数据文件 <b>{name}</b>（在 {file}），直接写就行；要接着以前的进度，
            点「浏览文件…」选你原来那个 json。
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFreshHidden(true)}>
            知道了
          </button>
        </div>
      )}
    </div>
  )
}

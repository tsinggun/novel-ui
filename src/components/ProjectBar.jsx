import { useEffect, useState } from 'react'
import { openProject, readLocalInfo } from '../persist'
import './ProjectBar.css'

/**
 * 项目 = 一个文件夹。
 * 只在本地运行（便携版 / 客户端）出现：点「打开项目」选文件夹，
 * 人物卡 / 场景卡 / 技法卡都读写这个文件夹里的 project.json。
 */
export default function ProjectBar({ onSwitchProject }) {
  const [local, setLocal] = useState(false)
  const [dir, setDir] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const info = await readLocalInfo()
      if (!alive || !info) return
      setLocal(true)
      setDir(info.dir || '')
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!local) return null

  const handleOpen = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await openProject()
      if (res.cancelled) return
      if (!res.ok) {
        setError(res.error || '打开失败，换个文件夹试试')
        return
      }
      setDir(res.dir)
      onSwitchProject?.(res.dir)
    } finally {
      setBusy(false)
    }
  }

  const name = dir ? dir.split(/[\\/]/).filter(Boolean).pop() : '未选择'

  return (
    <div className="project-bar">
      <span className="project-bar__label">当前项目</span>
      <span className="project-bar__name" title={dir}>
        {name}
      </span>
      <button
        type="button"
        className="btn btn--solid btn--sm"
        onClick={handleOpen}
        disabled={busy}
        title="选一个文件夹作为项目：卡片都存在这个文件夹里"
      >
        {busy ? '正在打开…' : '打开项目'}
      </button>
      {error && <span className="project-bar__error">{error}</span>}
    </div>
  )
}

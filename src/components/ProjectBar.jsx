import { useEffect, useRef, useState } from 'react'
import { openProject, readLocalInfo } from '../persist'
import './ProjectBar.css'

/**
 * 项目 = 一个文件夹。
 * 只在本地运行（便携版 / 客户端）出现：人物卡 / 场景卡 / 技法卡都读写这个文件夹里的 project.json。
 *
 * 打开方式两种：点「浏览…」用系统对话框挑，或直接把路径粘进输入框回车 —— 后者不依赖弹框，最稳。
 */
export default function ProjectBar({ onSwitchProject }) {
  const [local, setLocal] = useState(false)
  const [dir, setDir] = useState('')
  const [input, setInput] = useState('')
  const [opened, setOpened] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

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

  useEffect(() => {
    if (opened) inputRef.current?.focus()
  }, [opened])

  if (!local) return null

  /** path 为空 = 走系统对话框 */
  const switchTo = async (path) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await openProject(path || undefined)
      if (res.cancelled) return
      if (!res.ok) {
        setError(res.error || '这个路径打不开，检查一下是否存在')
        setOpened(true)
        return
      }
      setDir(res.dir)
      setInput('')
      setOpened(false)
      onSwitchProject?.(res.dir)
    } finally {
      setBusy(false)
    }
  }

  const submitInput = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const path = input.trim()
    if (!path) return
    switchTo(path)
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
        onClick={() => setOpened((value) => !value)}
        title="换一个文件夹作为项目：卡片都存在这个文件夹里"
      >
        打开项目
      </button>

      <button
        type="button"
        className="btn btn--sm"
        onClick={() => switchTo(null)}
        disabled={busy}
        title="用系统对话框选文件夹"
      >
        {busy ? '处理中…' : '浏览…'}
      </button>

      {error && <span className="project-bar__error">{error}</span>}

      {opened && (
        <div className="project-bar__panel">
          <label className="project-bar__panel-label" htmlFor="project-path">
            文件夹路径
          </label>
          <input
            id="project-path"
            ref={inputRef}
            className="input project-bar__input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={submitInput}
            placeholder="粘贴路径后回车，例如 D:\小说\我的长篇"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn--solid btn--sm"
            onClick={() => switchTo(input.trim())}
            disabled={busy || !input.trim()}
          >
            打开此路径
          </button>
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              setOpened(false)
              setError('')
            }}
          >
            取消
          </button>
          <p className="project-bar__tip">
            这个文件夹里的 project.json 存人物卡 / 场景卡 / 技法卡；空文件夹会被当成新项目。打开过就记住，下次启动自动接着开。
          </p>
        </div>
      )}
    </div>
  )
}

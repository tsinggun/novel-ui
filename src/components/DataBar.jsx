import { useEffect, useRef, useState } from 'react'
import { openDataFile, readLocalInfo } from '../persist'
import './ProjectBar.css'

/**
 * 数据文件条（只在本地运行时出现）。
 *
 * 「载入数据」= 选一个 json 文件，把里面的卡片装进界面；
 * 之后在客户端里的所有改动都会自动写回这个文件（写前备份到同目录 _novelui-backups）。
 *
 * 两种载入方式：点「浏览文件…」用系统对话框，或直接把路径粘进输入框回车。
 */
export default function DataBar({ onLoadData }) {
  const [local, setLocal] = useState(false)
  const [file, setFile] = useState('')
  const [fresh, setFresh] = useState(false)
  const [freshHidden, setFreshHidden] = useState(false)
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
      setFile(info.path || info.file || '')
      setFresh(Boolean(info.fresh))
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (opened) inputRef.current?.focus()
  }, [opened])

  if (!local) return null

  /** path 为空 = 走系统文件对话框 */
  const load = async (path) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await openDataFile(path || undefined)
      if (res.cancelled) return
      if (!res.ok) {
        setError(res.error || '这个文件读不了，确认是 json 格式')
        setOpened(true)
        return
      }
      setFile(res.path)
      setInput('')
      setOpened(false)
      setFresh(false)
      onLoadData?.(res.data, res.path)
    } finally {
      setBusy(false)
    }
  }

  const submitInput = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    const path = input.trim()
    if (!path) return
    load(path)
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
        className="btn btn--solid btn--sm"
        onClick={() => setOpened((value) => !value)}
        title="载入一个存着卡片数据的 json 文件"
      >
        载入数据
      </button>

      <button
        type="button"
        className="btn btn--sm"
        onClick={() => load(null)}
        disabled={busy}
        title="用系统对话框选 json 文件"
      >
        {busy ? '处理中…' : '浏览文件…'}
      </button>

      {error && <span className="project-bar__error">{error}</span>}

      {opened && (
        <div className="project-bar__panel">
          <label className="project-bar__panel-label" htmlFor="data-path">
            文件路径
          </label>
          <input
            id="data-path"
            ref={inputRef}
            className="input project-bar__input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={submitInput}
            placeholder="粘贴 json 路径后回车，例如 D:\小说\我的书\project.json"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn btn--solid btn--sm"
            onClick={() => load(input.trim())}
            disabled={busy || !input.trim()}
          >
            载入此路径
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
            载入后，界面里的改动会自动写回这个文件，写之前备份到同目录的 _novelui-backups，留最近 10 份。
          </p>
        </div>
      )}

      {fresh && !freshHidden && (
        <div className="project-bar__fresh">
          <span>
            第一次使用：已经帮你建好空数据文件 <b>{name}</b>（在 {file}），直接写就行；要接着以前的进度，
            点「载入数据」选你原来那个 json。
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFreshHidden(true)}>
            知道了
          </button>
        </div>
      )}
    </div>
  )
}

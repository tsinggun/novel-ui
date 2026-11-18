import { useEffect, useState } from 'react'
import { openDataFile, readLocalInfo } from '../persist'
import './ProjectBar.css'

/**
 * 数据来源条（只在本地运行时出现）。
 *
 * 两种存储模式：
 *   - 单文件模式：选一个 .json，整库写回这个文件（老路子）
 *   - 作品目录模式：选一个文件夹（里面一卡一文件，只写改过的那张，改前留旧版）
 *
 * 顶栏两个入口：「浏览文件…」选 json，「作品目录…」选文件夹。
 */
export default function DataBar({ onLoadData }) {
  const [local, setLocal] = useState(false)
  const [file, setFile] = useState('')
  const [mode, setMode] = useState('file')
  const [fresh, setFresh] = useState(false)
  const [freshHidden, setFreshHidden] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** 作品目录改成在界面里填路径：不弹系统框，免得被主窗口挡住又没法输入 */
  const [dirOpen, setDirOpen] = useState(false)
  const [dirPath, setDirPath] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const info = await readLocalInfo()
      if (!alive || !info) return
      setLocal(true)
      setFile(info.path || info.file || '')
      setMode(info.mode === 'dir' ? 'dir' : 'file')
      setFresh(Boolean(info.fresh))
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!local) return null

  const load = async (kind, pathIn) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await openDataFile(pathIn, kind)
      if (res.cancelled) return
      if (!res.ok) {
        setError(res.error || '这个路径读不了')
        return
      }
      setFile(res.path)
      setMode(res.mode === 'dir' ? 'dir' : 'file')
      setFresh(false)
      onLoadData?.(res.data, res.path)
    } finally {
      setBusy(false)
    }
  }

  const name = file ? file.split(/[\\/]/).filter(Boolean).pop() : '未选择'

  // 默认填「当前 json 同名的文件夹」，一开始就能直接确定
  const openDirPrompt = () => {
    const suggestion = file
      ? mode === 'dir'
        ? file
        : file.replace(/\.json$/i, '')
      : ''
    setDirPath(suggestion)
    setError('')
    setDirOpen(true)
  }

  const submitDir = (event) => {
    event?.preventDefault?.()
    const target = dirPath.trim().replace(/^"|"$/g, '')
    if (!target) {
      setError('先填一个文件夹路径')
      return
    }
    setDirOpen(false)
    load('dir', target)
  }

  return (
    <div className="project-bar">
      <span className="project-bar__label">{mode === 'dir' ? '作品目录' : '数据文件'}</span>
      <span className="project-bar__name" title={file}>
        {name}
      </span>

      <button
        type="button"
        className="btn btn--solid btn--sm topbar__btn"
        onClick={() => load('file')}
        disabled={busy}
        title="用系统对话框选一个 json 数据文件（整库读写）"
      >
        {busy ? '处理中…' : '浏览文件…'}
      </button>

      <button
        type="button"
        className="btn btn--sm topbar__btn"
        onClick={openDirPrompt}
        disabled={busy}
        title="填一个作品文件夹路径：里面一卡一文件，只写改过的那张"
      >
        作品目录…
      </button>

      {dirOpen && (
        <div className="path-prompt">
          <form className="path-prompt__box" onSubmit={submitDir}>
            <span className="path-prompt__title">作品目录</span>
            <p className="path-prompt__tip">
              粘贴文件夹路径，回车打开。没有这个文件夹就新建，里面是空的就自动建骨架
              （characters / scenes / techniques / plots）。
            </p>
            <input
              className="input path-prompt__input"
              type="text"
              spellCheck={false}
              autoFocus
              placeholder="D:\写作\我的小说"
              value={dirPath}
              onChange={(event) => setDirPath(event.target.value)}
            />
            {error && <p className="path-prompt__error">{error}</p>}
            <div className="path-prompt__actions">
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setDirOpen(false)}>
                取消
              </button>
              <button type="submit" className="btn btn--sm btn--solid">
                打开
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <span className="project-bar__error">{error}</span>}

      {fresh && !freshHidden && (
        <div className="project-bar__fresh">
          <span>
            第一次使用：已经帮你建好空数据 <b>{name}</b>（在 {file}），直接写就行；要接着以前的进度，
            点「浏览文件…」选你原来那个 json，或者「作品目录…」选一个作品文件夹。
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFreshHidden(true)}>
            知道了
          </button>
        </div>
      )}
    </div>
  )
}


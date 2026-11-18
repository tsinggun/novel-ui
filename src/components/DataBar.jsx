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
  /** 新建项目：位置（父目录）+ 项目名 */
  const [newOpen, setNewOpen] = useState(false)
  const [newParent, setNewParent] = useState('')
  const [newName, setNewName] = useState('')

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

  const load = async (kind, pathIn, extra) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await openDataFile(pathIn, kind, extra)
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
      setError('先填一个路径')
      return
    }
    setDirOpen(false)
    // 顺手兼容老数据：填的是 .json 就当单文件打开，方便把以前的 json 接进来
    if (/\.json$/i.test(target)) load('file', target)
    else load('dir', target)
  }

  // 新建项目：在「位置」下建一个「项目名」文件夹，里面自动长出骨架
  const openNewPrompt = () => {
    const parent = file
      ? mode === 'dir'
        ? file.replace(/[\\/][^\\/]*$/, '')
        : file.replace(/[\\/][^\\/]*$/, '')
      : ''
    setNewParent(parent)
    setNewName('')
    setError('')
    setNewOpen(true)
  }

  const submitNew = (event) => {
    event?.preventDefault?.()
    const parent = newParent.trim().replace(/^"|"$/g, '').replace(/[\\/]$/, '')
    const projectName = newName.trim().replace(/^"|"$/g, '')
    if (!parent) {
      setError('先填一个位置（父文件夹）')
      return
    }
    if (!projectName) {
      setError('给项目起个名字')
      return
    }
    if (/[\\/:*?"<>|]/.test(projectName)) {
      setError('项目名里不能有 \\ / : * ? " < > |')
      return
    }
    setNewOpen(false)
    load('dir', `${parent}\\${projectName}`, { create: true })
  }

  const newPathPreview = () => {
    const parent = newParent.trim().replace(/^"|"$/g, '').replace(/[\\/]$/, '')
    const projectName = newName.trim()
    if (!parent && !projectName) return ''
    return `${parent}${parent ? '\\' : ''}${projectName}`
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
        onClick={openNewPrompt}
        disabled={busy}
        title="新建一个作品：指定位置和项目名，目录里会自动建好卡片结构"
      >
        {busy ? '处理中…' : '新建项目'}
      </button>

      <button
        type="button"
        className="btn btn--sm topbar__btn"
        onClick={openDirPrompt}
        disabled={busy}
        title="打开一个已有的作品文件夹：一卡一文件，只写改过的那张"
      >
        打开项目…
      </button>

      {newOpen && (
        <div className="path-prompt">
          <form className="path-prompt__box" onSubmit={submitNew}>
            <span className="path-prompt__title">新建项目</span>
            <p className="path-prompt__tip">
              在「位置」下面建一个以项目名命名的文件夹，并自动建好
              characters / scenes / techniques / plots 和 manifest。
            </p>
            <label className="path-prompt__field">
              <span className="path-prompt__field-label">位置</span>
              <input
                className="input path-prompt__input"
                type="text"
                spellCheck={false}
                autoFocus
                placeholder="D:\写作"
                value={newParent}
                onChange={(event) => setNewParent(event.target.value)}
              />
            </label>
            <label className="path-prompt__field">
              <span className="path-prompt__field-label">项目名</span>
              <input
                className="input path-prompt__input"
                type="text"
                spellCheck={false}
                placeholder="雨夜旧书店"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </label>
            {newPathPreview() && (
              <p className="path-prompt__preview">将创建：{newPathPreview()}</p>
            )}
            {error && <p className="path-prompt__error">{error}</p>}
            <div className="path-prompt__actions">
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => setNewOpen(false)}>
                取消
              </button>
              <button type="submit" className="btn btn--sm btn--solid">
                创建并打开
              </button>
            </div>
          </form>
        </div>
      )}

      {dirOpen && (
        <div className="path-prompt">
          <form className="path-prompt__box" onSubmit={submitDir}>
            <span className="path-prompt__title">打开项目</span>
            <p className="path-prompt__tip">
              粘贴作品文件夹路径，回车打开；空的文件夹会自动建骨架
              （characters / scenes / techniques / plots）。填 .json 结尾的路径也能打开老的单文件数据。
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


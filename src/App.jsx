import { useEffect, useRef, useState } from 'react'
import NavTabs from './components/NavTabs'
import FontScaleControl from './components/FontScaleControl'
import DataBar from './components/DataBar'
import BuilderPage from './pages/BuilderPage'
import CharacterPage from './pages/CharacterPage'
import ScenePage from './pages/ScenePage'
import TechniquePage from './pages/TechniquePage'
import { readLocalInfo } from './persist'
import { useNovelData } from './useNovelData'
import { useFontScale } from './useFontScale'
import './App.css'

function App() {
  const [tab, setTab] = useState('builder')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewSignal, setPreviewSignal] = useState(0)
  /** 只有在本地跑（便携版 / 客户端）时才有数据文件条和「退出」 */
  const [local, setLocal] = useState(false)
  const settingsRef = useRef(null)
  const novel = useNovelData()
  const { scale, step, reset } = useFontScale()

  useEffect(() => {
    let alive = true
    readLocalInfo().then((info) => {
      if (alive) setLocal(Boolean(info))
    })
    return () => {
      alive = false
    }
  }, [])

  // 点「设置」外面 / 按 Esc 就把面板收起来
  useEffect(() => {
    if (!settingsOpen) return undefined
    const handleDown = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) setSettingsOpen(false)
    }
    const handleKey = (event) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handleDown)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      window.removeEventListener('keydown', handleKey)
    }
  }, [settingsOpen])

  const openPreview = () => {
    setTab('builder')
    setPreviewSignal((value) => value + 1)
  }

  const quit = () => {
    window.close()
    // --app 窗口允许自关；万一被浏览器拦下，给一句提示
    setTimeout(() => {
      if (!window.closed) window.alert('浏览器拦住了自动关闭，请点窗口右上角的 × 退出。')
    }, 120)
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__left">
          {local && <DataBar onLoadData={(data) => novel.applyLoaded(data)} />}
          <button
            type="button"
            className="btn btn--sm topbar__btn"
            onClick={openPreview}
            title="看一眼当前会拼成什么提示词"
          >
            预览提示词
          </button>
        </div>

        <div className="topbar__right">
          <div className="topbar__settings" ref={settingsRef}>
            <button
              type="button"
              className={`btn btn--sm topbar__btn${settingsOpen ? ' is-open' : ''}`}
              onClick={() => setSettingsOpen((value) => !value)}
              aria-expanded={settingsOpen}
            >
              设置
            </button>
            {settingsOpen && (
              <div className="settings">
                <span className="settings__title">全局字号</span>
                <FontScaleControl scale={scale} step={step} reset={reset} />
                <p className="settings__tip">影响全站文字大小，含卡片里的说明与详情。</p>
              </div>
            )}
          </div>
          {local && (
            <button type="button" className="btn btn--sm topbar__btn" onClick={quit} title="关闭这个窗口">
              退出
            </button>
          )}
        </div>
      </header>

      <div className="shell__body">
        <aside className="sidebar">
          <span className="sidebar__caption">视图</span>
          <NavTabs value={tab} onChange={setTab} layout="side" />
        </aside>

        <main className="workspace">
          {tab === 'builder' && (
            <BuilderPage novel={novel} onNavigate={setTab} previewSignal={previewSignal} />
          )}
          {tab === 'character' && <CharacterPage novel={novel} />}
          {tab === 'scene' && <ScenePage novel={novel} />}
          {tab === 'technique' && <TechniquePage novel={novel} />}
        </main>
      </div>
    </div>
  )
}

export default App

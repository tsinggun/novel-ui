import { useEffect, useRef, useState } from 'react'
import NavTabs from './components/NavTabs'
import FontScaleControl from './components/FontScaleControl'
import DataBar from './components/DataBar'
import BuilderPage from './pages/BuilderPage'
import CharacterPage from './pages/CharacterPage'
import ScenePage from './pages/ScenePage'
import ItemPage from './pages/ItemPage'
import TechniquePage from './pages/TechniquePage'
import { readLocalInfo, migrateToWorkspace } from './persist'
import { useNovelData } from './useNovelData'
import { useFontScale } from './useFontScale'
import './App.css'

function App() {
  const [tab, setTab] = useState('builder')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  /** 只有在本地跑（便携版 / 客户端）时才有数据文件条和「退出」 */
  const [local, setLocal] = useState(false)
  /** 迁移成作品目录后让数据条重新读一次 info */
  const [barVersion, setBarVersion] = useState(0)
  const [storageNotice, setStorageNotice] = useState('')
  const [migrating, setMigrating] = useState(false)
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

  /**
   * 关窗时通知本地服务退出（不然 node 会一直挂后台占着端口和 exe）。
   * 服务端会等 3 秒确认没有新请求才退，所以刷新页面不会误杀。
   */
  useEffect(() => {
    const bye = () => {
      try {
        navigator.sendBeacon?.('/plot-api/bye')
      } catch {
        /* 拿不到 sendBeacon 就算了，服务端还有窗口轮询兜底 */
      }
    }
    window.addEventListener('pagehide', bye)
    return () => window.removeEventListener('pagehide', bye)
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
    setPreviewOpen(true)
  }

  // 导航排序用的「引用次数」：人物/场景看已加入构建器的数量，技法看被情节引用的总次数
  const usage = {
    character: novel.data.inBuilder.characters.length,
    scene: novel.data.inBuilder.scenes.length,
    item: novel.data.inBuilder.items.length,
    technique: novel.data.plots.reduce((sum, plot) => sum + (plot.techniqueIds?.length || 0), 0),
  }

  /** 把当前的单文件 json 拆成作品目录（一卡一文件），并直接切过去 */
  const migrateToDir = async () => {
    if (migrating) return
    setMigrating(true)
    setStorageNotice('')
    try {
      const info = await readLocalInfo()
      if (!info) {
        setStorageNotice('只有在客户端里才能拆成作品目录')
        return
      }
      if (info.mode === 'dir') {
        setStorageNotice('当前已经是作品目录模式了')
        return
      }
      const res = await migrateToWorkspace({ jsonPath: info.path, attach: true })
      if (!res.ok) {
        setStorageNotice(res.error || '拆目录失败')
        return
      }
      if (res.data) novel.applyLoaded(res.data)
      setBarVersion((value) => value + 1)
      const counts = res.counts || {}
      setStorageNotice(
        `已拆成作品目录：人物 ${counts.characters ?? 0}、场景 ${counts.scenes ?? 0}、技法 ${counts.techniques ?? 0}、情节 ${counts.plots ?? 0}`,
      )
    } finally {
      setMigrating(false)
    }
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
          {local && <DataBar key={barVersion} onLoadData={(data) => novel.applyLoaded(data)} />}
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

                {local && (
                  <>
                    <span className="settings__title settings__title--gap">存储</span>
                    <button
                      type="button"
                      className="btn btn--sm btn--ghost settings__action"
                      onClick={migrateToDir}
                      disabled={migrating}
                      title="把这个 json 拆成作品目录：一卡一文件，只写改过的那张"
                    >
                      {migrating ? '正在拆…' : '拆成作品目录'}
                    </button>
                    <p className="settings__tip">
                      拆完会自动切过去。源 json 一个字节都不改，随时还能切回来。
                    </p>
                    {storageNotice && <p className="settings__notice">{storageNotice}</p>}
                  </>
                )}
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
          <NavTabs
            value={tab}
            usage={usage}
            onChange={(id) => {
              setPreviewOpen(false)
              setTab(id)
            }}
            layout="side"
          />
        </aside>

        <main className="workspace">
          {tab === 'builder' && (
            <BuilderPage
              novel={novel}
              onNavigate={setTab}
              previewOpen={previewOpen}
              onPreviewClose={() => setPreviewOpen(false)}
            />
          )}
          {tab === 'character' && <CharacterPage novel={novel} />}
          {tab === 'scene' && <ScenePage novel={novel} />}
          {tab === 'item' && <ItemPage novel={novel} />}
          {tab === 'technique' && <TechniquePage novel={novel} />}
        </main>
      </div>
    </div>
  )
}

export default App

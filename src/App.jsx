import { useState } from 'react'
import NavTabs from './components/NavTabs'
import FontScaleControl from './components/FontScaleControl'
import BuilderPage from './pages/BuilderPage'
import CharacterPage from './pages/CharacterPage'
import ScenePage from './pages/ScenePage'
import TechniquePage from './pages/TechniquePage'
import { useNovelData } from './useNovelData'
import { useFontScale } from './useFontScale'
import './App.css'

function App() {
  const [tab, setTab] = useState('builder')
  const novel = useNovelData()
  const { scale, step, reset } = useFontScale()

  return (
    <div className="app">
      <NavTabs value={tab} onChange={setTab} />
      <div className="app__toolbar">
        <FontScaleControl scale={scale} step={step} reset={reset} />
      </div>

      {tab === 'builder' && <BuilderPage novel={novel} onNavigate={setTab} />}
      {tab === 'character' && <CharacterPage novel={novel} />}
      {tab === 'scene' && <ScenePage novel={novel} />}
      {tab === 'technique' && <TechniquePage novel={novel} />}
    </div>
  )
}

export default App

import { useState } from 'react'
import NavTabs from './components/NavTabs'
import BuilderPage from './pages/BuilderPage'
import CharacterPage from './pages/CharacterPage'
import ScenePage from './pages/ScenePage'
import TechniquePage from './pages/TechniquePage'
import { useNovelData } from './useNovelData'
import './App.css'

function App() {
  const [tab, setTab] = useState('builder')
  const novel = useNovelData()

  return (
    <div className="app">
      <NavTabs value={tab} onChange={setTab} />

      {tab === 'builder' && <BuilderPage novel={novel} onNavigate={setTab} />}
      {tab === 'character' && <CharacterPage novel={novel} />}
      {tab === 'scene' && <ScenePage novel={novel} />}
      {tab === 'technique' && <TechniquePage novel={novel} />}
    </div>
  )
}

export default App

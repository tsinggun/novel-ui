const TABS = [
  { id: 'builder', label: '构造器' },
  { id: 'character', label: '人物卡' },
  { id: 'scene', label: '场景卡' },
  { id: 'technique', label: '技法卡' },
]

export default function NavTabs({ value, onChange }) {
  return (
    <nav className="nav" aria-label="视图切换">
      {TABS.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          className={`nav__item${value === tab.id ? ' is-active' : ''}`}
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
        >
          <span className="nav__index">0{index + 1}</span>
          <span className="nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

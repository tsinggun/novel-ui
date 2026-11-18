const BASE_TABS = [
  { id: 'builder', label: '构造器' },
  { id: 'character', label: '人物卡' },
  { id: 'scene', label: '场景卡' },
  { id: 'technique', label: '技法卡' },
]

/** layout=side 是左侧竖排导航（现在用的），top 是老的横排 */
export default function NavTabs({ value, onChange, layout = 'top' }) {
  const tabs = BASE_TABS

  return (
    <nav className={`nav nav--${layout}`} aria-label="视图切换">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`nav__item${value === tab.id ? ' is-active' : ''}`}
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
        >
          <span className="nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

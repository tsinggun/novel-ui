const BASE_TABS = [
  { id: 'builder', label: '构造器' },
  { id: 'character', label: '人物卡' },
  { id: 'scene', label: '场景卡' },
  { id: 'technique', label: '技法卡' },
]

const LIBRARY_TAB = { id: 'library', label: '素材库' }

/** showLibrary 只在本地运行（便携版 / 客户端）时为 true，网页版没有这个页 */
export default function NavTabs({ value, onChange, showLibrary = false, layout = 'top' }) {
  const tabs = showLibrary ? [...BASE_TABS, LIBRARY_TAB] : BASE_TABS

  return (
    <nav className={`nav nav--${layout}`} aria-label="视图切换">
      {tabs.map((tab, index) => (
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

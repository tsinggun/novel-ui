/**
 * 左侧导航。
 *
 * 顺序不是写死的：构造器永远第一（它是主工作区），
 * 场景卡 / 技法卡 / 人物卡 按「引用次数」从多到少排——用得多的排前面。
 * 引用次数：人物、场景 = 已加入构建器的数量；技法 = 被情节引用的总次数。
 * 数量一样时保持默认顺序（场景 → 技法 → 人物）。
 */
const BUILDER_TAB = { id: 'builder', label: '构造器', unit: '' }

const CARD_TABS = [
  { id: 'scene', label: '场景卡', unit: '景' },
  { id: 'character', label: '人物卡', unit: '位' },
  { id: 'item', label: '物品卡', unit: '件' },
  { id: 'technique', label: '技法卡', unit: '次' },
]

/** layout=side 是左侧竖排导航（现在用的），top 是老的横排 */
export default function NavTabs({ value, onChange, layout = 'top', usage = {} }) {
  // Array.prototype.sort 在现代引擎里是稳定排序，同分项自然保持默认顺序
  const cardTabs = CARD_TABS.map((tab) => ({ ...tab, count: Number(usage[tab.id]) || 0 })).sort(
    (a, b) => b.count - a.count,
  )
  const tabs = [BUILDER_TAB, ...cardTabs]

  return (
    <nav className={`nav nav--${layout}`} aria-label="视图切换">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`nav__item${value === tab.id ? ' is-active' : ''}`}
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
          title={tab.unit ? `${tab.label} · 引用 ${tab.count} ${tab.unit}` : tab.label}
        >
          <span className="nav__label">{tab.label}</span>
          {tab.unit && tab.count > 0 && (
            <span className="nav__count">
              {tab.count}
              {tab.unit}
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}

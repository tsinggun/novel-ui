import { useState } from 'react'

/**
 * 情节里勾选技法的小组件（多选）：点一下选中，再点取消。
 * 上方搜索框可按技法名称或标签筛选，下面列出可选技法。
 */
export default function TechniquePicker({
  techniques = [],
  selectedIds = [],
  onToggle,
  label = '使用技法 · 可多选',
  onNavigate,
  id,
}) {
  const [query, setQuery] = useState('')
  const keyword = query.trim().toLowerCase()

  const filtered = techniques.filter((tech) => {
    if (!keyword) return true
    if (tech.name.toLowerCase().includes(keyword)) return true
    return (tech.tags || []).some((tag) => tag.toLowerCase().includes(keyword))
  })

  return (
    <div className="tech-picker">
      <span className="label" id={id}>
        {label}
      </span>

      {techniques.length === 0 ? (
        <p className="empty">
          还没有技法卡。
          {onNavigate && (
            <button type="button" className="btn btn--link" onClick={() => onNavigate('technique')}>
              去技法卡页添加
            </button>
          )}
        </p>
      ) : (
        <div className="tech-picker__box">
          <input
            className="input tech-picker__search"
            type="search"
            placeholder="输入标签或技法名称可以搜索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {filtered.length === 0 ? (
            <p className="empty">没有匹配的技法，换个关键词试试。</p>
          ) : (
            <ul className="tech-picker__list">
              {filtered.map((tech) => {
                const active = selectedIds.includes(tech.id)
                return (
                  <li key={tech.id}>
                    <button
                      type="button"
                      className={`tech-chip${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      aria-label={tech.name}
                      title={tech.detail || tech.name}
                      onClick={() => onToggle(tech.id)}
                    >
                      {tech.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'

/**
 * 情节里勾选技法的小组件（多选）：点一下选中，再点取消。
 * 上方搜索框可按技法名称、标签或用法说明筛选；下面每条都带用法说明，
 * 列表限高可滚动，卡多也不会被弹窗底部裁掉。
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

  const filtered = useMemo(
    () =>
      techniques.filter((tech) => {
        if (!keyword) return true
        if (tech.name.toLowerCase().includes(keyword)) return true
        if ((tech.detail || '').toLowerCase().includes(keyword)) return true
        return (tech.tags || []).some((tag) => tag.toLowerCase().includes(keyword))
      }),
    [techniques, keyword],
  )

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
          <div className="tech-picker__bar">
            <input
              className="input tech-picker__search"
              type="search"
              placeholder="搜技法名称、标签或用法说明"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="tech-picker__count">
              共 {techniques.length} 张 · 已选 {selectedIds.length} 张
            </span>
          </div>

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
                      className={`tech-option${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      aria-label={tech.name}
                      onClick={() => onToggle(tech.id)}
                    >
                      <span className="tech-option__mark" aria-hidden="true">
                        {active ? '✓' : '+'}
                      </span>
                      <span className="tech-option__main">
                        <span className="tech-option__head">
                          <span className="tech-option__name">{tech.name}</span>
                          {(tech.tags || []).length > 0 && (
                            <span className="tech-option__tags">
                              {(tech.tags || []).slice(0, 3).join(' / ')}
                              {(tech.tags || []).length > 3 && ` +${tech.tags.length - 3}`}
                            </span>
                          )}
                        </span>
                        <span
                          className={`tech-option__detail${
                            tech.detail?.trim() ? '' : ' tech-option__detail--empty'
                          }`}
                        >
                          {tech.detail?.trim() || '还没写用法说明，AI 只会看到名字'}
                        </span>
                      </span>
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

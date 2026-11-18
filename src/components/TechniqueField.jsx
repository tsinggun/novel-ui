import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * 情节里的「使用技法」字段：
 * - 已在选中的技法以标签形式排在这里，点 × 直接取消；
 * - 「选择技法」打开二层弹窗，样式复用技法卡页面的卡片；
 * - 二层弹窗盖在一层详情弹窗之上，Esc / 点遮罩只关自己这一层。
 */
export default function TechniqueField({
  techniques = [],
  selectedIds = [],
  onChange,
  label = '使用技法 · 可多选',
  onNavigate,
}) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => techniques.find((item) => item.id === id))
        .filter(Boolean),
    [selectedIds, techniques],
  )

  const remove = (id) => onChange(selectedIds.filter((item) => item !== id))

  return (
    <div className="tech-field">
      <div className="tech-field__head">
        <span className="label">{label}</span>
        <span className="tech-field__meta">
          {selected.length > 0 ? `已选 ${selected.length} 个` : '还没选'}
        </span>
        <button
          type="button"
          className="btn btn--sm btn--ghost tech-field__open"
          onClick={() => setOpen(true)}
        >
          选择技法
        </button>
      </div>

      {selected.length > 0 ? (
        <ul className="tech-field__chips">
          {selected.map((tech) => (
            <li key={tech.id} className="tech-field__chip">
              <span className="tech-field__chip-name">{tech.name}</span>
              <button
                type="button"
                className="tech-field__chip-remove"
                aria-label={`取消技法 ${tech.name}`}
                title="取消这个技法"
                onClick={() => remove(tech.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tech-field__empty">
          还没有选技法。
          {techniques.length === 0 && onNavigate && (
            <button type="button" className="btn btn--link" onClick={() => onNavigate('technique')}>
              去技法卡页添加
            </button>
          )}
        </p>
      )}

      {open && (
        <TechniqueSelectModal
          techniques={techniques}
          selectedIds={selectedIds}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

function TechniqueSelectModal({ techniques, selectedIds, onChange, onClose }) {
  const [query, setQuery] = useState('')
  const [activeTags, setActiveTags] = useState([])
  const keyword = query.trim().toLowerCase()

  // Esc 只关这一层：capture + stopImmediatePropagation，避免把下面的详情弹窗一起关掉
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key !== 'Escape') return
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  const tagCounts = useMemo(() => {
    const map = new Map()
    techniques.forEach((tech) => {
      ;(tech.tags || []).forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1))
    })
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [techniques])

  const filtered = useMemo(
    () =>
      techniques.filter((tech) => {
        const hitTag = activeTags.every((tag) => (tech.tags || []).includes(tag))
        if (!hitTag) return false
        if (!keyword) return true
        if (tech.name.toLowerCase().includes(keyword)) return true
        if ((tech.detail || '').toLowerCase().includes(keyword)) return true
        return (tech.tags || []).some((tag) => tag.toLowerCase().includes(keyword))
      }),
    [techniques, activeTags, keyword],
  )

  const toggle = (id) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])

  const downOnOverlay = useRef(false)

  return (
    <div
      className="detail detail--nested"
      role="presentation"
      onMouseDown={(event) => {
        downOnOverlay.current = event.target === event.currentTarget
      }}
      onMouseUp={(event) => {
        const onOverlay = downOnOverlay.current && event.target === event.currentTarget
        downOnOverlay.current = false
        if (onOverlay) onClose()
      }}
    >
      <div className="detail__dialog" role="dialog" aria-modal="true" aria-label="选择技法">
        <header className="detail__head">
          <div className="detail__title-wrap">
            <span className="card__tag">技法</span>
            <h3 className="detail__title">选择技法</h3>
          </div>
          <span className="detail__meta">
            共 {techniques.length} 张 · 已选 {selectedIds.length} 张
          </span>
          <button type="button" className="detail__close" onClick={onClose} aria-label="关闭技法选择">
            ×
          </button>
        </header>

        <div className="detail__body">
          <input
            className="input tech-select__search"
            type="search"
            placeholder="搜技法名称、标签或用法说明"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          {tagCounts.length > 0 && (
            <div className="tech-select__tags">
              <button
                type="button"
                className={`tag-filter__item${activeTags.length === 0 ? ' is-active' : ''}`}
                onClick={() => setActiveTags([])}
              >
                全部 {techniques.length}
              </button>
              {tagCounts.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  className={`tag-filter__item${activeTags.includes(tag) ? ' is-active' : ''}`}
                  onClick={() =>
                    setActiveTags((prev) =>
                      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
                    )
                  }
                >
                  {tag} {count}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="empty">没有匹配的技法，换个关键词或取消标签筛选试试。</p>
          ) : (
            <ul className="tech-select__list">
              {filtered.map((tech) => {
                const active = selectedIds.includes(tech.id)
                return (
                  <li key={tech.id}>
                    <button
                      type="button"
                      className={`tech-select__card${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      onClick={() => toggle(tech.id)}
                    >
                      <span className="tech-select__mark" aria-hidden="true">
                        {active ? '✓' : '+'}
                      </span>
                      <span className="tech-select__main">
                        <span className="tech-select__head">
                          <span className="tech-select__name">{tech.name}</span>
                          {(tech.tags || []).length > 0 && (
                            <span className="tech-select__tags-inline">
                              {(tech.tags || []).join(' / ')}
                            </span>
                          )}
                        </span>
                        <span
                          className={`tech-select__detail${
                            tech.detail?.trim() ? '' : ' tech-select__detail--empty'
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

        <footer className="detail__foot">
          <span className="tool-hint detail__foot-hint">
            选中即生效，点同一张卡可取消；这一层关掉不影响下面的情节草稿。
          </span>
          <button type="button" className="btn btn--sm" onClick={onClose}>
            完成
          </button>
        </footer>
      </div>
    </div>
  )
}

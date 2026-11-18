import { useState } from 'react'
import { appendTerms } from '../searchTerms'

/**
 * 卡片库通用检索条，两种形态：
 * - 默认（技法卡这种有标签的）：多条件，回车 / 失焦 / 逗号把输入变成 chip，可单个 × 或整体清空。
 * - simple=true（人物、场景这种没有标签的）：就是普通单框搜索，边打边过滤。
 * 多个条件之间是「全都要命中」，具体匹配哪些字段由各页面自己决定。
 */
export default function CardSearch({
  terms,
  onTermsChange,
  placeholder = '搜索名称或标签',
  total,
  matched,
  simple = false,
}) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const raw = draft
    setDraft('')
    if (!raw.trim()) return
    const next = appendTerms(terms, raw)
    if (next.length !== terms.length) onTermsChange(next)
  }

  const removeTerm = (term) => onTermsChange(terms.filter((item) => item !== term))

  if (simple) {
    const value = terms[0] || ''
    return (
      <div className="card-search">
        <span className="label">检索</span>
        <input
          className="input card-search__plain"
          type="search"
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => onTermsChange(event.target.value ? [event.target.value] : [])}
        />
        <span className="card-search__hint">
          {value.trim() ? `命中 ${matched} / ${total} 张` : `共 ${total} 张`}
          {value.trim() && (
            <button type="button" className="btn btn--link" onClick={() => onTermsChange([])}>
              清空
            </button>
          )}
        </span>
      </div>
    )
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault()
      commit()
      return
    }
    if (event.key === 'Backspace' && !draft && terms.length > 0) {
      onTermsChange(terms.slice(0, -1))
    }
  }

  return (
    <div className="card-search">
      <span className="label">检索</span>

      <div className="card-search__box">
        {terms.map((term) => (
          <span key={term} className="search-chip">
            {term}
            <button
              type="button"
              className="search-chip__remove"
              aria-label={`移除条件 ${term}`}
              onClick={() => removeTerm(term)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="card-search__input"
          type="text"
          value={draft}
          placeholder={terms.length > 0 ? '继续输入，回车或失焦加入条件' : `${placeholder}，回车或失焦加入条件`}
          aria-label={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
        />
      </div>

      <span className="card-search__hint">
        {terms.length > 0 ? `命中 ${matched} / ${total} 张` : `共 ${total} 张`}
        {terms.length > 0 && (
          <button type="button" className="btn btn--link" onClick={() => onTermsChange([])}>
            清空
          </button>
        )}
      </span>
    </div>
  )
}

import { useState } from 'react'
import { appendTerms } from '../searchTerms'

/**
 * 卡片库通用检索条：多条件命中。
 * 输入框里敲的内容在「回车 / 失焦 / 逗号」时变成一个条件 chip，可单独 ×，也可整体清空。
 * 多个条件之间是「全都要命中」，具体匹配哪些字段由各页面自己决定。
 */
export default function CardSearch({
  terms,
  onTermsChange,
  placeholder = '搜索名称或标签',
  total,
  matched,
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

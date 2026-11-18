/**
 * 卡片库通用检索条：一个输入框 + 命中统计 + 一键清空。
 * 各页面自己按「标题/名称 + 标签」过滤数据，这里只负责输入与显示。
 */
export default function CardSearch({
  value,
  onChange,
  placeholder = '搜索名称或标签',
  total,
  matched,
}) {
  const keyword = value.trim()

  return (
    <div className="card-search">
      <span className="label">检索</span>
      <input
        className="input card-search__input"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="card-search__hint">
        {keyword ? `命中 ${matched} / ${total} 张` : `共 ${total} 张`}
        {keyword && (
          <button type="button" className="btn btn--link" onClick={() => onChange('')}>
            清空
          </button>
        )}
      </span>
    </div>
  )
}

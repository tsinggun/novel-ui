import Card from '../../components/Card'

/**
 * 场景 / 物品这类「名字 + 描述」的 chip 列表面板：
 * 两个分区结构一模一样，只是文案与 kind 不同，所以合成一个组件。
 */
export default function ChipSection({
  title,
  meta,
  label,
  emptyText,
  addPage,
  pageLabel,
  hint,
  kind, // 'scenes' | 'items'
  list,
  novel,
  data,
  onNavigate,
  extra, // 可选：chip 列表下面再塞一块（场景的本章备注就放这里）
}) {
  const inContext = data.inContext[kind] || []

  return (
    <Card title={title} meta={meta} className="card--frame">
      <div className="field field--lg">
        <span className="field__label">{label}</span>
        {list.length > 0 ? (
          <ul className="chip-list">
            {list.map((item) => {
              const isCtx = inContext.includes(item.id)
              return (
                <li key={item.id} className={`chip${isCtx ? ' chip--ctx' : ''}`}>
                  <span className="chip__name">{item.name}</span>
                  {item.detail && <span className="chip__detail">{item.detail}</span>}
                  <button
                    type="button"
                    className={`chip__ctx${isCtx ? ' is-on' : ''}`}
                    aria-pressed={isCtx}
                    title={`勾选后提示词里不再贴这段${pageLabel}描述，只留名字，省 token`}
                    onClick={(event) => {
                      event.stopPropagation()
                      novel.toggleInContext(kind, item.id)
                    }}
                  >
                    {isCtx ? '✓ 已在上下文' : '+ 已在上下文'}
                  </button>
                  <button
                    type="button"
                    className="chip__remove"
                    aria-label={`移出 ${item.name}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      novel.toggleInBuilder(kind, item.id)
                    }}
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="empty">
            {emptyText}
            <button type="button" className="btn btn--link" onClick={() => onNavigate(addPage)}>
              去{pageLabel}卡页添加
            </button>
          </p>
        )}
      </div>
      {extra}
      <span className="card__hint">{hint}</span>
    </Card>
  )
}

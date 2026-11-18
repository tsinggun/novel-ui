import './Card.css'

/**
 * 通用卡片容器：构造器里的场景卡 / 人物卡 / 情节卡，
 * 以及人物卡页、场景卡页里的实体卡片都复用它。
 */
export default function Card({
  title,
  tag,
  meta,
  children,
  actions,
  className = '',
  ...rest
}) {
  const classes = ['card', className].filter(Boolean).join(' ')

  return (
    <article className={classes} {...rest}>
      {(title || tag || meta) && (
        <header className="card__head">
          {title && <h3 className="card__title">{title}</h3>}
          {tag && <span className="card__tag">{tag}</span>}
          {meta && <span className="card__meta">{meta}</span>}
        </header>
      )}

      {children && <div className="card__body">{children}</div>}

      {actions && <footer className="card__actions">{actions}</footer>}
    </article>
  )
}

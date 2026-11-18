import { useEffect } from 'react'
import './DetailModal.css'

/**
 * 卡片详情弹窗：点卡片时打开，看完整内容（背景、备注、标签……）。
 * sections 为只读段落，children 可放更大的编辑区（如大号 textarea）。
 */
export default function DetailModal({
  open,
  title,
  tag,
  meta,
  tags,
  sections = [],
  children,
  footer,
  onClose,
}) {
  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="detail" role="presentation" onClick={onClose}>
      <div
        className="detail__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title ? `${title} 详情` : '卡片详情'}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="detail__head">
          <div className="detail__title-wrap">
            {tag && <span className="card__tag">{tag}</span>}
            {title && <h3 className="detail__title">{title}</h3>}
          </div>
          {meta && <span className="detail__meta">{meta}</span>}
          <button type="button" className="detail__close" onClick={onClose} aria-label="关闭详情">
            ×
          </button>
        </header>

        <div className="detail__body">
          {Array.isArray(tags) && tags.length > 0 && (
            <div className="detail__tags">
              {tags.map((item) => (
                <span key={item} className="tag-chip tag-chip--static">
                  {item}
                </span>
              ))}
            </div>
          )}

          {sections.map((section) => (
            <section key={section.label} className="detail__section">
              <span className="field__label">{section.label}</span>
              <p className={`detail__text${section.text ? '' : ' detail__text--empty'}`}>
                {section.text || '还没有填写内容。'}
              </p>
            </section>
          ))}

          {children}
        </div>

        {footer && <footer className="detail__foot">{footer}</footer>}
      </div>
    </div>
  )
}

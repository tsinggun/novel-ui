import { useState } from 'react'
import Card from './Card'
import DetailModal from './DetailModal'

/**
 * 人物卡 / 场景卡 / 技法卡共用的展示卡片。
 * 整张卡可点击：点空白区域或文字会弹出详情弹窗看完整内容。
 * showBuilder=false 时不显示「加入构建器」（技法卡由情节卡勾选，不参与构建器）。
 */
export default function EntityCard({
  title,
  detail,
  detailLabel = '详情',
  tags,
  inBuilder,
  onToggleBuilder,
  onEdit,
  onRemove,
  showBuilder = true,
}) {
  const [open, setOpen] = useState(false)

  const handleCardClick = (event) => {
    // 按钮等控件自身的点击不触发弹窗
    if (event.target.closest('button, a, input, textarea, select')) return
    setOpen(true)
  }

  const closeThen = (handler) => () => {
    setOpen(false)
    handler?.()
  }

  return (
    <>
      <Card
        title={title}
        meta={inBuilder ? '已在构建器' : undefined}
        className={`${inBuilder ? 'card--linked ' : ''}card--clickable`}
        onClick={handleCardClick}
        actions={
          <>
            {showBuilder && (
              <button
                type="button"
                className={`btn btn--sm ${inBuilder ? 'btn--ghost' : 'btn--solid'}`}
                onClick={onToggleBuilder}
              >
                {inBuilder ? '移出构建器' : '加入构建器'}
              </button>
            )}
            <button type="button" className="btn btn--sm btn--ghost" onClick={onEdit}>
              编辑
            </button>
            <button type="button" className="btn btn--sm btn--ghost btn--danger" onClick={onRemove}>
              删除
            </button>
          </>
        }
      >
        {Array.isArray(tags) && tags.length > 0 && (
          <div className="card__tags">
            {tags.map((tag) => (
              <span key={tag} className="tag-chip tag-chip--static">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="field field--note">
          <span className="field__label">{detailLabel}</span>
          <p className={`note-text${detail ? '' : ' note-text--empty'}`}>
            {detail || '还没有填写内容。'}
          </p>
        </div>

        <span className="card__hint">点击卡片查看全文</span>
      </Card>

      <DetailModal
        open={open}
        title={title}
        tag={showBuilder ? undefined : '技法'}
        meta={inBuilder ? '已在构建器' : undefined}
        tags={tags}
        sections={[{ label: detailLabel, text: detail }]}
        onClose={() => setOpen(false)}
        footer={
          <>
            {showBuilder && (
              <button
                type="button"
                className={`btn btn--sm ${inBuilder ? 'btn--ghost' : 'btn--solid'}`}
                onClick={onToggleBuilder}
              >
                {inBuilder ? '移出构建器' : '加入构建器'}
              </button>
            )}
            <button type="button" className="btn btn--sm btn--ghost" onClick={closeThen(onEdit)}>
              编辑
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost btn--danger"
              onClick={closeThen(onRemove)}
            >
              删除
            </button>
            <button type="button" className="btn btn--sm" onClick={() => setOpen(false)}>
              关闭
            </button>
          </>
        }
      />
    </>
  )
}

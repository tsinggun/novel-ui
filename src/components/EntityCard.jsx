import { useState } from 'react'
import Card from './Card'
import DetailModal from './DetailModal'

/**
 * 人物卡 / 场景卡 / 技法卡共用的展示卡片。
 * 整张卡可点击：弹出大弹窗，直接在里面放大编辑（改名字、详情、标签），保存后才写回。
 * showBuilder=false 时不显示「加入构建器」（技法卡由情节卡勾选，不参与构建器）。
 */
export default function EntityCard({
  id,
  title,
  detail,
  detailLabel = '详情',
  nameLabel = '名称',
  namePlaceholder = '',
  detailPlaceholder = '',
  tagLabel = '标签',
  tags,
  inBuilder,
  onToggleBuilder,
  onSave,
  onRemove,
  showBuilder = true,
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [tagInput, setTagInput] = useState('')

  const tagList = Array.isArray(tags) ? tags : null

  const openModal = () => {
    setDraft({
      name: title || '',
      detail: detail || '',
      tags: tagList ? [...tagList] : [],
    })
    setTagInput('')
    setOpen(true)
  }

  const handleCardClick = (event) => {
    // 按钮等控件自身的点击不触发弹窗
    if (event.target.closest('button, a, input, textarea, select')) return
    openModal()
  }

  const patch = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }))

  const canSave = Boolean(draft && draft.name.trim())

  const handleSave = () => {
    if (!canSave) return
    onSave?.({
      id,
      name: draft.name.trim(),
      detail: (draft.detail || '').trim(),
      tags: tagList ? draft.tags : undefined,
    })
    setOpen(false)
  }

  const closeThen = (handler) => () => {
    setOpen(false)
    handler?.()
  }

  const commitTag = () => {
    if (!tagList || !draft) return
    const value = tagInput.trim().replace(/^#+/, '')
    setTagInput('')
    if (!value || draft.tags.includes(value)) return
    patch('tags', [...draft.tags, value])
  }

  const handleTagKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault()
      commitTag()
      return
    }
    if (event.key === 'Backspace' && !tagInput && draft.tags.length > 0) {
      patch('tags', draft.tags.slice(0, -1))
    }
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
            <button type="button" className="btn btn--sm btn--ghost" onClick={openModal}>
              编辑
            </button>
            <button type="button" className="btn btn--sm btn--ghost btn--danger" onClick={onRemove}>
              删除
            </button>
          </>
        }
      >
        {tagList && tagList.length > 0 && (
          <div className="card__tags">
            {tagList.map((tag) => (
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

        <span className="card__hint">点击卡片放大查看与编辑</span>
      </Card>

      <DetailModal
        open={open}
        title={draft?.name?.trim() || title}
        tag={showBuilder ? undefined : '技法'}
        meta={inBuilder ? '已在构建器' : undefined}
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
            <button
              type="button"
              className="btn btn--sm btn--ghost btn--danger"
              onClick={closeThen(onRemove)}
            >
              删除
            </button>
            <span className="detail__foot-hint tool-hint">大弹窗里直接改，取消不保存。</span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setOpen(false)}>
              取消
            </button>
            <button
              type="button"
              className="btn btn--sm btn--solid"
              onClick={handleSave}
              disabled={!canSave}
            >
              保存
            </button>
          </>
        }
      >
        {draft && (
          <>
            <div className="detail__section">
              <label className="field__label" htmlFor={`entity-modal-name-${id}`}>
                {nameLabel}
              </label>
              <input
                id={`entity-modal-name-${id}`}
                className="input"
                value={draft.name}
                placeholder={namePlaceholder}
                onChange={(event) => patch('name', event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleSave()
                  }
                }}
              />
            </div>

            {tagList && (
              <div className="detail__section">
                <label className="field__label" htmlFor={`entity-modal-tags-${id}`}>
                  {tagLabel}
                </label>
                <div className="tag-editor">
                  {draft.tags.map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                      <button
                        type="button"
                        className="tag-chip__remove"
                        aria-label={`删除标签 ${tag}`}
                        onClick={() => patch('tags', draft.tags.filter((item) => item !== tag))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    id={`entity-modal-tags-${id}`}
                    className="tag-editor__input"
                    value={tagInput}
                    placeholder={draft.tags.length > 0 ? '继续添加…' : '输入标签，回车或逗号添加'}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={commitTag}
                  />
                </div>
              </div>
            )}

            <div className="detail__section">
              <label className="field__label" htmlFor={`entity-modal-detail-${id}`}>
                {detailLabel}
              </label>
              <textarea
                id={`entity-modal-detail-${id}`}
                className="input input--area detail__editor detail__editor--tall"
                value={draft.detail}
                placeholder={detailPlaceholder}
                onChange={(event) => patch('detail', event.target.value)}
              />
            </div>
          </>
        )}
      </DetailModal>
    </>
  )
}

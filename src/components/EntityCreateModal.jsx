import { useState } from 'react'
import DetailModal from './DetailModal'

/**
 * 新建人物 / 场景 / 技法卡的弹窗表单。
 * 跟「点卡片放大编辑」用的是同一个弹窗外壳（DetailModal），所以两边观感一致。
 * tags 传入时才渲染标签编辑器（技法师卡用）。
 */
export default function EntityCreateModal({
  open,
  title,
  nameLabel,
  namePlaceholder,
  detailLabel,
  detailPlaceholder,
  tagLabel = '标签',
  tags,
  draft,
  onChange,
  onSave,
  onCancel,
  onPasteImport,
}) {
  const [tagInput, setTagInput] = useState('')

  if (!open || !draft) return null

  // 直接粘一整段卡片 JSON（对象或数组）进输入框：拦下来转成批量导入，不当文本塞进去
  const catchJsonPaste = (event) => {
    if (!onPasteImport) return
    const text = event.clipboardData?.getData('text') || ''
    const trimmed = text.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return
    try {
      const parsed = JSON.parse(trimmed)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      if (items.length === 0 || typeof items[0] !== 'object' || items[0] === null) return
      event.preventDefault()
      onPasteImport(items)
    } catch {
      /* 不是 JSON 就按普通文本粘进去 */
    }
  }

  const tagList = Array.isArray(tags) ? tags : null
  const canSave = draft.name.trim().length > 0

  const patch = (key, value) => onChange({ ...draft, [key]: value })

  const commitTag = () => {
    if (!tagList) return
    const value = tagInput.trim().replace(/^#+/, '')
    if (!value) {
      setTagInput('')
      return
    }
    if (!tagList.includes(value)) onChange({ ...draft, tags: [...tagList, value] })
    setTagInput('')
  }

  const handleTagKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault()
      commitTag()
      return
    }
    if (event.key === 'Backspace' && !tagInput && tagList.length > 0) {
      onChange({ ...draft, tags: tagList.slice(0, -1) })
    }
  }

  return (
    <DetailModal
      open={open}
      title={title}
      tag="新建"
      onClose={onCancel}
      footer={
        <>
          <span className="detail__foot-hint tool-hint">保存后才写进卡片库，取消不留痕。</span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="btn btn--sm btn--solid" onClick={onSave} disabled={!canSave}>
            保存
          </button>
        </>
      }
    >
      <div className="detail__section">
        <label className="field__label" htmlFor="create-name">
          {nameLabel}
        </label>
        <input
          id="create-name"
          className="input"
          value={draft.name}
          placeholder={namePlaceholder}
          autoFocus
          onChange={(event) => patch('name', event.target.value)}
          onPaste={catchJsonPaste}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              if (canSave) onSave()
            }
          }}
        />
      </div>

      {tagList && (
        <div className="detail__section">
          <label className="field__label" htmlFor="create-tags">
            {tagLabel}
          </label>
          <div className="tag-editor">
            {tagList.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
                <button
                  type="button"
                  className="tag-chip__remove"
                  aria-label={`删除标签 ${tag}`}
                  onClick={() => onChange({ ...draft, tags: tagList.filter((item) => item !== tag) })}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="create-tags"
              className="tag-editor__input"
              value={tagInput}
              placeholder={tagList.length > 0 ? '继续添加…' : '输入标签，回车或逗号添加'}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={commitTag}
            />
          </div>
        </div>
      )}

      <div className="detail__section">
        <label className="field__label" htmlFor="create-detail">
          {detailLabel}
        </label>
        <textarea
          id="create-detail"
          className="input input--area detail__editor detail__editor--tall"
          value={draft.detail}
          placeholder={detailPlaceholder}
          onPaste={catchJsonPaste}
          onChange={(event) => patch('detail', event.target.value)}
        />
      </div>
    </DetailModal>
  )
}

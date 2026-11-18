import { useState } from 'react'
import Card from './Card'

/**
 * 人物卡 / 场景卡 / 技法卡共用的创建（编辑）表单卡片。
 * 传入 tags 时额外渲染「标签」编辑器（目前用于技法卡）。
 */
export default function EntityFormCard({
  title,
  nameLabel,
  namePlaceholder,
  detailLabel,
  detailPlaceholder,
  draft,
  onChange,
  onSave,
  onCancel,
  tagLabel = '标签',
  tags,
  onTagsChange,
}) {
  const [tagInput, setTagInput] = useState('')

  const patch = (key, value) => onChange({ ...draft, [key]: value })
  const canSave = draft.name.trim().length > 0
  const tagList = Array.isArray(tags) ? tags : null

  const commitTag = () => {
    if (!tagList) return
    const value = tagInput.trim().replace(/^#+/, '')
    if (!value) {
      setTagInput('')
      return
    }
    if (!tagList.includes(value)) onTagsChange([...tagList, value])
    setTagInput('')
  }

  const handleTagKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault()
      commitTag()
      return
    }
    if (event.key === 'Backspace' && !tagInput && tagList.length > 0) {
      onTagsChange(tagList.slice(0, -1))
    }
  }

  const removeTag = (tag) => onTagsChange(tagList.filter((item) => item !== tag))

  return (
    <Card
      title={title}
      tag={draft.id ? '编辑中' : '草稿'}
      className="card--draft form-card"
      actions={
        <>
          <button type="button" className="btn btn--solid btn--sm" onClick={onSave} disabled={!canSave}>
            保存
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            取消
          </button>
        </>
      }
    >
      <label className="label" htmlFor="entity-name">
        {nameLabel}
      </label>
      <input
        id="entity-name"
        className="input"
        value={draft.name}
        placeholder={namePlaceholder}
        autoFocus
        onChange={(event) => patch('name', event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (canSave) onSave()
          }
        }}
      />

      {tagList && (
        <>
          <label className="label" htmlFor="entity-tags">
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
                  onClick={() => removeTag(tag)}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="entity-tags"
              className="tag-editor__input"
              value={tagInput}
              placeholder={tagList.length > 0 ? '继续添加…' : '输入标签，回车或逗号添加'}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={commitTag}
            />
          </div>
        </>
      )}

      <label className="label" htmlFor="entity-detail">
        {detailLabel}
      </label>
      <textarea
        id="entity-detail"
        className="input input--area"
        value={draft.detail}
        placeholder={detailPlaceholder}
        onChange={(event) => patch('detail', event.target.value)}
      />
    </Card>
  )
}

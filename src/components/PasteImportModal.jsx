import { useState } from 'react'
import DetailModal from './DetailModal'

/**
 * 粘贴 JSON 批量导入卡片。
 * 粘一段单张卡的 JSON（{ "name": "...", "detail": "...", "tags": [...] }）
 * 或者一个数组（[ {...}, {...} ]）都行，追加进卡片库，不覆盖已有卡片。
 * id / createdAt 这类字段会被忽略，重名的卡片跳过。
 */
export default function PasteImportModal({
  open,
  title,
  hint,
  example,
  onImport,
  onClose,
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  if (!open) return null

  const parse = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setError('先粘一段 JSON 进来')
      return
    }
    let parsed
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      setError('不是有效的 JSON，检查一下引号、逗号、括号')
      return
    }
    const items = Array.isArray(parsed) ? parsed : [parsed]
    if (items.length === 0 || typeof items[0] !== 'object' || items[0] === null) {
      setError('要一个对象或对象数组，例如 { "name": "技法名" }')
      return
    }
    const result = onImport(items)
    setText('')
    setError('')
    if (result && result.added === 0) {
      setError(`没有新增：这 ${result.skipped} 张重名，已经在库里了`)
    }
  }

  return (
    <DetailModal
      open={open}
      title={title}
      tag="粘贴导入"
      onClose={onClose}
      footer={
        <>
          <span className="detail__foot-hint tool-hint">
            {hint || '追加进卡片库，不会覆盖已有卡片；重名自动跳过。'}
          </span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn--sm btn--solid" onClick={parse}>
            导入
          </button>
        </>
      }
    >
      <div className="detail__section">
        <label className="field__label" htmlFor="paste-json">
          JSON
        </label>
        <textarea
          id="paste-json"
          className="input input--area detail__editor detail__editor--tall"
          spellCheck={false}
          autoFocus
          value={text}
          placeholder={example || '{\n  "name": "慢镜头",\n  "detail": "把动作拆成几拍写",\n  "tags": ["节奏", "画面"]\n}'}
          onChange={(event) => {
            setText(event.target.value)
            if (error) setError('')
          }}
        />
        {error && <p className="path-prompt__error">{error}</p>}
      </div>
    </DetailModal>
  )
}

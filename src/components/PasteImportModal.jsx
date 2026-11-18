import { useRef, useState } from 'react'
import DetailModal from './DetailModal'

/**
 * 批量导入卡片：粘 JSON 或直接放一个 .json 文件进来都行。
 * 支持单张卡的 JSON（{ "name": "...", "detail": "...", "tags": [...] }）
 * 和数组（[ {...}, {...} ]），追加进卡片库，不覆盖已有卡片。
 * id / createdAt 这类字段会被忽略，重名的卡片跳过。
 *
 * 文件通道：点「选择 .json」挑文件，或者把文件拖到下面这个框里；
 * 读进来的内容会先铺在文本框里，确认无误再点「导入」。
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
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  if (!open) return null

  const readFile = async (file) => {
    if (!file) return
    if (!/\.(json|txt)$/i.test(file.name) && !/json|text/i.test(file.type || '')) {
      setError(`「${file.name}」看着不像 JSON 文件，选 .json 的`)
      return
    }
    try {
      const content = await file.text()
      setText(content)
      setFileName(file.name)
      setError('')
    } catch {
      setError(`读不了「${file.name}」，换一个文件试试`)
    }
  }

  const parse = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setError('先粘一段 JSON，或者选一个 .json 文件')
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
    setFileName('')
    setError('')
    if (result && result.added === 0) {
      setError(`没有新增：这 ${result.skipped} 张重名，已经在库里了`)
    }
  }

  return (
    <DetailModal
      open={open}
      title={title}
      tag="导入"
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
        <div className="import-bar">
          <label className="field__label" htmlFor="paste-json">
            JSON
          </label>
          <span className="tool-hint">粘一段 JSON，或者放 .json 文件进来</span>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              readFile(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()}>
            选择 .json 文件
          </button>
        </div>

        <textarea
          id="paste-json"
          className={`input input--area detail__editor detail__editor--tall${
            dragging ? ' is-dragging' : ''
          }`}
          spellCheck={false}
          autoFocus
          value={text}
          placeholder={example || '{\n  "name": "慢镜头",\n  "detail": "把动作拆成几拍写",\n  "tags": ["节奏", "画面"]\n}'}
          onChange={(event) => {
            setText(event.target.value)
            setFileName('')
            if (error) setError('')
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            readFile(event.dataTransfer?.files?.[0])
          }}
        />

        {fileName && <p className="tool-hint">已载入文件：{fileName}</p>}
        {error && <p className="path-prompt__error">{error}</p>}
      </div>
    </DetailModal>
  )
}

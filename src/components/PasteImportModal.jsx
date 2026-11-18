import { useRef, useState } from 'react'
import DetailModal from './DetailModal'
import { parseCardJson, readCardFiles } from '../cardImport'

/**
 * 批量导入卡片：粘 JSON，或者把 .json 文件丢进来（直接自动导入，不用再点按钮）。
 * 支持单张卡的 JSON（{ "name": "...", "detail": "...", "tags": [...] }）
 * 和数组（[ {...}, {...} ]），也支持一次拖多个文件（按顺序合并导入）。
 * 追加进卡片库，不覆盖已有卡片；id / createdAt 忽略，重名跳过。
 * 只有 JSON 坏掉时才会把内容铺回文本框，让手改后再点「导入」。
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

  const handleFiles = async (files) => {
    const list = Array.from(files || [])
    if (list.length === 0) return
    const { items, problems } = await readCardFiles(list)

    if (items.length > 0) {
      const result = onImport(items)
      setText('')
      setFileName('')
      setError(
        problems.length
          ? `已导入，但跳过了：${problems.join('、')}`
          : result.added === 0
            ? `没有新增：这 ${result.skipped} 张重名，已经在库里了`
            : '',
      )
      return
    }

    // 一张都没解析出来：单个文件就把内容铺进框里给人改
    if (list.length === 1 && problems.length === 1) {
      try {
        setText(await list[0].text())
        setFileName(list[0].name)
      } catch {
        /* 读不出来就只报错 */
      }
    }
    setError(problems.join('、') || '这些文件里没找到卡片')
  }

  const importText = () => {
    const trimmed = text.trim()
    if (!trimmed) {
      setError('先粘一段 JSON，或者把 .json 文件拖进来')
      return
    }
    const items = parseCardJson(trimmed)
    if (!items) {
      setError('不是有效的卡片 JSON：要一个对象或对象数组，例如 { "name": "技法名" }')
      return
    }
    const result = onImport(items)
    setText('')
    setFileName('')
    setError(result.added === 0 ? `没有新增：这 ${result.skipped} 张重名，已经在库里了` : '')
  }

  const dropHandlers = {
    onDragOver: (event) => {
      event.preventDefault()
      setDragging(true)
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event) => {
      event.preventDefault()
      setDragging(false)
      handleFiles(event.dataTransfer?.files)
    },
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
          <button type="button" className="btn btn--sm btn--solid" onClick={importText}>
            导入
          </button>
        </>
      }
    >
      <div className="detail__section" {...dropHandlers}>
        <div className="import-bar">
          <label className="field__label" htmlFor="paste-json">
            JSON
          </label>
          <span className="tool-hint">粘一段 JSON，或者把 .json 文件拖进这个弹窗（松手就导入）</span>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            multiple
            hidden
            onChange={(event) => {
              handleFiles(event.target.files)
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
          {...dropHandlers}
        />

        {dragging && <p className="tool-hint">松手就读这个文件并导入</p>}
        {fileName && <p className="tool-hint">已载入文件：{fileName}（检查无误后点「导入」）</p>}
        {error && <p className="path-prompt__error">{error}</p>}
      </div>
    </DetailModal>
  )
}

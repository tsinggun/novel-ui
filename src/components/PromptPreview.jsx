import { useEffect, useRef, useState } from 'react'
import './PromptPreview.css'

export default function PromptPreview({
  open,
  intro,
  body,
  full,
  customised,
  missingTechNotes,
  inContextCount = 0,
  savedChars = 0,
  onIntroChange,
  onReset,
  onNavigate,
  onClose,
}) {
  const [copied, setCopied] = useState(false)
  const downOnOverlay = useRef(false)

  const handleClose = () => {
    setCopied(false)
    onClose()
  }

  useEffect(() => {
    if (!open) return undefined
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(full)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      className="preview"
      role="presentation"
      onMouseDown={(event) => {
        downOnOverlay.current = event.target === event.currentTarget
      }}
      onMouseUp={(event) => {
        const onOverlay = downOnOverlay.current && event.target === event.currentTarget
        downOnOverlay.current = false
        if (onOverlay) handleClose()
      }}
    >
      <div
        className="preview__dialog"
        role="dialog"
        aria-modal="true"
        aria-label="提示词预览"
      >
        <header className="preview__head">
          <h3 className="preview__title">提示词预览</h3>
          <span className="preview__meta">
            {full.length} 字
            {inContextCount > 0 && ` · ${inContextCount} 项已在上下文，少发 ${savedChars} 字`}
          </span>
          <button type="button" className="preview__close" onClick={handleClose} aria-label="关闭预览">
            ×
          </button>
        </header>

        <div className="preview__intro">
          <div className="preview__intro-head">
            <span className="label">开头提示词（可修改）</span>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={onReset}
              disabled={!customised}
            >
              恢复默认
            </button>
          </div>
          <textarea
            className="input input--area preview__intro-input"
            value={intro}
            placeholder="写一句开场指令，例如：你是一名擅长刻画人物的作家……"
            onChange={(event) => onIntroChange(event.target.value)}
          />
        </div>

        {Array.isArray(missingTechNotes) && missingTechNotes.length > 0 && (
          <p className="preview__warn" role="status">
            这些技法卡没写「用法说明」，提示词里只剩名字：{missingTechNotes.join('、')}
            {onNavigate && (
              <button type="button" className="btn btn--link" onClick={onNavigate}>
                去技法卡页补
              </button>
            )}
          </p>
        )}

        {body ? (
          <pre className="preview__body">{body}</pre>
        ) : (
          <p className="preview__empty">还没有积木内容，先把卡片加入构建器。</p>
        )}

        <footer className="preview__foot">
          <button type="button" className="btn btn--sm btn--ghost" onClick={handleCopy}>
            {copied ? '已复制' : '复制全文'}
          </button>
          <button type="button" className="btn btn--sm" onClick={handleClose}>
            关闭
          </button>
        </footer>
      </div>
    </div>
  )
}

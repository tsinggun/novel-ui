import { useState } from 'react'
import Card from '../../components/Card'
import DetailModal from '../../components/DetailModal'
import TechniqueField from '../../components/TechniqueField'

const emptyDraft = { content: '', wordCount: '', techniqueIds: [] }

/**
 * 构造器分区之一：情节（列表 + 同弹窗的新增/编辑）
 * 清空构造器 / 导入数据时由父组件换 key 重挂载，弹窗与草稿自然复位。
 */
export default function PlotSection({ novel, data, fontSize, onNavigate }) {
  const [draft, setDraft] = useState(emptyDraft)
  const [hint, setHint] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  /** 正在编辑的那条情节 id；null 表示弹窗是用来新增的 */
  const [editingId, setEditingId] = useState(null)

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingId(null)
    setHint('')
  }

  const startEdit = (plot) => {
    setDraft({
      content: plot.content,
      wordCount: plot.wordCount ? String(plot.wordCount) : '',
      techniqueIds: [...(plot.techniqueIds || [])],
    })
    setEditingId(plot.id)
    setHint('')
    setDialogOpen(true)
  }

  const save = () => {
    if (!draft.content.trim()) {
      setHint('请先填写「情节内容」，再保存。')
      document.getElementById('plot-dialog-content')?.focus()
      return
    }
    const payload = {
      content: draft.content,
      /* 字数留空就存 0，提示词里不会出现「字数：约 …」这一行 */
      wordCount: draft.wordCount,
      techniqueIds: draft.techniqueIds,
    }
    if (editingId) novel.updatePlot(editingId, payload)
    else novel.addPlot(payload)
    setDraft(emptyDraft)
    closeDialog()
  }

  // 每条情节自带它所用技法的标签（去重），显示在情节卡下面
  const tagsOf = (plot) =>
    [...new Set(
      (plot.techniqueIds || [])
        .map((id) => data.techniques.find((item) => item.id === id))
        .filter(Boolean)
        .flatMap((tech) => tech.tags || []),
    )]

  return (
    <>
      <Card title="情节卡" meta={`${data.plots.length} 条`} className="card--frame">
        {data.plots.length > 0 && (
          <ul className="plot-list">
            {data.plots.map((plot, index) => {
              const techs = (plot.techniqueIds || [])
                .map((id) => data.techniques.find((item) => item.id === id))
                .filter(Boolean)
              const tags = tagsOf(plot)

              return (
                <li key={plot.id} className="plot">
                  <div className="plot__head">
                    <span className="plot__index">情节 {String(index + 1).padStart(2, '0')}</span>
                    {plot.wordCount > 0 && <span className="plot__meta">字数 {plot.wordCount}</span>}
                    <div className="plot__tools">
                      <button
                        type="button"
                        className="plot__action"
                        aria-label="上移"
                        disabled={index === 0}
                        onClick={() => novel.movePlot(plot.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="plot__action"
                        aria-label="下移"
                        disabled={index === data.plots.length - 1}
                        onClick={() => novel.movePlot(plot.id, 1)}
                      >
                        ↓
                      </button>
                      <button type="button" className="plot__action" onClick={() => startEdit(plot)}>
                        编辑
                      </button>
                      <button
                        type="button"
                        className="plot__remove"
                        aria-label="删除这条情节"
                        onClick={() => novel.removePlot(plot.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <p className="plot__content" style={{ fontSize: `calc(${fontSize}px * var(--fs))` }}>
                    {plot.content}
                  </p>
                  {techs.length > 0 && (
                    <div className="plot__techs">
                      {techs.map((tech) => (
                        <span
                          key={tech.id}
                          className={`plot__tech${tech.detail?.trim() ? '' : ' plot__tech--empty'}`}
                          title={tech.detail?.trim() || '这张技法卡还没写用法说明'}
                        >
                          <span className="plot__tech-name">{tech.name}</span>
                          {tech.detail?.trim() ? (
                            <span className="plot__tech-note">{tech.detail.trim()}</span>
                          ) : (
                            <span className="plot__tech-note">未写用法说明</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {tags.length > 0 && (
                    <div className="plot__tags">
                      {tags.map((tag) => (
                        <span key={tag} className="plot__tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {data.plots.length === 0 && (
          <p className="empty">还没有情节。点下面的「添加情节」新建一条。</p>
        )}
      </Card>

      <div className="builder-footer">
        <button
          type="button"
          className="btn btn--solid btn--wide"
          onClick={() => {
            setEditingId(null)
            setDraft(emptyDraft)
            setHint('')
            setDialogOpen(true)
          }}
        >
          添加情节
        </button>
      </div>

      <DetailModal
        open={dialogOpen}
        title={editingId ? '编辑情节' : '添加情节'}
        tag="情节"
        meta={
          editingId
            ? `第 ${String(data.plots.findIndex((item) => item.id === editingId) + 1).padStart(2, '0')} 条`
            : `第 ${String(data.plots.length + 1).padStart(2, '0')} 条`
        }
        onClose={closeDialog}
        footer={
          <>
            <span className="tool-hint detail__foot-hint">
              {editingId
                ? '改完点「保存情节」，点取消就丢弃这次修改。'
                : '取消只关弹窗，草稿会留着；保存后才清空。'}
            </span>
            <button type="button" className="btn btn--sm btn--ghost" onClick={closeDialog}>
              取消
            </button>
            <button type="button" className="btn btn--sm btn--solid" onClick={save}>
              保存情节
            </button>
          </>
        }
      >
        <div className="detail__section">
          <label className="field__label" htmlFor="plot-dialog-content">
            情节内容
          </label>
          <textarea
            id="plot-dialog-content"
            className="input input--area detail__editor detail__editor--tall"
            style={{ fontSize: `calc(${fontSize}px * var(--fs))` }}
            autoFocus
            placeholder="这一条情节发生了什么，谁做了什么，结果如何……"
            value={draft.content}
            onChange={(event) => {
              setDraft((prev) => ({ ...prev, content: event.target.value }))
              setHint('')
            }}
          />
        </div>

        <div className="plot-form__row">
          <label className="label" htmlFor="plot-dialog-words">
            字数要求
          </label>
          <input
            id="plot-dialog-words"
            className="input input--number"
            type="number"
            min="0"
            step="100"
            value={draft.wordCount}
            onChange={(event) => setDraft((prev) => ({ ...prev, wordCount: event.target.value }))}
          />
        </div>

        <TechniqueField
          techniques={data.techniques}
          selectedIds={draft.techniqueIds}
          onChange={(ids) => setDraft((prev) => ({ ...prev, techniqueIds: ids }))}
          onNavigate={onNavigate}
        />

        {hint && (
          <p className="builder-hint" role="status">
            {hint}
          </p>
        )}
      </DetailModal>
    </>
  )
}

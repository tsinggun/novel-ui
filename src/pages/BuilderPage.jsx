import { useRef, useState } from 'react'
import Card from '../components/Card'
import DetailModal from '../components/DetailModal'
import PromptPreview from '../components/PromptPreview'
import TechniquePicker from '../components/TechniquePicker'
import { buildPrompt, DEFAULT_PROMPT_INTRO } from '../prompt'
import { exportToDisk } from '../persist'

const emptyPlotDraft = { content: '', wordCount: '', techniqueIds: [] }

/** 构造器内部的分区 tab：前情提要 / 场景 / 人物 / 情节，一次只展开一块 */
const SECTIONS = [
  { id: 'recap', label: '前情提要' },
  { id: 'scene', label: '场景' },
  { id: 'character', label: '人物' },
  { id: 'plot', label: '情节' },
]

export default function BuilderPage({ novel, onNavigate }) {
  const { data } = novel
  const [section, setSection] = useState('recap')
  const [plotDraft, setPlotDraft] = useState(emptyPlotDraft)
  const [plotHint, setPlotHint] = useState('')
  const [plotDialogOpen, setPlotDialogOpen] = useState(false)
  const [editingPlot, setEditingPlot] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [sceneOpen, setSceneOpen] = useState(false)
  const [openCharacterId, setOpenCharacterId] = useState(null)
  const fileInputRef = useRef(null)

  // 卡片主体可点开弹窗，但输入框和按钮上的点击保持原样
  const cardClickGuard = (open) => (event) => {
    if (event.target.closest('button, a, input, textarea, select, label')) return
    open()
  }

  const sceneItems = data.inBuilder.scenes
    .map((id) => data.scenes.find((item) => item.id === id))
    .filter(Boolean)

  const characterItems = data.inBuilder.characters
    .map((id) => data.characters.find((item) => item.id === id))
    .filter(Boolean)

  const intro = data.promptIntro ?? DEFAULT_PROMPT_INTRO
  const fontSize = data.plotFontSize ?? 14

  const prompt = buildPrompt({
    intro,
    recap: data.previousRecap || '',
    scenes: sceneItems,
    characters: characterItems,
    plots: data.plots,
    characterNotes: data.characterNotes,
    sceneNote: data.notes.scene,
    techniques: data.techniques,
  })

  const handleAddPlot = () => {
    if (!plotDraft.content.trim()) {
      setPlotHint('请先填写「情节内容」，再保存。')
      if (!window.__NOVEL_UI_FOCUS__?.('plot-dialog-content')) {
        document.getElementById('plot-dialog-content')?.focus()
      }
      return
    }
    novel.addPlot({
      content: plotDraft.content,
      wordCount: plotDraft.wordCount,
      techniqueIds: plotDraft.techniqueIds,
    })
    setPlotDraft(emptyPlotDraft)
    setPlotHint('')
    setPlotDialogOpen(false)
  }

  const startPlotEdit = (plot) => {
    setEditingPlot({
      id: plot.id,
      content: plot.content,
      wordCount: plot.wordCount ? String(plot.wordCount) : '',
      techniqueIds: [...(plot.techniqueIds || [])],
    })
  }

  const handleSavePlotEdit = () => {
    if (!editingPlot) return
    if (!editingPlot.content.trim()) return
    novel.updatePlot(editingPlot.id, {
      content: editingPlot.content,
      wordCount: editingPlot.wordCount,
      techniqueIds: editingPlot.techniqueIds,
    })
    setEditingPlot(null)
  }

  const handleExport = async () => {
    const payload = JSON.stringify(data, null, 2)
    /* Harness 里优先写到磁盘：浏览器下载在桌面宿主里不一定有落点 */
    const savedPath = await exportToDisk(payload)
    if (savedPath) {
      setNotice('已导出到：' + savedPath)
      return
    }
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const date = new Date()
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
      date.getDate(),
    ).padStart(2, '0')}`
    const link = document.createElement('a')
    link.href = url
    link.download = `novel-builder-${stamp}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const ok = window.confirm('导入会覆盖当前所有卡片和情节，确定继续吗？')
      if (!ok) return
      novel.importData(parsed)
      setEditingPlot(null)
      setPlotDraft(emptyPlotDraft)
      setNotice(`已导入：${file.name}`)
    } catch {
      setNotice('导入失败：文件不是有效的 JSON。')
    }
  }

  const handleClearBuilder = () => {
    const ok = window.confirm(
      '清空构造器会移除本章所有情节、已加入的人物和场景、以及全部备注。\n人物卡 / 场景卡 / 技法卡本身不会被删除。\n\n确定清空吗？',
    )
    if (!ok) return
    novel.clearBuilder()
    setEditingPlot(null)
    setPlotDraft(emptyPlotDraft)
    setPlotDialogOpen(false)
    setSceneOpen(false)
    setOpenCharacterId(null)
    setNotice('已清空构造器：情节、已加入的人物场景和备注都清掉了。')
  }

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h2 className="page__title">构造器</h2>
          <p className="page__hint">把已加入的人物、场景与情节，组织成这一章的骨架。</p>
        </div>
        <div className="page__tools">
          <button type="button" className="btn btn--sm" onClick={() => setPreviewOpen(true)}>
            提示词预览
          </button>
          <button type="button" className="btn btn--sm btn--ghost" onClick={handleExport}>
            导出
          </button>
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            导入
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={handleImportFile}
          />
          <button
            type="button"
            className="btn btn--sm btn--danger-solid"
            onClick={handleClearBuilder}
            title="清空本章的情节、已加入的人物场景和备注（卡片库不受影响）"
          >
            清空构造器
          </button>
          {notice && <span className="tool-hint">{notice}</span>}
        </div>
      </header>

      <div className="builder-tabs" role="tablist" aria-label="构造器分区">
        {SECTIONS.map((item) => {
          const count =
            item.id === 'recap'
              ? (data.previousRecap || '').length
              : item.id === 'scene'
                ? sceneItems.length
                : item.id === 'character'
                  ? characterItems.length
                  : data.plots.length
          const unit = item.id === 'recap' ? '字' : item.id === 'plot' ? '条' : item.id === 'scene' ? '景' : '位'
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              className={`builder-tabs__item${section === item.id ? ' is-active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <span className="builder-tabs__label">{item.label}</span>
              <span className="builder-tabs__count">
                {count}
                {unit}
              </span>
            </button>
          )
        })}
      </div>

      {section === 'recap' && (
        <Card title="前情提要" meta="可选" className="card--frame">
        <label className="label" htmlFor="previous-recap">
          上一章结尾 / 必要前情
        </label>
        <textarea
          id="previous-recap"
          className="input input--area"
          placeholder="上一章最后发生了什么、谁在什么状态、留下了什么悬念……留空就不发给 AI。"
          value={data.previousRecap || ''}
          onChange={(event) => novel.setPreviousRecap(event.target.value)}
        />
        <span className="card__hint">建议 100–300 字：只写必要前情，太长会挤占正文的上下文</span>
        </Card>
      )}

      {section === 'scene' && (
        <Card
          title="场景卡"
          meta={`${sceneItems.length} / ${data.scenes.length}`}
          className="card--frame card--clickable"
          onClick={cardClickGuard(() => setSceneOpen(true))}
        >
        <div className="field field--lg">
          <span className="field__label">已加入的场景</span>
          {sceneItems.length > 0 ? (
            <ul className="chip-list">
              {sceneItems.map((item) => (
                <li key={item.id} className="chip">
                  <span className="chip__name">{item.name}</span>
                  {item.detail && <span className="chip__detail">{item.detail}</span>}
                  <button
                    type="button"
                    className="chip__remove"
                    aria-label={`移出 ${item.name}`}
                    onClick={() => novel.toggleInBuilder('scenes', item.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">
              还没有场景卡加入。
              <button type="button" className="btn btn--link" onClick={() => onNavigate('scene')}>
                去场景卡页添加
              </button>
            </p>
          )}
        </div>

        <label className="label" htmlFor="scene-note">
          备注
        </label>
        <textarea
          id="scene-note"
          className="input input--area"
          placeholder="这一章的场景基调、时间地点、氛围、转折……"
          value={data.notes.scene}
          onChange={(event) => novel.setNote('scene', event.target.value)}
        />
        <span className="card__hint">点击卡片展开查看与编辑</span>
        </Card>
      )}

      <DetailModal
        open={sceneOpen}
        title="场景卡"
        tag="本章"
        meta={`${sceneItems.length} 个场景`}
        sections={[
          {
            label: '已加入的场景',
            text: sceneItems
              .map((item, index) => `${index + 1}. ${item.name}\n${item.detail || '（无描述）'}`)
              .join('\n\n'),
          },
        ]}
        onClose={() => setSceneOpen(false)}
        footer={
          <button type="button" className="btn btn--sm" onClick={() => setSceneOpen(false)}>
            关闭
          </button>
        }
      >
        <div className="detail__section">
          <label className="field__label" htmlFor="scene-note-modal">
            备注
          </label>
          <textarea
            id="scene-note-modal"
            className="input input--area detail__editor"
            placeholder="这一章的场景基调、时间地点、氛围、转折……"
            value={data.notes.scene}
            onChange={(event) => novel.setNote('scene', event.target.value)}
          />
        </div>
      </DetailModal>

      {section === 'character' && (
        <>
          <div className="section-head">
            <h3 className="section-head__title">人物卡</h3>
            <span className="section-head__meta">
              {characterItems.length} / {data.characters.length} 位
            </span>
          </div>

          {characterItems.length === 0 && (
            <Card className="card--empty">
              <p className="empty">
                还没有人物卡加入。
                <button
                  type="button"
                  className="btn btn--link"
                  onClick={() => onNavigate('character')}
                >
                  去人物卡页添加
                </button>
              </p>
            </Card>
          )}

          <div className="character-stack">
            {characterItems.map((item) => (
              <Card
                key={item.id}
                title={item.name}
                tag="人物"
                meta={data.characterNotes[item.id]?.trim() ? '已写备注' : undefined}
                className="card--frame card--clickable"
                onClick={cardClickGuard(() => setOpenCharacterId(item.id))}
                actions={
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => novel.toggleInBuilder('characters', item.id)}
                  >
                    移出构建器
                  </button>
                }
              >
                <label className="label" htmlFor={`character-note-${item.id}`}>
                  本章备注 · 衣服 / 心情 / 状态
                </label>
                <textarea
                  id={`character-note-${item.id}`}
                  className="input input--area"
                  placeholder="这一章他穿什么、情绪如何、和谁的关系有变化、要埋伏笔的地方……"
                  value={data.characterNotes[item.id] || ''}
                  onChange={(event) => novel.setCharacterNote(item.id, event.target.value)}
                />
                <span className="card__hint">点击卡片展开查看与编辑</span>
              </Card>
            ))}
          </div>
        </>
      )}

      {(() => {
        const openItem = characterItems.find((item) => item.id === openCharacterId)
        if (!openItem) return null
        return (
          <DetailModal
            open
            title={openItem.name}
            tag="人物"
            sections={[{ label: '人物背景', text: openItem.detail }]}
            onClose={() => setOpenCharacterId(null)}
            footer={
              <>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    novel.toggleInBuilder('characters', openItem.id)
                  }}
                >
                  移出构建器
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setOpenCharacterId(null)}
                >
                  关闭
                </button>
              </>
            }
          >
            <div className="detail__section">
              <label className="field__label" htmlFor={`character-note-modal-${openItem.id}`}>
                本章备注 · 衣服 / 心情 / 状态
              </label>
              <textarea
                id={`character-note-modal-${openItem.id}`}
                className="input input--area detail__editor"
                placeholder="这一章他穿什么、情绪如何、和谁的关系有变化、要埋伏笔的地方……"
                value={data.characterNotes[openItem.id] || ''}
                onChange={(event) => novel.setCharacterNote(openItem.id, event.target.value)}
              />
            </div>
          </DetailModal>
        )
      })()}

      {section === 'plot' && (
        <>
          <Card title="情节卡" meta={`${data.plots.length} 条`} className="card--frame">
        <div className="plot-font">
          <span className="label">情节字号</span>
          <button
            type="button"
            className="plot__action"
            aria-label="缩小情节字号"
            disabled={fontSize <= 12}
            onClick={() => novel.setPlotFontSize(fontSize - 1)}
          >
            A−
          </button>
          <span className="plot-font__value">{fontSize}px</span>
          <button
            type="button"
            className="plot__action"
            aria-label="放大情节字号"
            disabled={fontSize >= 22}
            onClick={() => novel.setPlotFontSize(fontSize + 1)}
          >
            A＋
          </button>
        </div>
        {data.plots.length > 0 && (
          <ul className="plot-list">
            {data.plots.map((plot, index) => {
              const techs = (plot.techniqueIds || [])
                .map((id) => data.techniques.find((item) => item.id === id))
                .filter(Boolean)

              if (editingPlot?.id === plot.id) {
                return (
                  <li key={plot.id} className="plot plot--editing">
                    <div className="plot__head">
                      <span className="plot__index">情节 {String(index + 1).padStart(2, '0')}</span>
                      <span className="plot__meta">编辑中</span>
                    </div>

                    <div className="plot-form__row">
                      <label className="label" htmlFor={`plot-words-${plot.id}`}>
                        这条的字数
                      </label>
                      <input
                        id={`plot-words-${plot.id}`}
                        className="input input--number"
                        type="number"
                        min="0"
                        step="100"
                        placeholder="800"
                        value={editingPlot.wordCount}
                        onChange={(event) =>
                          setEditingPlot((prev) => ({ ...prev, wordCount: event.target.value }))
                        }
                      />
                    </div>

                    <textarea
                      className="input input--area"
                      style={{ fontSize: `calc(${fontSize}px * var(--fs))` }}
                      value={editingPlot.content}
                      placeholder="这一条情节发生了什么，谁做了什么，结果如何……"
                      onChange={(event) =>
                        setEditingPlot((prev) => ({ ...prev, content: event.target.value }))
                      }
                    />

                    <TechniquePicker
                      techniques={data.techniques}
                      selectedIds={editingPlot.techniqueIds}
                      onToggle={(id) =>
                        setEditingPlot((prev) => ({
                          ...prev,
                          techniqueIds: prev.techniqueIds.includes(id)
                            ? prev.techniqueIds.filter((item) => item !== id)
                            : [...prev.techniqueIds, id],
                        }))
                      }
                      onNavigate={onNavigate}
                    />

                    <div className="plot__edit-actions">
                      <button
                        type="button"
                        className="btn btn--solid btn--sm"
                        onClick={handleSavePlotEdit}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setEditingPlot(null)}
                      >
                        取消
                      </button>
                    </div>
                  </li>
                )
              }

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
                      <button
                        type="button"
                        className="plot__action"
                        onClick={() => startPlotEdit(plot)}
                      >
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
                        <span key={tech.id} className="plot__tech">
                          {tech.name}
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
                setPlotHint('')
                setPlotDialogOpen(true)
              }}
            >
              添加情节
            </button>
          </div>
        </>
      )}

      <DetailModal
        open={plotDialogOpen}
        title="添加情节"
        tag="情节"
        meta={`第 ${String(data.plots.length + 1).padStart(2, '0')} 条`}
        onClose={() => setPlotDialogOpen(false)}
        footer={
          <>
            <span className="tool-hint detail__foot-hint">取消只关弹窗，草稿会留着；保存后才清空。</span>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => setPlotDialogOpen(false)}
            >
              取消
            </button>
            <button type="button" className="btn btn--sm btn--solid" onClick={handleAddPlot}>
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
            className="input input--area detail__editor"
            style={{ fontSize: `calc(${fontSize}px * var(--fs))` }}
            autoFocus
            placeholder="这一条情节发生了什么，谁做了什么，结果如何……"
            value={plotDraft.content}
            onChange={(event) => {
              setPlotDraft((prev) => ({ ...prev, content: event.target.value }))
              setPlotHint('')
            }}
          />
        </div>

        <div className="plot-form__row">
          <label className="label" htmlFor="plot-dialog-words">
            这条情节的指定字数
          </label>
          <input
            id="plot-dialog-words"
            className="input input--number"
            type="number"
            min="0"
            step="100"
            placeholder="800"
            value={plotDraft.wordCount}
            onChange={(event) => setPlotDraft((prev) => ({ ...prev, wordCount: event.target.value }))}
          />
        </div>

        <TechniquePicker
          techniques={data.techniques}
          selectedIds={plotDraft.techniqueIds}
          onToggle={(id) =>
            setPlotDraft((prev) => ({
              ...prev,
              techniqueIds: prev.techniqueIds.includes(id)
                ? prev.techniqueIds.filter((item) => item !== id)
                : [...prev.techniqueIds, id],
            }))
          }
          onNavigate={onNavigate}
        />

        {plotHint && (
          <p className="builder-hint" role="status">
            {plotHint}
          </p>
        )}
      </DetailModal>

      <PromptPreview
        open={previewOpen}
        intro={intro}
        body={prompt.body}
        full={prompt.full}
        customised={data.promptIntro !== null}
        missingTechNotes={prompt.missingTechNotes}
        onNavigate={() => onNavigate('technique')}
        onIntroChange={(value) => novel.setPromptIntro(value)}
        onReset={() => novel.setPromptIntro(null)}
        onClose={() => setPreviewOpen(false)}
      />
    </section>
  )
}

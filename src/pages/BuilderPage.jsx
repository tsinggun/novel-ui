import { useRef, useState } from 'react'
import PromptPreview from '../components/PromptPreview'
import { buildPrompt, DEFAULT_PROMPT_INTRO } from '../prompt'
import { exportToDisk } from '../persist'
import RecapSection from './builder/RecapSection'
import SceneSection from './builder/SceneSection'
import ItemSection from './builder/ItemSection'
import CharacterSection from './builder/CharacterSection'
import PlotSection from './builder/PlotSection'

/** 构造器内部的分区 tab：前情提要 / 场景 / 人物 / 物品 / 情节，一次只展开一块 */
const SECTIONS = [
  { id: 'recap', label: '前情提要', unit: '字' },
  { id: 'scene', label: '场景', unit: '景' },
  { id: 'character', label: '人物', unit: '位' },
  { id: 'item', label: '物品', unit: '件' },
  { id: 'plot', label: '情节', unit: '条' },
]

export default function BuilderPage({ novel, onNavigate, previewOpen = false, onPreviewClose }) {
  const { data } = novel
  const [section, setSection] = useState('recap')
  const [notice, setNotice] = useState('')
  /** 清空构造器 / 导入数据时递增，通知各分区把弹窗收起来 */
  const [resetSignal, setResetSignal] = useState(0)
  const fileInputRef = useRef(null)

  const sceneItems = data.inBuilder.scenes
    .map((id) => data.scenes.find((item) => item.id === id))
    .filter(Boolean)

  const characterItems = data.inBuilder.characters
    .map((id) => data.characters.find((item) => item.id === id))
    .filter(Boolean)

  const itemItems = data.inBuilder.items
    .map((id) => data.items.find((item) => item.id === id))
    .filter(Boolean)

  const intro = data.promptIntro ?? DEFAULT_PROMPT_INTRO
  const fontSize = data.plotFontSize ?? 14

  const prompt = buildPrompt({
    intro,
    recap: data.previousRecap || '',
    scenes: sceneItems,
    characters: characterItems,
    items: itemItems,
    plots: data.plots,
    characterNotes: data.characterNotes,
    sceneNote: data.notes.scene,
    techniques: data.techniques,
    inContext: data.inContext,
  })

  const countOf = (id) =>
    id === 'recap'
      ? (data.previousRecap || '').length
      : id === 'scene'
        ? sceneItems.length
        : id === 'character'
          ? characterItems.length
          : id === 'item'
            ? itemItems.length
            : data.plots.length

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
      setResetSignal((value) => value + 1)
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
    setResetSignal((value) => value + 1)
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
        {SECTIONS.map((item) => (
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
              {countOf(item.id)}
              {item.unit}
            </span>
          </button>
        ))}
      </div>

      {section === 'recap' && <RecapSection novel={novel} data={data} />}

      {section === 'scene' && (
        <SceneSection
          novel={novel}
          data={data}
          items={sceneItems}
          key={resetSignal}
          onNavigate={onNavigate}
        />
      )}

      {section === 'item' && (
        <ItemSection novel={novel} data={data} items={itemItems} onNavigate={onNavigate} />
      )}

      {section === 'character' && (
        <CharacterSection
          novel={novel}
          data={data}
          items={characterItems}
          key={resetSignal}
          onNavigate={onNavigate}
        />
      )}

      {section === 'plot' && (
        <PlotSection
          novel={novel}
          data={data}
          fontSize={fontSize}
          key={resetSignal}
          onNavigate={onNavigate}
        />
      )}

      <PromptPreview
        open={previewOpen}
        intro={intro}
        body={prompt.body}
        full={prompt.full}
        customised={data.promptIntro !== null}
        missingTechNotes={prompt.missingTechNotes}
        inContextCount={prompt.inContextCount}
        savedChars={prompt.savedChars}
        onNavigate={() => onNavigate('technique')}
        onIntroChange={(value) => novel.setPromptIntro(value)}
        onReset={() => novel.setPromptIntro(null)}
        onClose={() => onPreviewClose?.()}
      />
    </section>
  )
}

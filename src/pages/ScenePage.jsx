import { useState } from 'react'
import Card from '../components/Card'
import CardSearch from '../components/CardSearch'
import EntityCard from '../components/EntityCard'
import EntityCreateModal from '../components/EntityCreateModal'
import PasteImportModal from '../components/PasteImportModal'
import { readCardFiles } from '../cardImport'
import { matchEveryTerm } from '../searchTerms'

export default function ScenePage({ novel }) {
  const { data } = novel
  const [draft, setDraft] = useState(null)
  const [terms, setTerms] = useState([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteNotice, setPasteNotice] = useState('')
  const [fileOver, setFileOver] = useState(false)

  /** 直接把 .json 文件拖到页面上：松手就读卡导入 */
  const handlePageDrop = async (event) => {
    event.preventDefault()
    setFileOver(false)
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return
    const { items, problems } = await readCardFiles(files)
    if (items.length === 0) {
      setPasteNotice(problems.join('、') || '文件里没找到场景卡')
      return
    }
    const result = novel.importEntities('scenes', items)
    setPasteNotice(
      `已导入 ${result.added} 张场景卡${result.skipped ? `，跳过重名 ${result.skipped} 张` : ''}${
        problems.length ? `；跳过 ${problems.join('、')}` : ''
      }`,
    )
  }

  const startCreate = () => setDraft({ name: '', detail: '' })
  const cancel = () => setDraft(null)

  const handleSave = () => {
    if (!draft || !draft.name.trim()) return
    novel.saveScene(draft)
    setDraft(null)
  }

  const inBuilder = (id) => data.inBuilder.scenes.includes(id)

  const visibleScenes = data.scenes.filter((item) => matchEveryTerm(terms, [item.name]))

  return (
    <section
      className={`page${fileOver ? ' page--fileover' : ''}`}
      onDragOver={(event) => {
        if (!event.dataTransfer?.types?.includes('Files')) return
        event.preventDefault()
        setFileOver(true)
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        setFileOver(false)
      }}
      onDrop={handlePageDrop}
    >
      {fileOver && <div className="page__dropmask">松手：读取 .json 并导入场景卡</div>}
      <header className="page__head">
        <div>
          <h2 className="page__title">场景卡</h2>
          <p className="page__hint">
            给每个场景起名并写下详情，加入构建器后即可和人物、情节一起编排。点击已有卡片会放大，直接在里面改。
          </p>
        </div>
        <div className="page__actions">
          {pasteNotice && <span className="tool-hint">{pasteNotice}</span>}
          <button type="button" className="btn" onClick={() => setPasteOpen(true)}>导入卡片</button>
          <button type="button" className="btn btn--solid" onClick={startCreate}>
            添加场景卡
          </button>
        </div>
      </header>

      {data.scenes.length > 0 && (
        <CardSearch
          simple
          terms={terms}
          onTermsChange={setTerms}
          placeholder="搜索场景名称"
          total={data.scenes.length}
          matched={visibleScenes.length}
        />
      )}

      {!draft && data.scenes.length === 0 && (
        <Card className="card--empty">
          <p className="empty">还没有场景卡。点击右上角「添加场景卡」创建第一张。</p>
        </Card>
      )}

      {(draft || data.scenes.length > 0) && (
        <div className="card-grid">
          {visibleScenes.length === 0 && terms.length > 0 && (
            <Card className="card--empty">
              <p className="empty">
                没有匹配的场景卡。
                <button type="button" className="btn btn--link" onClick={() => setTerms([])}>
                  清空检索
                </button>
              </p>
            </Card>
          )}

          {visibleScenes.map((item) => (
            <EntityCard
              key={item.id}
              id={item.id}
              title={item.name}
              detail={item.detail}
              detailLabel="详情 / 场景描述"
              nameLabel="场景名称"
              namePlaceholder="例如：城南旧书店的雨夜"
              detailPlaceholder="时间、地点、氛围、在场人物、发生的事件……"
              inBuilder={inBuilder(item.id)}
              onToggleBuilder={() => novel.toggleInBuilder('scenes', item.id)}
              onSave={(patch) => novel.saveScene(patch)}
              onRemove={() => novel.removeEntity('scenes', item.id)}
            />
          ))}
        </div>
      )}

      <p className="page__foot">
        共 {data.scenes.length} 张场景卡 · 已加入构建器 {data.inBuilder.scenes.length} 张
      </p>

      <EntityCreateModal
        open={Boolean(draft)}
        title="创建场景"
        nameLabel="场景名称"
        namePlaceholder="例如：城南旧书店的雨夜"
        detailLabel="详情 / 场景描述"
        detailPlaceholder="时间、地点、氛围、在场人物、发生的事件……"
        draft={draft}
        onChange={setDraft}
        onSave={handleSave}
        onCancel={cancel}
        onPasteImport={(items) => {
          const result = novel.importEntities('scenes', items)
          setDraft(null)
          setPasteNotice(`已导入 ${result.added} 张场景卡${result.skipped ? `，跳过重名 ${result.skipped} 张` : ''}`)
        }}
      />

      <PasteImportModal
        open={pasteOpen}
        title="导入场景卡"
        hint="粘 JSON 或选 .json 文件；追加进卡库，重名跳过。"
        example={'{\n  "name": "雨夜旧书店",\n  "detail": "时间、地点、氛围……"\n}'}
        onImport={(items) => {
          const result = novel.importEntities('scenes', items)
          setPasteNotice(`已导入 ${result.added} 张场景卡${result.skipped ? `，跳过重名 ${result.skipped} 张` : ''}`)
          if (result.added > 0) setPasteOpen(false)
          return result
        }}
        onClose={() => setPasteOpen(false)}
      />
    </section>
  )
}

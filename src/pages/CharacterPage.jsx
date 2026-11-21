import { useState } from 'react'
import Card from '../components/Card'
import CardSearch from '../components/CardSearch'
import EntityCard from '../components/EntityCard'
import EntityCreateModal from '../components/EntityCreateModal'
import PasteImportModal from '../components/PasteImportModal'
import { readCardFiles } from '../cardImport'
import { matchEveryTerm } from '../searchTerms'

export default function CharacterPage({ novel }) {
  const { data } = novel
  const [draft, setDraft] = useState(null)
  const [terms, setTerms] = useState([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteNotice, setPasteNotice] = useState('')
  const [fileOver, setFileOver] = useState(false)

  /** 直接把 .json 文件拖到页面上：松手就读卡导入，不用开弹窗 */
  const handlePageDrop = async (event) => {
    event.preventDefault()
    setFileOver(false)
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return
    const { items, problems } = await readCardFiles(files)
    if (items.length === 0) {
      setPasteNotice(problems.join('、') || '文件里没找到人物卡')
      return
    }
    const result = novel.importEntities('characters', items)
    setPasteNotice(
      `已导入 ${result.added} 张人物卡${result.skipped ? `，跳过重名 ${result.skipped} 张` : ''}${
        problems.length ? `；跳过 ${problems.join('、')}` : ''
      }`,
    )
  }

  const startCreate = () => setDraft({ name: '', detail: '' })
  const cancel = () => setDraft(null)

  const handleSave = () => {
    if (!draft || !draft.name.trim()) return
    novel.saveEntity('characters', draft)
    setDraft(null)
  }

  const inBuilder = (id) => data.inBuilder.characters.includes(id)

  const visibleCharacters = data.characters.filter((item) => matchEveryTerm(terms, [item.name]))

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
      {fileOver && <div className="page__dropmask">松手：读取 .json 并导入人物卡</div>}
      <header className="page__head">
        <div>
          <h2 className="page__title">人物卡</h2>
          <p className="page__hint">
            写下姓名与人物故事，保存后可一键加入构建器。点击已有卡片会放大，直接在里面改。
          </p>
        </div>
        <div className="page__actions">
          {pasteNotice && <span className="tool-hint">{pasteNotice}</span>}
          <button type="button" className="btn" onClick={() => setPasteOpen(true)}>导入卡片</button>
          <button type="button" className="btn btn--solid" onClick={startCreate}>
            添加人物
          </button>
        </div>
      </header>

      {data.characters.length > 0 && (
        <CardSearch
          simple
          terms={terms}
          onTermsChange={setTerms}
          placeholder="搜索人物姓名"
          total={data.characters.length}
          matched={visibleCharacters.length}
        />
      )}

      {!draft && data.characters.length === 0 && (
        <Card className="card--empty">
          <p className="empty">还没有人物卡。点击右上角「添加人物」开始第一张。</p>
        </Card>
      )}

      {(draft || data.characters.length > 0) && (
        <div className="card-grid">
          {visibleCharacters.length === 0 && terms.length > 0 && (
            <Card className="card--empty">
              <p className="empty">
                没有匹配的人物卡。
                <button type="button" className="btn btn--link" onClick={() => setTerms([])}>
                  清空检索
                </button>
              </p>
            </Card>
          )}

          {visibleCharacters.map((item) => (
            <EntityCard
              key={item.id}
              id={item.id}
              title={item.name}
              detail={item.detail}
              detailLabel="详情 / 人物故事"
              nameLabel="姓名"
              namePlaceholder="例如：林见月"
              detailPlaceholder="出身、性格、执念、与主角的关系、关键经历……"
              inBuilder={inBuilder(item.id)}
              onToggleBuilder={() => novel.toggleInBuilder('characters', item.id)}
              onSave={(patch) => novel.saveEntity('characters', patch)}
              onRemove={() => novel.removeEntity('characters', item.id)}
            />
          ))}
        </div>
      )}

      <p className="page__foot">
        共 {data.characters.length} 张人物卡 · 已加入构建器 {data.inBuilder.characters.length} 张
      </p>

      <EntityCreateModal
        open={Boolean(draft)}
        title="创建人物"
        nameLabel="姓名"
        namePlaceholder="例如：林见月"
        detailLabel="详情 / 人物故事"
        detailPlaceholder="出身、性格、执念、与主角的关系、关键经历……"
        draft={draft}
        onChange={setDraft}
        onSave={handleSave}
        onCancel={cancel}
        onPasteImport={(items) => {
          const result = novel.importEntities('characters', items)
          setDraft(null)
          setPasteNotice(`已导入 ${result.added} 张人物卡${result.skipped ? `，跳过重名 ${result.skipped} 张` : ''}`)
        }}
      />

      <PasteImportModal
        open={pasteOpen}
        title="导入人物卡"
        hint="粘 JSON 或选 .json 文件；追加进卡库，重名跳过。"
        example={'{\n  "name": "林见月",\n  "detail": "出身、性格、执念……"\n}'}
        onImport={(items) => {
          const result = novel.importEntities('characters', items)
          setPasteNotice(`已导入 ${result.added} 张人物卡${result.skipped ? `，跳过重名 ${result.skipped} 张` : ''}`)
          if (result.added > 0) setPasteOpen(false)
          return result
        }}
        onClose={() => setPasteOpen(false)}
      />
    </section>
  )
}


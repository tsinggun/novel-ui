import { useState } from 'react'
import Card from '../components/Card'
import CardSearch from '../components/CardSearch'
import EntityCard from '../components/EntityCard'
import EntityCreateModal from '../components/EntityCreateModal'
import PasteImportModal from '../components/PasteImportModal'
import { readCardFiles } from '../cardImport'
import { matchEveryTerm } from '../searchTerms'

export default function ItemPage({ novel }) {
  const { data } = novel
  const [draft, setDraft] = useState(null)
  const [terms, setTerms] = useState([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteNotice, setPasteNotice] = useState('')
  const [fileOver, setFileOver] = useState(false)

  const startCreate = () => setDraft({ name: '', detail: '' })
  const cancel = () => setDraft(null)

  const handleSave = () => {
    if (!draft || !draft.name.trim()) return
    novel.saveItem(draft)
    setDraft(null)
  }

  const inBuilder = (id) => data.inBuilder.items.includes(id)

  const importItems = (list) => {
    const result = novel.importEntities('items', list)
    setPasteNotice(
      `已导入 ${result.added} 张物品卡${result.skipped ? `，跳过重名 ${result.skipped} 张` : ''}`,
    )
    return result
  }

  /** 直接把 .json 文件拖到页面上：松手就读卡导入 */
  const handlePageDrop = async (event) => {
    event.preventDefault()
    setFileOver(false)
    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return
    const { items, problems } = await readCardFiles(files)
    if (items.length === 0) {
      setPasteNotice(problems.join('、') || '文件里没找到物品卡')
      return
    }
    importItems(items)
    if (problems.length) setPasteNotice((prev) => `${prev}；跳过 ${problems.join('、')}`)
  }

  const visibleItems = data.items.filter((item) => matchEveryTerm(terms, [item.name]))

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
      {fileOver && <div className="page__dropmask">松手：读取 .json 并导入物品卡</div>}
      <header className="page__head">
        <div>
          <h2 className="page__title">物品卡</h2>
          <p className="page__hint">
            写下物品与它的来历、外观、用途，加入构建器后 AI 才知道这件东西是什么、能干什么。
          </p>
        </div>
        <div className="page__actions">
          {pasteNotice && <span className="tool-hint">{pasteNotice}</span>}
          <button type="button" className="btn" onClick={() => setPasteOpen(true)}>
            导入卡片
          </button>
          <button type="button" className="btn btn--solid" onClick={startCreate}>
            添加物品
          </button>
        </div>
      </header>

      {data.items.length > 0 && (
        <CardSearch
          simple
          terms={terms}
          onTermsChange={setTerms}
          placeholder="搜索物品名称"
          total={data.items.length}
          matched={visibleItems.length}
        />
      )}

      {!draft && data.items.length === 0 && (
        <Card className="card--empty">
          <p className="empty">还没有物品卡。点击右上角「添加物品」开始第一张。</p>
        </Card>
      )}

      {(draft || data.items.length > 0) && (
        <div className="card-grid">
          {visibleItems.length === 0 && terms.length > 0 && (
            <Card className="card--empty">
              <p className="empty">
                没有匹配的物品卡。
                <button type="button" className="btn btn--link" onClick={() => setTerms([])}>
                  清空检索
                </button>
              </p>
            </Card>
          )}

          {visibleItems.map((item) => (
            <EntityCard
              key={item.id}
              id={item.id}
              title={item.name}
              detail={item.detail}
              detailLabel="物品描述"
              nameLabel="物品名称"
              namePlaceholder="例如：青铜钥匙、母亲的旧手串"
              detailPlaceholder="来历、外观、材质、用途、有什么特殊之处、谁给的……"
              inBuilder={inBuilder(item.id)}
              onToggleBuilder={() => novel.toggleInBuilder('items', item.id)}
              onSave={(patch) => novel.saveItem(patch)}
              onRemove={() => novel.removeEntity('items', item.id)}
            />
          ))}
        </div>
      )}

      <p className="page__foot">
        共 {data.items.length} 张物品卡 · 已加入构建器 {data.inBuilder.items.length} 张
      </p>

      <EntityCreateModal
        open={Boolean(draft)}
        title="创建物品"
        nameLabel="物品名称"
        namePlaceholder="例如：青铜钥匙、母亲的旧手串"
        detailLabel="物品描述"
        detailPlaceholder="来历、外观、材质、用途、有什么特殊之处、谁给的……"
        draft={draft}
        onChange={setDraft}
        onSave={handleSave}
        onCancel={cancel}
      />

      <PasteImportModal
        open={pasteOpen}
        title="导入物品卡"
        hint="粘 JSON 或选 .json 文件；追加进卡库，重名跳过。"
        example={'{\n  "name": "青铜钥匙",\n  "detail": "锈迹斑斑，能开二楼那扇门"\n}'}
        onImport={(list) => {
          const result = importItems(list)
          if (result.added > 0) setPasteOpen(false)
          return result
        }}
        onClose={() => setPasteOpen(false)}
      />
    </section>
  )
}

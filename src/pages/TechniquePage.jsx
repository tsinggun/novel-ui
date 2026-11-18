import { useState } from 'react'
import Card from '../components/Card'
import CardSearch from '../components/CardSearch'
import EntityCard from '../components/EntityCard'
import EntityCreateModal from '../components/EntityCreateModal'
import PasteImportModal from '../components/PasteImportModal'
import { matchEveryTerm } from '../searchTerms'

export default function TechniquePage({ novel }) {
  const { data } = novel
  const [draft, setDraft] = useState(null)
  const [activeTags, setActiveTags] = useState([])
  /** 排除标签：带这些标签的技法卡全部不显示（视图过滤，不动数据） */
  const [blockedTags, setBlockedTags] = useState([])
  const [terms, setTerms] = useState([])
  const [tagQuery, setTagQuery] = useState('')
  const [tagsExpanded, setTagsExpanded] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteNotice, setPasteNotice] = useState('')

  // 标签一多就折叠，先只铺这么多个；已选的永远优先显示
  const TAG_COLLAPSE_AT = 12
  const TAG_SEARCH_AT = 8

  const startCreate = () => setDraft({ name: '', detail: '', tags: [] })
  const cancel = () => setDraft(null)

  const handleSave = () => {
    if (!draft || !draft.name.trim()) return
    novel.saveTechnique(draft)
    setDraft(null)
  }

  // 收集全部标签：使用次数多的排前面，同频按首次出现
  const tagStats = []
  data.techniques.forEach((item) => {
    const itemTags = item.tags || []
    itemTags.forEach((tag) => {
      const found = tagStats.find((entry) => entry.tag === tag)
      if (found) found.count += 1
      else tagStats.push({ tag, count: 1, order: tagStats.length })
    })
  })
  tagStats.sort((a, b) => b.count - a.count || a.order - b.order)

  const toggleTag = (tag) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
  }

  // 多个标签是「同时满足」：选 A+B 只显示同时带 A 和 B 的技法卡（不是并集）
  const matchesFilter = (item) =>
    activeTags.length === 0 || activeTags.every((tag) => (item.tags || []).includes(tag))

  // 排除标签优先：带任一个被排除标签的卡直接不看
  const blockedFilter = (item) => (item.tags || []).every((tag) => !blockedTags.includes(tag))

  // 卡片检索：标题（技法名）+ 标签都能命中；多个条件全都要满足，和标签筛选也是「同时满足」
  const tagFiltered = data.techniques.filter((item) => blockedFilter(item) && matchesFilter(item))
  const visibleTechniques = tagFiltered.filter((item) =>
    matchEveryTerm(terms, [item.name, ...(item.tags || [])]),
  )

  // 筛选区实际铺出来的标签
  // 顺序永远按「使用次数 → 首次出现」排，选中的标签只加高亮、不挪位置，
  // 否则点一下标签它就跳到最前面，整排看起来全乱了。
  const query = tagQuery.trim().toLowerCase()
  const queryMatched = query
    ? tagStats.filter((entry) => entry.tag.toLowerCase().includes(query))
    : null
  const selectedStats = tagStats.filter((entry) => activeTags.includes(entry.tag))
  const shownTagStats = (() => {
    if (queryMatched) return queryMatched
    if (tagsExpanded) return tagStats
    // 收起状态：先铺前 N 个，但已选中的标签无论排多后都要露出来（仍按原顺序）
    const head = tagStats.slice(0, TAG_COLLAPSE_AT)
    const keep = new Set(head.map((entry) => entry.tag))
    selectedStats.forEach((entry) => keep.add(entry.tag))
    return tagStats.filter((entry) => keep.has(entry.tag))
  })()
  const hiddenTagCount = tagStats.length - shownTagStats.length

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h2 className="page__title">技法卡</h2>
          <p className="page__hint">
            写下写作技法（节奏、视角、修辞、结构……），保存后在情节卡里勾选使用。点击已有卡片会放大，直接在里面改。
          </p>
        </div>
        <div className="page__actions">
          {pasteNotice && <span className="tool-hint">{pasteNotice}</span>}
          <button type="button" className="btn" onClick={() => setPasteOpen(true)}>导入卡片</button>
          <button type="button" className="btn btn--solid" onClick={startCreate}>
            添加技法
          </button>
        </div>
      </header>

      {!draft && data.techniques.length === 0 && (
        <Card className="card--empty">
          <p className="empty">还没有技法卡。点击右上角「添加技法」创建第一张。</p>
        </Card>
      )}

      {data.techniques.length > 0 && (
        <CardSearch
          terms={terms}
          onTermsChange={setTerms}
          placeholder="搜索技法名称或标签"
          total={data.techniques.length}
          matched={visibleTechniques.length}
        />
      )}

      {data.techniques.length > 0 && tagStats.length > 0 && (
        <div className="tag-filter">
          <span className="label">按标签筛选</span>

          {tagStats.length > TAG_SEARCH_AT && (
            <input
              className="tag-filter__search"
              type="search"
              value={tagQuery}
              placeholder="搜索标签"
              onChange={(event) => setTagQuery(event.target.value)}
              aria-label="搜索标签"
            />
          )}

          <ul className="tag-filter__list">
            <li>
              <button
                type="button"
                className={`tag-filter__chip${activeTags.length === 0 ? ' is-active' : ''}`}
                onClick={() => setActiveTags([])}
              >
                全部 {data.techniques.length}
              </button>
            </li>
            {shownTagStats.map(({ tag, count }) => (
              <li key={tag} className="tag-unit">
                <button
                  type="button"
                  className={`tag-filter__chip${activeTags.includes(tag) ? ' is-active' : ''}${
                    blockedTags.includes(tag) ? ' is-excluded' : ''
                  }`}
                  aria-pressed={activeTags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                  title={`只显示带「${tag}」的技法卡`}
                >
                  {tag} {count}
                </button>
                <button
                  type="button"
                  className="tag-filter__exclude"
                  aria-label={`排除所有带「${tag}」的技法卡`}
                  title={`排除：带「${tag}」的技法卡全部不显示`}
                  onClick={() => setBlockedTags((prev) => [...prev, tag])}
                >
                  ⊘
                </button>
              </li>
            ))}
            {!query && hiddenTagCount > 0 && (
              <li>
                <button
                  type="button"
                  className="btn btn--link"
                  onClick={() => setTagsExpanded(true)}
                >
                  展开全部（还有 {hiddenTagCount} 个）
                </button>
              </li>
            )}
            {!query && tagsExpanded && tagStats.length > TAG_COLLAPSE_AT && (
              <li>
                <button type="button" className="btn btn--link" onClick={() => setTagsExpanded(false)}>
                  收起
                </button>
              </li>
            )}
          </ul>

          {blockedTags.length > 0 && (
            <div className="tag-filter__blocked">
              <span className="label">已排除</span>
              {blockedTags.map((tag) => (
                <span key={tag} className="tag-chip tag-chip--blocked">
                  ⊘ {tag}
                  <button
                    type="button"
                    className="tag-chip__remove"
                    aria-label={`恢复标签 ${tag}`}
                    onClick={() => setBlockedTags((prev) => prev.filter((item) => item !== tag))}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button type="button" className="btn btn--link" onClick={() => setBlockedTags([])}>
                全部恢复
              </button>
            </div>
          )}

          <div className="tag-filter__side">
            {queryMatched && queryMatched.length === 0 && (
              <span className="tag-filter__hint">没有匹配的标签</span>
            )}
            {activeTags.length > 0 && (
              <span className="tag-filter__hint">
                已选 {activeTags.length} 个标签（需同时满足）· 命中 {tagFiltered.length} 张
                <button type="button" className="btn btn--link" onClick={() => setActiveTags([])}>
                  清空
                </button>
              </span>
            )}
            <span className="tag-filter__hint tag-filter__hint--mute">
              共 {tagStats.length} 个标签 · {data.techniques.length} 张卡
            </span>
          </div>
        </div>
      )}

      {(draft || data.techniques.length > 0) && (
        <div className="card-grid">
          {visibleTechniques.length === 0 && (
            <Card className="card--empty">
              <p className="empty">
                没有匹配的技法卡。
                <button
                  type="button"
                  className="btn btn--link"
                  onClick={() => {
                    setActiveTags([])
                    setTerms([])
                  }}
                >
                  清空筛选
                </button>
              </p>
            </Card>
          )}

          {visibleTechniques.map((item) => (
            <EntityCard
              key={item.id}
              id={item.id}
              title={item.name}
              detail={item.detail}
              detailLabel="用法说明"
              nameLabel="技法名称"
              namePlaceholder="例如：慢镜头、限知视角、物件寄托"
              detailPlaceholder="这个技法怎么用、适合放在什么样的情节里、要注意什么……"
              tagLabel="标签"
              tags={item.tags}
              onSave={(patch) => novel.saveTechnique(patch)}
              onRemove={() => novel.removeEntity('techniques', item.id)}
              showBuilder={false}
            />
          ))}
        </div>
      )}

      <p className="page__foot">
        共 {data.techniques.length} 张技法卡
        {activeTags.length > 0 && ` · 当前显示 ${visibleTechniques.length} 张`} · 在构造器添加情节时可勾选
      </p>

      <EntityCreateModal
        open={Boolean(draft)}
        title="创建技法"
        nameLabel="技法名称"
        namePlaceholder="例如：慢镜头、限知视角、物件寄托"
        detailLabel="用法说明"
        detailPlaceholder="这个技法怎么用、适合放在什么样的情节里、要注意什么……"
        tags={draft?.tags}
        draft={draft}
        onChange={setDraft}
        onSave={handleSave}
        onCancel={cancel}
        onPasteImport={(items) => {
          const result = novel.importEntities('techniques', items)
          setDraft(null)
          setPasteNotice(`已导入 ${result.added} 张技法卡${result.skipped ? `，跳过重名 ${result.skipped} 张` : ''}`)
        }}
      />

      <PasteImportModal
        open={pasteOpen}
        title="导入技法卡"
        hint="粘 JSON 或选 .json 文件；追加进卡库，重名跳过。"
        example={'{\n  "name": "慢镜头",\n  "detail": "把动作拆成几拍写",\n  "tags": ["节奏", "画面"]\n}'}
        onImport={(items) => {
          const result = novel.importEntities('techniques', items)
          setPasteNotice(`已导入 ${result.added} 张技法卡${result.skipped ? `，跳过重名 ${result.skipped} 张` : ''}`)
          if (result.added > 0) setPasteOpen(false)
          return result
        }}
        onClose={() => setPasteOpen(false)}
      />
    </section>
  )
}

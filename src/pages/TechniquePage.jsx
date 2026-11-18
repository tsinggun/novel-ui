import { useState } from 'react'
import Card from '../components/Card'
import CardSearch from '../components/CardSearch'
import EntityCard from '../components/EntityCard'
import EntityFormCard from '../components/EntityFormCard'

export default function TechniquePage({ novel }) {
  const { data } = novel
  const [draft, setDraft] = useState(null)
  const [activeTags, setActiveTags] = useState([])
  const [cardQuery, setCardQuery] = useState('')
  const [tagQuery, setTagQuery] = useState('')
  const [tagsExpanded, setTagsExpanded] = useState(false)

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

  const matchesFilter = (item) =>
    activeTags.length === 0 || activeTags.some((tag) => (item.tags || []).includes(tag))

  // 卡片检索：标题（技法名）+ 标签都能命中；和标签筛选是「同时满足」
  const keyword = cardQuery.trim().toLowerCase()
  const tagFiltered = data.techniques.filter((item) => matchesFilter(item))
  const visibleTechniques = tagFiltered.filter(
    (item) =>
      !keyword ||
      item.name.toLowerCase().includes(keyword) ||
      (item.tags || []).some((tag) => tag.toLowerCase().includes(keyword)),
  )

  // 筛选区实际铺出来的标签
  const query = tagQuery.trim().toLowerCase()
  const selectedStats = tagStats.filter((entry) => activeTags.includes(entry.tag))
  const unselectedStats = tagStats.filter((entry) => !activeTags.includes(entry.tag))
  const queryMatched = query
    ? tagStats.filter((entry) => entry.tag.toLowerCase().includes(query))
    : null
  const shownTagStats = queryMatched
    ? queryMatched
    : tagsExpanded
      ? [...selectedStats, ...unselectedStats]
      : [...selectedStats, ...unselectedStats.slice(0, Math.max(0, TAG_COLLAPSE_AT - selectedStats.length))]
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
        <button type="button" className="btn btn--solid" onClick={startCreate}>
          添加技法
        </button>
      </header>

      {!draft && data.techniques.length === 0 && (
        <Card className="card--empty">
          <p className="empty">还没有技法卡。点击右上角「添加技法」创建第一张。</p>
        </Card>
      )}

      {data.techniques.length > 0 && (
        <CardSearch
          value={cardQuery}
          onChange={setCardQuery}
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
              <li key={tag}>
                <button
                  type="button"
                  className={`tag-filter__chip${activeTags.includes(tag) ? ' is-active' : ''}`}
                  aria-pressed={activeTags.includes(tag)}
                  onClick={() => toggleTag(tag)}
                >
                  {tag} {count}
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

          <div className="tag-filter__side">
            {queryMatched && queryMatched.length === 0 && (
              <span className="tag-filter__hint">没有匹配的标签</span>
            )}
            {activeTags.length > 0 && (
              <span className="tag-filter__hint">
                已选 {activeTags.length} 个标签 · 命中 {tagFiltered.length} 张
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
          {draft && !draft.id && (
            <EntityFormCard
              title="创建技法"
              nameLabel="技法名称"
              namePlaceholder="例如：慢镜头、限知视角、物件寄托"
              detailLabel="用法说明"
              detailPlaceholder="这个技法怎么用、适合放在什么样的情节里、要注意什么……"
              draft={draft}
              onChange={setDraft}
              onSave={handleSave}
              onCancel={cancel}
              tags={draft.tags}
              onTagsChange={(tags) => setDraft((prev) => ({ ...prev, tags }))}
            />
          )}

          {visibleTechniques.length === 0 && (
            <Card className="card--empty">
              <p className="empty">
                没有匹配的技法卡。
                <button
                  type="button"
                  className="btn btn--link"
                  onClick={() => {
                    setActiveTags([])
                    setCardQuery('')
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
    </section>
  )
}

import { useState } from 'react'
import Card from '../components/Card'
import EntityCard from '../components/EntityCard'
import EntityFormCard from '../components/EntityFormCard'

export default function TechniquePage({ novel }) {
  const { data } = novel
  const [draft, setDraft] = useState(null)
  const [activeTags, setActiveTags] = useState([])

  const startCreate = () => setDraft({ name: '', detail: '', tags: [] })
  const startEdit = (item) =>
    setDraft({
      id: item.id,
      name: item.name,
      detail: item.detail,
      tags: Array.isArray(item.tags) ? item.tags : [],
    })
  const cancel = () => setDraft(null)

  const handleSave = () => {
    if (!draft || !draft.name.trim()) return
    novel.saveTechnique(draft)
    setDraft(null)
  }

  // 收集全部标签（按首次出现排序，带张数）
  const tagStats = []
  data.techniques.forEach((item) => {
    const itemTags = item.tags || []
    itemTags.forEach((tag) => {
      const found = tagStats.find((entry) => entry.tag === tag)
      if (found) found.count += 1
      else tagStats.push({ tag, count: 1 })
    })
  })

  const toggleTag = (tag) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
  }

  const matchesFilter = (item) =>
    activeTags.length === 0 || activeTags.some((tag) => (item.tags || []).includes(tag))

  // 正在编辑的那张即使被筛掉也要显示，避免编辑到一半消失
  const visibleTechniques = data.techniques.filter(
    (item) => matchesFilter(item) || draft?.id === item.id,
  )

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h2 className="page__title">技法卡</h2>
          <p className="page__hint">
            写下写作技法（节奏、视角、修辞、结构……），保存后在情节卡里勾选使用。
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

      {data.techniques.length > 0 && tagStats.length > 0 && (
        <div className="tag-filter">
          <span className="label">按标签筛选</span>
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
            {tagStats.map(({ tag, count }) => (
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
          </ul>
          {activeTags.length > 0 && (
            <span className="tag-filter__hint">
              已选 {activeTags.length} 个标签 · 命中 {visibleTechniques.length} 张
            </span>
          )}
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
                <button type="button" className="btn btn--link" onClick={() => setActiveTags([])}>
                  清空筛选
                </button>
              </p>
            </Card>
          )}

          {visibleTechniques.map((item) =>
            draft?.id === item.id ? (
              <EntityFormCard
                key={item.id}
                title={draft.name || '编辑中'}
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
            ) : (
              <EntityCard
                key={item.id}
                title={item.name}
                detail={item.detail}
                detailLabel="用法说明"
                tags={item.tags}
                onEdit={() => startEdit(item)}
                onRemove={() => novel.removeEntity('techniques', item.id)}
                showBuilder={false}
              />
            ),
          )}
        </div>
      )}

      <p className="page__foot">
        共 {data.techniques.length} 张技法卡
        {activeTags.length > 0 && ` · 当前显示 ${visibleTechniques.length} 张`} · 在构造器添加情节时可勾选
      </p>
    </section>
  )
}


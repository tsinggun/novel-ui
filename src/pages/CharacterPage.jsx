import { useState } from 'react'
import Card from '../components/Card'
import EntityCard from '../components/EntityCard'
import EntityFormCard from '../components/EntityFormCard'

export default function CharacterPage({ novel }) {
  const { data } = novel
  const [draft, setDraft] = useState(null)

  const startCreate = () => setDraft({ name: '', detail: '' })
  const cancel = () => setDraft(null)

  const handleSave = () => {
    if (!draft || !draft.name.trim()) return
    novel.saveCharacter(draft)
    setDraft(null)
  }

  const inBuilder = (id) => data.inBuilder.characters.includes(id)

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h2 className="page__title">人物卡</h2>
          <p className="page__hint">
            写下姓名与人物故事，保存后可一键加入构建器。点击已有卡片会放大，直接在里面改。
          </p>
        </div>
        <button type="button" className="btn btn--solid" onClick={startCreate}>
          添加人物
        </button>
      </header>

      {!draft && data.characters.length === 0 && (
        <Card className="card--empty">
          <p className="empty">还没有人物卡。点击右上角「添加人物」开始第一张。</p>
        </Card>
      )}

      {(draft || data.characters.length > 0) && (
        <div className="card-grid">
          {draft && !draft.id && (
            <EntityFormCard
              title="创建人物"
              nameLabel="姓名"
              namePlaceholder="例如：林见月"
              detailLabel="详情 / 人物故事"
              detailPlaceholder="出身、性格、执念、与主角的关系、关键经历……"
              draft={draft}
              onChange={setDraft}
              onSave={handleSave}
              onCancel={cancel}
            />
          )}

          {data.characters.map((item) => (
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
              onSave={(patch) => novel.saveCharacter(patch)}
              onRemove={() => novel.removeEntity('characters', item.id)}
            />
          ))}
        </div>
      )}

      <p className="page__foot">
        共 {data.characters.length} 张人物卡 · 已加入构建器 {data.inBuilder.characters.length} 张
      </p>
    </section>
  )
}

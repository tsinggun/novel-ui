import { useMemo, useState } from 'react'
import Card from '../components/Card'
import '../components/Card.css'
import './LibraryPage.css'

const GROUPS = [
  { kind: 'characters', label: '人物', hint: '可以从任何一部作品里攒，用得上的再拉进当前作品' },
  { kind: 'scenes', label: '场景', hint: '氛围、地点、道具类的设定都放这' },
  { kind: 'techniques', label: '技法', hint: '带标签，方便按节奏情绪挑' },
]

export default function LibraryPage({ novel, library }) {
  const [filter, setFilter] = useState('')

  const terms = filter.trim().toLowerCase()

  const visible = useMemo(() => {
    const hit = (item) => {
      if (!terms) return true
      const text = [item.name, item.detail, ...(item.tags || [])].join(' ').toLowerCase()
      return text.includes(terms)
    }
    return {
      characters: (library.library.characters || []).filter(hit),
      scenes: (library.library.scenes || []).filter(hit),
      techniques: (library.library.techniques || []).filter(hit),
    }
  }, [library.library, terms])

  const total =
    (library.library.characters?.length || 0) +
    (library.library.scenes?.length || 0) +
    (library.library.techniques?.length || 0)

  /** 从素材库拉进当前作品（新 id，不动素材库里那份） */
  const pull = (kind, item) => {
    if (kind === 'characters') novel.saveCharacter({ name: item.name, detail: item.detail })
    if (kind === 'scenes') novel.saveScene({ name: item.name, detail: item.detail })
    if (kind === 'techniques') {
      novel.saveTechnique({ name: item.name, detail: item.detail, tags: item.tags || [] })
    }
  }

  return (
    <section className="page">
      <header className="page__head">
        <div>
          <h2 className="page__title">素材库</h2>
          <p className="page__hint">
            本机独有一份，不跟作品走，也不会上传。用「存入」把当前作品的卡片攒进来，用「取用」拉回任意作品。
          </p>
        </div>
        <div className="page__head-actions">
          <input
            className="input input--search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="按名字 / 内容 / 标签筛选"
            aria-label="筛选素材"
          />
        </div>
      </header>

      {!library.available && (
        <Card className="card--empty">
          <p className="empty">
            素材库只在本地运行时可用：双击「启动小说构建器」打开的客户端窗口里能看到这里。
            线上网页版没有入口，也读不到你本机的素材。
          </p>
        </Card>
      )}

      {library.available && (
        <>
          <p className="page__foot">
            共 {total} 份素材
            {library.busy && ' · 正在保存'}
            {library.libraryPath && ` · 文件：${library.libraryPath}`}
          </p>

          <div className="library">
            {GROUPS.map((group) => {
              const libItems = visible[group.kind] || []
              const workItems = (novel.data[group.kind] || []).filter((item) =>
                terms
                  ? [item.name, item.detail, ...(item.tags || [])]
                      .join(' ')
                      .toLowerCase()
                      .includes(terms)
                  : true,
              )

              return (
                <div className="library__group" key={group.kind}>
                  <div className="library__head">
                    <h3 className="library__title">
                      {group.label}
                      <span className="library__count">{libItems.length}</span>
                    </h3>
                    <p className="library__hint">{group.hint}</p>
                  </div>

                  {libItems.length === 0 && (
                    <p className="library__empty">素材库里还没有{group.label}，从下面「当前作品」里选一份存进来。</p>
                  )}

                  {libItems.length > 0 && (
                    <div className="card-grid">
                      {libItems.map((item) => (
                        <Card
                          key={item.id}
                          title={item.name}
                          tag={group.kind === 'techniques' ? (item.tags || []).join(' · ') : ''}
                          actions={
                            <>
                              <button
                                type="button"
                                className="btn btn--solid btn--sm"
                                onClick={() => pull(group.kind, item)}
                              >
                                取用
                              </button>
                              <button
                                type="button"
                                className="btn btn--link btn--danger"
                                onClick={() => library.drop(group.kind, item.id)}
                              >
                                移出
                              </button>
                            </>
                          }
                        >
                          <p className="card__detail">{item.detail || '（还没写说明）'}</p>
                        </Card>
                      ))}
                    </div>
                  )}

                  {workItems.length > 0 && (
                    <details className="library__source">
                      <summary>
                        从当前作品存入{group.label}（{workItems.length}）
                      </summary>
                      <ul className="library__list">
                        {workItems.map((item) => {
                          const kept = (library.library[group.kind] || []).some((one) =>
                            one.name.trim() === item.name.trim() &&
                            (one.detail || '').trim() === (item.detail || '').trim(),
                          )
                          return (
                            <li key={item.id} className="library__row">
                              <span className="library__row-name">{item.name}</span>
                              <span className="library__row-detail">
                                {(item.detail || '（无说明）').slice(0, 60)}
                              </span>
                              <button
                                type="button"
                                className="btn btn--sm"
                                disabled={kept}
                                onClick={() => library.keep(group.kind, item)}
                              >
                                {kept ? '已存入' : '存入'}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

import { useState } from 'react'
import Card from '../../components/Card'
import DetailModal from '../../components/DetailModal'
import { cardClickGuard } from './cardClickGuard'

/**
 * 构造器分区之一：人物（每人一张卡 + 本章备注）
 * 清空构造器 / 导入数据时由父组件换 key 重挂载，弹窗状态自然复位。
 */
export default function CharacterSection({ novel, data, items, onNavigate }) {
  const [openId, setOpenId] = useState(null)

  const openItem = items.find((item) => item.id === openId)

  return (
    <>
      <div className="section-head">
        <h3 className="section-head__title">人物卡</h3>
        <span className="section-head__meta">
          {items.length} / {data.characters.length} 位
        </span>
      </div>

      {items.length === 0 && (
        <Card className="card--empty">
          <p className="empty">
            还没有人物卡加入。
            <button type="button" className="btn btn--link" onClick={() => onNavigate('character')}>
              去人物卡页添加
            </button>
          </p>
        </Card>
      )}

      <div className="character-stack">
        {items.map((item) => (
          <Card
            key={item.id}
            title={item.name}
            tag="人物"
            meta={
              (data.inContext.characters || []).includes(item.id)
                ? '已在上下文'
                : data.characterNotes[item.id]?.trim()
                  ? '已写备注'
                  : undefined
            }
            className="card--frame card--clickable"
            onClick={cardClickGuard(() => setOpenId(item.id))}
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
            <label className="ctx-toggle">
              <input
                type="checkbox"
                checked={(data.inContext.characters || []).includes(item.id)}
                onChange={() => novel.toggleInContext('characters', item.id)}
              />
              <span className="ctx-toggle__text">
                已在上下文（提示词不再贴人物背景，只发本章备注，省 token）
              </span>
            </label>
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

      <DetailModal
        open={Boolean(openItem)}
        title={openItem?.name || ''}
        tag="人物"
        sections={[{ label: '人物背景', text: openItem?.detail || '（无描述）' }]}
        onClose={() => setOpenId(null)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => openItem && novel.toggleInBuilder('characters', openItem.id)}
            >
              移出构建器
            </button>
            <button type="button" className="btn btn--sm" onClick={() => setOpenId(null)}>
              关闭
            </button>
          </>
        }
      >
        {openItem && (
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
        )}
      </DetailModal>
    </>
  )
}

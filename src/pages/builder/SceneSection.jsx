import { useState } from 'react'
import DetailModal from '../../components/DetailModal'
import ChipSection from './ChipSection'

/**
 * 构造器分区之一：场景（已加入的场景 + 本章备注）
 * 清空构造器 / 导入数据时由父组件换 key 重挂载，弹窗状态自然复位。
 */
export default function SceneSection({ novel, data, items, onNavigate }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <ChipSection
        title="场景卡"
        meta={`${items.length} / ${data.scenes.length}`}
        label="已加入的场景"
        emptyText="还没有场景卡加入。"
        addPage="scene"
        pageLabel="场景"
        kind="scenes"
        list={items}
        novel={novel}
        data={data}
        onNavigate={onNavigate}
        hint="点击卡片展开查看与编辑"
        extra={
          <>
            <label className="label" htmlFor="scene-note">
              备注
            </label>
            <textarea
              id="scene-note"
              className="input input--area"
              placeholder="这一章的场景基调、时间地点、氛围、转折……"
              value={data.notes.scene}
              onChange={(event) => novel.setNote('scene', event.target.value)}
            />
          </>
        }
      />

      <DetailModal
        open={open}
        title="场景卡"
        tag="本章"
        meta={`${items.length} 个场景`}
        sections={[
          {
            label: '已加入的场景',
            text: items
              .map((item, index) => `${index + 1}. ${item.name}\n${item.detail || '（无描述）'}`)
              .join('\n\n'),
          },
        ]}
        onClose={() => setOpen(false)}
        footer={
          <button type="button" className="btn btn--sm" onClick={() => setOpen(false)}>
            关闭
          </button>
        }
      >
        <div className="detail__section">
          <label className="field__label" htmlFor="scene-note-modal">
            备注
          </label>
          <textarea
            id="scene-note-modal"
            className="input input--area detail__editor"
            placeholder="这一章的场景基调、时间地点、氛围、转折……"
            value={data.notes.scene}
            onChange={(event) => novel.setNote('scene', event.target.value)}
          />
        </div>
      </DetailModal>
    </>
  )
}

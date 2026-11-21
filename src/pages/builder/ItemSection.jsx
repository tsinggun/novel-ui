import ChipSection from './ChipSection'

/** 构造器分区之一：物品（名字 + 描述，会拼进提示词的【物品卡】段） */
export default function ItemSection({ novel, data, items, onNavigate }) {
  return (
    <ChipSection
      title="物品卡"
      meta={`${items.length} / ${data.items.length}`}
      label="已加入的物品"
      emptyText="还没有物品卡加入。"
      addPage="item"
      pageLabel="物品"
      kind="items"
      list={items}
      novel={novel}
      data={data}
      onNavigate={onNavigate}
      hint="物品卡会写进提示词的【物品卡】段落：名字 + 描述，AI 才知道这件东西是什么、能干什么。"
    />
  )
}

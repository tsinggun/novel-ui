import Card from '../../components/Card'

/** 构造器分区之一：前情提要（上一章结尾 / 必要前情） */
export default function RecapSection({ novel, data }) {
  return (
    <Card title="前情提要" meta="可选" className="card--frame">
      <label className="label" htmlFor="previous-recap">
        上一章结尾 / 必要前情
      </label>
      <textarea
        id="previous-recap"
        className="input input--area"
        placeholder="上一章最后发生了什么、谁在什么状态、留下了什么悬念……留空就不发给 AI。"
        value={data.previousRecap || ''}
        onChange={(event) => novel.setPreviousRecap(event.target.value)}
      />
      <span className="card__hint">建议 100–300 字：只写必要前情，太长会挤占正文的上下文</span>
    </Card>
  )
}

import { FS_MAX, FS_MIN, FS_STEP } from '../useFontScale'

/**
 * 全局字号控件：A− / A＋ 按 5% 一档调整，中间显示当前比例，点百分比恢复 100%。
 * 只改文字大小（--fs），全站所有页面共用。
 */
export default function FontScaleControl({ scale, step, reset }) {
  const percent = Math.round(scale * 100)

  return (
    <div className="type-scale" role="group" aria-label="全局字号">
      <span className="label">字号</span>
      <button
        type="button"
        className="type-scale__btn"
        aria-label="缩小全局字号"
        disabled={scale <= FS_MIN}
        onClick={() => step(-FS_STEP)}
      >
        A−
      </button>
      <button
        type="button"
        className={`type-scale__value${percent === 100 ? ' is-default' : ''}`}
        title="恢复到 100%"
        onClick={reset}
      >
        {percent}%
      </button>
      <button
        type="button"
        className="type-scale__btn"
        aria-label="放大全局字号"
        disabled={scale >= FS_MAX}
        onClick={() => step(FS_STEP)}
      >
        A＋
      </button>
    </div>
  )
}

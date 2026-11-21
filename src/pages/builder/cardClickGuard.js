/**
 * 卡片主体可点开弹窗，但输入框和按钮上的点击保持原样。
 * 人物卡、场景卡这类「整张卡可点」的容器共用。
 */
export function cardClickGuard(open) {
  return (event) => {
    if (event.target.closest('button, a, input, textarea, select, label')) return
    open()
  }
}

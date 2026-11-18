/**
 * 卡片检索的条件词工具。
 * 条件词大小写不敏感、去重；多条条件之间是「全都要命中」（AND）。
 */

/** 把一次输入拆成若干条件词：空格、逗号、顿号都算分隔 */
export function splitTerms(raw) {
  return String(raw || '')
    .split(/[\s,，、]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 追加条件词，按小写去重，保留用户输入时的大小写 */
export function appendTerms(prev, raw) {
  const next = [...prev]
  splitTerms(raw).forEach((word) => {
    if (!next.some((item) => item.toLowerCase() === word.toLowerCase())) next.push(word)
  })
  return next
}

/** 若干文本字段里，每个条件词都要至少命中一个字段 */
export function matchEveryTerm(terms, fields) {
  if (terms.length === 0) return true
  const haystack = fields
    .filter((field) => typeof field === 'string' && field)
    .map((field) => field.toLowerCase())
  return terms.every((term) => haystack.some((text) => text.includes(term.toLowerCase())))
}

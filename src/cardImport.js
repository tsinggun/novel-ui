/**
 * 卡片 JSON 导入的公共解析：粘贴导入弹窗和「把文件拖到页面上」都走这里。
 * 认单张对象或对象数组；文件只收 .json/.txt。
 */

/** 一段文本 → 卡片数组（解析失败返回 null） */
export function parseCardJson(raw) {
  let parsed
  try {
    parsed = JSON.parse(String(raw || '').trim())
  } catch {
    return null
  }
  const items = Array.isArray(parsed) ? parsed : [parsed]
  if (items.length === 0) return null
  if (typeof items[0] !== 'object' || items[0] === null) return null
  return items
}

/** 一批 File → { items, problems }，items 已合并好，problems 是跳过的文件名+原因 */
export async function readCardFiles(files) {
  const list = Array.from(files || [])
  const items = []
  const problems = []
  for (const file of list) {
    if (!/\.(json|txt)$/i.test(file.name) && !/json|text/i.test(file.type || '')) {
      problems.push(`${file.name}（不是 JSON 文件）`)
      continue
    }
    let raw
    try {
      raw = await file.text()
    } catch {
      problems.push(`${file.name}（读不出来）`)
      continue
    }
    const parsed = parseCardJson(raw)
    if (!parsed) {
      problems.push(`${file.name}（JSON 格式不对）`)
      continue
    }
    items.push(...parsed)
  }
  return { items, problems }
}

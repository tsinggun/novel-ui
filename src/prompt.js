export const DEFAULT_PROMPT_INTRO = `你是一名擅长结合积木要素来写小说的作家，现在根据排列的提示词来生成小说。

写作方式：请写成连贯的一章正文，按下面的顺序推进，不要逐条罗列或分段复述；不要改变已给出的人设、时间线和场景细节，也不要新增设定；直接输出正文，不要标题、要点、说明、字数统计或总结。`

/**
 * 把构造器里排列好的积木（前情 → 场景 → 人物 → 情节）拼成提示词。
 * 返回 intro（开头提示词）、body（积木部分）、full（可直接复制的全文）。
 */

/** 说明文字压成一行，避免多行把编号体系顶乱 */
const oneLine = (text) => (text || '').trim().replace(/\s*\r?\n\s*/g, ' ')

/** 去掉说明末尾多余标点，拼进句子时不会出现「。；」「。。」这种 */
const stripTail = (text) => oneLine(text).replace(/[。．.；;，,、：:\s]+$/u, '')

export function buildPrompt({
  intro = DEFAULT_PROMPT_INTRO,
  recap = '',
  scenes = [],
  characters = [],
  items = [],
  plots = [],
  characterNotes = {},
  sceneNote = '',
  techniques = [],
  inContext = { characters: [], scenes: [], items: [] },
}) {
  // 已在上下文的卡片：不再重复贴描述，只留名字 + 本章备注，省 token
  const sceneInCtx = new Set(inContext.scenes || [])
  const charInCtx = new Set(inContext.characters || [])
  const itemInCtx = new Set(inContext.items || [])


  // 情节实际用到的技法（去重，保持首次出现顺序）；用于提示词预览里提示「哪些技法还没写用法说明」
  const usedTechniques = []
  plots.forEach((plot) => {
    ;(plot.techniqueIds || []).forEach((techId) => {
      if (!techId) return
      const tech = techniques.find((item) => item.id === techId)
      if (tech && !usedTechniques.some((item) => item.id === tech.id)) usedTechniques.push(tech)
    })
  })

  const lines = []

  if (recap.trim()) {
    lines.push('【前情提要】')
    lines.push(`   ${recap.trim()}`)
    lines.push('')
  }

  if (scenes.length > 0) {
    lines.push('【场景卡】')
    scenes.forEach((scene, index) => {
      if (sceneInCtx.has(scene.id)) {
        lines.push(`${index + 1}. ${scene.name}（场景设定已在上下文，不再重复）`)
      } else {
        lines.push(`${index + 1}. ${scene.name}`)
        if (scene.detail) lines.push(`   场景描述：${oneLine(scene.detail)}`)
      }
    })
    lines.push('')
  }

  // 场景的本章备注是全局的，单独成块，避免被误读成最后一个场景的备注
  if (sceneNote.trim()) {
    lines.push('【本章基调与备注】')
    lines.push(`   ${oneLine(sceneNote)}`)
    lines.push('   （备注优先于上面的场景描述：有冲突时以备注为准。）')
    lines.push('')
  }

  if (characters.length > 0) {
    lines.push('【人物卡】')
    lines.push('   （人物背景与本章备注冲突时，以本章备注为准。）')
    characters.forEach((person, index) => {
      if (charInCtx.has(person.id)) {
        lines.push(`${index + 1}. ${person.name}（人物设定已在上下文，不再重复）`)
        const note = oneLine(characterNotes[person.id])
        if (note) lines.push(`   本章备注：${note}`)
      } else {
        lines.push(`${index + 1}. ${person.name}`)
        if (person.detail) lines.push(`   人物背景：${oneLine(person.detail)}`)
        const note = oneLine(characterNotes[person.id])
        if (note) lines.push(`   本章备注：${note}`)
      }
    })
    lines.push('')
  }

  // 物品卡：名字 + 描述，AI 才知道这件东西能不能用、怎么用
  if (items.length > 0) {
    lines.push('【物品卡】')
    items.forEach((item, index) => {
      if (itemInCtx.has(item.id)) {
        lines.push(`${index + 1}. ${item.name}（这件物品的设定已在上下文，不再重复）`)
      } else {
        lines.push(`${index + 1}. ${item.name}`)
        if (item.detail) lines.push(`   物品描述：${oneLine(item.detail)}`)
      }
    })
    lines.push('')
  }

  // 情节卡：每条情节独立成块 —— 情节文本、字数、用到的技法（名字 + 用法说明）全在同一个块里。
  // 技法说明必须写在这里，AI 才可能照着写；只写技法名等于没写。
  if (plots.length > 0) {
    lines.push('【情节卡】')
    plots.forEach((plot, index) => {
      const techList = (plot.techniqueIds || [])
        .map((id) => techniques.find((item) => item.id === id))
        .filter(Boolean)

      const content = oneLine(plot.content) || '（这条情节卡是空的）'
      lines.push(`${index + 1}. ${content}`)

      if (plot.wordCount > 0) lines.push(`   字数：约 ${plot.wordCount} 字`)

      if (techList.length > 0) {
        const hint = techList.length > 1 ? '（下面这几样要同时用上，不是任选其一）' : ''
        lines.push(`   写作技法${hint}：`)
        techList.forEach((tech) => {
          const note = stripTail(tech.detail)
          lines.push(`     · ${tech.name}${note ? ` —— ${note}` : '（这张技法卡还没填用法说明）'}`)
        })
      }
    })
    lines.push('')
  }

  const body = lines.join('\n').trim()
  const introText = intro.trim()
  const full = `${introText ? `${introText}\n\n` : ''}${body}`.trimEnd() + '\n'

  // 用到了但没写「用法说明」的技法：预览里要提示去补，否则 AI 只看到一个名字
  const missingTechNotes = usedTechniques.filter((tech) => !tech.detail?.trim()).map((tech) => tech.name)

  // 因为「已在上下文」而没发出去的描述字数，预览里显示省了多少
  const savedChars =
    scenes.reduce((sum, scene) => (sceneInCtx.has(scene.id) ? sum + (scene.detail || '').length : sum), 0) +
    characters.reduce(
      (sum, person) => (charInCtx.has(person.id) ? sum + (person.detail || '').length : sum),
      0,
    ) +
    items.reduce((sum, item) => (itemInCtx.has(item.id) ? sum + (item.detail || '').length : sum), 0)
  const inContextCount =
    (inContext.scenes || []).length +
    (inContext.characters || []).length +
    (inContext.items || []).length

  return { intro, body, full, missingTechNotes, savedChars, inContextCount }
}

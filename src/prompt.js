export const DEFAULT_PROMPT_INTRO =
  '你是一名擅长结合积木要素来写小说的作家，现在根据排列的提示词来生成小说。'

/**
 * 把构造器里排列好的积木（前情 → 场景 → 人物 → 情节）拼成提示词。
 * 返回 intro（开头提示词）、body（积木部分）、full（可直接复制的全文）。
 */
export function buildPrompt({
  intro = DEFAULT_PROMPT_INTRO,
  recap = '',
  scenes = [],
  characters = [],
  plots = [],
  characterNotes = {},
  sceneNote = '',
  techniques = [],
}) {
  const totalWords = plots.reduce((sum, plot) => sum + (Number(plot.wordCount) || 0), 0)

  // 情节实际用到的技法（去重，保持首次出现顺序）
  const usedTechniques = []
  plots.forEach((plot) => {
    const techId = (plot.techniqueIds || [])[0]
    if (!techId) return
    const tech = techniques.find((item) => item.id === techId)
    if (tech && !usedTechniques.some((item) => item.id === tech.id)) usedTechniques.push(tech)
  })

  const lengthText = totalWords > 0 ? `约 ${totalWords} 字的一章` : '连贯的一章'

  const lines = [
    `写作方式：请写成${lengthText}正文，按下面的顺序推进，不要逐条罗列或分段复述；不要改变已给出的人设、时间线和场景细节，也不要新增设定；直接输出正文，不要标题、要点、说明、字数统计或总结。`,
    '',
  ]

  if (recap.trim()) {
    lines.push('【前情提要】')
    lines.push(`   ${recap.trim()}`)
    lines.push('')
  }

  if (scenes.length > 0) {
    lines.push('【场景卡】')
    scenes.forEach((scene, index) => {
      lines.push(`${index + 1}. ${scene.name}`)
      if (scene.detail) lines.push(`   场景描述：${scene.detail}`)
    })
    lines.push('')
  }

  // 场景的本章备注是全局的，单独成块，避免被误读成最后一个场景的备注
  if (sceneNote.trim()) {
    lines.push('【本章基调与备注】')
    lines.push(`   ${sceneNote.trim()}`)
    lines.push('')
  }

  if (characters.length > 0) {
    lines.push('【人物卡】')
    characters.forEach((person, index) => {
      lines.push(`${index + 1}. ${person.name}`)
      if (person.detail) lines.push(`   人物背景：${person.detail}`)
      const note = (characterNotes[person.id] || '').trim()
      if (note) lines.push(`   本章备注：${note}`)
    })
    lines.push('')
  }

  // 技法说明集中在前面说一次，情节里只留名字，避免同一条说明反复出现
  if (usedTechniques.length > 0) {
    lines.push('【本章技法】')
    usedTechniques.forEach((tech, index) => {
      lines.push(`${index + 1}. ${tech.name}${tech.detail ? ` —— ${tech.detail}` : ''}`)
    })
    lines.push('')
  }

  if (plots.length > 0) {
    lines.push('【情节卡】')
    plots.forEach((plot, index) => {
      const techId = (plot.techniqueIds || [])[0]
      const tech = techId ? techniques.find((item) => item.id === techId) : null

      lines.push(`${index + 1}. ${plot.content}`)

      // 情节和它的写作要求（字数 + 技法名）放在同一个块里
      const requirements = []
      if (plot.wordCount > 0) requirements.push(`约 ${plot.wordCount} 字`)
      if (tech) requirements.push(`用「${tech.name}」来写`)

      if (requirements.length > 0) {
        lines.push(`   写作要求：${requirements.join('；')}。`)
      }
    })
  }

  const body = lines.join('\n').trimEnd()
  const introText = intro.trim()
  const full = `${introText ? `${introText}\n\n` : ''}${body}`.trimEnd() + '\n'

  return { intro, body, full }
}

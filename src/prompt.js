export const DEFAULT_PROMPT_INTRO =
  '你是一名擅长结合积木要素来写小说的作家，现在根据排列的提示词来生成小说。'

/**
 * 把构造器里排列好的积木（场景 → 人物 → 情节）拼成提示词。
 * 返回 intro（开头提示词）、body（积木部分）、full（可直接复制的全文）。
 */
export function buildPrompt({
  intro = DEFAULT_PROMPT_INTRO,
  scenes = [],
  characters = [],
  plots = [],
  characterNotes = {},
  sceneNote = '',
  techniques = [],
}) {
  const lines = [
    '写作方式：按下面的顺序写成连贯的一章正文，不要逐条罗列或分段复述；人物与场景只用下列内容，不要新增设定。',
    '',
  ]

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
    lines.push('【本章场景备注】')
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

  if (plots.length > 0) {
    const totalWords = plots.reduce((sum, plot) => sum + (Number(plot.wordCount) || 0), 0)

    lines.push('【情节卡】')
    if (totalWords > 0) {
      lines.push(`（全章合计约 ${totalWords} 字，各条字数为参考）`)
    }

    const explainedTechniques = new Set()

    plots.forEach((plot, index) => {
      // 一条情节只带一个技法；历史数据若有多个，取第一个
      const techId = (plot.techniqueIds || [])[0]
      const tech = techId ? techniques.find((item) => item.id === techId) : null

      // 情节内容和它的写作要求（字数 + 技法）放在同一个块里，避免技法被当成附录
      const requirements = []
      if (plot.wordCount > 0) requirements.push(`约 ${plot.wordCount} 字`)
      if (tech) {
        const repeated = explainedTechniques.has(tech.id)
        if (!repeated && tech.detail) {
          requirements.push(`用「${tech.name}」技法来写 —— ${tech.detail}`)
          explainedTechniques.add(tech.id)
        } else {
          requirements.push(`用「${tech.name}」技法来写`)
          if (!repeated) explainedTechniques.add(tech.id)
        }
      }

      lines.push(`${index + 1}. ${plot.content}`)
      if (requirements.length > 0) {
        const requirementText = requirements.join('；')
        lines.push(`   写作要求：${requirementText}${/[。！？]$/.test(requirementText) ? '' : '。'}`)
      }
    })
  }

  const body = lines.join('\n').trimEnd()
  const introText = intro.trim()
  const full = `${introText ? `${introText}\n\n` : ''}${body}`.trimEnd() + '\n'

  return { intro, body, full }
}

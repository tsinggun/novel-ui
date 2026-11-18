export const DEFAULT_PROMPT_INTRO = `你是一名擅长结合积木要素来写小说的作家，现在根据排列的提示词来生成小说。

写作方式：请写成连贯的一章正文，按下面的顺序推进，不要逐条罗列或分段复述；不要改变已给出的人设、时间线和场景细节，也不要新增设定；直接输出正文，不要标题、要点、说明、字数统计或总结。`

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

  // 技法说明直接写进这一条情节里，不再单独成块：
  // 这样「情节 + 用哪个技法 + 这个技法怎么用」永远在同一行，AI 不会只读到技法名。
  if (plots.length > 0) {
    lines.push('【情节卡】')
    plots.forEach((plot, index) => {
      const techList = (plot.techniqueIds || [])
        .map((id) => techniques.find((item) => item.id === id))
        .filter(Boolean)

      lines.push(`${index + 1}. ${plot.content}`)

      // 情节和它的写作要求（字数 + 技法名 + 技法说明）放在同一个块里
      const requirements = []
      if (plot.wordCount > 0) requirements.push(`约 ${plot.wordCount} 字`)

      if (techList.length === 1) {
        const tech = techList[0]
        requirements.push(
          `用「${tech.name}」来写${tech.detail?.trim() ? `（${tech.detail.trim()}）` : ''}`,
        )
      } else if (techList.length > 1) {
        const names = techList.map((tech) => `「${tech.name}」`).join('、')
        const notes = techList
          .filter((tech) => tech.detail?.trim())
          .map((tech) => `「${tech.name}」：${tech.detail.trim()}`)
        requirements.push(`同时用${names}来写${notes.length > 0 ? `（${notes.join('；')}）` : ''}`)
      }

      if (requirements.length > 0) {
        lines.push(`   写作要求：${requirements.join('；')}。`)
      }
    })
  }

  const body = lines.join('\n').trim()
  const introText = intro.trim()
  const full = `${introText ? `${introText}\n\n` : ''}${body}`.trimEnd() + '\n'

  // 用到了但没写「用法说明」的技法：预览里要提示去补，否则 AI 只看到一个名字
  const missingTechNotes = usedTechniques.filter((tech) => !tech.detail?.trim()).map((tech) => tech.name)

  return { intro, body, full, missingTechNotes }
}

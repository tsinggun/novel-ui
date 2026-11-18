/**
 * 便携版客户端（不需要编译）：
 *   node client/server.mjs
 *
 * 做的事：
 *   1. 把 dist/ 当静态站点在本机随机端口起服务；
 *   2. 复刻 Harness 的 /plot-api 接口，把数据落到 <文档>/NovelUI/<作品>/：
 *        GET  /plot-api/state   → project.json
 *        POST /plot-api/state   → 写 project.json（写前自动备份，保留最近 10 份）
 *        POST /plot-api/export  → exports/novel-<时间>.json
 *   3. 用 Edge 的 --app 模式开一个没有地址栏的窗口，等同桌面窗口；
 *   4. 窗口关掉就退出本进程。
 */

import { createServer } from 'node:http'
import { appendFileSync, existsSync } from 'node:fs'
import { appendFile, copyFile, mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '..', 'dist')

const appRoot = path.join(os.homedir(), 'Documents', 'NovelUI')
/** 上次载入的数据文件，记在这里，下次启动直接接着用 */
const lastFileRecord = path.join(appRoot, 'last-file.txt')
/** 默认数据文件（第一次启动时的落点） */
const defaultDataFile = path.join(appRoot, 'default', 'project.json')
/** 启动日志：双击启动（无黑窗）时看不到控制台，出问题就看这个文件 */
const logFile = path.join(appRoot, 'client.log')

/* 控制台输出同时写一份到 client.log，方便排查「双击没反应」 */
const rawLog = console.log.bind(console)
const stamp = () => new Date().toLocaleString('zh-CN', { hour12: false })
console.log = (...args) => {
  const line = args.map((item) => (typeof item === 'string' ? item : String(item))).join(' ')
  rawLog(line)
  // 同步写，保证 process.exit 之前这行一定落到文件里
  try {
    appendFileSync(logFile, `[${stamp()}] ${line}\n`, 'utf8')
  } catch {
    /* 日志写不了就算了，不影响启动 */
  }
}

const BACKUP_KEEP = 10

/**
 * 数据 = 一个 json 文件。「载入数据」选一个 json，里面的卡片装进界面；
 * 在客户端里的所有修改，都写回这个文件（写前自动备份）。
 */
let dataFile = defaultDataFile

/**
 * 存储模式：
 *   'file' —— 单个 json（老模式，兼容 + 导出/交换格式）
 *   'dir'  —— 作品目录（一卡一文件，只写脏文件；见下方 dir 相关函数）
 */
let mode = 'file'
/** 目录模式下的作品根目录 */
let workspaceDir = null

const stateFile = () => dataFile
const dataDir = () => (mode === 'dir' && workspaceDir ? workspaceDir : path.dirname(dataFile))
const backupDir = () => path.join(dataDir(), '_novelui-backups')
const exportDir = () =>
  mode === 'dir' && workspaceDir
    ? path.join(workspaceDir, '_exports')
    : path.join(path.dirname(dataFile), '_novelui-exports')

/** 启动时优先用 NOVEL_FILE，其次上次载入的路径，最后用文档里的默认文件 */
async function restoreLastFile() {
  const applyPath = async (candidate) => {
    const abs = path.resolve(candidate)
    if (!existsSync(abs)) return false
    const st = await stat(abs).catch(() => null)
    if (st && st.isDirectory()) {
      // 目录：有 manifest 就是现成作品；没有就在 ensureInitialDataFile 里建空骨架
      mode = 'dir'
      workspaceDir = abs
      dataFile = abs
      return true
    }
    mode = 'file'
    workspaceDir = null
    dataFile = abs
    return true
  }

  if (process.env.NOVEL_FILE) {
    await applyPath(process.env.NOVEL_FILE)
    return
  }
  try {
    const saved = (await readFile(lastFileRecord, 'utf8')).trim()
    if (saved) await applyPath(saved)
  } catch {
    /* 没有记录就留默认 */
  }
}

/** 空数据文件的初始内容（第一次启动用） */
const emptyData = {
  characters: [],
  scenes: [],
  techniques: [],
  plots: [],
  inBuilder: { characters: [], scenes: [] },
  inContext: { characters: [], scenes: [] },
  notes: { character: '', scene: '' },
  characterNotes: {},
  promptIntro: null,
  plotFontSize: 14,
  previousRecap: '',
}

/** 本次启动是不是刚新建了文件（界面据此提示「第一次使用」） */
let freshCreated = false

/**
 * 第一次打开：没有任何数据文件时（没记录 / 记录的文件被删了 / 默认文件不存在），
 * 直接在文档目录里建一份空 json，让界面立刻可用，而不是留一个「文件不存在」。
 */
async function ensureInitialDataFile() {
  if (mode === 'dir' && workspaceDir) {
    if (existsSync(path.join(workspaceDir, 'manifest.json'))) return
    await openWorkspace(workspaceDir)
    return
  }
  if (existsSync(dataFile)) return
  await mkdir(dataDir(), { recursive: true })
  await writeFile(dataFile, `${JSON.stringify(emptyData, null, 2)}\n`, 'utf8')
  // 用 NOVEL_FILE 指定路径时不写「上次的文件」，免得覆盖用户自己记的那份
  if (!process.env.NOVEL_FILE) {
    await writeFile(lastFileRecord, dataFile, 'utf8').catch(() => {})
  }
  freshCreated = true
  console.log(`  第一次启动：已新建空数据文件 ${dataFile}`)
}

async function readDataFile(file) {
  const text = await readFile(file, 'utf8')
  const parsed = JSON.parse(text)
  const wrapped =
    parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object'
      ? parsed.data
      : parsed
  if (!wrapped || typeof wrapped !== 'object') throw new Error('这个 json 里不是数据对象')
  return wrapped
}

/** 切到一个数据来源：.json 文件走单文件模式，文件夹走目录模式 */
async function setDataFile(target) {
  const trimmed = String(target || '').trim()
  if (!trimmed) throw new Error('路径为空')
  const absolute = path.resolve(trimmed)
  if (!existsSync(absolute)) throw new Error('路径不存在：' + absolute)

  if (!absolute.toLowerCase().endsWith('.json') && (await stat(absolute)).isDirectory()) {
    // 目录模式：有 manifest 就读现成的作品，空目录就当场建一个空作品
    const loaded = await openWorkspace(absolute)
    mode = 'dir'
    workspaceDir = absolute
    dataFile = absolute
    await mkdir(appRoot, { recursive: true }).catch(() => {})
    await writeFile(lastFileRecord, absolute, 'utf8').catch(() => {})
    return { path: absolute, data: loaded.data, mode: 'dir', fresh: loaded.fresh }
  }

  const data = await readDataFile(absolute)
  mode = 'file'
  workspaceDir = null
  dataFile = absolute
  await mkdir(appRoot, { recursive: true }).catch(() => {})
  await writeFile(lastFileRecord, absolute, 'utf8').catch(() => {})
  return { path: absolute, data, mode: 'file', fresh: false }
}

/* ------------------------------------------------------------------
 * 目录式作品存储（一卡一文件）
 *
 *   作品/
 *   ├── manifest.json        索引 + 非卡片类字段（inBuilder / 备注 / 设置…）
 *   ├── characters/<名字>~<id尾6>.json
 *   ├── scenes/ techniques/ plots/
 *   └── .history/<kind>/<文件>.<时间戳>.json   每个文件改前的旧版本
 *
 * 三条铁律：
 *   1. 只写脏文件：没变的卡一个字节都不碰（靠和上一份快照逐条对比得出）
 *   2. 原子写：先写 .tmp 再 rename，不会出现半截文件
 *   3. 改前留旧版：每个文件在 .history 里留最近 20 份
 * ------------------------------------------------------------------ */

const ENTITY_KINDS = ['characters', 'scenes', 'techniques', 'plots']
const MANIFEST_NAME = 'manifest.json'
const HISTORY_DIR = '.history'
const HISTORY_KEEP = 20
/** manifest 里存这些非卡片字段（构造器状态、备注、设置） */
const META_FIELDS = [
  'title',
  'inBuilder',
  'inContext',
  'notes',
  'characterNotes',
  'promptIntro',
  'previousRecap',
  'plotFontSize',
]

const manifestPath = (dir) => path.join(dir, MANIFEST_NAME)

/** 文件名：中文名 + id 尾部，去掉 Windows 非法字符；一旦生成就跟着 id 不变 */
function entityFileName(entity) {
  const clean = String(entity.name || entity.content || '')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  const tail = String(entity.id || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
  return `${clean || 'untitled'}~${tail || 'x'}.json`
}

/** 原子写：临时文件 + rename，崩在中间不会留下半个文件 */
async function writeJsonAtomic(file, value) {
  const dir = path.dirname(file)
  await mkdir(dir, { recursive: true })
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`)
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await rename(temp, file)
}

/** 改前备份到 .history/<kind>/，每个文件只留最近 HISTORY_KEEP 份 */
async function backupEntityFile(dir, kind, name) {
  const src = path.join(dir, kind, name)
  if (!existsSync(src)) return
  const histDir = path.join(dir, HISTORY_DIR, kind)
  await mkdir(histDir, { recursive: true })
  const base = name.replace(/\.json$/i, '')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await copyFile(src, path.join(histDir, `${base}.${stamp}.json`))

  const files = (await readdir(histDir))
    .filter((item) => item.startsWith(`${base}.`) && item.endsWith('.json'))
    .sort()
  while (files.length > HISTORY_KEEP) {
    const oldest = files.shift()
    await unlink(path.join(histDir, oldest)).catch(() => {})
  }
}

const pickMeta = (data) => {
  const meta = {}
  for (const field of META_FIELDS) {
    if (data && data[field] !== undefined) meta[field] = data[field]
  }
  return meta
}

function emptyManifest(title) {
  const now = Date.now()
  return {
    schemaVersion: 2,
    title: title || '未命名作品',
    createdAt: now,
    updatedAt: now,
    files: { characters: {}, scenes: {}, techniques: {}, plots: {} },
    meta: {},
  }
}

/** 读整个作品目录，组装成界面需要的那份数据 */
async function loadWorkspace(dir) {
  const file = manifestPath(dir)
  if (!existsSync(file)) {
    return { manifest: null, data: JSON.parse(JSON.stringify(emptyData)), fresh: false, exists: false }
  }
  const manifest = JSON.parse(await readFile(file, 'utf8'))
  const data = JSON.parse(JSON.stringify(emptyData))
  for (const kind of ENTITY_KINDS) {
    const files = (manifest.files && manifest.files[kind]) || {}
    const list = []
    for (const [id, name] of Object.entries(files)) {
      try {
        const text = await readFile(path.join(dir, kind, name), 'utf8')
        const parsed = JSON.parse(text)
        if (parsed && typeof parsed === 'object') list.push(parsed)
      } catch {
        /* 单个文件坏了不该让整个作品打不开：跳过它，界面上这张卡就是缺的 */
      }
    }
    // 按创建时间还原顺序（文件系统顺序不可靠）
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    data[kind] = list
  }
  Object.assign(data, manifest.meta || {})
  return { manifest, data, fresh: false, exists: true }
}

/** 打开/新建一个作品目录 */
async function openWorkspace(dir, title) {
  const abs = path.resolve(dir)
  const loaded = await loadWorkspace(abs)
  if (loaded.exists) return { data: loaded.data, fresh: false }

  const entries = existsSync(abs) ? await readdir(abs) : []
  if (entries.filter((name) => !name.startsWith('.')).length > 0) {
    throw new Error('这个文件夹里没有 manifest.json，不像一个作品目录')
  }

  const manifest = emptyManifest(title || path.basename(abs))
  await mkdir(abs, { recursive: true })
  for (const kind of ENTITY_KINDS) await mkdir(path.join(abs, kind), { recursive: true })
  await writeJsonAtomic(manifestPath(abs), manifest)
  console.log(`  新建作品目录 ${abs}`)
  return { data: JSON.parse(JSON.stringify(emptyData)), fresh: true }
}

/**
 * 把一份完整数据写回作品目录 —— 只写和上一份快照不一样的卡。
 * 返回本次真正动过的文件列表（界面/日志用）。
 */
async function writeWorkspace(dir, prevData, nextData) {
  const loaded = await loadWorkspace(dir)
  const manifest = JSON.parse(JSON.stringify(loaded.manifest || emptyManifest()))
  manifest.files = manifest.files || {}
  // 先留一份原始 manifest 的快照，用来判断「文件索引有没有变」
  const beforeSnapshot = JSON.stringify({ ...manifest, updatedAt: 0 })
  const changed = []

  for (const kind of ENTITY_KINDS) {
    manifest.files[kind] = manifest.files[kind] || {}
    const files = manifest.files[kind]
    const before = new Map(((prevData && prevData[kind]) || []).map((item) => [item.id, item]))
    const after = Array.isArray(nextData[kind]) ? nextData[kind] : []
    const afterIds = new Set(after.map((item) => item.id))

    for (const entity of after) {
      const nextJson = JSON.stringify(entity)
      const prevJson = before.has(entity.id) ? JSON.stringify(before.get(entity.id)) : null
      const name = files[entity.id]
      const onDisk = name ? existsSync(path.join(dir, kind, name)) : false
      if (prevJson === nextJson && onDisk) continue // 没变，一个字节都不碰

      const fileName = name || entityFileName(entity)
      await backupEntityFile(dir, kind, fileName)
      await writeJsonAtomic(path.join(dir, kind, fileName), entity)
      files[entity.id] = fileName
      changed.push(`${kind}/${fileName}`)
    }

    for (const [id, name] of Object.entries(files)) {
      if (afterIds.has(id)) continue
      await backupEntityFile(dir, kind, name)
      await rm(path.join(dir, kind, name), { force: true })
      delete files[id]
      changed.push(`${kind}/${name}（删除）`)
    }
  }

  const nextManifest = {
    ...manifest,
    meta: pickMeta(nextData),
    updatedAt: Date.now(),
  }
  const afterSnapshot = JSON.stringify({ ...nextManifest, updatedAt: 0 })
  if (beforeSnapshot !== afterSnapshot) {
    await writeJsonAtomic(manifestPath(dir), nextManifest)
    changed.push(MANIFEST_NAME)
  }
  return changed
}

/** 迁移校验用：把数据归一成可比较的结构（补齐默认值、卡片按 id 排序、忽略时间戳与标题） */
function normalizeForCompare(data) {
  const out = {}
  for (const kind of ENTITY_KINDS) {
    out[kind] = (data[kind] || [])
      .slice()
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .map((item) => JSON.parse(JSON.stringify(item)))
  }
  const meta = pickMeta({ ...emptyData, ...data })
  delete meta.title
  out.meta = meta
  return JSON.stringify(out, Object.keys(out).length ? undefined : undefined)
}

/** 找出两份数据第一处不同，报错时能说人话 */
function describeMismatch(source, reloaded) {
  for (const kind of ENTITY_KINDS) {
    const a = (source[kind] || []).length
    const b = (reloaded[kind] || []).length
    if (a !== b) return `${kind} 数量不一致：源 ${a} / 目录 ${b}`
    const ids = new Set((source[kind] || []).map((item) => item.id))
    for (const item of source[kind] || []) {
      const other = (reloaded[kind] || []).find((candidate) => candidate.id === item.id)
      if (!other) return `${kind} 缺少卡片 ${item.id}`
      if (JSON.stringify(item) !== JSON.stringify(other)) {
        return `${kind} 卡片 ${item.id}（${item.name || ''}）内容不一致`
      }
    }
    if (ids.size !== a) return `${kind} 里存在重复 id`
  }
  const metaA = JSON.stringify(pickMeta({ ...emptyData, ...source }))
  const metaB = JSON.stringify(pickMeta({ ...emptyData, ...reloaded }))
  if (metaA !== metaB) {
    const keys = META_FIELDS.filter(
      (field) =>
        JSON.stringify((source[field] ?? emptyData[field])) !==
        JSON.stringify((reloaded[field] ?? emptyData[field])),
    )
    return `元信息不一致：${keys.join('、')}`
  }
  return '未能定位差异'
}

/** 把一个 json 拆成作品目录；校验不一致就整目录回滚 */
async function migrateJsonToWorkspace(jsonPath, targetDir) {
  const source = path.resolve(jsonPath)
  if (!existsSync(source)) throw new Error('源文件不存在：' + source)
  const target = path.resolve(targetDir)
  if (existsSync(target)) {
    const entries = await readdir(target)
    if (entries.length > 0) throw new Error('目标文件夹不是空的，请换一个新文件夹：' + target)
  }

  const sourceData = await readDataFile(source)
  await mkdir(target, { recursive: true })
  for (const kind of ENTITY_KINDS) await mkdir(path.join(target, kind), { recursive: true })
  const manifest = emptyManifest(path.basename(source, '.json'))
  manifest.meta = pickMeta(sourceData)
  await writeJsonAtomic(manifestPath(target), manifest)
  await writeWorkspace(target, null, sourceData)

  const reloaded = await loadWorkspace(target)
  if (normalizeForCompare(sourceData) !== normalizeForCompare(reloaded.data)) {
    const reason = describeMismatch(sourceData, reloaded.data)
    await rm(target, { recursive: true, force: true })
    throw new Error(`迁移后数据对不上（${reason}），已删除目标文件夹回滚`)
  }

  const counts = {}
  for (const kind of ENTITY_KINDS) counts[kind] = (reloaded.data[kind] || []).length
  return { dir: target, counts }
}

/* 素材库：本机独立的一份卡片池，跨项目复用（不在任何项目文件夹里） */
const libraryDir = path.join(appRoot, '_library')
const libraryFile = path.join(libraryDir, 'library.json')
const libraryBackupDir = path.join(libraryDir, 'backups')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const json = (res, status, payload) => {
  const body = JSON.stringify(payload ?? null)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      // 单次写入上限 64MB，正常数据几百 KB
      if (size > 64 * 1024 * 1024) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

async function rotateBackup() {
  const file = stateFile()
  try {
    await stat(file)
  } catch {
    return
  }
  const dir = backupDir()
  await mkdir(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const base = path.basename(file, '.json')
  await copyFile(file, path.join(dir, `${base}-${stamp}.json`))

  const files = (await readdir(dir))
    .filter((name) => name.startsWith(`${base}-`) && name.endsWith('.json'))
    .sort()
  while (files.length > BACKUP_KEEP) {
    const oldest = files.shift()
    await unlink(path.join(dir, oldest)).catch(() => {})
  }
}

async function handleState(req, res) {
  if (req.method === 'GET') {
    try {
      if (mode === 'dir' && workspaceDir) {
        const loaded = await loadWorkspace(workspaceDir)
        const stamp = loaded.manifest ? loaded.manifest.updatedAt : 0
        json(res, 200, {
          data: loaded.data,
          path: workspaceDir,
          dir: workspaceDir,
          mode: 'dir',
          title: loaded.manifest ? loaded.manifest.title : path.basename(workspaceDir),
          updatedAt: stamp ? Math.round(stamp / 1000) : Math.round(Date.now() / 1000),
        })
        return
      }
      const file = stateFile()
      await mkdir(dataDir(), { recursive: true })
      const text = await readFile(file, 'utf8')
      const data = JSON.parse(text)
      const meta = await stat(file)
      json(res, 200, {
        data,
        path: file,
        dir: dataDir(),
        mode: 'file',
        updatedAt: Math.round(meta.mtimeMs / 1000),
      })
    } catch {
      json(res, 404, { path: mode === 'dir' ? workspaceDir : stateFile(), dir: dataDir(), mode })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req))
      if (!body || typeof body.data !== 'object' || body.data === null) {
        json(res, 400, { error: '缺少 data' })
        return
      }

      if (mode === 'dir' && workspaceDir) {
        // 目录模式：和上一份快照逐条比，只写脏了的卡
        const prev = (await loadWorkspace(workspaceDir)).data
        const changed = await writeWorkspace(workspaceDir, prev, body.data)
        json(res, 200, {
          ok: true,
          path: workspaceDir,
          dir: workspaceDir,
          mode: 'dir',
          changed,
        })
        return
      }

      await mkdir(dataDir(), { recursive: true })
      await rotateBackup()
      const file = stateFile()
      const temp = path.join(dataDir(), `.${path.basename(file)}.tmp`)
      await writeFile(temp, JSON.stringify(body.data, null, 2), 'utf8')
      await rename(temp, file)
      json(res, 200, { ok: true, path: file, dir: dataDir(), mode: 'file', changed: [path.basename(file)] })
    } catch (error) {
      json(res, 500, { error: String(error && error.message ? error.message : error) })
    }
    return
  }

  json(res, 405, { error: '不支持的请求方法' })
}

/** 让用户在系统文件选择框里挑一个 json */
function pickFileByDialog() {
  return pickByDialog('file')
}

/** 让用户在系统选择框里挑一个作品文件夹 */
function pickFolderByDialog() {
  return pickByDialog('folder')
}

function pickByDialog(kind) {
  // PowerShell 5.1 的 stdout 会被控制台代码页（GBK/437）改写，中文路径经管道传回来会变乱码。
  // 所以让 PowerShell 把结果直接以 UTF-8 写进临时文件，Node 再读文件，避免编码损失。
  const resultFile = path.join(os.tmpdir(), `novelui-pick-${process.pid}-${Date.now()}.txt`)
  // PowerShell 单引号字符串不转义反斜杠，用正斜杠更稳（Windows 一样能打开）
  const psResultFile = resultFile.replace(/'/g, "''").replace(/\\/g, '/')

  // 一个置顶的隐形父窗口做 owner，否则对话框会跑到应用窗口后面去
  const ownerBlock = `
Add-Type -AssemblyName System.Windows.Forms | Out-Null
Add-Type -AssemblyName System.Drawing | Out-Null
$owner = New-Object System.Windows.Forms.Form
$owner.Text = '载入数据'
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.FormBorderStyle = 'None'
$owner.StartPosition = 'CenterScreen'
$owner.Width = 1
$owner.Height = 1
$owner.Opacity = 0
$owner.Show()
$owner.Activate()
`.trim()

  // 作品目录：自己画一个小窗，路径可以直接粘贴（和「浏览文件」一样能敲路径，而且不会有旧式树状框）
  const pathDialogScript = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms | Out-Null
Add-Type -AssemblyName System.Drawing | Out-Null

$form = New-Object System.Windows.Forms.Form
$form.Text = '选择作品文件夹'
$form.TopMost = $true
$form.FormBorderStyle = 'FixedDialog'
$form.StartPosition = 'CenterScreen'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.ClientSize = New-Object System.Drawing.Size(620, 132)

$label = New-Object System.Windows.Forms.Label
$label.Text = '文件夹路径（可直接粘贴，或用「浏览…」挑）'
$label.SetBounds(14, 14, 580, 20)
$box = New-Object System.Windows.Forms.TextBox
$box.SetBounds(14, 40, 496, 26)
$browse = New-Object System.Windows.Forms.Button
$browse.Text = '浏览…'
$browse.SetBounds(518, 39, 88, 28)
$browse.Add_Click({
  $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
  if ($box.Text.Trim()) { $dlg.SelectedPath = $box.Text.Trim().Trim('"') }
  if ($dlg.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) { $box.Text = $dlg.SelectedPath }
}.GetNewClosure())
$ok = New-Object System.Windows.Forms.Button
$ok.Text = '确定'
$ok.SetBounds(420, 88, 88, 30)
$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = '取消'
$cancel.SetBounds(518, 88, 88, 30)
$cancel.Add_Click({ $form.Close() }.GetNewClosure())
$ok.Add_Click({
  $text = $box.Text.Trim().Trim('"')
  if (-not $text) { [System.Windows.Forms.MessageBox]::Show($form, '请先填一个文件夹路径。', '提示') | Out-Null; return }
  try {
    if (-not [IO.Path]::IsPathRooted($text)) { $text = [IO.Path]::GetFullPath($text) }
  } catch {}
  $form.Tag = $text
  $form.Close()
}.GetNewClosure())

$form.Controls.AddRange(@($label, $box, $browse, $ok, $cancel))
$form.AcceptButton = $ok
$form.CancelButton = $cancel
$form.Add_Shown({ $form.Activate(); $box.Focus() })

$value = ''
if ($form.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $value = [string]$form.Tag }
[IO.File]::WriteAllText('${psResultFile}', $value, (New-Object System.Text.UTF8Encoding($false)))
`.trim()

  const fileScript = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
${ownerBlock}

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '载入数据文件（json）'
$dialog.Filter = 'JSON 数据 (*.json)|*.json|所有文件 (*.*)|*.*'
$dialog.CheckFileExists = $true
$value = ''
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $value = $dialog.FileName }
[IO.File]::WriteAllText('${psResultFile}', $value, (New-Object System.Text.UTF8Encoding($false)))
$owner.Close()
`.trim()

  const ps51 = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe'

  // 目录选择改成界面里填路径（见 DataBar 的输入框），不再走系统弹窗：
  // 系统文件夹框容易被主窗口挡住、又没有路径输入，会把应用卡在等一个看不见的窗口上。
  if (kind === 'folder') return Promise.resolve(null)

  // 跑一次选择框；返回 { ok, value }，ok 表示脚本真的跑完了（用来区分「用户取消」和「解释器起不来」）
  const run = (exe, script) =>
    new Promise((resolve) => {
      let settled = false
      const done = (result) => {
        if (settled) return
        settled = true
        resolve(result)
      }
      const child = spawn(exe, ['-NoProfile', '-STA', '-Command', script], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      child.on('error', () => done({ ok: false, value: null }))
      child.on('close', async () => {
        try {
          const picked = (await readFile(resultFile, 'utf8')).replace(/^\uFEFF/, '').trim()
          await unlink(resultFile).catch(() => {})
          done({ ok: true, value: picked || null })
        } catch {
          await unlink(resultFile).catch(() => {})
          done({ ok: false, value: null })
        }
      })
    })

  return run(ps51, pathDialogScript).then((result) => result.value)
}

/** 载入数据：GET 看当前来源，POST 换一个 json 或作品文件夹并返回里面的数据 */
async function handleDataFile(req, res) {
  if (req.method === 'GET') {
    json(res, 200, { path: dataFile, mode })
    return
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: '不支持的请求方法' })
    return
  }

  try {
    const body = JSON.parse((await readBody(req)) || '{}')

    // 没有给 path：json 走系统选择框；作品目录必须在界面里填路径（不再弹系统文件夹框）
    let target = body.path
    if (!target) {
      if (body.kind === 'dir') {
        json(res, 200, { ok: false, cancelled: true, needPath: true, path: dataFile, mode })
        return
      }
      target = await pickFileByDialog()
    }
    // 新建项目：目录不存在就建（连带父目录）
    if (body.create === true && !existsSync(path.resolve(target))) {
      await mkdir(path.resolve(target), { recursive: true })
    }
    if (!target) {
      json(res, 200, { ok: false, cancelled: true, path: dataFile, mode })
      return
    }

    const applied = await setDataFile(target)
    json(res, 200, {
      ok: true,
      cancelled: false,
      path: applied.path,
      mode: applied.mode,
      fresh: applied.fresh === true,
      data: applied.data,
    })
  } catch (error) {
    json(res, 200, { ok: false, error: String(error && error.message ? error.message : error) })
  }
}

/**
 * 作品目录专用接口：
 *   POST { action:'open', path? }                    → 打开/新建作品目录
 *   POST { action:'migrate', jsonPath, targetDir? }  → 把 json 拆成作品目录
 *   POST { action:'info' }                           → 当前存储模式与作品信息
 */
async function handleWorkspace(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: '不支持的请求方法' })
    return
  }
  try {
    const body = JSON.parse((await readBody(req)) || '{}')
    const action = body.action || 'open'

    if (action === 'info') {
      const title =
        mode === 'dir' && workspaceDir
          ? ((await loadWorkspace(workspaceDir)).manifest || {}).title || path.basename(workspaceDir)
          : path.basename(dataFile)
      json(res, 200, { ok: true, mode, path: dataFile, title })
      return
    }

    if (action === 'migrate') {
      const jsonPath = body.jsonPath || (mode === 'file' ? dataFile : null)
      if (!jsonPath) throw new Error('没有可迁移的 json')
      // 没指定目标目录就用「同目录下与 json 同名的文件夹」
      const targetDir = body.targetDir || jsonPath.replace(/\.json$/i, '')
      const result = await migrateJsonToWorkspace(jsonPath, targetDir)

      // attach=true：迁完直接切过去（界面不用刷新就能继续用）
      if (body.attach === true) {
        const opened = await openWorkspace(result.dir)
        mode = 'dir'
        workspaceDir = result.dir
        dataFile = result.dir
        await mkdir(appRoot, { recursive: true }).catch(() => {})
        await writeFile(lastFileRecord, result.dir, 'utf8').catch(() => {})
        json(res, 200, { ok: true, ...result, source: jsonPath, mode: 'dir', attached: true, data: opened.data })
        return
      }

      attachedMigrateHint()
      json(res, 200, { ok: true, ...result, source: jsonPath, attached: false })
      return
    }

    // action=open
    const target = body.path || (await pickFolderByDialog())
    if (!target) {
      json(res, 200, { ok: false, cancelled: true, mode, path: dataFile })
      return
    }
    const opened = await openWorkspace(target)
    mode = 'dir'
    workspaceDir = path.resolve(target)
    dataFile = workspaceDir
    await mkdir(appRoot, { recursive: true }).catch(() => {})
    await writeFile(lastFileRecord, dataFile, 'utf8').catch(() => {})
    json(res, 200, { ok: true, cancelled: false, mode: 'dir', path: dataFile, fresh: opened.fresh, data: opened.data })
  } catch (error) {
    json(res, 200, { ok: false, error: String(error && error.message ? error.message : error) })
  }
}

/** 迁移完不自动切换，只留一条提示（用户可能还想继续用原来的 json） */
function attachedMigrateHint() {
  console.log('  作品目录已生成；要切过去可以在界面里「打开作品目录」选择它')
}

async function handleExport(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: '不支持的请求方法' })
    return
  }
  try {
    const body = JSON.parse(await readBody(req))
    const dir = exportDir()
    await mkdir(dir, { recursive: true })
    const file = path.join(dir, `novel-${Date.now()}.json`)
    await writeFile(file, JSON.stringify(body && body.payload ? body.payload : {}, null, 2), 'utf8')
    json(res, 200, { path: file })
  } catch (error) {
    json(res, 500, { error: String(error && error.message ? error.message : error) })
  }
}

async function handleLibrary(req, res) {
  await mkdir(libraryDir, { recursive: true })

  if (req.method === 'GET') {
    try {
      const data = JSON.parse(await readFile(libraryFile, 'utf8'))
      const meta = await stat(libraryFile)
      json(res, 200, {
        data,
        path: libraryFile,
        updatedAt: Math.round(meta.mtimeMs / 1000),
      })
    } catch {
      json(res, 404, { path: libraryFile })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req))
      if (!body || typeof body.data !== 'object' || body.data === null) {
        json(res, 400, { error: '缺少 data' })
        return
      }
      const next = {
        characters: Array.isArray(body.data.characters) ? body.data.characters : [],
        scenes: Array.isArray(body.data.scenes) ? body.data.scenes : [],
        techniques: Array.isArray(body.data.techniques) ? body.data.techniques : [],
      }

      // 写前备份，保留最近 BACKUP_KEEP 份
      await mkdir(libraryBackupDir, { recursive: true })
      await copyFile(libraryFile, path.join(libraryBackupDir, `library-${Date.now()}.json`)).catch(
        () => {},
      )
      await writeFile(libraryFile, JSON.stringify(next, null, 2), 'utf8')
      const files = (await readdir(libraryBackupDir))
        .filter((name) => name.startsWith('library-') && name.endsWith('.json'))
        .sort()
      while (files.length > BACKUP_KEEP) {
        const oldest = files.shift()
        await unlink(path.join(libraryBackupDir, oldest)).catch(() => {})
      }

      json(res, 200, { ok: true, path: libraryFile })
    } catch (error) {
      json(res, 500, { error: String(error && error.message ? error.message : error) })
    }
    return
  }

  json(res, 405, { error: '不支持的请求方法' })
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/') pathname = '/index.html'
  const target = path.join(distDir, pathname)
  if (!target.startsWith(distDir)) {
    res.writeHead(403).end('forbidden')
    return
  }
  try {
    const text = await readFile(target)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000' : 'no-cache',
    })
    res.end(text)
  } catch {
    // SPA 回退
    try {
      const html = await readFile(path.join(distDir, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(html)
    } catch {
      res.writeHead(404).end('未找到 dist/index.html，先跑 npm run client:build')
    }
  }
}

if (!existsSync(path.join(distDir, 'index.html'))) {
  console.error('缺少 dist/index.html，请先执行：npm run client:build')
  process.exit(1)
}

// 接着上次载入的数据文件；没有记录就用文档里的默认文件；都没有就新建一份空的
await restoreLastFile()
await ensureInitialDataFile()

const server = createServer(async (req, res) => {
  lastActiveAt = Date.now()
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (url.pathname === '/plot-api/state') return handleState(req, res)
  if (url.pathname === '/plot-api/export') return handleExport(req, res)
  if (url.pathname === '/plot-api/library') return handleLibrary(req, res)
  if (url.pathname === '/plot-api/data-file') return handleDataFile(req, res)
  if (url.pathname === '/plot-api/workspace') return handleWorkspace(req, res)
  if (url.pathname === '/plot-api/info') {
    return json(res, 200, {
      file: mode === 'dir' && workspaceDir ? path.basename(workspaceDir) : path.basename(dataFile),
      path: dataFile,
      dir: dataDir(),
      mode,
      library: libraryFile,
      platform: 'portable',
      /** true = 这次启动刚新建了空数据（第一次使用） */
      fresh: freshCreated,
    })
  }
  return serveStatic(req, res, url)
})

// 窗口关掉后拿不到任何通知，就靠空闲超时退出，避免留个后台进程
let lastActiveAt = Date.now()
const IDLE_LIMIT = 30 * 60 * 1000
setInterval(() => {
  if (Date.now() - lastActiveAt > IDLE_LIMIT) {
    console.log('  30 分钟没有访问，客户端自动退出。')
    server.close()
    process.exit(0)
  }
}, 60 * 1000).unref()

// 浏览器候选：Chrome 的 --app 最稳（一定开新窗口），其次 Edge，都没有就交给系统默认浏览器
const BROWSER_CANDIDATES = [
  path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
  path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
]

// 固定端口，这样窗口刷新/重开都还是同一个地址；被占用时退回随机端口
const PREFERRED_PORT = Number(process.env.NOVEL_PORT || 23871)

/** 已经有一个本程序的服务在这个端口上跑？ */
async function hasRunningInstance() {
  try {
    const res = await fetch(`http://127.0.0.1:${PREFERRED_PORT}/plot-api/info`, {
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return false
    const json = await res.json()
    return Boolean(json && json.platform === 'portable')
  } catch {
    return false
  }
}

/** 桌面上是否已经开着「小说构建器」窗口 */
function hasAppWindow() {
  const script = `
$count = (Get-Process chrome,msedge -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle -eq '小说构建器' } |
  Measure-Object).Count
Write-Output $count
`.trim()

  return new Promise((resolve) => {
    const powershell = process.env.SystemRoot
      ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell.exe'
    const child = spawn(powershell, ['-NoProfile', '-Command', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    child.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8')
    })
    child.on('error', () => resolve(false))
    child.on('close', () => resolve(Number(out.trim()) > 0))
  })
}

/** 把已经开着的窗口提到前面（双击启动器时给个反馈，不然像是「没反应」） */
function focusAppWindow() {
  const script = `
$win = Get-Process chrome,msedge -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowTitle -eq '小说构建器' } |
  Select-Object -First 1
if ($win) {
  $shell = New-Object -ComObject WScript.Shell
  [void]$shell.AppActivate($win.Id)
  Write-Output 'ok'
} else {
  Write-Output 'none'
}
`.trim()

  return new Promise((resolve) => {
    const powershell = process.env.SystemRoot
      ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell.exe'
    const child = spawn(powershell, ['-NoProfile', '-Command', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let out = ''
    child.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8')
    })
    child.on('error', () => resolve(false))
    child.on('close', () => resolve(out.trim().includes('ok')))
  })
}

/** 用浏览器 --app 开一个没有地址栏的窗口（Chrome → Edge 逐个试，失败才用默认浏览器） */
async function openAppWindow(targetUrl) {
  const candidates = BROWSER_CANDIDATES.filter((item) => item && existsSync(item))
  if (candidates.length === 0) {
    console.log('  没找到 Chrome / Edge，用系统默认浏览器打开')
    spawn('cmd', ['/c', 'start', '', targetUrl], { detached: true, stdio: 'ignore' }).unref()
    return
  }

  const profileDir = path.join(appRoot, '.window-profile')
  await mkdir(profileDir, { recursive: true })
  // 上次异常退出可能留下单实例锁，不清掉会静默不开窗
  for (const lock of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    await rm(path.join(profileDir, lock), { force: true, recursive: true }).catch(() => {})
  }

  const launch = (browser) => {
    console.log(`  正在用 ${path.basename(browser)} 打开窗口…`)
    return spawn(
      browser,
      [
        `--app=${targetUrl}`,
        '--new-window',
        '--window-size=1360,900',
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=msEdgeSidebarV2,msEdgeTabPreloading',
        // 关掉后台自更新/同步，避免弹「无法更新」这类窗口
        '--disable-component-update',
        '--disable-background-networking',
        '--disable-sync',
        '--no-service-autorun',
        '--no-experimental-drop-shadow',
      ],
      { stdio: 'ignore', detached: true },
    )
  }

  for (const browser of candidates) {
    const child = launch(browser)
    const failed = await new Promise((resolve) => {
      // 只认 spawn 事件，超时算失败：进程没起来就换下一个浏览器
      const timer = setTimeout(() => resolve(new Error('启动超时')), 5000)
      child.once('error', (error) => {
        clearTimeout(timer)
        resolve(error)
      })
      child.once('spawn', () => {
        clearTimeout(timer)
        // 启动器会把窗口交接给已运行的主进程后自己退出，所以不跟它一起退
        child.once('exit', (code) => {
          console.log(`  窗口已交给 ${path.basename(browser)} 主进程（启动器退出码 ${code ?? 0}），服务继续运行。`)
        })
        resolve(null)
      })
    })

    if (!failed) {
      // 给浏览器一点时间真正把窗口画出来，调用方随后才退出
      await new Promise((resolve) => setTimeout(resolve, 1500))
      return
    }
    console.log(`  ${path.basename(browser)} 启动失败：${failed.message}，换下一个`)
  }

  console.log('  浏览器都启动失败，改用系统默认浏览器')
  spawn('cmd', ['/c', 'start', '', targetUrl], { detached: true, stdio: 'ignore' }).unref()
}

/* 单实例：已经有一份在跑就不要再起服务、更不要再开第二个窗口 */
const running = await hasRunningInstance()
if (running && !process.argv.includes('--no-window')) {
  const alreadyOpen = await hasAppWindow()
  if (alreadyOpen) {
    console.log('  已经有一个「小说构建器」窗口开着，把它提到前面。')
    await focusAppWindow()
    console.log(`  地址：http://127.0.0.1:${PREFERRED_PORT}/`)
    process.exit(0)
  }
  console.log('  检测到后台服务已在运行，直接把窗口接上去。')
  await openAppWindow(`http://127.0.0.1:${PREFERRED_PORT}/`)
  process.exit(0)
}
if (running) {
  console.log(`  已有实例在 ${PREFERRED_PORT} 端口运行，本次不再启动。`)
  process.exit(0)
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`  端口 ${PREFERRED_PORT} 被占用，改用随机端口`)
    server.listen(0, '127.0.0.1', onListening)
  } else {
    throw error
  }
})

server.listen(PREFERRED_PORT, '127.0.0.1', onListening)

async function onListening() {
  const port = server.address().port
  const targetUrl = `http://127.0.0.1:${port}/`
  console.log(`小说构建器 · 便携版`)
  console.log(`  数据文件：${dataFile}`)
  console.log(`  本地地址：${targetUrl}`)

  if (process.argv.includes('--no-window')) return

  await openAppWindow(targetUrl)
}

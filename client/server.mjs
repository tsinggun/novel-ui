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
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises'
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

const BACKUP_KEEP = 10

/**
 * 数据 = 一个 json 文件。「载入数据」选一个 json，里面的卡片装进界面；
 * 在客户端里的所有修改，都写回这个文件（写前自动备份）。
 */
let dataFile = defaultDataFile

const stateFile = () => dataFile
const dataDir = () => path.dirname(dataFile)
const backupDir = () => path.join(dataDir(), '_novelui-backups')
const exportDir = () => path.join(dataDir(), '_novelui-exports')

/** 启动时优先用 NOVEL_FILE，其次上次载入的文件，最后用文档里的默认文件 */
async function restoreLastFile() {
  if (process.env.NOVEL_FILE) {
    dataFile = path.resolve(process.env.NOVEL_FILE)
    return
  }
  try {
    const saved = (await readFile(lastFileRecord, 'utf8')).trim()
    if (saved && existsSync(saved)) dataFile = saved
  } catch {
    /* 没有记录就留默认 */
  }
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

/** 切到一个数据文件：校验能解析，然后记住它 */
async function setDataFile(target) {
  const trimmed = String(target || '').trim()
  if (!trimmed) throw new Error('路径为空')
  const absolute = path.resolve(trimmed)
  if (!existsSync(absolute)) throw new Error('文件不存在：' + absolute)
  if (!absolute.toLowerCase().endsWith('.json')) throw new Error('请选择 .json 文件')
  const data = await readDataFile(absolute)
  dataFile = absolute
  await mkdir(appRoot, { recursive: true }).catch(() => {})
  await writeFile(lastFileRecord, absolute, 'utf8').catch(() => {})
  return { path: absolute, data }
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
  await mkdir(dataDir(), { recursive: true })

  if (req.method === 'GET') {
    try {
      const file = stateFile()
      const text = await readFile(file, 'utf8')
      const data = JSON.parse(text)
      const meta = await stat(file)
      json(res, 200, { data, path: file, dir: dataDir(), updatedAt: Math.round(meta.mtimeMs / 1000) })
    } catch {
      json(res, 404, { path: stateFile(), dir: dataDir() })
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
      await rotateBackup()
      const file = stateFile()
      const temp = path.join(dataDir(), `.${path.basename(file)}.tmp`)
      await writeFile(temp, JSON.stringify(body.data, null, 2), 'utf8')
      await rename(temp, file)
      json(res, 200, { ok: true, path: file, dir: dataDir() })
    } catch (error) {
      json(res, 500, { error: String(error && error.message ? error.message : error) })
    }
    return
  }

  json(res, 405, { error: '不支持的请求方法' })
}

/** 让用户在系统文件选择框里挑一个 json（Windows 上用 PowerShell 弹，父窗口置顶避免被挡住） */
function pickFileByDialog() {
  const script = `
Add-Type -AssemblyName System.Windows.Forms | Out-Null
Add-Type -AssemblyName System.Drawing | Out-Null
# 用一个置顶的隐形父窗口做 owner，否则对话框会跑到应用窗口后面去
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

$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = '载入数据文件（json）'
$dialog.Filter = 'JSON 数据 (*.json)|*.json|所有文件 (*.*)|*.*'
$dialog.CheckFileExists = $true

if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $dialog.FileName
}
$owner.Close()
`.trim()

  return new Promise((resolve) => {
    const powershell = process.env.SystemRoot
      ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      : 'powershell.exe'
    const child = spawn(powershell, ['-NoProfile', '-STA', '-Command', script], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let out = ''
    child.stdout.on('data', (chunk) => {
      out += chunk.toString('utf8')
    })
    child.on('error', () => resolve(null))
    child.on('close', () => {
      const lines = out
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      resolve(lines.length ? lines[lines.length - 1] : null)
    })
  })
}

/** 载入数据：GET 看当前文件，POST 换一个 json 文件并返回里面的数据 */
async function handleDataFile(req, res) {
  if (req.method === 'GET') {
    json(res, 200, { path: dataFile })
    return
  }

  if (req.method !== 'POST') {
    json(res, 405, { error: '不支持的请求方法' })
    return
  }

  try {
    const body = JSON.parse((await readBody(req)) || '{}')

    // 没有给 path：弹系统文件选择框让用户挑
    const target = body.path || (await pickFileByDialog())
    if (!target) {
      json(res, 200, { ok: false, cancelled: true, path: dataFile })
      return
    }

    const applied = await setDataFile(target)
    json(res, 200, { ok: true, cancelled: false, path: applied.path, data: applied.data })
  } catch (error) {
    json(res, 200, { ok: false, error: String(error && error.message ? error.message : error) })
  }
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

// 接着上次载入的数据文件；没有记录就用文档里的默认文件
await restoreLastFile()

const server = createServer(async (req, res) => {
  lastActiveAt = Date.now()
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (url.pathname === '/plot-api/state') return handleState(req, res)
  if (url.pathname === '/plot-api/export') return handleExport(req, res)
  if (url.pathname === '/plot-api/library') return handleLibrary(req, res)
  if (url.pathname === '/plot-api/data-file') return handleDataFile(req, res)
  if (url.pathname === '/plot-api/info') {
    return json(res, 200, {
      file: path.basename(dataFile),
      path: dataFile,
      dir: dataDir(),
      library: libraryFile,
      platform: 'portable',
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

/** 用浏览器 --app 开一个没有地址栏的窗口 */
async function openAppWindow(targetUrl) {
  const browser = BROWSER_CANDIDATES.find((item) => item && existsSync(item))
  if (!browser) {
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

  const child = spawn(
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
    { stdio: 'ignore', detached: false },
  )

  // 启动器把窗口交给已运行的主进程后自己就退出了，所以不能跟着它退出，
  // 否则服务一关窗口立刻变成「无法访问此网站」。
  child.on('exit', (code) => {
    console.log(`  已打开窗口（启动器退出码 ${code ?? 0}），服务继续运行。`)
  })
  child.on('error', (error) => {
    console.log(`  浏览器启动失败：${error.message}，改用默认浏览器`)
    spawn('cmd', ['/c', 'start', '', targetUrl], { detached: true, stdio: 'ignore' }).unref()
  })
}

/* 单实例：已经有一份在跑就不要再起服务、更不要再开第二个窗口 */
const running = await hasRunningInstance()
if (running && !process.argv.includes('--no-window')) {
  const alreadyOpen = await hasAppWindow()
  if (alreadyOpen) {
    console.log('  已经有一个「小说构建器」窗口开着，不再重复启动。')
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

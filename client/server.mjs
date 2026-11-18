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

const slug = process.env.NOVEL_PROJECT || 'default'
const appRoot = path.join(os.homedir(), 'Documents', 'NovelUI')
const projectDir = path.join(appRoot, slug)
const stateFile = path.join(projectDir, 'project.json')
const backupDir = path.join(projectDir, 'backups')
const exportDir = path.join(projectDir, 'exports')

const BACKUP_KEEP = 10

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
  try {
    await stat(stateFile)
  } catch {
    return
  }
  await mkdir(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await copyFile(stateFile, path.join(backupDir, `project-${stamp}.json`))

  const files = (await readdir(backupDir))
    .filter((name) => name.startsWith('project-') && name.endsWith('.json'))
    .sort()
  while (files.length > BACKUP_KEEP) {
    const oldest = files.shift()
    await unlink(path.join(backupDir, oldest)).catch(() => {})
  }
}

async function handleState(req, res) {
  await mkdir(projectDir, { recursive: true })

  if (req.method === 'GET') {
    try {
      const text = await readFile(stateFile, 'utf8')
      const data = JSON.parse(text)
      const meta = await stat(stateFile)
      json(res, 200, { data, path: stateFile, updatedAt: Math.round(meta.mtimeMs / 1000) })
    } catch {
      json(res, 404, { path: stateFile })
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
      const temp = path.join(projectDir, 'project.json.tmp')
      await writeFile(temp, JSON.stringify(body.data, null, 2), 'utf8')
      await rename(temp, stateFile)
      json(res, 200, { ok: true, path: stateFile })
    } catch (error) {
      json(res, 500, { error: String(error && error.message ? error.message : error) })
    }
    return
  }

  json(res, 405, { error: '不支持的请求方法' })
}

async function handleExport(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: '不支持的请求方法' })
    return
  }
  try {
    const body = JSON.parse(await readBody(req))
    await mkdir(exportDir, { recursive: true })
    const file = path.join(exportDir, `novel-${Date.now()}.json`)
    await writeFile(file, JSON.stringify(body && body.payload ? body.payload : {}, null, 2), 'utf8')
    json(res, 200, { path: file })
  } catch (error) {
    json(res, 500, { error: String(error && error.message ? error.message : error) })
  }
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

const server = createServer(async (req, res) => {
  lastActiveAt = Date.now()
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (url.pathname === '/plot-api/state') return handleState(req, res)
  if (url.pathname === '/plot-api/export') return handleExport(req, res)
  if (url.pathname === '/plot-api/info') {
    return json(res, 200, { slug, dir: projectDir, platform: 'portable' })
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
  console.log(`  作品目录：${projectDir}`)
  console.log(`  本地地址：${targetUrl}`)

  if (process.argv.includes('--no-window')) return

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
      // 关掉后台自更新/同步，避免弹「无法更新 Microsoft Edge」这类窗口
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

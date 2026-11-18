/**
 * 把 dist 推到 gh-pages 分支（本地一条命令发布，不需要配 CI）。
 * 用法：npm run deploy
 *
 * 说明：
 * - 先跑 `npm run build:pages`（package.json 的 deploy 脚本已经串好）
 * - 本机 git 可能不在 PATH 里（Windows 常见），这里按常见安装路径兜底查找
 * - 推送用 Git Credential Manager 取本机登录态，不再单独输密码
 */

import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const GIT_CANDIDATES = [
  process.env.GIT_EXE,
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
  'git',
].filter(Boolean)

function findGit() {
  for (const candidate of GIT_CANDIDATES) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore' })
      return candidate
    } catch {
      /* 试试下一个 */
    }
  }
  throw new Error('找不到 git，请先安装 Git 或设置环境变量 GIT_EXE 指向 git.exe')
}

const git = findGit()
const projectDir = process.cwd()
const distDir = join(projectDir, 'dist')

if (!existsSync(join(distDir, 'index.html'))) {
  console.error('dist 里没有 index.html，请先运行 npm run build:pages')
  process.exit(1)
}

const remote = execFileSync(git, ['config', '--get', 'remote.origin.url'], {
  cwd: projectDir,
  encoding: 'utf8',
}).trim()

if (!remote) {
  console.error('当前仓库没有 origin 远程，请先 git remote add origin <仓库地址>')
  process.exit(1)
}

const tmp = join(tmpdir(), `novel-ui-pages-${Date.now()}`)
cpSync(distDir, tmp, { recursive: true })
writeFileSync(join(tmp, '.nojekyll'), '')

const run = (args) => execFileSync(git, args, { cwd: tmp, stdio: 'inherit' })
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

run(['init', '-b', 'gh-pages', '-q'])
run(['add', '-A'])
run(['commit', '-q', '-m', `deploy: ${stamp}`])
run(['remote', 'add', 'origin', remote])
run(['-c', 'credential.helper=manager', 'push', '-f', 'origin', 'gh-pages'])

rmSync(tmp, { recursive: true, force: true })
console.log(`\n已发布：${remote} (gh-pages)`)
console.log('若 Pages 的 Source 是 "Deploy from a branch"，几十秒后即可访问站点。')

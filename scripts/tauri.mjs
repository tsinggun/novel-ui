/**
 * Tauri 构建助手：先检查这台机器有没编译条件，再决定能不能打包。
 *   node scripts/tauri.mjs            只看环境
 *   node scripts/tauri.mjs build      直接调用 @tauri-apps/cli 打包
 *
 * 缺的条件一般是两类：
 *   1. Rust 的 std 组件（rustup target add x86_64-pc-windows-msvc）
 *   2. MSVC 链接器（Visual Studio「使用 C++ 的桌面开发」工作负载）
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const checks = []

function probe(name, command, args = ['--version'], hint = '') {
  // Windows 上 cargo / rustc 常是 .cmd 包装，必须过 shell 才能执行
  const result = spawnSync(command, args, { shell: true, encoding: 'utf8' })
  const ok = result.status === 0
  checks.push({ name, ok, detail: ok ? (result.stdout || '').split('\n')[0].trim() : '', hint })
}

probe('cargo', 'cargo')
probe('rustc', 'rustc')

const stdCheck = spawnSync('rustc', ['--print', 'sysroot'], { shell: true, encoding: 'utf8' })
const sysroot = (stdCheck.stdout || '').trim()
const stdDir = sysroot ? path.join(sysroot, 'lib', 'rustlib', 'x86_64-pc-windows-msvc', 'lib') : ''
const stdOk = stdDir ? existsSync(stdDir) : false
checks.push({
  name: 'Rust std (x86_64-pc-windows-msvc)',
  ok: stdOk,
  detail: stdDir,
  hint: '缺 std 时执行：rustup target add x86_64-pc-windows-msvc',
})

const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe'
let linker = ''
if (existsSync(vswhere)) {
  try {
    linker = execFileSync(
      vswhere,
      ['-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'],
      { encoding: 'utf8' },
    ).trim()
  } catch {
    linker = ''
  }
}
checks.push({
  name: 'MSVC 工具链 (C++ 桌面开发)',
  ok: Boolean(linker),
  detail: linker,
  hint: '缺链接器时：在 Visual Studio Installer 里勾选「使用 C++ 的桌面开发」',
})

for (const check of checks) {
  console.log(`${check.ok ? '✔' : '✘'} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`)
  if (!check.ok && check.hint) console.log(`   ${check.hint}`)
}

const ready = checks.every((check) => check.ok)
if (!ready) {
  console.log('\n还缺条件，暂时打不出安装包；网页版和便携版（npm run client）不受影响。')
  if (process.argv.includes('build')) process.exit(1)
  process.exit(0)
}

if (process.argv.includes('build')) {
  console.log('\n开始打包…')
  const result = spawnSync('npx', ['@tauri-apps/cli@2', 'build'], { stdio: 'inherit', shell: true })
  process.exit(result.status ?? 1)
} else {
  console.log('\n条件齐了，执行：node scripts/tauri.mjs build')
}

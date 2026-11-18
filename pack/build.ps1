# 打包「小说构建器」单文件 exe
#
# 流程：
#   1. vite build 出 dist
#   2. 把 node.exe + client/server.mjs + dist 摆进 pack/payload
#   3. 压成 pack/Launcher/payload.zip（作为内嵌资源）
#   4. dotnet publish 成单文件自包含 exe
#   5. 改名为「小说构建器.exe」，放到 release/
#
# 用法（在仓库根目录）：
#   pwsh -File pack/build.ps1
#   pwsh -File pack/build.ps1 -NodeExe "D:\some\node.exe"

param(
    [string]$NodeExe = "C:\nvm4w\nodejs\node.exe",
    [string]$Version = "0.1.0"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot   # 仓库根目录
Set-Location -LiteralPath $root

$sevenZip = "C:\Program Files\7-Zip\7z.exe"

Write-Host "[1/5] 构建前端 …"
& npx vite build | Out-Null

Write-Host "[2/5] 准备 payload …"
$stage = Join-Path $PSScriptRoot "payload"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Join-Path $stage "node"), (Join-Path $stage "client") | Out-Null
if (-not (Test-Path $NodeExe)) { throw "找不到 node.exe：$NodeExe" }
Copy-Item -LiteralPath $NodeExe (Join-Path $stage "node\node.exe")
Copy-Item -LiteralPath (Join-Path $root "client\server.mjs") (Join-Path $stage "client\server.mjs")
Copy-Item -LiteralPath (Join-Path $root "dist") -Destination (Join-Path $stage "dist") -Recurse

Write-Host "[3/5] 压缩 payload …"
$zipPath = Join-Path $PSScriptRoot "Launcher\payload.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
if (Test-Path $sevenZip) {
    & $sevenZip a -tzip -mx=7 -bso0 -bsp0 $zipPath (Join-Path $stage "*") | Out-Null
} else {
    Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zipPath -CompressionLevel Optimal
}

Write-Host "[4/5] 编译单文件 exe …"
Copy-Item -LiteralPath (Join-Path $root "src-tauri\icons\icon.ico") (Join-Path $PSScriptRoot "icon.ico") -Force
Push-Location (Join-Path $PSScriptRoot "Launcher")
try {
    & dotnet publish -c Release -r win-x64 --self-contained -o (Join-Path $PSScriptRoot "out") | Out-Null
} finally {
    Pop-Location
}

Write-Host "[5/5] 收尾 …"
$releaseDir = Join-Path $root "release"
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$outExe = Join-Path $releaseDir "小说构建器.exe"
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "out\NovelBuilder.exe") -Destination $outExe -Force

$size = [math]::Round((Get-Item $outExe).Length / 1MB, 1)
Write-Host ""
Write-Host "完成：$outExe  ($size MB, 版本 $Version)"

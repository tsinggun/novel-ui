# 生成 Tauri 需要的图标：32/128/256 PNG + 多尺寸 ICO
# 用法：pwsh scripts/make-icons.ps1
Add-Type -AssemblyName System.Drawing

function New-BlockIcon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 19, 19, 19))

  $inset = [double]$size / 10.0
  $stroke = [Math]::Max(1.0, [double]$size / 24.0)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 140, 140, 140)), ([float]$stroke)
  $side = [double]$size - 2.0 * $inset
  $g.DrawRectangle($pen, [float]$inset, [float]$inset, [float]$side, [float]$side)

  $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 233, 233, 233))
  $unit = $side / 4.0
  $x0 = $inset + $unit * 0.8
  $y0 = $inset + $unit * 0.8
  $g.FillRectangle($fill, [float]$x0, [float]$y0, [float]$unit, [float]$unit)
  $g.FillRectangle($fill, [float]($x0 + $unit * 1.4), [float]$y0, [float]$unit, [float]$unit)
  $g.FillRectangle($fill, [float]$x0, [float]($y0 + $unit * 1.4), [float]($unit * 2.4), [float]$unit)

  $g.Dispose()
  $pen.Dispose()
  $fill.Dispose()
  return $bmp
}

$dir = Join-Path $PSScriptRoot '..\src-tauri\icons'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

foreach ($size in @(32, 128, 256)) {
  $bmp = New-BlockIcon $size
  $bmp.Save((Join-Path $dir "$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
Copy-Item (Join-Path $dir '256.png') (Join-Path $dir '128x128@2x.png') -Force
Copy-Item (Join-Path $dir '128.png') (Join-Path $dir '128x128.png') -Force
Copy-Item (Join-Path $dir '32.png') (Join-Path $dir 'icon.png') -Force

# 用 PNG 分包组装 ICO（Vista 之后支持 PNG 内嵌）
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$entries = @()
foreach ($size in $sizes) {
  $bmp = New-BlockIcon $size
  $stream = New-Object System.IO.MemoryStream
  $bmp.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $entries += , @{ Size = $size; Bytes = $stream.ToArray() }
  $bmp.Dispose()
  $stream.Dispose()
}

$fs = [System.IO.File]::Create((Join-Path $dir 'icon.ico'))
$bw = New-Object System.IO.BinaryWriter($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$entries.Count)

$offset = 6 + 16 * $entries.Count
foreach ($entry in $entries) {
  $dim = 0
  if ($entry.Size -lt 256) { $dim = $entry.Size }
  $bw.Write([Byte]$dim)
  $bw.Write([Byte]$dim)
  $bw.Write([Byte]0)
  $bw.Write([Byte]0)
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]32)
  $bw.Write([UInt32]$entry.Bytes.Length)
  $bw.Write([UInt32]$offset)
  $offset += $entry.Bytes.Length
}
foreach ($entry in $entries) {
  $bw.Write([Byte[]]$entry.Bytes)
}
$bw.Flush()
$bw.Close()
$fs.Close()

Get-ChildItem $dir | Select-Object Name, Length

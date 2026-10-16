Add-Type -AssemblyName System.Drawing

$width = 1600
$height = 1000
$bitmap = [System.Drawing.Bitmap]::new($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function New-Brush([int]$red, [int]$green, [int]$blue, [int]$alpha = 255) {
  [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb($alpha, $red, $green, $blue))
}

function Fill-Polygon($brush, [int[]]$coordinates) {
  $points = [System.Drawing.Point[]]::new($coordinates.Length / 2)
  for ($index = 0; $index -lt $points.Length; $index += 1) {
    $points[$index] = [System.Drawing.Point]::new($coordinates[$index * 2], $coordinates[$index * 2 + 1])
  }
  $graphics.FillPolygon($brush, $points)
}

$sky = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  [System.Drawing.Rectangle]::new(0, 0, $width, $height),
  [System.Drawing.Color]::FromArgb(20, 27, 29),
  [System.Drawing.Color]::FromArgb(78, 87, 76),
  90
)
$graphics.FillRectangle($sky, 0, 0, $width, $height)
$moon = New-Brush 206 204 171 90
$graphics.FillEllipse($moon, 1210, 100, 180, 180)

$farTrees = New-Brush 39 49 43
Fill-Polygon $farTrees @(0, 520, 90, 390, 172, 514, 297, 305, 429, 535, 544, 363, 685, 567, 835, 322, 981, 563, 1092, 392, 1227, 551, 1349, 330, 1493, 552, 1600, 391, 1600, 710, 0, 710)
$nearTrees = New-Brush 23 31 27
Fill-Polygon $nearTrees @(0, 625, 90, 478, 195, 633, 316, 430, 452, 640, 555, 490, 678, 679, 822, 459, 972, 684, 1096, 516, 1205, 658, 1350, 456, 1482, 663, 1600, 499, 1600, 810, 0, 810)

$road = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  [System.Drawing.Rectangle]::new(0, 620, $width, 380),
  [System.Drawing.Color]::FromArgb(70, 73, 64),
  [System.Drawing.Color]::FromArgb(13, 18, 16),
  90
)
Fill-Polygon $road @(0, 1000, 535, 635, 1065, 635, 1600, 1000)
$edge = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(140, 179, 166, 131), 6)
$graphics.DrawLine($edge, 190, 1000, 598, 635)
$graphics.DrawLine($edge, 1410, 1000, 1002, 635)
$dashes = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(170, 186, 177, 139), 10)
for ($y = 700; $y -lt 1000; $y += 95) {
  $graphics.DrawLine($dashes, 800, $y, 800, [Math]::Min(1000, $y + 42))
}

$headlightGlow = New-Brush 255 224 159 28
$graphics.FillEllipse($headlightGlow, 390, 680, 360, 230)
$graphics.FillEllipse($headlightGlow, 850, 680, 360, 230)
$body = New-Brush 32 38 34
Fill-Polygon $body @(430, 805, 550, 733, 621, 665, 958, 665, 1044, 742, 980, 805, 1000, 875, 960, 902, 480, 902, 440, 870)
$trim = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(130, 112, 120, 104), 8)
$graphics.DrawPolygon($trim, [System.Drawing.Point[]]@(
  [System.Drawing.Point]::new(550, 733),
  [System.Drawing.Point]::new(621, 665),
  [System.Drawing.Point]::new(958, 665),
  [System.Drawing.Point]::new(1044, 742)
))
$glass = New-Brush 149 155 142 125
Fill-Polygon $glass @(610, 716, 652, 673, 787, 673, 787, 716)
Fill-Polygon $glass @(808, 673, 947, 673, 990, 716, 808, 716)
$lamps = New-Brush 246 225 174
$graphics.FillRectangle($lamps, 445, 790, 62, 26)
$graphics.FillRectangle($lamps, 920, 790, 62, 26)
$wheels = New-Brush 10 13 12
$rim = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(150, 102, 106, 95), 7)
foreach ($x in @(550, 885)) {
  $graphics.FillEllipse($wheels, $x, 850, 108, 108)
  $graphics.DrawEllipse($rim, $x, 850, 108, 108)
}

$infected = New-Brush 12 17 15 245
foreach ($position in @('1110,668', '1195,715', '355,700', '1315,650')) {
  $coordinates = $position.Split(',')
  $x = [int]::Parse($coordinates[0])
  $y = [int]::Parse($coordinates[1])
  $graphics.FillEllipse($infected, $x - 27, $y - 28, 54, 54)
  Fill-Polygon $infected @(($x - 17), ($y + 5), ($x + 18), ($y + 5), ($x + 27), ($y + 155), ($x + 8), ($y + 166), $x, ($y + 97), ($x - 12), ($y + 166), ($x - 31), ($y + 154))
}
$eyes = New-Brush 199 103 75 210
foreach ($position in @('1102,663', '1118,663', '1188,710', '1202,710', '348,695', '362,695', '1308,645', '1322,645')) {
  $coordinates = $position.Split(',')
  $graphics.FillEllipse($eyes, [int]::Parse($coordinates[0]), [int]::Parse($coordinates[1]), 5, 5)
}

$titlePanel = New-Brush 10 15 13 195
$graphics.FillRectangle($titlePanel, 62, 55, 760, 430)
$accent = New-Brush 196 220 134
$graphics.FillRectangle($accent, 62, 55, 5, 430)
$labelFont = [System.Drawing.Font]::new('Arial', 21, [System.Drawing.FontStyle]::Bold)
$titleFont = [System.Drawing.Font]::new('Arial', 110, [System.Drawing.FontStyle]::Bold)
$subtitleFont = [System.Drawing.Font]::new('Arial', 25, [System.Drawing.FontStyle]::Regular)
$light = New-Brush 233 230 212 240
$graphics.DrawString('COUNTY ROAD 09  //  RESCUE RUN', $labelFont, $accent, 100, 95)
$graphics.DrawString('DEAD', $titleFont, $light, 92, 145)
$graphics.DrawString('SIGNAL', $titleFont, $accent, 92, 262)
$graphics.DrawString('THE SIGNAL IS NOT WHAT IT SEEMS.', $subtitleFont, $light, 102, 410)

$vignette = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
  [System.Drawing.Rectangle]::new(0, 500, $width, 500),
  [System.Drawing.Color]::FromArgb(0, 0, 0, 0),
  [System.Drawing.Color]::FromArgb(95, 0, 0, 0),
  90
)
$graphics.FillRectangle($vignette, 0, 500, $width, 500)
$output = Join-Path $PSScriptRoot '..\cover.png'
$bitmap.Save([System.IO.Path]::GetFullPath($output), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Get-Item ([System.IO.Path]::GetFullPath($output)) | Select-Object FullName, Length

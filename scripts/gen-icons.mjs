// 构建时纯代码生成 PWA 图标，无需任何第三方图像库或二进制资源
// 图形：青绿底上两个白色人形（圆头 + 露出的肩部圆弧）
import { deflateSync } from 'node:zlib'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pub = join(root, 'public')

const ACCENT = [12, 133, 120]
const WHITE = [255, 255, 255]

// ---- PNG 编码 ----
function crcTable() {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
}
const T = crcTable()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = T[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePng(size, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    px.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- 有符号距离场（512 设计坐标系）----
function sdCircle(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r
}
// 人形：头（圆）+ 肩（圆的上半，下半裁平）
function sdPerson(x, y, cx) {
  const head = sdCircle(x, y, cx, 185, 38)
  const shoulder = Math.max(sdCircle(x, y, cx, 345, 72), y - 345)
  return Math.min(head, shoulder)
}
function sdFigures(x, y) {
  return Math.min(sdPerson(x, y, 186), sdPerson(x, y, 326))
}

function render(size, { maskable }) {
  const px = Buffer.alloc(size * size * 4)
  // 图形在 512 坐标系中的映射
  const figScale = (size / 512) * (maskable ? 0.78 : 1)
  const figOff = (size - 512 * figScale) / 2
  const bgRadius = maskable ? 0 : size * 0.22

  function blend(i, rgb, cov) {
    if (cov <= 0) return
    px[i] = Math.round(rgb[0] * cov + px[i] * (1 - cov))
    px[i + 1] = Math.round(rgb[1] * cov + px[i + 1] * (1 - cov))
    px[i + 2] = Math.round(rgb[2] * cov + px[i + 2] * (1 - cov))
    px[i + 3] = 255
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // 背景：圆角矩形（maskable 全出血）
      const bg = bgRadius
        ? sdRoundRect(x + 0.5, y + 0.5, 0, 0, size, size, bgRadius)
        : -1
      blend(i, ACCENT, Math.max(0, Math.min(1, 0.5 - bg)))
      // 白色人形
      const dx = (x + 0.5 - figOff) / figScale
      const dy = (y + 0.5 - figOff) / figScale
      const fig = sdFigures(dx, dy)
      blend(i, WHITE, Math.max(0, Math.min(1, 0.5 - fig)))
    }
  }
  return encodePng(size, px)
}
function sdRoundRect(x, y, x0, y0, x1, y1, r) {
  const hx = (x1 - x0) / 2
  const hy = (y1 - y0) / 2
  const qx = Math.abs(x - (x0 + x1) / 2) - hx + r
  const qy = Math.abs(y - (y0 + y1) / 2) - hy + r
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ax, ay) - r
}

await mkdir(pub, { recursive: true })
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable.png', 512, true]
]
for (const [name, size, maskable] of targets) {
  await writeFile(join(pub, name), render(size, { maskable }))
  console.log('icon: generated', name)
}

// 构建时拉取本地 OCR 资源到 public/tesseract
// 已存在则跳过；语言包下载 gz 后就地解压
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'public', 'tesseract')

const files = [
  [
    'worker.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    false
  ],
  [
    'tesseract-core-simd-lstm.wasm.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
    false
  ],
  [
    'chi_sim.traineddata',
    'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/chi_sim.traineddata.gz',
    true
  ],
  [
    'eng.traineddata',
    'https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/eng.traineddata.gz',
    true
  ]
]

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

await mkdir(out, { recursive: true })
for (const [name, url, isGz] of files) {
  const p = join(out, name)
  if (await exists(p)) {
    console.log('tesseract: skip', name)
    continue
  }
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`download failed ${url} -> ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(p, isGz ? gunzipSync(buf) : buf)
  console.log('tesseract: fetched', name)
}

// PWA 图标由 gen-icons.mjs 纯代码生成到 public
await import('./gen-icons.mjs')

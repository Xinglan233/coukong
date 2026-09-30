import { spawn } from 'node:child_process'
const options = { stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } }
const migrate = spawn('node', ['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','coukong-local','--local','--config','worker/wrangler.jsonc'], options)
migrate.on('exit', code => {
  if (code) process.exit(code)
  const worker = spawn('node', ['node_modules/wrangler/bin/wrangler.js','dev','--local','--port','8787','--config','worker/wrangler.jsonc'], options)
  const vite = spawn('node', ['node_modules/vite/bin/vite.js','--host','127.0.0.1'], options)
  const stop = () => { worker.kill('SIGTERM'); vite.kill('SIGTERM') }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
  worker.on('exit', stop); vite.on('exit', stop)
})

const value = process.env.TONGYE_E2E_API_PORT || '8787'
if (!/^\d+$/.test(value) || Number(value) < 1024 || Number(value) > 65535) throw new Error('E2E API 端口须为1024–65535整数')
export const API_PORT = Number(value)
export const API_BASE = `http://localhost:${API_PORT}`

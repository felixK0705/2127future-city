import { createReadStream, existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  hasOpenAiKey,
  requestOpenAiContent,
} from './server/openai.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))
const dist = join(root, 'dist')
const port = Number(process.env.PORT || 4173)
const limits = new Map()

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

const sendJson = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

const readJsonBody = async (request) => {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 64 * 1024) {
      const error = new Error('REQUEST_TOO_LARGE')
      error.code = 'REQUEST_TOO_LARGE'
      throw error
    }
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('INVALID_JSON')
    error.code = 'INVALID_PAYLOAD'
    throw error
  }
}

const takeRateLimitSlot = (address) => {
  const now = Date.now()
  const current = limits.get(address)
  if (!current || now - current.startedAt >= 60_000) {
    limits.set(address, { startedAt: now, count: 1 })
    if (limits.size > 1000) {
      for (const [key, value] of limits) {
        if (now - value.startedAt >= 60_000) limits.delete(key)
      }
    }
    return true
  }
  if (current.count >= 10) return false
  current.count += 1
  return true
}

const serveStatic = (request, response, pathname) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('この操作には対応していません。')
    return
  }

  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('URLの形式が正しくありません。')
    return
  }
  const requested = resolve(dist, decoded.replace(/^[/\\]+/, '') || 'index.html')
  const pathFromDist = relative(dist, requested)
  const isInside = pathFromDist !== '..' && !pathFromDist.startsWith(`..${sep}`)
  let filePath = isInside && existsSync(requested) ? requested : join(dist, 'index.html')
  if (!existsSync(filePath)) {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('展示データがまだ準備されていません。先にビルドを実行してください。')
    return
  }

  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(filePath).on('error', () => {
    if (!response.headersSent) response.writeHead(500)
    response.end('展示データを読み込めませんでした。')
  }).pipe(response)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost')
  if (url.pathname !== '/api/city-content') {
    serveStatic(request, response, url.pathname)
    return
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
    return
  }
  const address = request.socket.remoteAddress || 'unknown'
  if (!takeRateLimitSlot(address)) {
    sendJson(response, 429, { error: 'RATE_LIMITED' })
    return
  }
  if (!hasOpenAiKey()) {
    sendJson(response, 503, { error: 'AI_NOT_CONFIGURED' })
    return
  }

  try {
    const content = await requestOpenAiContent(await readJsonBody(request))
    sendJson(response, 200, content)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'UNKNOWN'
    console.error('[city-content]', error instanceof Error ? error.message : error)
    if (code === 'INVALID_PAYLOAD' || code === 'REQUEST_TOO_LARGE') {
      sendJson(response, code === 'REQUEST_TOO_LARGE' ? 413 : 400, { error: code })
      return
    }
    sendJson(response, 502, { error: 'AI_GENERATION_FAILED' })
  }
})

server.listen(port, () => {
  console.log(`2127 未来都市: http://localhost:${port}`)
})

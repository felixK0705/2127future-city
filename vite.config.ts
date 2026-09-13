import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import {
  hasOpenAiKey,
  requestOpenAiContent,
} from './server/openai.mjs'

const readJsonBody = async (request: AsyncIterable<Uint8Array>) => {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.byteLength
    if (size > 64 * 1024) {
      const error = new Error('REQUEST_TOO_LARGE')
      Object.assign(error, { code: 'REQUEST_TOO_LARGE' })
      throw error
    }
    chunks.push(chunk)
  }
  const merged = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(merged))
}

const readLargeJsonBody = async (
  request: AsyncIterable<Uint8Array>,
  maxBytes = 16 * 1024 * 1024,
) => {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.byteLength
    if (size > maxBytes) {
      const error = new Error('REQUEST_TOO_LARGE')
      Object.assign(error, { code: 'REQUEST_TOO_LARGE' })
      throw error
    }
    chunks.push(chunk)
  }
  const merged = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return JSON.parse(new TextDecoder().decode(merged))
}

const sendJson = (
  response: {
    writeHead(status: number, headers: Record<string, string>): void
    end(body: string): void
  },
  status: number,
  body: unknown,
) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

const cityCaptureApi = (): Plugin => ({
  name: 'city-capture-api',
  configureServer(server) {
    server.middlewares.use('/api/save-city-capture', async (request, response) => {
      if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
        return
      }
      try {
        const body = (await readLargeJsonBody(request)) as {
          id?: unknown
          cityName?: unknown
          png?: unknown
        }
        const id = String(body.id ?? '').replace(/[^A-Z]/g, '')
        const cityName = String(body.cityName ?? '').replace(/[<>:"/\\|?*]/g, '').trim()
        const png = String(body.png ?? '')
        const match = png.match(/^data:image\/png;base64,(.+)$/)
        if (!id || !match?.[1]) {
          sendJson(response, 400, { error: 'INVALID_PAYLOAD' })
          return
        }
        const dir = join(process.cwd(), 'captures', 'cities')
        mkdirSync(dir, { recursive: true })
        const filename = cityName ? `${id}-${cityName}.png` : `${id}.png`
        writeFileSync(join(dir, filename), Buffer.from(match[1], 'base64'))
        sendJson(response, 200, { ok: true, filename })
      } catch (error) {
        const code =
          error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN'
        if (code === 'REQUEST_TOO_LARGE') {
          sendJson(response, 413, { error: code })
          return
        }
        console.error('[city-capture]', error instanceof Error ? error.message : error)
        sendJson(response, 500, { error: 'SAVE_FAILED' })
      }
    })
  },
})

const cityContentApi = (environment: Record<string, string>): Plugin => ({
  name: 'city-content-api',
  configureServer(server) {
    server.middlewares.use('/api/city-content', async (request, response) => {
      if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'METHOD_NOT_ALLOWED' })
        return
      }
      if (!hasOpenAiKey(environment)) {
        sendJson(response, 503, { error: 'AI_NOT_CONFIGURED' })
        return
      }
      try {
        const content = await requestOpenAiContent(await readJsonBody(request), environment)
        sendJson(response, 200, content)
      } catch (error) {
        const code =
          error instanceof Error && 'code' in error ? String(error.code) : 'UNKNOWN'
        console.error('[city-content]', error instanceof Error ? error.message : error)
        if (code === 'INVALID_PAYLOAD' || code === 'REQUEST_TOO_LARGE') {
          sendJson(response, code === 'REQUEST_TOO_LARGE' ? 413 : 400, { error: code })
          return
        }
        sendJson(response, 502, { error: 'AI_GENERATION_FAILED' })
      }
    })
  },
})

export default defineConfig(({ mode }) => {
  // loadEnv は Vite サーバー内だけで読み、クライアントへ公開しない。
  const environment = { ...process.env, ...loadEnv(mode, process.cwd(), '') } as Record<
    string,
    string
  >
  return {
    plugins: [react(), cityContentApi(environment), cityCaptureApi()],
  }
})

import { POLICY_CATEGORIES, findPolicy } from '../data/policies'
import { CATEGORY_KEYS, METRIC_KEYS, type Choices, type Scores } from '../types'
import { METRIC_LABELS } from '../data/copy'
import { scoreArchetype } from '../lib/archetypeScoring'
import { getArchetype } from '../core-city'
import { deriveCitizenNumber, formatIssueDate } from '../lib/citizenCard'

export { deriveCitizenNumber } from '../lib/citizenCard'

export type SouvenirData = {
  cityName: string
  typeTitle?: string
  archetypeId?: string
  choices: Choices
  scores: Scores
  dioramaSnapshot?: string
  visitDate?: Date
}

/* Two rounded cards on a grey sheet: the city model over a black caption panel
   on the left, the readout on the right. */
const PAGE_WIDTH = 2400
const PAGE_HEIGHT = 1390
const MARGIN = 34
const CARD_TOP = MARGIN
const CARD_HEIGHT = PAGE_HEIGHT - MARGIN * 2
const CARD_RADIUS = 40
const LEFT_WIDTH = 900
const SNAPSHOT_HEIGHT = 608
const RIGHT_X = MARGIN + LEFT_WIDTH + 46
const RIGHT_WIDTH = PAGE_WIDTH - RIGHT_X - MARGIN

const FONT_STACK = '"Noto Sans JP", "Yu Gothic", sans-serif'
const INK = '#1a1a1a'
const INK_MUTED = '#8d8f93'
const RED = '#d93f3f'
const PANEL = '#141415'

/** canvas cannot trigger a font download, so make sure the faces are resident */
const ensureFonts = async () => {
  try {
    await Promise.all([
      document.fonts.load(`400 26px ${FONT_STACK}`),
      document.fonts.load(`500 38px ${FONT_STACK}`),
      document.fonts.load(`700 76px ${FONT_STACK}`),
    ])
    await document.fonts.ready
  } catch {
    // 既定のフォントのままで描き続ける
  }
}

const roundRectPath = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

const setTracking = (context: CanvasRenderingContext2D, value: string) => {
  if ('letterSpacing' in context) {
    (context as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value
  }
}

const wrapText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = Number.POSITIVE_INFINITY,
): number => {
  let line = ''
  let currentY = y
  let lines = 0
  for (const character of text) {
    const candidate = line + character
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, currentY)
      currentY += lineHeight
      lines += 1
      if (lines >= maxLines) return currentY
      line = character
    } else {
      line = candidate
    }
  }
  if (line && lines < maxLines) {
    context.fillText(line, x, currentY)
    currentY += lineHeight
  }
  return currentY
}

const loadSnapshot = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    if (!source) {
      reject(new Error('ジオラマ画像が見つかりません。'))
      return
    }
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('ジオラマ画像を読み込めませんでした。'))
    image.src = source
  })

const drawCoverImage = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  context.drawImage(
    image,
    (image.naturalWidth - sourceWidth) / 2,
    (image.naturalHeight - sourceHeight) / 2,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  )
}

const tradeoffLine = (scores: Scores): string => {
  const ranked = [...METRIC_KEYS].sort(
    (left, right) =>
      scores[right] - scores[left] || METRIC_KEYS.indexOf(left) - METRIC_KEYS.indexOf(right),
  )
  const strongest = ranked[0] ?? METRIC_KEYS[0]
  const weakest = ranked[ranked.length - 1] ?? METRIC_KEYS[0]
  return `${METRIC_LABELS[strongest]}を伸ばす代わりに、${METRIC_LABELS[weakest]}をどう守るかが問われる都市です。`
}

export const createReportImage = async (data: SouvenirData): Promise<Blob> => {
  try {
    const scored = scoreArchetype(data.choices)
    const archetypeId = data.archetypeId ?? scored.archetypeId
    const archetype = getArchetype(scored.archetypeId)
    const typeTitle = data.typeTitle ?? archetype.title
    const snapshot = await loadSnapshot(data.dioramaSnapshot ?? '')
    await ensureFonts()
    const canvas = document.createElement('canvas')
    canvas.width = PAGE_WIDTH
    canvas.height = PAGE_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('記念品画像を作成できませんでした。')

    const visitDate = data.visitDate ?? new Date()
    const citizenNumber = deriveCitizenNumber(data.cityName, archetypeId)

    // 下地
    const sheet = context.createLinearGradient(0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    sheet.addColorStop(0, '#ededee')
    sheet.addColorStop(1, '#e2e2e4')
    context.fillStyle = sheet
    context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

    const dropCard = (x: number, width: number) => {
      context.save()
      context.shadowColor = 'rgba(24,24,27,0.16)'
      context.shadowBlur = 48
      context.shadowOffsetY = 18
      context.fillStyle = '#ffffff'
      roundRectPath(context, x, CARD_TOP, width, CARD_HEIGHT, CARD_RADIUS)
      context.fill()
      context.restore()
    }

    // 左：都市模型と黒い銘板
    dropCard(MARGIN, LEFT_WIDTH)
    context.save()
    roundRectPath(context, MARGIN, CARD_TOP, LEFT_WIDTH, CARD_HEIGHT, CARD_RADIUS)
    context.clip()
    context.fillStyle = '#e6e6e8'
    context.fillRect(MARGIN, CARD_TOP, LEFT_WIDTH, SNAPSHOT_HEIGHT)
    drawCoverImage(context, snapshot, MARGIN, CARD_TOP, LEFT_WIDTH, SNAPSHOT_HEIGHT)
    context.fillStyle = PANEL
    context.fillRect(MARGIN, CARD_TOP + SNAPSHOT_HEIGHT, LEFT_WIDTH, CARD_HEIGHT - SNAPSHOT_HEIGHT)

    const plateX = MARGIN + 60
    const plateTop = CARD_TOP + SNAPSHOT_HEIGHT
    context.fillStyle = '#c9c9ce'
    context.font = `400 26px ${FONT_STACK}`
    context.fillText('2127年発行　未来都市来訪記念', plateX, plateTop + 76)
    context.fillStyle = '#f4f4f5'
    context.font = `700 76px ${FONT_STACK}`
    const nameBottom = wrapText(context, data.cityName || '名もなき未来都市', plateX, plateTop + 170, 780, 90, 2)
    context.fillStyle = RED
    context.font = `500 30px ${FONT_STACK}`
    context.fillText(typeTitle, plateX, nameBottom + 22)
    context.fillStyle = '#9a9aa0'
    context.font = `400 25px ${FONT_STACK}`
    const dateLabel = `来訪日　${formatIssueDate(visitDate)}`
    const footY = CARD_TOP + CARD_HEIGHT - 84
    context.fillText(dateLabel, plateX, footY)
    context.fillText(`市民番号　${citizenNumber}`, plateX + context.measureText(dateLabel).width + 70, footY)
    context.restore()

    // 右：指標と政策
    dropCard(RIGHT_X, RIGHT_WIDTH)
    context.save()
    roundRectPath(context, RIGHT_X, CARD_TOP, RIGHT_WIDTH, CARD_HEIGHT, CARD_RADIUS)
    context.clip()
    const face = context.createLinearGradient(RIGHT_X, CARD_TOP, RIGHT_X, CARD_TOP + CARD_HEIGHT)
    face.addColorStop(0, '#fbfbfc')
    face.addColorStop(1, '#f1f1f3')
    context.fillStyle = face
    context.fillRect(RIGHT_X, CARD_TOP, RIGHT_WIDTH, CARD_HEIGHT)

    const left = RIGHT_X + 64
    const right = RIGHT_X + RIGHT_WIDTH - 64
    context.fillStyle = INK
    context.font = `500 38px ${FONT_STACK}`
    context.fillText('この都市の五つの指標', left, 140)
    context.textAlign = 'right'
    context.fillStyle = INK_MUTED
    context.font = `500 21px ${FONT_STACK}`
    setTracking(context, '5px')
    context.fillText('2127 CITIZEN PASS', right, 136)
    setTracking(context, '0px')
    context.textAlign = 'left'

    const barLeft = left + 198
    const barWidth = right - 120 - barLeft
    context.textBaseline = 'middle'
    METRIC_KEYS.forEach((metric, index) => {
      const y = 205 + index * 60
      const score = Math.max(0, Math.min(100, data.scores[metric]))
      context.fillStyle = INK
      context.font = `400 26px ${FONT_STACK}`
      context.fillText(METRIC_LABELS[metric], left, y)
      context.fillStyle = '#e2e2e4'
      roundRectPath(context, barLeft, y - 8, barWidth, 16, 8)
      context.fill()
      if (score > 0) {
        context.fillStyle = RED
        roundRectPath(context, barLeft, y - 8, Math.max(16, barWidth * (score / 100)), 16, 8)
        context.fill()
      }
      context.textAlign = 'right'
      context.fillStyle = INK
      context.font = `500 28px ${FONT_STACK}`
      context.fillText(String(score), right, y)
      context.textAlign = 'left'
    })

    context.fillStyle = '#dcdcde'
    context.fillRect(left, 512, right - left, 2)

    context.textBaseline = 'alphabetic'
    context.fillStyle = INK
    context.font = `500 38px ${FONT_STACK}`
    context.fillText('選んだ五つの政策', left, 590)

    context.textBaseline = 'middle'
    POLICY_CATEGORIES.forEach((category, index) => {
      const policy = findPolicy(category.id, data.choices[category.id] ?? '')
      const y = 660 + index * 60
      context.fillStyle = INK_MUTED
      context.font = `400 24px ${FONT_STACK}`
      context.fillText(category.label, left, y)
      context.fillStyle = INK
      context.font = `500 30px ${FONT_STACK}`
      wrapText(context, policy?.title ?? '未選択', left + 210, y, right - left - 210, 36, 1)
    })

    // 締めの一文は赤い縦線を添えて
    const quoteY = CARD_TOP + CARD_HEIGHT - 106
    context.fillStyle = RED
    context.fillRect(left, quoteY - 30, 6, 60)
    context.fillStyle = '#4a4a4e'
    context.font = `400 26px ${FONT_STACK}`
    wrapText(context, tradeoffLine(data.scores), left + 34, quoteY, right - left - 34, 38, 2)
    context.restore()

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error('記念品画像の書き出しに失敗しました。')),
        'image/png',
      )
    })
  } catch (error) {
    if (error instanceof Error && /[ぁ-んァ-ン一-龯]/u.test(error.message)) throw error
    throw new Error('記念品画像の作成に失敗しました。もう一度お試しください。')
  }
}

export const downloadReport = async (data: SouvenirData): Promise<void> => {
  try {
    const blob = await createReportImage(data)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${data.cityName || '2127未来都市'}-来訪記念.png`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch {
    throw new Error('記念品をダウンロードできませんでした。もう一度お試しください。')
  }
}

export const createShareUrl = (
  data: Pick<SouvenirData, 'cityName' | 'choices'>,
  baseUrl = window.location.href,
): string => {
  const url = new URL(baseUrl)
  url.search = ''
  url.hash = ''
  url.searchParams.set('city', data.cityName)
  for (const key of CATEGORY_KEYS) {
    const choice = data.choices[key]
    if (choice) url.searchParams.set(key, choice)
  }
  return url.toString()
}

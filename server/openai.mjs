const API_URL = 'https://api.openai.com/v1/responses'
const METRIC_KEYS = ['environment', 'freedom', 'equity', 'convenience', 'diversity']
const CATEGORY_KEYS = ['energy', 'transport', 'law', 'education', 'culture']

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    headline: { type: 'string', minLength: 1, maxLength: 70 },
    dailyLife: { type: 'string', minLength: 1, maxLength: 180 },
    analysis: { type: 'string', minLength: 1, maxLength: 220 },
  },
  required: ['headline', 'dailyLife', 'analysis'],
}

const fail = (code, message) => {
  const error = new Error(message)
  error.code = code
  return error
}

const cleanString = (value, maxLength) => {
  if (typeof value !== 'string') throw fail('INVALID_PAYLOAD', '入力形式が不正です。')
  const text = value.trim()
  if (!text || text.length > maxLength || /[\u0000-\u001f]/u.test(text)) {
    throw fail('INVALID_PAYLOAD', '入力形式が不正です。')
  }
  return text
}

export const normalizePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw fail('INVALID_PAYLOAD', '入力形式が不正です。')
  }
  const keys = Object.keys(payload)
  if (
    keys.length !== 4 ||
    !['policies', 'scores', 'cityName', 'typeTitle'].every((key) => keys.includes(key)) ||
    !Array.isArray(payload.policies) ||
    payload.policies.length !== 5
  ) {
    throw fail('INVALID_PAYLOAD', '入力形式が不正です。')
  }

  const seenCategories = new Set()
  const policies = payload.policies.map((policy) => {
    if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
      throw fail('INVALID_PAYLOAD', '政策の入力形式が不正です。')
    }
    const policyKeys = Object.keys(policy)
    if (
      policyKeys.length !== 3 ||
      !['category', 'title', 'summary'].every((key) => policyKeys.includes(key)) ||
      !CATEGORY_KEYS.includes(policy.category) ||
      seenCategories.has(policy.category)
    ) {
      throw fail('INVALID_PAYLOAD', '政策の入力形式が不正です。')
    }
    seenCategories.add(policy.category)
    return {
      category: policy.category,
      title: cleanString(policy.title, 80),
      summary: cleanString(policy.summary, 360),
    }
  })

  if (
    !payload.scores ||
    typeof payload.scores !== 'object' ||
    Array.isArray(payload.scores) ||
    Object.keys(payload.scores).length !== METRIC_KEYS.length
  ) {
    throw fail('INVALID_PAYLOAD', '指標の入力形式が不正です。')
  }
  const scores = Object.fromEntries(
    METRIC_KEYS.map((key) => {
      const value = payload.scores[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
        throw fail('INVALID_PAYLOAD', '指標の入力形式が不正です。')
      }
      return [key, value]
    }),
  )

  return {
    policies,
    scores,
    cityName: cleanString(payload.cityName, 80),
    typeTitle: cleanString(payload.typeTitle, 80),
  }
}

const extractText = (response) => {
  if (typeof response.output_text === 'string') return response.output_text
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }
  return ''
}

const isJapaneseContent = (value, input) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (
    Object.keys(value).length !== 3 ||
    !['headline', 'dailyLife', 'analysis'].every((key) => {
      const text = value[key]
      return (
        typeof text === 'string' &&
        text.trim().length > 0 &&
        text.length <= responseSchema.properties[key].maxLength &&
        /[\u3040-\u30ff\u3400-\u9fff]/u.test(text) &&
        !/[A-Za-z]/u.test(text) &&
        !/\b[OL][FS][EG][CD]\b/u.test(text)
      )
    })
  ) {
    return false
  }
  const completeText = `${value.headline}\n${value.dailyLife}\n${value.analysis}`
  return value.headline.includes(input.cityName) && completeText.includes(input.typeTitle)
}

export const hasOpenAiKey = (environment = process.env) =>
  typeof environment.OPENAI_API_KEY === 'string' && environment.OPENAI_API_KEY.trim() !== ''

export async function requestOpenAiContent(payload, environment = process.env) {
  if (!hasOpenAiKey(environment)) {
    throw fail('MISSING_API_KEY', 'AIサービスは現在利用できません。')
  }
  const input = normalizePayload(payload)
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${environment.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: environment.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: [
        'あなたは2127年の未来都市を伝える日本語編集者です。',
        '出力は指定されたJSONスキーマの三つの文字列だけにしてください。',
        'すべて自然な日本語で書き、英語・中国語・内部コードを出力しないでください。',
        `都市名は必ず「${input.cityName}」だけを使い、新しい都市名を作らないでください。`,
        `都市タイプの称号は必ず「${input.typeTitle}」として扱い、別の称号に変更しないでください。`,
        '入力された五政策と五指標だけを根拠に、生活、強み、代償を具体的に描いてください。',
        '内部識別子、分類コード、極コードを推測したり出力したりしないでください。',
      ].join('\n'),
      input: JSON.stringify(input),
      text: {
        format: {
          type: 'json_schema',
          name: 'future_city_content',
          strict: true,
          schema: responseSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw fail('UPSTREAM_ERROR', `OpenAI API returned ${response.status}`)
  }
  let parsed
  try {
    parsed = JSON.parse(extractText(await response.json()))
  } catch {
    throw fail('INVALID_UPSTREAM_RESPONSE', 'AIの応答形式が不正です。')
  }
  if (!isJapaneseContent(parsed, input)) {
    throw fail('INVALID_UPSTREAM_RESPONSE', 'AIの応答形式が不正です。')
  }
  return parsed
}

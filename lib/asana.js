const ASANA_BASE = 'https://app.asana.com/api/1.0'

function getToken() {
  return process.env.ASANA_TOKEN || process.env.ASANA_PAT
}

function getHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function asanaFetch(path, { timeoutMs = 30000 } = {}) {
  const url = path.startsWith('http') ? path : `${ASANA_BASE}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      headers: getHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    })

    if (res.status === 429) {
      clearTimeout(timeout)
      await sleep(1500)
      return asanaFetch(path, { timeoutMs })
    }

    const data = await res.json()

    if (!res.ok) {
      throw new Error(data?.errors?.[0]?.message || `Asana ${res.status}`)
    }

    return data
  } finally {
    clearTimeout(timeout)
  }
}

export function mapAsanaCustomFields(item) {
  const map = {}
  for (const field of item?.custom_fields || []) {
    map[field.name] =
      field.enum_value?.name ??
      field.display_value ??
      field.text_value ??
      field.number_value ??
      field.date_value?.date ??
      null
  }
  return map
}

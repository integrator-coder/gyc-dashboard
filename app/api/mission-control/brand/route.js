import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const dynamic = 'force-dynamic'

const BRAND_PATH = path.join(process.cwd(), 'data', 'brand-guide.json')
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'brand')

async function readBrand() {
  try {
    const raw = await fs.readFile(BRAND_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writeBrand(data) {
  data.lastUpdated = new Date().toISOString()
  await fs.writeFile(BRAND_PATH, JSON.stringify(data, null, 2), 'utf8')
}

export async function GET() {
  const data = await readBrand()
  return NextResponse.json(data)
}

export async function POST(req) {
  const ct = req.headers.get('content-type') || ''

  // ── JSON update ────────────────────────────────────────────────────────────
  if (ct.includes('application/json')) {
    const body = await req.json()
    const { action, path: fieldPath, value } = body

    const data = await readBrand()

    if (action === 'update_field') {
      // path is dot-notation: "brand.tagline" → data.brand.tagline = value
      const parts = fieldPath.split('.')
      let obj = data
      for (let i = 0; i < parts.length - 1; i++) {
        if (!obj[parts[i]]) obj[parts[i]] = {}
        obj = obj[parts[i]]
      }
      obj[parts[parts.length - 1]] = value
      data.updatedBy = 'Todd'
      await writeBrand(data)
      return NextResponse.json({ ok: true })
    }

    if (action === 'add_color') {
      const { palette, color } = body
      if (!data.colors[palette]) data.colors[palette] = []
      data.colors[palette].push(color)
      data.updatedBy = body.updatedBy || 'Todd'
      await writeBrand(data)
      return NextResponse.json({ ok: true })
    }

    if (action === 'remove_color') {
      const { palette, hex } = body
      if (data.colors[palette]) {
        data.colors[palette] = data.colors[palette].filter((c) => c.hex !== hex)
      }
      data.updatedBy = body.updatedBy || 'Todd'
      await writeBrand(data)
      return NextResponse.json({ ok: true })
    }

    if (action === 'add_template' || action === 'add_media') {
      const key = action === 'add_template' ? 'templates' : 'mediaLibrary'
      data[key].items = data[key].items || []
      data[key].items.push({ ...body.item, addedAt: new Date().toISOString() })
      data.updatedBy = body.updatedBy || 'Todd'
      await writeBrand(data)
      return NextResponse.json({ ok: true })
    }

    if (action === 'remove_template' || action === 'remove_media') {
      const key = action === 'remove_template' ? 'templates' : 'mediaLibrary'
      data[key].items = (data[key].items || []).filter((item) => item.id !== body.id)
      data.updatedBy = body.updatedBy || 'Todd'
      await writeBrand(data)
      return NextResponse.json({ ok: true })
    }

    if (action === 'update_logo_variant') {
      const { variantName, file } = body
      const idx = data.logo.variants.findIndex((v) => v.name === variantName)
      if (idx >= 0) data.logo.variants[idx].file = file
      data.updatedBy = body.updatedBy || 'Todd'
      await writeBrand(data)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // ── File upload ─────────────────────────────────────────────────────────────
  if (ct.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file')
    const category = formData.get('category') || 'media'
    const name = formData.get('name') || file?.name || 'upload'
    const description = formData.get('description') || ''

    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const subDir = ['logos', 'templates', 'media'].includes(category) ? category : 'media'
    const dir = path.join(UPLOAD_DIR, subDir)
    await fs.mkdir(dir, { recursive: true })

    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const filePath = path.join(dir, safeName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    const publicUrl = `/brand/${subDir}/${safeName}`

    // Save to brand guide
    const data = await readBrand()
    if (category === 'logos') {
      // Try to match to a logo variant by name
      const variantIdx = data.logo.variants.findIndex((v) =>
        v.name.toLowerCase().includes(name.toLowerCase().replace(/[-_.]/g, ' ').trim())
      )
      if (variantIdx >= 0) data.logo.variants[variantIdx].file = publicUrl
    } else {
      const key = category === 'templates' ? 'templates' : 'mediaLibrary'
      data[key].items = data[key].items || []
      data[key].items.push({
        id: `${category}-${Date.now()}`,
        name: name.replace(/[-_.]/g, ' ').replace(/\.[^.]+$/, ''),
        file: publicUrl,
        description,
        addedAt: new Date().toISOString(),
      })
    }
    data.updatedBy = 'Todd'
    await writeBrand(data)

    return NextResponse.json({ ok: true, url: publicUrl })
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
}

export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[acronym]/gbp/locations/new-location-workflow
 *
 * Trigger the New Location workflow:
 * 1. Look up the client's assigned GA
 * 2. Return the GA-specific Asana form URL
 * 3. UI shows the form link to the GA to fill out
 *
 * Body: { locationName, gbpUrl, locationId }
 * Requires: ga, cx, admin, or superadmin role.
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

// GA-specific Asana form URLs
const GA_FORM_URLS = {
  'Sebastian': 'https://form.asana.com/?k=WxYnQ4Lbwoci_LxwE1CcYQ&d=931093392134374',
  'Stefen':    'https://form.asana.com/?k=2C6UUyYC-AmwXUomfLp6_Q&d=931093392134374',
  'Briana':    'https://form.asana.com/?k=Vai5dKwf1tJlGbpvhMsaEQ&d=931093392134374',
  'Zu':        'https://form.asana.com/?k=LI-FEc5bz_yLP2t-eO-h4g&d=931093392134374',
  'JC':        'https://form.asana.com/?k=XEJ22cEsnHQNYgHKbL_CUQ&d=931093392134374',
}

export async function POST(req, { params }) {
  const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin', 'manager'])
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { acronym } = await params
  const body = await req.json()
  const { locationName, gbpUrl, locationId } = body

  if (!locationName?.trim()) {
    return NextResponse.json({ error: 'locationName is required' }, { status: 400 })
  }

  try {
    // Get client profile to find assigned GA
    const { rows: profileRows } = await pool.query(
      `SELECT "companyName", "assignedGA" FROM "ClientProfile" 
       WHERE "tenantId" = 'gyc' AND "acronym" = $1 LIMIT 1`,
      [acronym.toUpperCase()]
    )

    if (profileRows.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    const clientName = profileRows[0].companyName || acronym.toUpperCase()
    const assignedGA = profileRows[0].assignedGA

    if (!assignedGA) {
      return NextResponse.json({
        success: false,
        error: 'No Growth Advisor assigned to this client.',
        warning: 'Location was saved. Please manually kick off the New Location project in Asana.',
      }, { status: 400 })
    }

    // Look up the GA-specific Asana form URL
    // Try exact match first, then case-insensitive
    const formUrl = GA_FORM_URLS[assignedGA] ||
      Object.entries(GA_FORM_URLS).find(([k]) =>
        k.toLowerCase() === assignedGA.toLowerCase()
      )?.[1]

    if (!formUrl) {
      return NextResponse.json({
        success: false,
        assignedGA,
        error: `No Asana form configured for Growth Advisor "${assignedGA}".`,
        warning: 'Location was saved. Please manually kick off the New Location project in Asana.',
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      formUrl,
      assignedGA,
      clientName,
      locationName: locationName.trim(),
      message: `New Location form ready for ${assignedGA}`,
    })

  } catch (error) {
    console.error('[POST /api/clients/[acronym]/gbp/locations/new-location-workflow]', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get New Location workflow',
      warning: 'Location was saved. Please manually kick off the New Location project in Asana.',
    }, { status: 500 })
  }
}

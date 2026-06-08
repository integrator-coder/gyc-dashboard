export const dynamic = 'force-dynamic'

/**
 * POST /api/clients/[acronym]/gbp/locations/new-location-workflow
 *
 * Trigger the New Location workflow in Asana:
 * 1. Duplicate the New Location project template
 * 2. Find the GA's Asana user
 * 3. Add the GA as a project member
 * 4. Create an action-required task for the GA
 * 5. Return the Asana project URL
 *
 * Body: { locationName, gbpUrl, locationId }
 * Requires: ga, cx, admin, or superadmin role.
 */

import { NextResponse } from 'next/server'
import { requireApiUser } from '@/lib/auth'
import { pool } from '@/lib/pg'

const ASANA_PAT = process.env.ASANA_PAT
const ASANA_WORKSPACE_GID = '931093392134374'
const ASANA_BASE_URL = 'https://app.asana.com/api/1.0'

// Template GID — fallback to NEW CLIENT ONBOARDING for now
// Todd will update this in .env.local when the correct template is ready
const DEFAULT_TEMPLATE_GID = '1201619092827904'

async function asanaFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${ASANA_BASE_URL}${path}`
  const headers = {
    'Authorization': `Bearer ${ASANA_PAT}`,
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const res = await fetch(url, { ...options, headers })

  if (res.status === 429) {
    // Rate limited — wait 2 seconds and retry once
    await new Promise(resolve => setTimeout(resolve, 2000))
    const retry = await fetch(url, { ...options, headers })
    if (!retry.ok) {
      const text = await retry.text().catch(() => '')
      throw new Error(`Asana ${retry.status} (after retry): ${text}`)
    }
    return retry.json()
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Asana ${res.status}: ${text}`)
  }

  return res.json()
}

async function getAsanaWorkspaceTeams() {
  const data = await asanaFetch(`/workspaces/${ASANA_WORKSPACE_GID}/teams`)
  return data.data || []
}

async function findAsanaUserByName(searchName) {
  if (!searchName) return null

  // Get all workspace users
  const data = await asanaFetch(`/workspaces/${ASANA_WORKSPACE_GID}/users?opt_fields=gid,name,email`)
  const users = data.data || []

  // Normalize search name for comparison
  const normalized = searchName.toLowerCase().trim()

  // Try exact match first
  let match = users.find(u => u.name.toLowerCase() === normalized)
  if (match) return match

  // Try partial match (first name or last name)
  match = users.find(u => {
    const nameParts = u.name.toLowerCase().split(' ')
    return nameParts.some(part => part === normalized)
  })
  if (match) return match

  // No match
  return null
}

async function instantiateProjectTemplate(templateGid, projectName, teamGid) {
  const data = await asanaFetch(`/project_templates/${templateGid}/instantiateProject`, {
    method: 'POST',
    body: JSON.stringify({
      name: projectName,
      public: false,
      team: teamGid,
      is_strict: false,
    }),
  })

  return data.data || null
}

async function addProjectMember(projectGid, userGid) {
  await asanaFetch(`/projects/${projectGid}/addMembers`, {
    method: 'POST',
    body: JSON.stringify({
      members: [userGid],
    }),
  })
}

async function createTaskInProject(projectGid, taskName, assigneeGid, notes) {
  const data = await asanaFetch(`/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      data: {
        name: taskName,
        notes: notes || '',
        projects: [projectGid],
        assignee: assigneeGid,
      },
    }),
  })

  return data.data || null
}

export async function POST(req, { params }) {
  const auth = await requireApiUser(['ga', 'cx', 'admin', 'superadmin'])
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
        error: 'No Growth Advisor assigned to this client. Cannot create Asana workflow.' 
      }, { status: 400 })
    }

    // Find the GA's Asana user
    const asanaUser = await findAsanaUserByName(assignedGA)
    if (!asanaUser) {
      return NextResponse.json({ 
        error: `Could not find Asana user for Growth Advisor "${assignedGA}". Please verify the name matches Asana.` 
      }, { status: 404 })
    }

    // Get workspace teams (we need one for the project)
    const teams = await getAsanaWorkspaceTeams()
    if (teams.length === 0) {
      throw new Error('No teams found in Asana workspace')
    }

    // Use the first team (or you could make this configurable)
    const teamGid = teams[0].gid

    // Get template GID from env or use fallback
    const templateGid = process.env.ASANA_NEW_LOCATION_TEMPLATE_GID || DEFAULT_TEMPLATE_GID

    // Instantiate the project template
    const projectName = `New Location — ${clientName} — ${locationName.trim()}`
    const newProject = await instantiateProjectTemplate(templateGid, projectName, teamGid)

    if (!newProject?.gid) {
      throw new Error('Failed to create Asana project from template')
    }

    // Add the GA as a project member
    await addProjectMember(newProject.gid, asanaUser.gid)

    // Create an action-required task for the GA
    const taskName = `[ACTION REQUIRED] Fill out New Location details for ${locationName.trim()}`
    const taskNotes = `A new location has been added to the GYC Dashboard for ${clientName} — ${locationName.trim()}.

Please fill out this project with all relevant details so that Billing, Web, Paid Media, and SEO teams can be notified and updated.

Location Details:
- Location Name: ${locationName.trim()}
${gbpUrl ? `- GBP URL: ${gbpUrl}` : ''}
${locationId ? `- Dashboard Location ID: ${locationId}` : ''}

Next Steps:
1. Complete the project fields with client info
2. Notify relevant teams via project tasks
3. Update the Dashboard with any additional location data`

    await createTaskInProject(newProject.gid, taskName, asanaUser.gid, taskNotes)

    // Build the Asana project URL
    const projectUrl = `https://app.asana.com/0/${newProject.gid}/list`

    return NextResponse.json({
      success: true,
      projectUrl,
      projectGid: newProject.gid,
      projectName,
      assignedTo: asanaUser.name,
      message: 'New Location workflow created successfully',
    })
  } catch (error) {
    console.error('[POST /api/clients/[acronym]/gbp/locations/new-location-workflow]', error)
    
    // Return a softer error — still save the location even if Asana fails
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to create Asana workflow',
      warning: 'Location was saved, but Asana project could not be created. Please create the project manually.',
    }, { status: 500 })
  }
}

import { prisma } from '@/lib/db'

export const RECON_STATUSES = ['draft', 'pending-review', 'validated', 'rejected']
export const GBP_CLAIMED_VALUES = ['yes', 'no', 'unknown']
export const GBP_STATUS_VALUES = ['verified', 'manually-entered', 'not-claimed', 'not-found', 'skip']

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function normalizeDraftStatus(value, fallback = 'draft') {
  const normalized = String(value || '').trim().toLowerCase()
  return RECON_STATUSES.includes(normalized) ? normalized : fallback
}

export function normalizeGbpClaimed(value, fallback = 'unknown') {
  const normalized = String(value || '').trim().toLowerCase()
  return GBP_CLAIMED_VALUES.includes(normalized) ? normalized : fallback
}

export function normalizeGbpStatus(value, fallback = 'not-found') {
  const normalized = String(value || '').trim().toLowerCase()
  return GBP_STATUS_VALUES.includes(normalized) ? normalized : fallback
}

export function pickManualLocationFields(input = {}) {
  return {
    locationName: String(input.locationName || '').trim(),
    address: String(input.address || '').trim() || null,
    city: String(input.city || '').trim() || null,
    state: String(input.state || '').trim() || null,
    googleMapsUrl: String(input.googleMapsUrl || '').trim() || null,
    reviewNotes: String(input.reviewNotes || '').trim() || null,
    gbpClaimed: normalizeGbpClaimed(input.gbpClaimed),
    gbpStatus: normalizeGbpStatus(input.gbpStatus, 'manually-entered'),
    manualData: safeObject(input.manualData),
  }
}

export function deriveLocationsFromAutoData(autoData) {
  const source = safeObject(autoData)
  const rawLocations = Array.isArray(source.locations)
    ? source.locations
    : Array.isArray(source.gbpLocations)
      ? source.gbpLocations
      : Array.isArray(source.results)
        ? source.results
        : []

  return rawLocations
    .map((location, index) => {
      const item = safeObject(location)
      const locationName = String(item.locationName || item.name || item.title || '').trim()
      if (!locationName) return null
      return {
        locationName,
        address: String(item.address || item.addressLine1 || '').trim() || null,
        city: String(item.city || '').trim() || null,
        state: String(item.state || item.region || '').trim() || null,
        googleMapsUrl: String(item.googleMapsUrl || item.mapsUrl || item.url || '').trim() || null,
        gbpClaimed: normalizeGbpClaimed(item.gbpClaimed),
        gbpStatus: normalizeGbpStatus(item.gbpStatus, 'not-found'),
        reviewNotes: null,
        autoData: item,
        manualData: null,
        locationIndex: index,
      }
    })
    .filter(Boolean)
}

export function serializeReconLocation(location) {
  return {
    id: location.id,
    reconDraftId: location.reconDraftId,
    locationName: location.locationName,
    address: location.address,
    city: location.city,
    state: location.state,
    googleMapsUrl: location.googleMapsUrl,
    gbpClaimed: location.gbpClaimed,
    gbpStatus: location.gbpStatus,
    reviewNotes: location.reviewNotes,
    autoData: location.autoData,
    manualData: location.manualData,
    locationIndex: location.locationIndex,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  }
}

export function serializeReconDraft(draft) {
  const locations = Array.isArray(draft.ReconLocation) ? draft.ReconLocation.map(serializeReconLocation) : []
  const verifiedCount = locations.filter((location) => location.gbpStatus === 'verified').length
  return {
    id: draft.id,
    prospectName: draft.prospectName,
    websiteUrl: draft.websiteUrl,
    requestedBy: draft.requestedBy,
    status: draft.status,
    rawAutoData: draft.rawAutoData,
    validatedData: draft.validatedData,
    reviewedBy: draft.reviewedBy,
    reviewedAt: draft.reviewedAt,
    notes: draft.notes,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    locations,
    locationCount: locations.length,
    verifiedCount,
  }
}

export async function getReconDraftWithLocations(id) {
  return prisma.reconDraft.findUnique({
    where: { id },
    include: {
      ReconLocation: {
        orderBy: [{ locationIndex: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
}

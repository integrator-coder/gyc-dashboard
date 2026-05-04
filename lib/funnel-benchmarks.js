/**
 * GYC Funnel Benchmarks
 * Hardcoded industry benchmarks for childcare center funnels.
 */

export const FUNNEL_BENCHMARKS = {
  leadToTour: 50,       // 50% — leads that should tour
  tourToReg: 50,        // 50% — tours that should register
  overallConversion: 25 // 25% — overall lead-to-registration floor
}

/**
 * Compute benchmark-aware funnel status for a client.
 *
 * @param {number|null} leadToTour   - Lead-to-tour rate as a percentage (0–100)
 * @param {number|null} tourToReg    - Tour-to-registration rate as a percentage (0–100)
 * @returns {object} Full funnel status object
 */
export function funnelStatus(leadToTour, tourToReg) {
  const ltt = leadToTour != null ? Number(leadToTour) : null
  const ttr = tourToReg  != null ? Number(tourToReg)  : null

  // Overall conversion: (LTT * TTR) / 100
  const overall = ltt != null && ttr != null ? (ltt * ttr) / 100 : null

  // Gap calculations (positive = below benchmark, negative = above)
  const lttGap     = ltt     != null ? FUNNEL_BENCHMARKS.leadToTour      - ltt     : null
  const ttrGap     = ttr     != null ? FUNNEL_BENCHMARKS.tourToReg        - ttr     : null
  const overallGap = overall != null ? FUNNEL_BENCHMARKS.overallConversion - overall : null

  // Status helper: critical < 50% of benchmark, warning < benchmark, above >= benchmark
  function computeStatus(value, benchmark) {
    if (value == null) return 'above'
    if (value >= benchmark) return 'above'
    if (value >= benchmark * 0.5) return 'warning'
    return 'critical'
  }

  const lttStatus     = computeStatus(ltt,     FUNNEL_BENCHMARKS.leadToTour)
  const ttrStatus     = computeStatus(ttr,     FUNNEL_BENCHMARKS.tourToReg)
  const overallStatus = computeStatus(overall, FUNNEL_BENCHMARKS.overallConversion)

  // Primary constraint
  const lttBelow = lttStatus !== 'above'
  const ttrBelow = ttrStatus !== 'above'

  let primaryConstraint
  if (lttBelow && ttrBelow) {
    primaryConstraint = 'both'
  } else if (lttBelow && !ttrBelow) {
    primaryConstraint = 'lead-to-tour'
  } else if (!lttBelow && ttrBelow) {
    primaryConstraint = 'tour-to-reg'
  } else {
    primaryConstraint = 'none'
  }

  // Next steps
  const nextSteps = []

  if (primaryConstraint === 'none') {
    nextSteps.push('All funnel metrics are above benchmark — strong performance across the board')
  } else {
    if (primaryConstraint === 'both') {
      nextSteps.push('Both touring rate and close rate need attention — prioritize speed to lead first')
    }

    if (lttBelow) {
      nextSteps.push('Check speed to lead — response within 5 minutes dramatically increases tour bookings')
      nextSteps.push('Review follow-up volume — most leads need 5–8 touches before they book a tour')
      nextSteps.push('Add human touch points — personal phone calls convert at a significantly higher rate than automated messages')
      nextSteps.push('Review booking friction — is online booking available? Can parents book outside business hours?')
      if (lttStatus === 'critical') {
        nextSteps.push('Consider lead quality — are your campaigns targeting high-intent search terms?')
      }
    }

    if (ttrBelow) {
      nextSteps.push('Review tour process — close rate is below benchmark; consider a tour script or checklist')
      nextSteps.push('Add a follow-up sequence after tours — many families need a nudge to commit')
      nextSteps.push('Capture objections — ask families what\'s holding them back and address it directly')
    }
  }

  return {
    leadToTour: ltt,
    tourToReg: ttr,
    overallConversion: overall,
    leadToTourGap: lttGap,
    tourToRegGap: ttrGap,
    overallConversionGap: overallGap,
    leadToTourStatus: lttStatus,
    tourToRegStatus: ttrStatus,
    overallStatus,
    primaryConstraint,
    nextSteps,
  }
}

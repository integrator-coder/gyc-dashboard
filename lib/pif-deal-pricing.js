function parseMoney(value) {
  if (!value) return 0
  const cleaned = String(value).replace(/[$,\/]/g, '').replace(/[^0-9.]/g, '')
  return parseFloat(cleaned) || 0
}

function derivePifDealPricing(tokenMap, stripeMrr = 0) {
  const standardMonthly = parseMoney(tokenMap['Core - Standard Monthly Rate'])
    || parseMoney(tokenMap['Growth - Standard Monthly Rate'])
  const returnMonthly = parseMoney(tokenMap['Core - Month 7 on payment'])
    || parseMoney(tokenMap['Growth - Month 7 on payment'])
  const pifAmount = parseMoney(tokenMap['Core - PIF'])
    || parseMoney(tokenMap['Growth - PIF'])
  const pif = pifAmount > 0

  // Stripe describes the client's current book, not necessarily this deal.
  // It is a safe fallback for ordinary monthly deals only. A PIF return must
  // come from the agreement's explicit post-term payment token.
  const mrr = pif ? returnMonthly : (standardMonthly || Number(stripeMrr || 0))

  return { pif, pifAmount, mrr, renewalAmount: mrr }
}

module.exports = { parseMoney, derivePifDealPricing }

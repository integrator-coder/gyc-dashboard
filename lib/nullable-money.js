function nullableNumber(value) {
  return value === null || value === undefined ? null : Number(value)
}

function summarizeNullableMoney(rows, key) {
  let verifiedTotal = 0
  let pendingCount = 0
  for (const row of rows) {
    const value = nullableNumber(row[key])
    if (value === null) pendingCount += 1
    else verifiedTotal += value
  }
  return { verifiedTotal, pendingCount }
}

module.exports = { nullableNumber, summarizeNullableMoney }

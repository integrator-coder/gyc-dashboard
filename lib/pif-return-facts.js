function nullableAmount(value) {
  return value === null || value === undefined || value === '' ? null : Number(value)
}

function pifReturnFact(row) {
  return {
    pausedMrr: Number(row.mrrMoved || 0),
    returningMrr: nullableAmount(row.returningMrr ?? row.mrrReturnAmount),
    pifCash: nullableAmount(row.pifCashReceived),
    returningProgram: row.returningProgram || null,
  }
}

function summarizePifReturns(rows) {
  return rows.reduce((out, row) => {
    const fact = pifReturnFact(row)
    out.pausedMrr += fact.pausedMrr
    if (fact.returningMrr == null) out.pendingReturnMrr += 1
    else out.returningMrr += fact.returningMrr
    return out
  }, { pausedMrr: 0, returningMrr: 0, pendingReturnMrr: 0 })
}

module.exports = { nullableAmount, pifReturnFact, summarizePifReturns }

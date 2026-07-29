async function fetchConfirmedPifReturns(db) {
  const { rows } = await db.query(`
    SELECT movement."canceledSubscriptionId", movement."stripeCustomerId", movement."clientName",
           movement."movementDate", movement."mrrMoved", movement."pifCashReceived",
           movement."termMonths", movement."scheduledReturnDate", movement.status,
           deal."renewalAmount" AS "returningMrr", deal.service AS "returningProgram"
    FROM "ChurnLateralMovement" movement
    LEFT JOIN "ClientStripeLink" stripe_link ON stripe_link."stripeCustomerId"=movement."stripeCustomerId"
    LEFT JOIN "ClientProfile" profile ON profile.id=stripe_link."clientProfileId"
    LEFT JOIN LATERAL (
      SELECT sales_deal."renewalAmount", sales_deal.service
      FROM "SalesDeal" sales_deal
      WHERE sales_deal."tenantId"=movement."tenantId"
        AND sales_deal."dealDate"=movement."movementDate"
        AND sales_deal."renewalAmount">0
        AND (sales_deal.pif=true OR sales_deal."pifOverride"=true)
        AND sales_deal."renewalAmount"<sales_deal."firstPayment"
        AND (
          regexp_replace(lower(sales_deal."clientName"),'[^a-z0-9]','','g')=regexp_replace(lower(movement."clientName"),'[^a-z0-9]','','g')
          OR regexp_replace(lower(sales_deal."clientName"),'[^a-z0-9]','','g')=regexp_replace(lower(COALESCE(profile."companyName",'')),'[^a-z0-9]','','g')
          OR regexp_replace(lower(sales_deal."clientName"),'[^a-z0-9]','','g')=regexp_replace(lower(COALESCE(profile.acronym,'')),'[^a-z0-9]','','g')
          OR rtrim(regexp_replace(lower(sales_deal."clientName"),'[^a-z0-9]','','g'),'s')=rtrim(regexp_replace(lower(movement."clientName"),'[^a-z0-9]','','g'),'s')
        )
      ORDER BY (regexp_replace(lower(sales_deal."clientName"),'[^a-z0-9]','','g')=regexp_replace(lower(movement."clientName"),'[^a-z0-9]','','g')) DESC, sales_deal.id DESC
      LIMIT 1
    ) deal ON TRUE
    WHERE movement."tenantId"='gyc' AND movement.status='confirmed'
    ORDER BY movement."movementDate" DESC
  `)
  return rows
}

module.exports = { fetchConfirmedPifReturns }

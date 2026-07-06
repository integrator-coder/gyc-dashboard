const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding ACL test data...')

  // Get a few real clients from the database
  const clients = await prisma.clientProfile.findMany({
    take: 4,
    where: { status: 'active' },
  })

  if (clients.length === 0) {
    console.log('No active clients found to create test data')
    return
  }

  // Create a sync log
  const syncLog = await prisma.aclSyncLog.create({
    data: {
      clientsChecked: 142,
      discrepanciesFound: 4,
      syncType: 'monthly',
      status: 'completed',
    },
  })

  console.log(`Created sync log: ${syncLog.id}`)

  // Create test discrepancies using real client data
  const discrepancies = [
    {
      clientId: String(clients[0]?.id || ''),
      clientName: clients[0]?.companyName || 'Test Client 1',
      acronym: clients[0]?.acronym || 'TC1',
      changeType: 'cancellation',
      dbValue: 'active',
      stripeValue: 'cancelled',
      mrrImpact: -2500.0,
      status: 'pending',
      syncRunAt: new Date(),
    },
    {
      clientId: clients[1] ? String(clients[1].id) : null,
      clientName: clients[1]?.companyName || 'Test Client 2',
      acronym: clients[1]?.acronym || 'TC2',
      changeType: 'mrr_mismatch',
      dbValue: '$3,500',
      stripeValue: '$4,200',
      mrrImpact: 700.0,
      status: 'pending',
      syncRunAt: new Date(),
    },
    {
      clientId: clients[2] ? String(clients[2].id) : null,
      clientName: clients[2]?.companyName || 'Test Client 3',
      acronym: clients[2]?.acronym || 'TC3',
      changeType: 'status_change',
      dbValue: 'active',
      stripeValue: 'paused',
      mrrImpact: null,
      status: 'pending',
      syncRunAt: new Date(),
    },
    {
      clientId: clients[3] ? String(clients[3].id) : null,
      clientName: clients[3]?.companyName || 'Test Client 4',
      acronym: clients[3]?.acronym || 'TC4',
      changeType: 'evergreen_transition',
      dbValue: '$5,000 (12-month)',
      stripeValue: '$5,500 (evergreen)',
      mrrImpact: 500.0,
      status: 'pending',
      syncRunAt: new Date(),
    },
  ]

  for (const disc of discrepancies) {
    const created = await prisma.aclDiscrepancy.create({ data: disc })
    console.log(`Created discrepancy: ${created.clientName} (${created.changeType})`)
  }

  console.log('Test data seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

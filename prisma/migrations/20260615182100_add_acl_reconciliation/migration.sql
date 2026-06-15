-- CreateTable
CREATE TABLE "AclDiscrepancy" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "acronym" TEXT,
    "changeType" TEXT NOT NULL,
    "dbValue" TEXT NOT NULL,
    "stripeValue" TEXT NOT NULL,
    "mrrImpact" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dismissNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "syncRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AclDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AclSyncLog" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientsChecked" INTEGER NOT NULL,
    "discrepanciesFound" INTEGER NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',

    CONSTRAINT "AclSyncLog_pkey" PRIMARY KEY ("id")
);

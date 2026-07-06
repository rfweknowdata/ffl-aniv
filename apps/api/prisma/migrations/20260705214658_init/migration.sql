-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "internalId" TEXT NOT NULL,
    "profaneName" TEXT NOT NULL,
    "mysticName" TEXT,
    "birthDate" TEXT,
    "birthMonth" INTEGER,
    "birthDay" INTEGER,
    "nif" TEXT,
    "phoneNumber" TEXT,
    "email" TEXT,
    "memberNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SendLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" DATETIME,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SendLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
    "smtpUser" TEXT,
    "smtpPassword" TEXT,
    "fromName" TEXT NOT NULL DEFAULT 'Fraternidade Fiat Lux',
    "fromEmail" TEXT,
    "replyTo" TEXT,
    "sendHour" INTEGER NOT NULL DEFAULT 8,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_internalId_key" ON "Member"("internalId");

-- CreateIndex
CREATE INDEX "Member_birthMonth_birthDay_idx" ON "Member"("birthMonth", "birthDay");

-- CreateIndex
CREATE INDEX "SendLog_year_status_idx" ON "SendLog"("year", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SendLog_memberId_year_key" ON "SendLog"("memberId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateEnum
CREATE TYPE "AlertRuleType" AS ENUM ('keywords', 'category');

-- CreateTable
CREATE TABLE "alert_rule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AlertRuleType" NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_rule_userId_idx" ON "alert_rule"("userId");

-- AddForeignKey
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

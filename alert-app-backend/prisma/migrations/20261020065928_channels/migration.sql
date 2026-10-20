-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('email');

-- CreateTable
CREATE TABLE "channel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastTestSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rule_channel" (
    "alertRuleId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,

    CONSTRAINT "alert_rule_channel_pkey" PRIMARY KEY ("alertRuleId","channelId")
);

-- CreateIndex
CREATE INDEX "channel_userId_idx" ON "channel"("userId");

-- CreateIndex
CREATE INDEX "alert_rule_channel_channelId_idx" ON "alert_rule_channel"("channelId");

-- AddForeignKey
ALTER TABLE "channel" ADD CONSTRAINT "channel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule_channel" ADD CONSTRAINT "alert_rule_channel_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "alert_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rule_channel" ADD CONSTRAINT "alert_rule_channel_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data (written by hand): existing users and rules get their email channel.
-- New users get theirs from a Better Auth hook after sign-up (create-auth.ts).
-- Ids are uuid v4 (gen_random_uuid): Postgres 17 can't make v7, and these rows
-- only need to be unique.
-- ---------------------------------------------------------------------------

-- One email channel for every existing user
INSERT INTO "channel" ("id", "userId", "type", "config", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", 'email', '{}', now(), now()
FROM "user";

-- Every existing rule sends to its owner's email channel
INSERT INTO "alert_rule_channel" ("alertRuleId", "channelId")
SELECT r."id", c."id"
FROM "alert_rule" r
JOIN "channel" c ON c."userId" = r."userId" AND c."type" = 'email';

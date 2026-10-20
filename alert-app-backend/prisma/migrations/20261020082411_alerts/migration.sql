-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "article" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sourceName" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "categories" TEXT[],
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_article" (
    "notificationId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,

    CONSTRAINT "notification_article_pkey" PRIMARY KEY ("notificationId","articleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_url_key" ON "article"("url");

-- CreateIndex
CREATE UNIQUE INDEX "article_sourceId_externalId_key" ON "article"("sourceId", "externalId");

-- CreateIndex
CREATE INDEX "notification_alertRuleId_sentAt_idx" ON "notification"("alertRuleId", "sentAt");

-- CreateIndex
CREATE INDEX "notification_channelId_idx" ON "notification"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_batchId_alertRuleId_channelId_key" ON "notification"("batchId", "alertRuleId", "channelId");

-- CreateIndex
CREATE INDEX "notification_article_articleId_idx" ON "notification_article"("articleId");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "alert_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_article" ADD CONSTRAINT "notification_article_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_article" ADD CONSTRAINT "notification_article_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

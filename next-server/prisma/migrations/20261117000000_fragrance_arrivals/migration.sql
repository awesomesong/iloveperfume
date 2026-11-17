-- 신제품 수집 파이프라인(/api/cron/perfume-arrivals)용 컬럼·테이블 추가.
-- 기존 행은 source = 'USER', officialUrl = NULL로 유지된다 (데이터 삭제·변경 없음).

-- CreateEnum
CREATE TYPE "FragranceSource" AS ENUM ('USER', 'AI_AGENT');

-- AlterTable
ALTER TABLE "Fragrance" ADD COLUMN     "officialUrl" TEXT,
ADD COLUMN     "source" "FragranceSource" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "FragranceBlockedUrl" (
    "id" TEXT NOT NULL,
    "officialUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FragranceBlockedUrl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FragranceBlockedUrl_officialUrl_key" ON "FragranceBlockedUrl"("officialUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Fragrance_officialUrl_key" ON "Fragrance"("officialUrl");

-- CreateIndex
CREATE INDEX "Fragrance_source_createdAt_idx" ON "Fragrance"("source", "createdAt" DESC);


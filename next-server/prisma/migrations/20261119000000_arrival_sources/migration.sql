-- 신제품 수집 대상을 코드의 고정 목록에서 DB 등록부로 옮긴다 (새 테이블만 추가 — 기존 데이터 삭제·변경 없음).
-- ArrivalBrandLead: 후보 브랜드(판매처 입점·회원 등록) → ArrivalSource: 공식 사이트와 판정 결과 → ArrivalSeenUrl: 수집하면서 본 상품·기사 주소

-- CreateEnum
CREATE TYPE "ArrivalSourceKind" AS ENUM ('SHOPIFY', 'SITEMAP');

-- CreateEnum
CREATE TYPE "ArrivalSourceStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ArrivalLeadStatus" AS ENUM ('PENDING', 'RESOLVED', 'UNRESOLVED');

-- CreateTable
CREATE TABLE "ArrivalSource" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "brandKey" TEXT NOT NULL,
    "aliases" TEXT[],
    "host" TEXT NOT NULL,
    "kind" "ArrivalSourceKind",
    "status" "ArrivalSourceStatus" NOT NULL DEFAULT 'INACTIVE',
    "rank" INTEGER NOT NULL DEFAULT 2,
    "koreaBasis" TEXT NOT NULL,
    "reason" TEXT,
    "nextProbeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "baselineAt" TIMESTAMP(3),
    "lastCollectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArrivalSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArrivalSeenUrl" (
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "perfume" BOOLEAN,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "article" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ArrivalSeenUrl_pkey" PRIMARY KEY ("sourceId","url")
);

-- CreateTable
CREATE TABLE "ArrivalBrandLead" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "examples" TEXT[],
    "status" "ArrivalLeadStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArrivalBrandLead_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArrivalSource_host_key" ON "ArrivalSource"("host");

-- CreateIndex
CREATE INDEX "ArrivalSource_status_lastCollectedAt_idx" ON "ArrivalSource"("status", "lastCollectedAt");

-- CreateIndex
CREATE INDEX "ArrivalSource_nextProbeAt_idx" ON "ArrivalSource"("nextProbeAt");

-- CreateIndex
CREATE INDEX "ArrivalSource_brandKey_idx" ON "ArrivalSource"("brandKey");

-- CreateIndex
CREATE INDEX "ArrivalBrandLead_status_attempts_createdAt_idx" ON "ArrivalBrandLead"("status", "attempts", "createdAt");

-- AddForeignKey
ALTER TABLE "ArrivalSeenUrl" ADD CONSTRAINT "ArrivalSeenUrl_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ArrivalSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 지금까지 코드에 적혀 있던 수집 대상 2곳을 그대로 옮긴다 (계속 수집되도록 ACTIVE)
INSERT INTO "ArrivalSource" ("id", "brand", "brandKey", "aliases", "host", "kind", "status", "rank", "koreaBasis", "reason", "updatedAt") VALUES
  ('seed_dsanddurga', 'D.S. & DURGA', 'dsdurga', ARRAY[]::TEXT[], 'dsanddurga.com', 'SHOPIFY', 'ACTIVE', 2, '신세계 센텀시티 입점(2024-12), 29CM 라이징 브랜드 기획전(2026-11)', '기존 수집 대상', CURRENT_TIMESTAMP),
  ('seed_juliettehasagun', 'JULIETTE HAS A GUN', 'juliettehasagun', ARRAY[]::TEXT[], 'www.juliettehasagun.com', 'SHOPIFY', 'ACTIVE', 2, '수입사 ㈜씨이오인터내셔널, 더현대 서울 팝업(2026-08)', '기존 수집 대상', CURRENT_TIMESTAMP)
ON CONFLICT ("host") DO NOTHING;

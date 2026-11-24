-- 기존 향수 채우기: 신제품 기간이 지난 향수도 등록한다 (컬럼만 추가 — 기존 데이터 삭제 없음).
-- Fragrance.firstSeenAt: "신제품" 표시 기준. ArrivalSource.backfilledAt: 그 사이트의 기존 향수를 다 채운 시각.

-- AlterTable
ALTER TABLE "Fragrance" ADD COLUMN "firstSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ArrivalSource" ADD COLUMN "backfilledAt" TIMESTAMP(3);

-- 지금까지 수집된 향수는 모두 신제품으로 들어왔다 — 수집한 날을 처음 등장한 날로 둔다
UPDATE "Fragrance" SET "firstSeenAt" = "createdAt" WHERE "source" = 'AI_AGENT';

-- 새 테이블은 서버(Prisma)만 읽고 쓴다 — 다른 테이블처럼 행 수준 보안을 켜서 Supabase 공개 API로는 접근하지 못하게 한다
ALTER TABLE "ArrivalSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArrivalSeenUrl" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArrivalBrandLead" ENABLE ROW LEVEL SECURITY;

-- 기존 향수 채우기: 신제품 기간이 지난 향수도 등록한다 (컬럼만 추가 — 기존 데이터 삭제 없음).
-- Fragrance.firstSeenAt: "신제품" 표시 기준. ArrivalSource.backfilledAt: 그 사이트의 기존 향수를 다 채운 시각.

-- AlterTable
ALTER TABLE "Fragrance" ADD COLUMN "firstSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ArrivalSource" ADD COLUMN "backfilledAt" TIMESTAMP(3);

-- 지금까지 수집된 향수는 모두 신제품으로 들어왔다 — 수집한 날을 처음 등장한 날로 둔다
UPDATE "Fragrance" SET "firstSeenAt" = "createdAt" WHERE "source" = 'AI_AGENT';

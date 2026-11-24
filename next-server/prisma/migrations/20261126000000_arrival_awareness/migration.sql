-- 국내 인지도(네이버 블로그 글 수) — 기준에 못 미치는 브랜드는 수집하지 않고, 높은 브랜드부터 채운다
ALTER TABLE "ArrivalSource" ADD COLUMN "awareness" INTEGER;
ALTER TABLE "ArrivalSource" ADD COLUMN "awarenessAt" TIMESTAMP(3);

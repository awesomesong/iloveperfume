-- Notice를 향수 뉴스 전용 테이블로 전환한다.
-- 주의: 기존 공지 글과 그 댓글을 모두 삭제한다 (되돌릴 수 없음).
--       새 필수 컬럼(summary, category, sourceUrl 등)은 기존 행이 있으면 추가할 수 없다.

-- 기존 데이터 삭제
DELETE FROM "Comment" WHERE "noticeId" IS NOT NULL;
DELETE FROM "Notice";

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('RELEASE', 'BRAND', 'TREND', 'INTERVIEW');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN');

-- DropForeignKey
ALTER TABLE "Notice" DROP CONSTRAINT IF EXISTS "Notice_authorEmail_fkey";

-- AlterTable
ALTER TABLE "Notice" DROP COLUMN "authorEmail",
DROP COLUMN "content",
ADD COLUMN     "summary" TEXT NOT NULL,
ADD COLUMN     "category" "NewsCategory" NOT NULL,
ADD COLUMN     "status" "NoticeStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "sourceUrl" TEXT NOT NULL,
ADD COLUMN     "sourceName" TEXT NOT NULL,
ADD COLUMN     "publishedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "image" SET DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Notice_sourceUrl_key" ON "Notice"("sourceUrl");

-- CreateIndex
CREATE INDEX "Notice_status_publishedAt_idx" ON "Notice"("status", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Notice_category_status_publishedAt_idx" ON "Notice"("category", "status", "publishedAt" DESC);

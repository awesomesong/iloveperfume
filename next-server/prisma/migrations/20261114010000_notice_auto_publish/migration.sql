-- 향수 뉴스 검수 단계 제거: 파이프라인이 저장한 글은 바로 공개한다.
-- NoticeStatus에서 DRAFT를 없애고 기본값을 PUBLISHED로 바꾼다.

-- 남아 있는 검수 대기 글은 공개로 전환
UPDATE "Notice" SET "status" = 'PUBLISHED' WHERE "status" = 'DRAFT';

-- AlterEnum (PostgreSQL은 enum 값 삭제를 지원하지 않아 타입을 새로 만든다)
ALTER TABLE "Notice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "NoticeStatus" RENAME TO "NoticeStatus_old";
CREATE TYPE "NoticeStatus" AS ENUM ('PUBLISHED', 'HIDDEN');
ALTER TABLE "Notice" ALTER COLUMN "status" TYPE "NoticeStatus" USING ("status"::text::"NoticeStatus");
ALTER TABLE "Notice" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';
DROP TYPE "NoticeStatus_old";

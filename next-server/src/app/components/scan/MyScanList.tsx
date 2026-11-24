import Image from 'next/image';
import Link from 'next/link';
import prisma from '@/prisma/db';
import { formatNewsTime } from '@/src/app/utils/formatNewsTime';

/** 한 번에 보여주는 최근 기록 수 */
const MAX_ITEMS = 100;

interface Props {
  userEmail: string;
}

/**
 * 프로필의 "내가 스캔한 향수" — 내가 찍었거나 가입하며 저장한 스캔을 최근 순으로 보여준다.
 * 정사각형 사진 격자, 누르면 그 스캔 결과로 간다. 스타일은 globals.css `.scan-history` (design-system 6-4).
 */
export default async function MyScanList({ userEmail }: Props) {
  const [scans, total] = await Promise.all([
    prisma.scanResult.findMany({
      where: { userEmail },
      orderBy: { createdAt: 'desc' },
      take: MAX_ITEMS,
      select: { id: true, brand: true, name: true, imageUrl: true, createdAt: true },
    }),
    prisma.scanResult.count({ where: { userEmail } }),
  ]);

  return (
    <section className="scan-history">
      <h3 className="text-sm font-bold tracking-[0.2em] text-[var(--color-text-secondary)]">
        내가 스캔한 향수 {total > 0 && <span className="font-normal tracking-normal">{total}</span>}
      </h3>

      {scans.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
          아직 스캔한 향수가 없어요.{' '}
          <Link href="/scan" className="underline underline-offset-4 text-fg-primary">
            향수 스캔하기
          </Link>
        </p>
      ) : (
        <>
          <ul className="scan-history__grid">
            {scans.map((scan) => (
              <li key={scan.id}>
                <Link href={`/scan/result/${scan.id}`} className="scan-history__link">
                  <div className="scan-history__thumb">
                    <Image
                      src={scan.imageUrl}
                      alt=""
                      fill
                      sizes="(max-width: 767px) 50vw, 240px"
                      className="object-cover"
                    />
                  </div>
                  <p className="scan-history__name">{scan.name}</p>
                  <p className="scan-history__meta">{scan.brand}</p>
                  <p className="scan-history__meta">{formatNewsTime(scan.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
          {total > scans.length && (
            <p className="mt-6 text-xs text-[var(--color-text-secondary)]">
              최근 {MAX_ITEMS}개까지 보여드려요.
            </p>
          )}
        </>
      )}
    </section>
  );
}

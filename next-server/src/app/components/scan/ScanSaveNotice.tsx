'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Button from '@/src/app/components/Button';
import InlineSpinner from '@/src/app/components/InlineSpinner';

/** none: 주인 없는 스캔(로그인 없이 찍음) · mine: 내 기록 · other: 다른 사람 기록 */
export type ScanOwnership = 'none' | 'mine' | 'other';

interface Props {
  scanId: string;
  ownership: ScanOwnership;
  isLoggedIn: boolean;
}

/** "가입하고 저장하기"를 누른 스캔 — 가입하고 돌아오면 다시 누르지 않아도 저장한다 */
const PENDING_KEY = 'ilp:pendingScanSave';

function readPending(): string | null {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}

function writePending(scanId: string | null) {
  try {
    if (scanId) sessionStorage.setItem(PENDING_KEY, scanId);
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // 저장소를 못 쓰는 브라우저 — 돌아와서 "저장하기"를 직접 누르면 된다
  }
}

const linkClassName = 'underline underline-offset-4 text-fg-primary';

/**
 * 스캔 결과를 내 스캔 기록에 남기는 한 줄 안내.
 * 로그인 없이 찍은 사람에게는 가입을 권하고, 로그인한 사람에게는 저장 버튼을 보여준다.
 */
export default function ScanSaveNotice({ scanId, ownership: initialOwnership, isLoggedIn }: Props) {
  const [ownership, setOwnership] = useState(initialOwnership);
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTried = useRef(false);

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/scan/save/${scanId}`, { method: 'POST' });
      const body: { message?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 그 사이 다른 사람이 저장했으면 안내 줄을 거둔다
        if (res.status === 409) setOwnership('other');
        toast.error(body.message ?? '스캔 결과를 저장하지 못했어요.');
        return;
      }
      setOwnership('mine');
      toast.success('내 스캔 기록에 저장했어요.');
    } catch {
      toast.error('스캔 결과를 저장하지 못했어요.');
    } finally {
      setIsSaving(false);
    }
  }, [scanId]);

  // 가입 전에 "가입하고 저장하기"를 눌렀던 스캔이면 돌아오자마자 저장한다
  useEffect(() => {
    if (autoSaveTried.current || !isLoggedIn) return;
    autoSaveTried.current = true;
    if (readPending() !== scanId) return;
    writePending(null);
    if (initialOwnership === 'none') void save();
  }, [isLoggedIn, scanId, initialOwnership, save]);

  if (ownership === 'other') return null;

  const callbackUrl = encodeURIComponent(`/scan/result/${scanId}`);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-xs text-secondary text-center break-keep">
      {ownership === 'mine' ? (
        <>
          <p>내 스캔 기록에 저장된 결과예요.</p>
          <Link href="/profile" className={linkClassName}>
            기록 보기
          </Link>
        </>
      ) : isLoggedIn ? (
        <>
          <p>이 결과를 내 스캔 기록에 남길 수 있어요.</p>
          <Button variant="ghostLavender" size="sm" disabled={isSaving} onClick={save}>
            {isSaving && <InlineSpinner className="size-3" />}
            저장하기
          </Button>
        </>
      ) : (
        <>
          <p>가입하면 이 결과를 언제든 다시 볼 수 있어요.</p>
          <Link
            href={`/auth/register?callbackUrl=${callbackUrl}`}
            className={linkClassName}
            onClick={() => writePending(scanId)}
          >
            가입하고 저장하기
          </Link>
        </>
      )}
    </div>
  );
}

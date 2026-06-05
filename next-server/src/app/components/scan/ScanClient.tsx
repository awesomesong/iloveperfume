'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineCamera, HiOutlinePhoto } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import PointsLoading from '@/src/app/components/PointsLoading';
import CameraCapture from './CameraCapture';
import ScanPreview from './ScanPreview';

type Stage = 'idle' | 'camera' | 'previewing' | 'analyzing';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function ScanClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // ?camera=true — 뒤로가기 / "다른 향수 스캔하기" 진입 시 카메라 자동 시작
  const [autoStartCamera, setAutoStartCamera] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('camera') === 'true') {
      setAutoStartCamera(true);
      setStage('camera');
    }
  }, []);

  useEffect(() => {
    return () => { if (capturedUrl) URL.revokeObjectURL(capturedUrl); };
  }, [capturedUrl]);

  const setImage = useCallback(
    (blob: Blob) => {
      if (capturedUrl) URL.revokeObjectURL(capturedUrl);
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setStage('previewing');
    },
    [capturedUrl],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 업로드할 수 있어요.'); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error('이미지는 10MB 이하 크기로 올려 주세요.'); return; }
    setImage(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('이미지 파일만 업로드할 수 있어요.'); return; }
    if (file.size > MAX_FILE_SIZE) { toast.error('이미지는 10MB 이하 크기로 올려 주세요.'); return; }
    setImage(file);
  };

  const resetAll = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setStage('idle');
  };

  const handleAnalyze = async () => {
    if (!capturedBlob) return;
    setStage('analyzing');
    try {
      const formData = new FormData();
      formData.append('file', capturedBlob, 'scan.png');
      const res = await fetch('/api/scan/analyze', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message ?? '분석에 실패했어요. 잠시 후 다시 시도해 주세요.');
        setStage('previewing');
        return;
      }
      if (!data.isFragrance || !data.brand || !data.name) {
        toast.error(data.message ?? '향수를 인식하지 못했어요.');
        setStage('previewing');
        return;
      }

      router.replace('/scan?camera=true');
      router.push(`/scan/result/${data.scanId}`);
    } catch {
      toast.error('네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      setStage('previewing');
    }
  };

  /* ── 분석 중 ── */
  if (stage === 'analyzing') {
    return <PointsLoading loadingMessage="AI가 향수를 분석하고 있어요 (약 10~15초)" />;
  }

  /* ── 미리보기 ── */
  if (stage === 'previewing' && capturedUrl) {
    return (
      <section className="mt-6 md:mt-10">
        <ScanPreview imageUrl={capturedUrl} onRetake={resetAll} onAnalyze={handleAnalyze} />
      </section>
    );
  }

  /* ── 카메라 활성 ── */
  if (stage === 'camera') {
    return (
      <section className="mt-6 md:mt-10 max-w-2xl mx-auto w-full">
        <CameraCapture
          onCapture={setImage}
          autoStart={autoStartCamera}
          onActiveChange={(active) => { if (!active && stage === 'camera') setStage('idle'); }}
        />
      </section>
    );
  }

  /* ── 대기 (idle) ── */
  return (
    <section className="mt-6 md:mt-10">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 모바일: 세로 / 데스크톱: 카메라(좌) + 파일(우) 나란히 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">

        {/* 카메라 — 주 CTA */}
        <button
          type="button"
          onClick={() => setStage('camera')}
          className="group flex flex-col items-center justify-center gap-6 rounded-2xl px-8 py-14 cursor-pointer transition-all duration-300 hover:opacity-90 active:scale-[0.98]"
          style={{
            background: 'var(--color-accent-pale)',
            border: '1px solid var(--color-accent-border)',
            boxShadow: '0 2px 12px var(--color-shadow-soft)',
          }}
        >
          <div
            className="size-20 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-accent-border)' }}
          >
            <HiOutlineCamera className="size-10" style={{ color: 'var(--color-accent)' }} aria-hidden />
          </div>
          <div className="text-center">
            <p className="text-base font-bold tracking-tight text-fg-primary">카메라로 스캔하기</p>
            <p className="text-[13px] mt-2 leading-relaxed text-secondary">
              향수병에 카메라를 가까이 대면<br />AI가 바로 인식해드려요
            </p>
          </div>
        </button>

        {/* 파일 업로드 — 보조 CTA (드래그앤드롭) */}
        <div
          role="button"
          tabIndex={0}
          aria-label="향수 사진 파일 업로드"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
          }}
          className={[
            'flex flex-col items-center justify-center gap-6 rounded-2xl border-2 border-dashed px-8 py-14 cursor-pointer transition-all duration-200',
            isDragging
              ? 'border-accent bg-[var(--color-accent-pale)]'
              : 'border-default hover:border-accent/50 hover:bg-[var(--color-accent-pale)]/40',
          ].join(' ')}
        >
          <div
            className="size-20 rounded-full flex items-center justify-center"
            style={{ background: 'var(--color-accent-pale)', border: '1px solid var(--color-accent-border)' }}
          >
            <HiOutlinePhoto className="size-10" style={{ color: 'var(--color-accent)' }} aria-hidden />
          </div>
          <div className="text-center">
            <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {isDragging ? '여기에 놓아주세요' : '사진 파일 올리기'}
            </p>
            <p className="text-[13px] text-secondary mt-2 leading-relaxed">
              드래그하거나 클릭해서 선택<br />JPG · PNG · WEBP · 최대 10MB
            </p>
          </div>
        </div>
      </div>

      {/* 하단 안내 */}
      <p className="text-[11px] text-secondary text-center mt-6 leading-relaxed">
        촬영 사진은 분석 후 안전하게 보관돼요. 본인이 직접 촬영한 사진만 올려 주세요.
      </p>
    </section>
  );
}

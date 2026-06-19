'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  HiOutlinePhoto,
  HiOutlineCamera,
  HiOutlineMagnifyingGlass,
  HiOutlineArrowPath,
  HiOutlineXMark,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import Button from '@/src/app/components/Button';
import PointsLoading from '@/src/app/components/PointsLoading';

type Stage = 'idle' | 'camera-starting' | 'camera-active' | 'previewing' | 'analyzing';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validateFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return '이미지 파일만 업로드할 수 있어요.';
  if (file.size > MAX_FILE_SIZE) return '이미지는 10MB 이하 크기로 올려 주세요.';
  return null;
}

/* 뷰파인더 코너 마커 — 카메라 대기 상태임을 시각적으로 표현 */
function ViewfinderCorners() {
  return (
    <>
      <span aria-hidden className="absolute top-3.5 left-3.5 size-4 border-t border-l border-white/25 rounded-tl-sm" />
      <span aria-hidden className="absolute top-3.5 right-3.5 size-4 border-t border-r border-white/25 rounded-tr-sm" />
      <span aria-hidden className="absolute bottom-3.5 left-3.5 size-4 border-b border-l border-white/25 rounded-bl-sm" />
      <span aria-hidden className="absolute bottom-3.5 right-3.5 size-4 border-b border-r border-white/25 rounded-br-sm" />
    </>
  );
}

interface Props {
  /** 분석 성공 시 호출 — 미제공 시 /scan/result/${scanId}로 바로 이동 */
  onSuccess?: (scanId: string) => void;
}

export default function HomeImageUpload({ onSuccess }: Props = {}) {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<Stage>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageSource, setImageSource] = useState<'camera' | 'file'>('file');

  /* ── 카메라 ── */
  const startCamera = useCallback(async () => {
    setStage('camera-starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('이 브라우저는 카메라를 지원하지 않아요.');
        setStage('idle');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setStage('camera-active');
    } catch (e) {
      const err = e as { name?: string };
      if (err.name === 'NotAllowedError') {
        toast.error('카메라 권한이 거부됐어요. 브라우저 설정에서 허용 후 다시 시도해 주세요.', { duration: 5000 });
      } else if (err.name === 'NotFoundError') {
        toast.error('연결된 카메라를 찾을 수 없어요.');
      } else {
        toast.error('카메라를 시작할 수 없어요.');
      }
      setStage('idle');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (stage !== 'camera-active') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => toast.error('카메라 화면을 불러오지 못했어요.'));
  }, [stage]);

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) { toast.error('카메라가 아직 준비되지 않았어요.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob((b) => {
      if (!b) { toast.error('사진을 저장하지 못했어요.'); return; }
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(b));
      setBlob(b);
      setImageSource('camera');
      setStage('previewing');
    }, 'image/png', 0.95);
  };

  const cancelCamera = () => { stopCamera(); setStage('idle'); };

  /* ── 파일 ── */
  const handleFile = useCallback((file: File) => {
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setBlob(file);
    setImageSource('file');
    setStage('previewing');
  }, [previewUrl]);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null); setBlob(null); setStage('idle');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  /* ── 분석 ── */
  const handleAnalyze = async () => {
    if (!blob) return;
    setStage('analyzing');
    try {
      const formData = new FormData();
      formData.append('file', blob, 'scan.png');
      const res = await fetch('/api/scan/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message ?? '분석에 실패했어요.'); setStage('previewing'); return; }
      if (!data.isFragrance || !data.brand || !data.name) { toast.error(data.message ?? '향수를 인식하지 못했어요.'); setStage('previewing'); return; }
      if (onSuccess) {
        onSuccess(data.scanId);
      } else {
        router.push(`/scan/result/${data.scanId}`);
      }
    } catch {
      toast.error('네트워크 오류가 발생했어요.');
      setStage('previewing');
    }
  };

  if (stage === 'analyzing') {
    return <PointsLoading loadingMessage="AI가 향수를 분석하고 있어요 (약 10~15초)" />;
  }

  const isCameraMode = stage === 'camera-starting' || stage === 'camera-active';

  return (
    <>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      {/* 뷰파인더 컨테이너 — 카메라 활성 시 컨트롤 바와 하나의 유닛으로 연결 */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: '4/3',
          border: '1px solid var(--color-accent-border)',
          borderRadius: isCameraMode ? '1rem 1rem 0 0' : '1rem',
          borderBottom: isCameraMode ? 'none' : undefined,
        }}
      >

        {/* ── 미리보기 ── */}
        {stage === 'previewing' && previewUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={previewUrl}
            alt="업로드한 향수 사진"
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'contain', background: '#0a0a0a' }}
          />
        )}

        {/* ── CTA (idle) ── */}
        {stage === 'idle' && (
          <button
            type="button"
            onClick={startCamera}
            className="absolute inset-0 flex flex-col items-center justify-center group"
            style={{ background: 'var(--color-accent-pale)' }}
          >
            <span className="flex flex-col items-center gap-3 sm:gap-5">
              {/* 아이콘 링 */}
              <span
                className="size-11 sm:size-14 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-[1.06]"
                style={{
                  background: 'var(--color-card-bg)',
                  border: '1px solid var(--color-accent-border)',
                  boxShadow: '0 4px 16px var(--color-shadow-soft)',
                }}
              >
                <HiOutlineCamera
                  className="size-5 sm:size-6"
                  style={{ color: 'var(--color-accent)' }}
                  aria-hidden
                />
              </span>

              <span className="text-center px-4 sm:px-8">
                <span
                  className="block text-[15px] sm:text-[16px] font-medium tracking-tight"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  카메라로 스캔하기
                </span>
                <span className="block text-[13px] sm:text-[14px] mt-1.5 sm:mt-2 text-secondary leading-relaxed">
                  향수병을 카메라에 비추면<br />AI가 바로 인식해드려요
                </span>
              </span>
            </span>
          </button>
        )}

        {/* ── 카메라 시작 중 ── */}
        {stage === 'camera-starting' && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            style={{ background: '#0a0a0a' }}
          >
            <ViewfinderCorners />
            <span
              className="size-12 rounded-full flex items-center justify-center animate-pulse motion-reduce:animate-none"
              style={{
                background: 'rgba(122,128,204,0.10)',
                border: '1px solid rgba(122,128,204,0.25)',
              }}
            >
              <HiOutlineCamera className="size-5 text-white/60" aria-hidden />
            </span>
            <p className="text-[14px] text-white/55 tracking-wide">카메라 연결 중...</p>
          </div>
        )}

        {/* ── 카메라 활성 ── */}
        {isCameraMode && (
          <>
            <ViewfinderCorners />
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'contain', background: '#000' }}
            />
          </>
        )}
      </div>

      {/* ── 카메라 컨트롤 바 — 뷰파인더와 이어지는 하단 바 ── */}
      {stage === 'camera-active' && (
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            background: '#0a0a0a',
            border: '1px solid var(--color-accent-border)',
            borderTop: 'none',
            borderRadius: '0 0 1rem 1rem',
          }}
        >
          {/* 닫기 */}
          <button
            type="button"
            onClick={cancelCamera}
            className="size-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
            aria-label="카메라 닫기"
          >
            <HiOutlineXMark className="size-4 text-white" aria-hidden />
          </button>

          {/* 셔터 */}
          <button
            type="button"
            onClick={capturePhoto}
            className="size-14 rounded-full flex items-center justify-center transition-transform active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.92)',
              boxShadow: '0 0 0 3px rgba(255,255,255,0.20), 0 0 0 6px rgba(255,255,255,0.07)',
            }}
            aria-label="촬영"
          >
            <span className="size-10 rounded-full block" style={{ background: '#0a0a0a' }} />
          </button>

          <span className="size-10" aria-hidden />
        </div>
      )}

      {/* ── 미리보기 컨트롤 — 이미지 박스 밖, 카드 배경 위 (접근성 확보) ── */}
      {stage === 'previewing' ? (
        <div className="mt-3 flex flex-col gap-2.5">
          <p className="text-[12px] text-center text-secondary">
            향수병이 선명하게 보일수록 더 정확하게 인식할 수 있어요.
          </p>
          <div className="flex gap-2">
            <Button variant="ilp" onClick={handleAnalyze} className="flex-1">
              <HiOutlineMagnifyingGlass className="size-4 shrink-0" aria-hidden />
              분석하기
            </Button>
            <Button variant="ghostLavender" onClick={reset}>
              <HiOutlineArrowPath className="size-4 shrink-0" aria-hidden />
              {imageSource === 'camera' ? '다시 찍기' : '다시 선택'}
            </Button>
          </div>
        </div>
      ) : (
        /* ── 파일 업로드 — 보조 옵션 ── */
        <div
          role="button"
          tabIndex={0}
          aria-label="향수 사진 파일 업로드"
          onClick={() => galleryInputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && galleryInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false);
          }}
          className={[
            'mt-2.5 flex items-center gap-3 rounded-xl px-3.5 py-3 cursor-pointer transition-colors duration-150',
            isDragging
              ? 'bg-[var(--color-accent-pale)]'
              : 'hover:bg-[var(--color-accent-pale)]/60',
          ].join(' ')}
          style={{ border: '1px solid var(--color-accent-border)' }}
        >
          <span
            className="size-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-accent-pale)' }}
          >
            <HiOutlinePhoto className="size-4 text-secondary" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] sm:text-[15px] font-medium text-fg-primary">
              {isDragging ? '여기에 놓아주세요' : '사진 파일로 분석하기'}
            </span>
            <span className="block text-[12px] sm:text-[13px] text-secondary mt-0.5">
              드래그하거나 클릭 · JPG · PNG · WEBP
            </span>
          </span>
        </div>
      )}
    </>
  );
}

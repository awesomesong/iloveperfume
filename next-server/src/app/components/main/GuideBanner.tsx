'use client';

import Link from 'next/link';
import { useState } from 'react';
import { HiOutlineBookOpen } from 'react-icons/hi2';

export default function GuideBanner() {
    const [isOpen, setIsOpen] = useState(true);

    const handleClose = () => {
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div
            className="absolute top-4 left-4 right-4 z-10 mx-auto min-[480px]:left-auto min-[480px]:right-4 min-[480px]:mx-0 min-[480px]:w-auto"
            role="dialog"
            aria-modal="true"
            aria-label="I Love Perfume 이용 방법 안내"
        >
            <div
                className="flex items-center gap-3 rounded-full p-2 pl-4 pr-2"
                style={{
                    background: 'var(--color-card-bg)',
                    border: '1px solid var(--color-accent-border)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
                }}
            >
                <Link
                    href="/guide"
                    className="flex min-w-0 flex-1 items-center gap-2 text-xs text-secondary hover:opacity-70 transition-opacity"
                >
                    <HiOutlineBookOpen className="size-3.5 shrink-0" aria-hidden />
                    <p className="min-w-0 whitespace-nowrap">이용 방법 안내</p>
                </Link>
                <button
                    type="button"
                    onClick={handleClose}
                    className="shrink-0 rounded-full p-1.5 text-secondary hover:opacity-60 transition-opacity"
                    aria-label="닫기"
                >
                    <svg className="size-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

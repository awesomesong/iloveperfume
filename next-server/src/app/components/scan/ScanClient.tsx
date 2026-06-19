'use client';

import { useRouter } from 'next/navigation';
import HomeImageUpload from './HomeImageUpload';

export default function ScanClient() {
  const router = useRouter();

  return (
    <section className="mt-6 md:mt-10 max-w-2xl mx-auto w-full px-2 sm:px-4">
      <div
        className="rounded-[20px] sm:rounded-[24px] p-3 sm:p-5 md:p-8"
        style={{
          background: 'var(--color-card-bg)',
          border: '1px solid var(--color-card-border)',
          boxShadow: '0 2px 16px var(--color-shadow-soft)',
        }}
      >
        <HomeImageUpload
          onSuccess={(scanId) => {
            router.replace('/scan?camera=true');
            router.push(`/scan/result/${scanId}`);
          }}
        />
      </div>

    </section>
  );
}

export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import FeatureShowcase from '@/src/app/components/main/FeatureShowcase';
import ProductFragrance from '@/src/app/components/main/ProductFragrance';
import GuideBanner from '@/src/app/components/main/GuideBanner';
import ScrollToSection from '@/src/app/components/ScrollToSection';

export default function Home() {
  return (
    <div className="flex flex-col relative">
      <GuideBanner />
      <Suspense>
        <ScrollToSection />
      </Suspense>
      <FeatureShowcase />
      <ProductFragrance />
    </div>
  );
}

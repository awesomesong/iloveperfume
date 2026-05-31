import FeatureShowcase from '@/src/app/components/main/FeatureShowcase';
import ProductFragrance from '@/src/app/components/main/ProductFragrance';
import GuideBanner from '@/src/app/components/main/GuideBanner';

export default function Home() {
  return (
    <div className="flex flex-col relative">
      <GuideBanner />
      <FeatureShowcase />
      <ProductFragrance />
    </div>
  );
}

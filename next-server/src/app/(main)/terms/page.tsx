import type { Metadata } from 'next';
import LegalDocument from '@/src/app/components/LegalDocument';
import { TERMS_OF_SERVICE } from '@/src/app/config/legal';

export const metadata: Metadata = {
    title: '이용약관',
    description: 'I Love Perfume 서비스 이용약관입니다.',
    alternates: { canonical: '/terms' },
};

export default function TermsPage() {
    return <LegalDocument doc={TERMS_OF_SERVICE} />;
}

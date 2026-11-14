import type { Metadata } from 'next';
import LegalDocument from '@/src/app/components/LegalDocument';
import { PRIVACY_POLICY } from '@/src/app/config/legal';

export const metadata: Metadata = {
    title: '개인정보처리방침',
    description: 'I Love Perfume가 개인정보를 어떻게 처리하는지 안내합니다.',
    alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
    return <LegalDocument doc={PRIVACY_POLICY} />;
}

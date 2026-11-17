/**
 * 푸터 콘텐츠 설정
 *
 * 푸터에 보이는 문구·링크는 전부 이 파일에서 관리한다.
 * - 링크 추가/삭제: FOOTER_LINK_GROUPS 수정
 * - 약관·개인정보처리방침 본문: config/legal.ts
 * - 문의 메일·SNS: FOOTER_CONTACT 값 채우기
 * 값이 비어 있는 항목(빈 문자열·빈 배열)은 화면에 렌더링되지 않는다.
 */

export type FooterLink = {
    label: string;
    href: string;
    /** true면 새 탭으로 연다 (외부 링크) */
    external?: boolean;
};

export type FooterLinkGroup = {
    title: string;
    links: FooterLink[];
};

export const FOOTER_BRAND = {
    tagline: '향수를 수집하고 기록하는 공간',
    /** 저작권 표기 주체 */
    copyrightHolder: '아이러브퍼퓸',
};

export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
    {
        title: '서비스',
        links: [
            { label: '향수 갤러리', href: '/' },
            { label: '향수 컬렉션', href: '/fragrance' },
            { label: '향수 스캔', href: '/scan' },
            { label: '향수 뉴스', href: '/notice' },
            { label: '채팅', href: '/chatMember' },
        ],
    },
    {
        title: '안내',
        links: [
            { label: '서비스 소개 · 이용 안내', href: '/guide' },
        ],
    },
];

export const FOOTER_CONTACT = {
    title: '문의',
    /** 예: 'help@example.com' — 비워 두면 표시하지 않음 */
    email: 'kshs24820@gmail.com',
    /** SNS·깃허브 등 외부 채널 */
    channels: [
        { label: 'GitHub', href: 'https://github.com/awesomesong/next-socket', external: true },
    ] as FooterLink[],
};

/** 하단 저작권 줄 옆에 놓이는 법적 고지 링크 (본문은 config/legal.ts) */
export const FOOTER_LEGAL_LINKS: FooterLink[] = [
    { label: '이용약관', href: '/terms' },
    { label: '개인정보처리방침', href: '/privacy' },
];

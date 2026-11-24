/** @type {import('next').NextConfig} */
// https://nextjs.org/docs/app/api-reference/config/next-config-js

// NextAuth requires NEXTAUTH_URL at build time. Provide a fallback so static
// prerendering doesn't fail when the env var isn't injected by the CI runner.
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'https://www.iloveperfume.co.kr';

const nextConfig = {
    onDemandEntries: {
        // Keep pages in memory longer during dev to reduce route-change recompiles.
        maxInactiveAge: 1000 * 60 * 25,
        pagesBufferLength: 8,
    },
    async redirects() {
        return [
            {
                source: '/:path*',
                has: [{ type: 'host', value: 'iloveperfume.co.kr' }],
                destination: 'https://www.iloveperfume.co.kr/:path*',
                permanent: true,
            },
            // 향수 뉴스 경로 변경(/notice → /news) — 기존 링크·검색 결과 유지용
            { source: '/notice', destination: '/news', permanent: true },
            { source: '/notice/:id', destination: '/news/:id', permanent: true },
        ];
    },
    async headers() {
        return [
            {
                source: '/api/ai/:path*',
                headers: [
                    {
                        key: 'Access-Control-Allow-Origin',
                        value: '*',
                    },
                    {
                        key: 'Access-Control-Allow-Methods',
                        value: 'GET, POST, OPTIONS',
                    },
                    {
                        key: 'Access-Control-Allow-Headers',
                        value: 'Content-Type, Authorization',
                    },
                    {
                        key: 'Cross-Origin-Embedder-Policy',
                        value: 'unsafe-none',
                    },
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin',
                    },
                    {
                        key: 'Cross-Origin-Resource-Policy',
                        value: 'cross-origin',
                    },
                ],
            },
        ];
    },
    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60 * 60 * 24 * 30,
        // next/image가 최적화해 주는 이미지 호스트 — 목록은 image-hosts.json (src/app/lib/imageSrc.ts와 함께 쓴다).
        // 목록에 없는 호스트(수집된 향수의 브랜드 공식 사이트 이미지 등)는 최적화 없이 원본 주소로 그린다.
        remotePatterns: require('./image-hosts.json'),
    },
    logging: {
      fetches: {
        fullUrl: process.env.NODE_ENV === 'production',
      },
    },
    reactStrictMode: true,
    generateEtags: false,
    experimental: {
        optimizePackageImports: [
            '@heroui/react',
            'framer-motion',
            'react-icons',
            'react-select',
            '@tanstack/react-query',
        ],
        // 정적 생성 워커를 1개로 제한 — 워커마다 별도 PrismaClient(=별도 커넥션 풀)가
        // 생성되어 DB 동시 연결 허용치를 넘기는 문제(P2024)를 막기 위함
        cpus: 1,
    },
};

module.exports = nextConfig;

/** 그라데이션 칸 하나 — 색은 globals.css의 .blend-bottle-defs 변수(라이트·다크)에서 온다 */
const Stop = ({ at, color, alpha }: { at: number; color: string; alpha?: number }) => (
    <stop offset={at} style={{ stopColor: color.startsWith("--") ? `var(${color})` : color, stopOpacity: alpha }} />
);

/**
 * 액체 그라데이션 다섯 개 — 색은 가장 가까운 --blend-liquid-* 변수에서 온다.
 * 기본 한 벌(prefix "blend")은 BottleDefs에, 향수 색을 입힌 병은 자기 svg 안에 한 벌 더 둔다(BottleSvg의 tint).
 */
export const LiquidGradients = ({ prefix }: { prefix: string }) => (
    <>
    {/* 액체: 벽에 닿는 양끝은 아주 짙고 가운데는 밝다 */}
    <linearGradient id={`${prefix}-liquid`} x1="0" y1="0" x2="1" y2="0">
        <Stop at={0} color="--blend-liquid-edge" />
        <Stop at={0.03} color="--blend-liquid-deep" />
        <Stop at={0.15} color="--blend-liquid-mid" />
        <Stop at={0.33} color="--blend-liquid" />
        <Stop at={0.46} color="--blend-liquid-hi" />
        <Stop at={0.62} color="--blend-liquid" />
        <Stop at={0.84} color="--blend-liquid-mid" />
        <Stop at={0.96} color="--blend-liquid-deep" />
        <Stop at={1} color="--blend-liquid-edge" />
    </linearGradient>
    {/* 위는 맑고 아래는 짙게 */}
    <linearGradient id={`${prefix}-liquid-depth`} x1="0" y1="0" x2="0" y2="1">
        <Stop at={0} color="--blend-liquid-top" alpha={0.34} />
        <Stop at={0.22} color="--blend-liquid-top" alpha={0} />
        <Stop at={0.55} color="--blend-liquid-edge" alpha={0} />
        <Stop at={1} color="--blend-liquid-edge" alpha={0.4} />
    </linearGradient>
    {/* 모서리로 갈수록 깊어지는 색 */}
    <radialGradient id={`${prefix}-liquid-deep`} cx="0.42" cy="0.36" r="0.78">
        <Stop at={0.62} color="--blend-liquid-edge" alpha={0} />
        <Stop at={1} color="--blend-liquid-edge" alpha={0.3} />
    </radialGradient>
    {/* 뒤쪽 유리로 들어온 빛 / 바닥에 모인 빛 */}
    <radialGradient id={`${prefix}-back-light`}>
        <Stop at={0} color="--blend-liquid-top" alpha={0.3} />
        <Stop at={1} color="--blend-liquid-top" alpha={0} />
    </radialGradient>
    <radialGradient id={`${prefix}-glow`}>
        <Stop at={0} color="--blend-liquid-top" alpha={0.55} />
        <Stop at={1} color="--blend-liquid-top" alpha={0} />
    </radialGradient>
    </>
);

/**
 * 병 그림(BottleSvg)이 함께 쓰는 그라데이션 모음 — /blend 페이지에 한 번만 둔다.
 * 병마다 그라데이션을 다시 만들지 않아 화면에 병이 13개 있어도 가볍다.
 * 흐림 필터·마스크·겹침 효과는 쓰지 않는다(그리는 비용이 크다).
 * 사물을 그리는 값이라 그라데이션을 쓴다(design-system 9절 허용 예외).
 */
const BottleDefs = () => (
    <svg width="0" height="0" className="blend-bottle-defs" aria-hidden focusable="false">
        <defs>
            {/* 둥근 병의 가장자리: 왼쪽 위가 밝고 오른쪽 아래가 짙다 */}
            <linearGradient id="blend-rim" x1="0" y1="0" x2="1" y2="1">
                <Stop at={0} color="--blend-rim-1" />
                <Stop at={0.3} color="--blend-rim-2" />
                <Stop at={0.55} color="--blend-rim-3" />
                <Stop at={0.8} color="--blend-rim-mid" />
                <Stop at={1} color="--blend-rim-5" />
            </linearGradient>
            {/* 커팅 병의 곧은 면 네 개 */}
            <linearGradient id="blend-facet-top" x1="0" y1="0" x2="1" y2="0">
                <Stop at={0} color="--blend-rim-1" />
                <Stop at={0.55} color="--blend-rim-2" />
                <Stop at={1} color="--blend-rim-3" />
            </linearGradient>
            <linearGradient id="blend-facet-left" x1="0" y1="0" x2="1" y2="0">
                <Stop at={0} color="--blend-rim-4" />
                <Stop at={0.2} color="--blend-rim-2" />
                <Stop at={0.55} color="--blend-rim-1" />
                <Stop at={1} color="--blend-rim-2" />
            </linearGradient>
            <linearGradient id="blend-facet-right" x1="0" y1="0" x2="1" y2="0">
                <Stop at={0} color="--blend-rim-3" />
                <Stop at={0.3} color="--blend-rim-2" />
                <Stop at={0.6} color="--blend-rim-mid" />
                <Stop at={1} color="--blend-rim-5" />
            </linearGradient>
            <linearGradient id="blend-facet-bottom" x1="0" y1="0" x2="0" y2="1">
                <Stop at={0} color="--blend-rim-warm" />
                <Stop at={0.5} color="--blend-rim-mid" />
                <Stop at={1} color="--blend-rim-5" />
            </linearGradient>
            {/* 정면 유리: 뒤 배경이 비치고 가장자리만 짙다 */}
            <linearGradient id="blend-face" x1="0" y1="0" x2="1" y2="0">
                <Stop at={0} color="--blend-face-edge" />
                <Stop at={0.045} color="--blend-face-in" />
                <Stop at={0.14} color="--blend-face" />
                <Stop at={0.86} color="--blend-face" />
                <Stop at={0.955} color="--blend-face-out" />
                <Stop at={1} color="--blend-face-edge-r" />
            </linearGradient>
            <linearGradient id="blend-face-top" x1="0" y1="0" x2="0" y2="1">
                <Stop at={0} color="--blend-hi" alpha={0.9} />
                <Stop at={0.06} color="--blend-hi" alpha={0} />
            </linearGradient>
            {/* 병 안 빈 곳(액체 위) */}
            <linearGradient id="blend-air" x1="0" y1="0" x2="1" y2="0">
                <Stop at={0} color="--blend-air-edge" />
                <Stop at={0.12} color="--blend-air" />
                <Stop at={0.7} color="--blend-air" />
                <Stop at={1} color="--blend-air-edge" />
            </linearGradient>
            <LiquidGradients prefix="blend" />
            {/* 경계 없이 번지는 반사(또렷한 띠는 줄무늬처럼 보여 쓰지 않는다) */}
            <radialGradient id="blend-sheen">
                <Stop at={0} color="--blend-hi" alpha={1} />
                <Stop at={0.45} color="--blend-hi" alpha={0.55} />
                <Stop at={1} color="--blend-hi" alpha={0} />
            </radialGradient>
            {/* 뚜껑: 광택 원기둥 */}
            <linearGradient id="blend-cap" x1="0" y1="0" x2="1" y2="0">
                <Stop at={0} color="--blend-cap-0" />
                <Stop at={0.06} color="--blend-cap-1" />
                <Stop at={0.15} color="--blend-cap-2" />
                <Stop at={0.215} color="--blend-cap-hi" />
                <Stop at={0.25} color="--blend-cap-2" />
                <Stop at={0.31} color="--blend-cap-3" />
                <Stop at={0.52} color="--blend-cap-1" />
                <Stop at={0.78} color="--blend-cap-0" />
                <Stop at={0.88} color="--blend-cap-2" />
                <Stop at={0.93} color="--blend-cap-1" />
                <Stop at={1} color="--blend-cap-0" />
            </linearGradient>
            <linearGradient id="blend-cap-top" x1="0" y1="0" x2="1" y2="0">
                <Stop at={0} color="--blend-cap-1" />
                <Stop at={0.22} color="--blend-cap-hi" />
                <Stop at={0.4} color="--blend-cap-2" />
                <Stop at={1} color="--blend-cap-1" />
            </linearGradient>
            {/* 뚜껑 아래쪽: 바닥에서 올라온 빛 + 맨 아래 그늘 */}
            <linearGradient id="blend-cap-shade" x1="0" y1="0" x2="0" y2="1">
                <Stop at={0.62} color="--blend-hi" alpha={0} />
                <Stop at={0.82} color="--blend-hi" alpha={0.1} />
                <Stop at={0.9} color="--blend-shadow" alpha={0} />
                <Stop at={1} color="--blend-shadow" alpha={0.55} />
            </linearGradient>
            <linearGradient id="blend-metal" x1="0" y1="0" x2="1" y2="0">
                <Stop at={0} color="--blend-metal-0" />
                <Stop at={0.12} color="--blend-metal-1" />
                <Stop at={0.23} color="--blend-metal-hi" />
                <Stop at={0.34} color="--blend-metal-2" />
                <Stop at={0.62} color="--blend-metal-3" />
                <Stop at={0.84} color="--blend-metal-2" />
                <Stop at={1} color="--blend-metal-0" />
            </linearGradient>
            <linearGradient id="blend-neck" x1="0" y1="0" x2="1" y2="0">
                <Stop at={0} color="--blend-rim-4" />
                <Stop at={0.12} color="--blend-rim-1" />
                <Stop at={0.5} color="--blend-rim-2" />
                <Stop at={0.88} color="--blend-rim-1" />
                <Stop at={1} color="--blend-rim-4" />
            </linearGradient>
            {/* 바닥 그림자(흐림 필터 대신 원형 그라데이션) */}
            <radialGradient id="blend-shadow">
                <Stop at={0} color="--blend-shadow" alpha={0.34} />
                <Stop at={0.5} color="--blend-shadow" alpha={0.12} />
                <Stop at={1} color="--blend-shadow" alpha={0} />
            </radialGradient>
            <radialGradient id="blend-shadow-contact">
                <Stop at={0} color="--blend-shadow" alpha={0.7} />
                <Stop at={0.7} color="--blend-shadow" alpha={0.4} />
                <Stop at={1} color="--blend-shadow" alpha={0} />
            </radialGradient>
        </defs>
    </svg>
);

export default BottleDefs;

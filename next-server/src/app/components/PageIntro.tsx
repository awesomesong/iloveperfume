import clsx from "clsx";

type Props = {
    title: string;
    /** 한 줄 설명 — 모바일에서는 숨긴다 */
    description?: string;
    className?: string;
};

/**
 * 목록형 페이지의 머리 — 제목 + 한 줄 설명.
 * 모바일은 왼쪽 정렬·제목만, 768px부터 가운데 정렬·넉넉한 여백. 스타일은 globals.css의 .page-intro.
 */
const PageIntro = ({ title, description, className }: Props) => (
    <header className={clsx("page-intro", className)}>
        <h2 className="page-intro__title">{title}</h2>
        {description && <p className="page-intro__desc">{description}</p>}
    </header>
);

export default PageIntro;

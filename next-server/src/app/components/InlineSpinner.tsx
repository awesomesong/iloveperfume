import clsx from "clsx";

type Props = {
    /** 크기 등 추가 클래스 (기본 size-4) */
    className?: string;
};

/**
 * 버튼 안에 넣는 작은 로딩 표시. 부모의 글자색을 따른다.
 * 화면 전체 로딩은 PointsLoading을 쓴다. 스타일은 globals.css의 .inline-spinner.
 */
const InlineSpinner = ({ className }: Props) => (
    <span className={clsx("inline-spinner size-4", className)} aria-hidden />
);

export default InlineSpinner;

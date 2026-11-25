import { memo, type MouseEvent } from "react";
import type { ScentFamily } from "@/src/app/lib/blend/scentNotes";

type Props = {
    families: readonly ScentFamily[];
    /** 지금 오른쪽에 보이는 계열 — 검색 중이면 null(어느 계열도 고르지 않은 상태) */
    selectedId: string | null;
    /** 계열마다 고른 향 개수 — 무신사 필터 탭("추천 1")처럼 이름 뒤에 숫자로 붙인다 */
    pickedCounts: ReadonlyMap<string, number>;
    /** 오른쪽 향 목록의 id */
    listId: string;
    onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
};

/**
 * 왼쪽 계열 목록 — 누르면 오른쪽에 그 계열의 향만 보인다(컬리·올리브영·무신사 카테고리 화면 구조).
 * 주소는 바꾸지 않는다. 스타일은 globals.css의 .blend-family-nav.
 */
const ScentFamilyNav = ({ families, selectedId, pickedCounts, listId, onSelect }: Props) => (
    <nav className="blend-family-nav" aria-label="향 계열">
        {families.map((family) => {
            const picked = pickedCounts.get(family.id) ?? 0;
            return (
                <button
                    key={family.id}
                    type="button"
                    value={family.id}
                    onClick={onSelect}
                    aria-controls={listId}
                    aria-current={family.id === selectedId ? "true" : undefined}
                    className="blend-family-nav__link"
                >
                    <span className="blend-family-nav__name">
                        {family.name}
                        {picked > 0 && (
                            <span className="blend-family-nav__picked">
                                <span className="sr-only">, 고른 향 </span>
                                {picked}
                                <span className="sr-only">가지, 전체 </span>
                            </span>
                        )}
                    </span>
                    <span className="blend-family-nav__count">{family.notes.length}가지</span>
                </button>
            );
        })}
    </nav>
);

export default memo(ScentFamilyNav);

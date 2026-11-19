import { memo, type MouseEvent } from "react";
import type { ScentFamily } from "@/src/app/lib/blend/scentNotes";

export const familySectionId = (familyId: string) => `blend-family-${familyId}`;

type Props = {
    families: readonly ScentFamily[];
};

function scrollToFamily(event: MouseEvent<HTMLButtonElement>) {
    const target = document.getElementById(familySectionId(event.currentTarget.value));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
}

/** 계열 이름 줄 — 누르면 그 계열로 내려간다. 주소(#)를 바꾸지 않아 뒤로 가기 기록이 쌓이지 않는다 */
const ScentFamilyNav = ({ families }: Props) => (
    <nav className="blend-family-nav" aria-label="향 계열">
        {families.map((family) => (
            <button
                key={family.id}
                type="button"
                value={family.id}
                onClick={scrollToFamily}
                className="blend-family-nav__link"
            >
                {family.name}
            </button>
        ))}
    </nav>
);

export default memo(ScentFamilyNav);

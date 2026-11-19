'use client';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { HiMagnifyingGlass } from "react-icons/hi2";
import BottlePreview from "./BottlePreview";
import BlendStepActions from "./BlendStepActions";
import ScentFamilyNav, { familySectionId } from "./ScentFamilyNav";
import ScentOption from "./ScentOption";
import ScentPyramid from "./ScentPyramid";
import {
    MAX_LAYER_NOTES,
    filterScentFamilies,
    notesInLayer,
    type ScentLayer,
} from "@/src/app/lib/blend/scentNotes";

type Props = {
    /** 지금 고르는 층 — 이 층의 향만 보여주고, 층마다 MAX_LAYER_NOTES개까지 고른다 */
    layer: ScentLayer;
    bottleId: string;
    initialNoteIds: readonly string[];
    /** 향을 고르거나 뺄 때마다 — 주소(쿼리스트링)에 남긴다 */
    onSelect: (noteIds: readonly string[]) => void;
    onBack: () => void;
    onNext: () => void;
    /** 제목 영역 — 부모가 만든 요소를 그대로 받아, 향을 고를 때 다시 그리지 않는다 */
    children: ReactNode;
};

/**
 * 향 고르기 — 한 층(처음·중심·남는 향)의 향을 계열별로 펼쳐 두고 바로 고른다(층마다 1~2개).
 * 향을 고르면 바뀐 칸과 고른 향 칩만 다시 그린다. 스타일은 globals.css의 .blend-scent*.
 */
const ScentPicker = ({ layer, bottleId, initialNoteIds, onSelect, onBack, onNext, children }: Props) => {
    const [noteIds, setNoteIds] = useState(initialNoteIds);
    const [query, setQuery] = useState("");
    // 최신 선택은 ref로 읽어, 핸들러를 한 번만 만든다 — 165칸이 고를 때마다 다시 그려지지 않는다
    const noteIdsRef = useRef(noteIds);

    useEffect(() => {
        noteIdsRef.current = noteIds;
        onSelect(noteIds);
    }, [noteIds, onSelect]);

    const selected = useMemo(() => new Set(noteIds), [noteIds]);
    const families = useMemo(() => filterScentFamilies(layer.families, query), [layer, query]);

    const handleToggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = event.target;
        if (checked && notesInLayer(noteIdsRef.current, layer.id).length >= MAX_LAYER_NOTES) {
            toast(`${layer.name}은 ${MAX_LAYER_NOTES}가지까지 고를 수 있어요.`);
            return;
        }
        setNoteIds((current) =>
            checked ? (current.includes(value) ? current : [...current, value]) : current.filter((id) => id !== value),
        );
    }, [layer]);


    const handleQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value);
    }, []);

    const handleNext = useCallback(() => {
        if (notesInLayer(noteIdsRef.current, layer.id).length === 0) {
            toast(`${layer.name}을 한 가지 이상 골라 주세요.`);
            return;
        }
        onNext();
    }, [layer, onNext]);

    return (
        <section className="blend-scent">
            {children}
            <div className="blend-scent__tools">
                <label className="blend-search">
                    <span className="sr-only">향 이름 검색</span>
                    <HiMagnifyingGlass className="blend-search__icon" aria-hidden />
                    <input
                        type="search"
                        value={query}
                        onChange={handleQueryChange}
                        placeholder="향 이름 검색"
                        className="blend-search__input"
                        autoComplete="off"
                        enterKeyHint="search"
                    />
                </label>
                <ScentFamilyNav families={families} />
            </div>
            <div className="blend-scent__list">
                {families.length === 0 && <p className="blend-scent__empty">‘{query.trim()}’에 맞는 향이 없어요.</p>}
                {families.map((family) => (
                    <section key={family.id} id={familySectionId(family.id)} className="blend-family">
                        <h3 id={`${familySectionId(family.id)}-title`} className="blend-family__title">
                            {family.name}
                        </h3>
                        <div
                            role="group"
                            aria-labelledby={`${familySectionId(family.id)}-title`}
                            className="blend-family__notes"
                        >
                            {family.notes.map((scent) => (
                                <ScentOption
                                    key={scent.id}
                                    scent={scent}
                                    checked={selected.has(scent.id)}
                                    onChange={handleToggle}
                                />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
            <aside className="blend-scent__aside" aria-label="고른 향">
                <BottlePreview bottleId={bottleId} />
                <ScentPyramid noteIds={noteIds} />
                <BlendStepActions secondaryLabel="이전" onSecondary={onBack} onNext={handleNext} />
            </aside>
        </section>
    );
};

export default ScentPicker;

'use client';
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type MouseEvent,
    type ReactNode,
} from "react";
import toast from "react-hot-toast";
import { HiMagnifyingGlass, HiXMark } from "react-icons/hi2";
import BottlePreview from "./BottlePreview";
import BlendStepActions from "./BlendStepActions";
import ScentFamilyNav from "./ScentFamilyNav";
import ScentOption from "./ScentOption";
import ScentPyramid from "./ScentPyramid";
import {
    MAX_LAYER_NOTES,
    SCENT_FAMILIES,
    SCENT_LAYERS,
    filterScentFamilies,
    layerOfNote,
    type LayerNotes,
    type ScentFamily,
    type ScentLayer,
} from "@/src/app/lib/blend/scentNotes";

type Props = {
    /** 지금 고르는 층 — 모든 계열·향을 보여 주고, 층마다 MAX_LAYER_NOTES개까지 고른다 */
    layer: ScentLayer;
    bottleId: string;
    colorId: string;
    initialNotes: LayerNotes;
    /** 향을 고르거나 뺄 때마다 — 주소(쿼리스트링)에 남긴다 */
    onSelect: (notes: LayerNotes) => void;
    onBack: () => void;
    onNext: () => void;
    /** 제목 영역 — 부모가 만든 요소를 그대로 받아, 향을 고를 때 다시 그리지 않는다 */
    children: ReactNode;
};

/**
 * 향 고르기 — 한 층(처음·중심·남는 향)의 향을 고른다(층마다 1~2개). 세 층 모두 같은 계열·향을 보여 주고,
 * 다른 층에 이미 담은 향은 그 층 이름을 보여 주며 다시 담지 않는다(한 향은 한 층에만).
 * 위: 제목·검색 / 가운데: 왼쪽 계열 목록 + 오른쪽 그 계열의 향(이 칸만 스크롤) / 아래: 지금 층에서 고른 향·버튼.
 * 검색어가 있으면 오른쪽에 모든 계열의 맞는 향을 보여 준다. 스타일은 globals.css의 .blend-scent*.
 */
const ScentPicker = ({ layer, bottleId, colorId, initialNotes, onSelect, onBack, onNext, children }: Props) => {
    const [notes, setNotes] = useState(initialNotes);
    const [query, setQuery] = useState("");
    const [familyId, setFamilyId] = useState(layer.defaultFamilyId);
    // 최신 선택은 ref로 읽어, 핸들러를 한 번만 만든다 — 향 칸이 고를 때마다 다시 그려지지 않는다
    const notesRef = useRef(notes);
    const listRef = useRef<HTMLDivElement>(null);
    const listId = useId();

    useEffect(() => {
        notesRef.current = notes;
        onSelect(notes);
    }, [notes, onSelect]);

    /** 이 층에서 고른 향 */
    const selected = useMemo(() => new Set(notes[layer.id]), [notes, layer]);
    /** 다른 층에 담은 향 → 그 층 이름 */
    const takenBy = useMemo(
        () => new Map(SCENT_LAYERS.filter((other) => other.id !== layer.id).flatMap((other) => notes[other.id].map((id) => [id, other.name]))),
        [notes, layer],
    );
    const isSearching = query.trim() !== "";
    const results = useMemo(() => filterScentFamilies(SCENT_FAMILIES, query), [query]);
    const shownFamilies: readonly ScentFamily[] = useMemo(
        () => (isSearching ? results : SCENT_FAMILIES.filter((family) => family.id === familyId)),
        [isSearching, results, familyId],
    );
    const pickedCounts = useMemo(
        () => new Map(SCENT_FAMILIES.map((family) => [family.id, family.notes.filter((scent) => selected.has(scent.id)).length])),
        [selected],
    );
    const resultCount = results.reduce((sum, family) => sum + family.notes.length, 0);

    const handleToggle = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = event.target;
        if (checked) {
            const other = layerOfNote(notesRef.current, value);
            if (other && other.id !== layer.id) {
                toast(`이미 ${other.name}에 고른 향이에요.`);
                return;
            }
            if (notesRef.current[layer.id].length >= MAX_LAYER_NOTES) {
                toast(`${layer.name}은 ${MAX_LAYER_NOTES}가지까지 고를 수 있어요.`);
                return;
            }
        }
        setNotes((current) => {
            const ids = current[layer.id];
            const next = checked ? (ids.includes(value) ? ids : [...ids, value]) : ids.filter((id) => id !== value);
            return next === ids ? current : { ...current, [layer.id]: next };
        });
    }, [layer]);

    const handleRemove = useCallback((noteId: string) => {
        setNotes((current) => ({ ...current, [layer.id]: current[layer.id].filter((id) => id !== noteId) }));
    }, [layer]);

    // 계열을 누르면 검색을 끝내고 그 계열의 맨 위부터 보여 준다
    const handleFamilySelect = useCallback((event: MouseEvent<HTMLButtonElement>) => {
        setFamilyId(event.currentTarget.value);
        setQuery("");
        listRef.current?.scrollTo({ top: 0 });
    }, []);

    const handleQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value);
        listRef.current?.scrollTo({ top: 0 });
    }, []);

    const handleQueryClear = useCallback(() => setQuery(""), []);

    const handleNext = useCallback(() => {
        if (notesRef.current[layer.id].length === 0) {
            toast(`${layer.name}을 한 가지 이상 골라 주세요.`);
            return;
        }
        onNext();
    }, [layer, onNext]);

    return (
        <section className="blend-scent">
            {children}
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
                {isSearching && (
                    <button type="button" onClick={handleQueryClear} className="blend-search__clear" aria-label="검색어 지우기">
                        <HiXMark aria-hidden />
                    </button>
                )}
            </label>
            <div className="blend-scent__body">
                <ScentFamilyNav
                    families={SCENT_FAMILIES}
                    selectedId={isSearching ? null : familyId}
                    pickedCounts={pickedCounts}
                    listId={listId}
                    onSelect={handleFamilySelect}
                />
                <div ref={listRef} id={listId} className="blend-scent__list">
                    {isSearching && (
                        <h3 className="blend-scent__list-title">
                            검색 결과<span className="blend-scent__list-count">{resultCount}가지</span>
                        </h3>
                    )}
                    {isSearching && resultCount === 0 && (
                        <p className="blend-scent__empty">‘{query.trim()}’에 맞는 향이 없어요.</p>
                    )}
                    {shownFamilies.map((family) => {
                        const titleId = `${listId}-${family.id}`;
                        return (
                            <section key={family.id} className="blend-family" aria-labelledby={titleId}>
                                {isSearching ? (
                                    <h4 id={titleId} className="blend-family__label">{family.name}</h4>
                                ) : (
                                    <h3 id={titleId} className="blend-scent__list-title">
                                        {family.name}
                                        <span className="blend-scent__list-count">{family.notes.length}가지</span>
                                    </h3>
                                )}
                                <div role="group" aria-labelledby={titleId} className="blend-family__notes">
                                    {family.notes.map((scent) => (
                                        <ScentOption
                                            key={scent.id}
                                            scent={scent}
                                            checked={selected.has(scent.id)}
                                            takenBy={takenBy.get(scent.id)}
                                            onChange={handleToggle}
                                        />
                                    ))}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
            <aside className="blend-scent__aside" aria-label="고른 향">
                <BottlePreview bottleId={bottleId} colorId={colorId} />
                <ScentPyramid notes={notes} currentLayerId={layer.id} onRemove={handleRemove} />
                <BlendStepActions secondaryLabel="이전" onSecondary={onBack} onNext={handleNext} />
            </aside>
        </section>
    );
};

export default ScentPicker;

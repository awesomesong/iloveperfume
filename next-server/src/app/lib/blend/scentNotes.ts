/**
 * 향의 층 — 실제 향수처럼 처음 향(탑) → 중심 향(미들) → 남는 향(베이스) 순서로 하나씩 고른다.
 * 탑은 뿌린 직후 날아가는 가벼운 향, 미들은 몇 시간 이어지는 중심, 베이스는 가장 오래 남는 향이다.
 */
export type ScentLayerId = "top" | "middle" | "base";

/** 한 층에 고를 수 있는 향의 최대 개수 — 향수 공방에서도 층마다 1~2가지만 고른다 */
export const MAX_LAYER_NOTES = 2;
/** 병 하나에 섞을 수 있는 향의 최대 개수 (세 층 × 2) */
export const MAX_SCENT_NOTES = MAX_LAYER_NOTES * 3;

export type ScentNote = {
    id: string;
    /** 화면에 보이는 이름 */
    name: string;
    /**
     * 같은 향의 다른 표기 — 향수 노트 글(Fragrance.notes)에서 이 향을 찾을 때 쓴다.
     * 브랜드마다 "쟈스민/자스민", "패츌리/팟츌리"처럼 표기가 달라서 함께 둔다.
     */
    aliases: readonly string[];
};

export type ScentFamily = {
    id: string;
    name: string;
    notes: readonly ScentNote[];
};

const note = (id: string, name: string, ...aliases: string[]): ScentNote => ({ id, name, aliases });

/** 화면에 계열 순서대로, 계열 안에서는 이 순서대로 보여준다 */
export const SCENT_FAMILIES: readonly ScentFamily[] = [
    {
        id: "citrus",
        name: "시트러스",
        notes: [
            note("bergamot", "베르가못", "베르가모트"),
            note("lemon", "레몬"),
            note("lime", "라임"),
            note("grapefruit", "자몽", "그레이프프루트"),
            note("orange", "오렌지"),
            note("mandarin", "만다린"),
            note("tangerine", "탠저린"),
            note("clementine", "클레멘타인"),
            note("bitter-orange", "비터 오렌지", "비가라드"),
            note("blood-orange", "블러드 오렌지"),
            note("yuzu", "유자"),
            note("citron", "시트론"),
            note("calamansi", "칼라만시"),
            note("kumquat", "금귤", "쿰쿼트", "낑깡"),
            note("petitgrain", "페티그레인"),
            note("lemon-verbena", "레몬 버베나", "버베나"),
        ],
    },
    {
        id: "floral",
        name: "플로럴",
        notes: [
            note("rose", "장미", "로즈"),
            note("jasmine", "자스민", "쟈스민", "재스민"),
            note("iris", "아이리스", "오리스", "붓꽃"),
            note("tuberose", "튜베로즈"),
            note("lily-of-the-valley", "은방울꽃", "뮤게"),
            note("neroli", "네롤리"),
            note("orange-blossom", "오렌지 블로섬", "오렌지 블로썸", "오렌지 플라워", "오렌지 꽃"),
            note("ylang-ylang", "일랑일랑"),
            note("violet", "바이올렛", "제비꽃"),
            note("peony", "피오니", "작약"),
            note("freesia", "프리지아"),
            note("magnolia", "목련", "매그놀리아"),
            note("hyacinth", "히아신스"),
            note("mimosa", "미모사"),
            note("heliotrope", "헬리오트로프"),
            note("frangipani", "프랜지파니", "플루메리아"),
            note("gardenia", "가드니아", "치자꽃"),
            note("carnation", "카네이션"),
            note("lilac", "라일락"),
            note("lotus", "연꽃", "로터스"),
            note("cherry-blossom", "벚꽃", "체리 블라썸", "체리 블로섬"),
            note("osmanthus", "금목서", "오스만투스"),
            note("narcissus", "수선화"),
            note("hibiscus", "히비스커스"),
            note("geranium", "제라늄"),
            note("lily", "백합", "릴리"),
            note("orchid", "오키드", "난초"),
            note("sweet-pea", "스위트피", "스위트 피"),
            note("poppy", "양귀비"),
            note("plum-blossom", "매화", "플럼 블로섬", "플럼블로썸"),
        ],
    },
    {
        id: "fruity",
        name: "프루티",
        notes: [
            note("peach", "복숭아", "피치"),
            note("apricot", "살구"),
            note("pear", "배", "페어"),
            note("apple", "사과", "애플"),
            note("blackcurrant", "블랙커런트", "블랙 커런트", "카시스"),
            note("raspberry", "라즈베리"),
            note("strawberry", "딸기", "스트로베리"),
            note("blackberry", "블랙베리"),
            note("cherry", "체리"),
            note("plum", "자두", "플럼"),
            note("fig", "무화과", "피그"),
            note("pineapple", "파인애플"),
            note("mango", "망고"),
            note("lychee", "리치"),
            note("passion-fruit", "패션프루트"),
            note("coconut", "코코넛"),
            note("melon", "멜론"),
            note("pomegranate", "석류"),
            note("guava", "구아바"),
            note("banana", "바나나"),
            note("grape", "포도"),
            note("avocado", "아보카도"),
        ],
    },
    {
        id: "green",
        name: "그린·허브",
        notes: [
            note("lavender", "라벤더"),
            note("rosemary", "로즈마리"),
            note("basil", "바질"),
            note("mint", "민트", "페퍼민트"),
            note("sage", "세이지"),
            note("clary-sage", "클라리세이지", "클라리 세이지"),
            note("thyme", "타임"),
            note("bay-leaf", "월계수 잎", "월계수"),
            note("chamomile", "카모마일", "캐모마일"),
            note("eucalyptus", "유칼립투스"),
            note("green-tea", "녹차", "그린티"),
            note("black-tea", "홍차", "블랙티"),
            note("fig-leaf", "무화과 잎"),
            note("tomato-leaf", "토마토 잎"),
            note("galbanum", "갈바넘"),
            note("violet-leaf", "바이올렛 잎"),
            note("bamboo", "대나무"),
            note("grass", "풀잎", "잔디"),
            note("dill", "딜"),
            note("angelica", "안젤리카"),
            note("juniper", "주니퍼베리", "쥬니퍼베리", "주니퍼", "쥬니퍼"),
            note("artemisia", "쑥", "아르테미시아"),
        ],
    },
    {
        id: "woody",
        name: "우디",
        notes: [
            note("cedarwood", "시더우드", "시더"),
            note("sandalwood", "샌달우드", "샌들우드", "백단향"),
            note("vetiver", "베티버", "베티베"),
            note("patchouli", "패츌리", "파촐리", "패출리", "팟츌리"),
            note("oud", "오드", "침향", "아가우드", "아키갈라우드"),
            note("guaiac-wood", "가이악우드", "가이악 우드"),
            note("cypress", "사이프러스"),
            note("hinoki", "히노키", "편백"),
            note("pine", "소나무", "파인", "솔잎"),
            note("birch", "자작나무"),
            note("rosewood", "로즈우드"),
            note("cashmere-wood", "캐시미어 우드"),
            note("driftwood", "드리프트우드"),
            note("blonde-wood", "블론드우드", "블론드 우드"),
            note("teak", "티크우드", "티크 우드"),
            note("papyrus", "파피루스"),
            note("cypriol", "사이프리올", "시프리올"),
            note("oakmoss", "오크모스", "이끼", "모스"),
        ],
    },
    {
        id: "spicy",
        name: "스파이시",
        notes: [
            note("black-pepper", "블랙 페퍼", "블랙페퍼", "페퍼", "후추"),
            note("pink-pepper", "핑크 페퍼", "핑크페퍼"),
            note("white-pepper", "화이트 페퍼"),
            note("cardamom", "카다멈", "카다몸"),
            note("cinnamon", "시나몬", "계피"),
            note("clove", "클로브", "정향"),
            note("nutmeg", "넛멕", "육두구"),
            note("ginger", "진저", "생강"),
            note("saffron", "사프란"),
            note("star-anise", "스타 아니스", "팔각"),
            note("cumin", "커민", "큐민"),
            note("coriander", "코리앤더", "고수"),
        ],
    },
    {
        id: "sweet",
        name: "스위트",
        notes: [
            note("vanilla", "바닐라"),
            note("tonka-bean", "통카빈", "통카 빈"),
            note("honey", "꿀", "허니", "벌집"),
            note("caramel", "캐러멜", "카라멜"),
            note("chocolate", "초콜릿", "카카오"),
            note("coffee", "커피"),
            note("praline", "프랄린"),
            note("almond", "아몬드"),
            note("pistachio", "피스타치오"),
            note("hazelnut", "헤이즐넛"),
            note("milk", "밀크", "우유"),
            note("marshmallow", "마시멜로"),
            note("cotton-candy", "솜사탕", "코튼 캔디"),
            note("rum", "럼"),
        ],
    },
    {
        id: "musk",
        name: "머스크·앰버",
        notes: [
            note("musk", "머스크"),
            note("white-musk", "화이트 머스크", "화이트머스크"),
            note("amber", "앰버", "엠버"),
            note("ambergris", "앰버그리스"),
            note("ambroxan", "앰브록스", "앰브록산", "암브록산"),
            note("cashmeran", "캐시메란", "캐시머란"),
            note("ambrette", "암브레트", "앰브레트"),
            note("aldehyde", "알데하이드"),
            note("powder", "파우더리", "파우더"),
        ],
    },
    {
        id: "resin",
        name: "레진·스모키",
        notes: [
            note("incense", "인센스"),
            note("frankincense", "올리바넘", "프랑킨센스", "유향"),
            note("myrrh", "미르", "몰약"),
            note("benzoin", "벤조인"),
            note("labdanum", "라브다넘"),
            note("elemi", "엘레미"),
            note("opoponax", "오포포낙스"),
            note("styrax", "스티락스"),
            note("tolu-balsam", "톨루 발삼"),
            note("tobacco", "타바코", "담배"),
            note("leather", "레더", "가죽"),
            note("suede", "스웨이드"),
            note("birch-tar", "버치 타르"),
        ],
    },
    {
        id: "aquatic",
        name: "아쿠아",
        notes: [
            note("sea-breeze", "바닷바람", "마린", "씨 브리즈", "스프레이"),
            note("sea-salt", "바다 소금", "씨솔트", "솔트", "소금"),
            note("water", "워터"),
            note("ozone", "오존"),
            note("mineral", "미네랄"),
            note("rain", "빗방울", "레인"),
            note("water-lily", "수련", "워터 릴리"),
            note("seaweed", "해조류", "씨위드"),
            note("sand", "모래"),
        ],
    },
];

/** id로 향을 찾는 표 — 모듈을 불러올 때 한 번만 만든다 */
export const SCENT_NOTE_BY_ID: ReadonlyMap<string, ScentNote> = new Map(
    SCENT_FAMILIES.flatMap((family) => family.notes.map((scent) => [scent.id, scent] as const)),
);

/** 띄어쓰기·대소문자를 무시하고 비교한다 ("오렌지블로섬" = "오렌지 블로섬") */
const normalize = (text: string) => text.replace(/\s+/g, "").toLowerCase();

/** 향마다 검색할 글자 — 이름·다른 표기·영문 id. 모듈을 불러올 때 한 번만 만든다 */
const SEARCH_TEXT_BY_ID = new Map(
    SCENT_FAMILIES.flatMap((family) =>
        family.notes.map((scent) => [scent.id, normalize([scent.name, ...scent.aliases, scent.id].join("|"))] as const),
    ),
);

/** 검색어에 맞는 향만 남긴 계열 목록. 검색어가 없으면 원래 목록을 그대로 돌려준다 */
const FAMILY_NAME_BY_ID: ReadonlyMap<string, string> = new Map(
    SCENT_FAMILIES.map((family) => [family.id, family.name]),
);

/** 계열 id → 보여줄 이름(모르는 id면 그대로) */
export const scentFamilyName = (id: string) => FAMILY_NAME_BY_ID.get(id) ?? id;

/** 향 id → 보여줄 이름(모르는 id면 그대로) */
export const scentNoteName = (id: string) => SCENT_NOTE_BY_ID.get(id)?.name ?? id;

/**
 * 향마다 가장 흔한 층 — 층 정보가 없는 옛 공유 링크(?notes=)를 열 때만 쓴다.
 * 계열 기준(시트러스·그린은 탑, 플로럴은 미들, 우디·머스크는 베이스) + 후추·생강은 탑.
 */
const FAMILY_LAYER: Record<string, ScentLayerId> = {
    citrus: "top",
    fruity: "top",
    green: "top",
    aquatic: "top",
    floral: "middle",
    spicy: "middle",
    woody: "base",
    sweet: "base",
    musk: "base",
    resin: "base",
};

/** 계열과 층이 다른 향 — 후추·생강은 처음에 톡 쏘는 탑 노트로 쓴다 */
const LAYER_OVERRIDES: Record<string, ScentLayerId> = {
    "black-pepper": "top",
    "pink-pepper": "top",
    "white-pepper": "top",
    ginger: "top",
};

/** 향 id → 흔한 층 (옛 링크용) */
export const LAYER_BY_NOTE_ID: ReadonlyMap<string, ScentLayerId> = new Map(
    SCENT_FAMILIES.flatMap((family) =>
        family.notes.map((scent) => [scent.id, LAYER_OVERRIDES[scent.id] ?? FAMILY_LAYER[family.id]] as const),
    ),
);

export type ScentLayer = {
    id: ScentLayerId;
    /** 화면에 보이는 이름 */
    name: string;
    /**
     * 뿌린 뒤 언제 나는 향인지 — 아직 안 고른 층 자리에 보인다.
     * 탑 5~20분, 미들 15~30분 뒤부터 몇 시간, 베이스 몇 시간~며칠(향수 노트 안내 글 기준, 농도·피부에 따라 다름)
     */
    hint: string;
    /** 이 층을 열면 먼저 보여 줄 계열 — 실제 향수에서 이 층에 가장 많이 쓰는 계열 */
    defaultFamilyId: string;
};

/**
 * 고르는 순서대로. 세 층 모두 같은 계열 10개·향 전부를 보여 주고, 어느 향이든 어느 층에 담을 수 있다
 * (사이트 향수 106개의 TOP/HEART/BASE 노트 중 약 25%가 그 향의 흔한 층이 아닌 곳에 쓰였다, 2026-11-25).
 * 먼저 여는 계열은 같은 표에서 층마다 가장 많이 나온 계열(TOP 시트러스 87회, HEART 플로럴 133회, BASE 우디 119회).
 */
export const SCENT_LAYERS: readonly ScentLayer[] = [
    { id: "top", name: "처음 향", hint: "뿌리자마자 나는 향", defaultFamilyId: "citrus" },
    { id: "middle", name: "중심 향", hint: "30분쯤 지나 나는 향", defaultFamilyId: "floral" },
    { id: "base", name: "남는 향", hint: "몇 시간 뒤까지 남는 향", defaultFamilyId: "woody" },
];

const LAYER_BY_ID: ReadonlyMap<string, ScentLayer> = new Map(SCENT_LAYERS.map((layer) => [layer.id, layer]));
export const getScentLayer = (id: ScentLayerId): ScentLayer => LAYER_BY_ID.get(id) ?? SCENT_LAYERS[0];
export const isScentLayerId = (id: string): id is ScentLayerId => LAYER_BY_ID.has(id);

/** 층마다 고른 향(고른 순서). 한 향은 한 층에만 담는다 */
export type LayerNotes = Readonly<Record<ScentLayerId, readonly string[]>>;
export const EMPTY_LAYER_NOTES: LayerNotes = { top: [], middle: [], base: [] };

/** 세 층에서 고른 향 전체 — 처음 → 중심 → 남는 향 순서 */
export const allNoteIds = (notes: LayerNotes) => SCENT_LAYERS.flatMap((layer) => notes[layer.id]);

/** 이 향을 담은 층(없으면 undefined) */
export const layerOfNote = (notes: LayerNotes, noteId: string) =>
    SCENT_LAYERS.find((layer) => notes[layer.id].includes(noteId));

/** 계열을 검색어로 거른다. 검색어가 없으면 받은 배열을 그대로 돌려준다(다시 그리지 않게) */
export function filterScentFamilies(families: readonly ScentFamily[], query: string): readonly ScentFamily[] {
    const keyword = normalize(query);
    if (!keyword) return families;
    return families.map((family) => ({
        ...family,
        notes: family.notes.filter((scent) => SEARCH_TEXT_BY_ID.get(scent.id)?.includes(keyword)),
    })).filter((family) => family.notes.length > 0);
}

/**
 * 향수 노트 용어집 — 영문 노트 이름을 한국 향수 판매처에서 통용되는 표기로 옮긴다.
 *
 * 원료 노트의 한국어 표기는 LLM이 아니라 코드가 이 용어집으로 정한다.
 * 그래서 실행할 때마다 같은 표기가 나오고(예: Patchouli는 항상 "패출리"),
 * 용어집에 없는 단어가 섞인 원료는 한글로 지어 옮기지 않고 영문 그대로 둔다.
 * 표기를 바꾸거나 단어를 추가할 때는 이 파일만 고치면 프롬프트에도 함께 반영된다.
 *
 * 작성 규칙
 * - 영문은 소문자·단수형. 철자가 여러 가지면 "|"로 나열한다(예: "vetiver|vetyver").
 * - 복수형(-s, -es, -ies)은 코드가 단수형으로 바꿔 찾으므로 따로 적지 않는다(불규칙형만 적는다).
 * - 여러 단어가 한 덩어리로 굳은 것만 구로 적는다(예: "tonka bean" → 통카빈).
 *   나머지는 단어별 표기를 띄어 이어 붙인다(예: green + apple → "그린 애플").
 */
import { stripAccents } from "./text";

const MATERIAL_TERMS: readonly (readonly [en: string, ko: string])[] = [
  // 시트러스
  ["bergamot", "베르가못"],
  ["lemon", "레몬"],
  ["lime", "라임"],
  ["mandarin", "만다린"],
  ["tangerine", "탠저린"],
  ["clementine", "클레멘타인"],
  ["orange", "오렌지"],
  ["grapefruit", "자몽"],
  ["pomelo", "포멜로"],
  ["yuzu", "유자"],
  ["citron", "시트론"],
  ["neroli", "네롤리"],
  ["petitgrain", "페티그레인"],
  ["lemongrass", "레몬그라스"],
  ["verbena", "버베나"],
  ["citrus", "시트러스"],

  // 플로럴
  ["rose", "로즈"],
  ["jasmine", "자스민"],
  ["tuberose", "튜베로즈"],
  ["iris", "아이리스"],
  ["orris", "오리스"],
  ["violet", "바이올렛"],
  ["lily", "릴리"],
  ["madonna lily", "마돈나 릴리"],
  ["lily of the valley|muguet", "은방울꽃"],
  ["peony", "피오니"],
  ["magnolia", "매그놀리아"],
  ["gardenia", "가드니아"],
  ["freesia", "프리지아"],
  ["lavender", "라벤더"],
  ["lavandin", "라반딘"],
  ["geranium", "제라늄"],
  ["ylang ylang|ylang", "일랑일랑"],
  ["osmanthus", "오스만투스"],
  ["mimosa", "미모사"],
  ["heliotrope", "헬리오트로프"],
  ["orchid", "오키드"],
  ["lotus", "로터스"],
  ["carnation", "카네이션"],
  ["narcissus", "나르시스"],
  ["hyacinth", "히아신스"],
  ["lilac", "라일락"],
  ["honeysuckle", "허니서클"],
  ["tiare", "티아레"],
  ["frangipani", "프랜지파니"],
  ["champaca", "참파카"],
  ["immortelle", "이모르뗄"],
  ["chamomile|camomile", "캐모마일"],
  ["poppy", "포피"],
  ["damask", "다마스크"],

  // 과일·견과
  ["apple", "애플"],
  ["pear", "페어"],
  ["peach", "피치"],
  ["apricot", "애프리콧"],
  ["plum", "플럼"],
  ["cherry", "체리"],
  ["raspberry", "라즈베리"],
  ["strawberry", "스트로베리"],
  ["blackberry", "블랙베리"],
  ["blueberry", "블루베리"],
  ["blackcurrant|black currant", "블랙커런트"],
  ["cassis", "카시스"],
  ["fig", "피그"],
  ["coconut", "코코넛"],
  ["pineapple", "파인애플"],
  ["mango", "망고"],
  ["banana", "바나나"],
  ["guava", "구아바"],
  ["lychee|litchi", "리치"],
  ["melon", "멜론"],
  ["watermelon", "워터멜론"],
  ["pomegranate", "석류"],
  ["passion fruit|passionfruit", "패션프루트"],
  ["rhubarb", "루바브"],
  ["quince", "퀸스"],
  ["olive", "올리브"],
  ["avocado", "아보카도"],
  ["berry", "베리"],
  ["almond", "아몬드"],
  ["hazelnut", "헤이즐넛"],
  ["pistachio", "피스타치오"],

  // 스파이스·허브
  ["pepper|peppercorn", "페퍼"],
  ["baie rose|baies rose", "핑크 페퍼"], // 프랑스어 표기 (pink pepper)
  ["chili|chilli", "칠리"],
  ["cardamom", "카다멈"],
  ["cinnamon", "시나몬"],
  ["clove", "클로브"],
  ["nutmeg", "넛맥"],
  ["ginger", "진저"],
  ["saffron", "사프란"],
  ["coriander", "코리앤더"],
  ["cumin", "커민"],
  ["anise", "아니스"],
  ["star anise", "스타 아니스"],
  ["fennel", "펜넬"],
  ["licorice|liquorice", "리코리스"],
  ["basil", "바질"],
  ["mint", "민트"],
  ["peppermint", "페퍼민트"],
  ["spearmint", "스피어민트"],
  ["rosemary", "로즈마리"],
  ["thyme", "타임"],
  ["sage", "세이지"],
  ["clary sage", "클라리 세이지"],
  ["tarragon", "타라곤"],
  ["eucalyptus", "유칼립투스"],
  ["artemisia", "아르테미지아"],
  ["davana", "다바나"],
  ["angelica", "안젤리카"],
  ["absinthe", "압생트"],
  ["juniper", "주니퍼"],
  ["tea", "티"],
  ["mate", "마테"],
  ["carrot", "캐럿"],
  ["tomato", "토마토"],
  ["rice", "라이스"],

  // 우드·이끼
  ["sandalwood", "샌달우드"],
  ["cedar", "시더"],
  ["cedarwood", "시더우드"],
  ["vetiver|vetyver", "베티버"],
  ["patchouli", "패출리"],
  ["oud|oudh", "오드"],
  ["agarwood", "아가우드"],
  ["guaiac|gaiac", "가이악"],
  ["guaiacwood|gaiacwood", "가이악 우드"],
  ["birch", "버치"],
  ["pine", "파인"],
  ["cypress", "사이프러스"],
  ["fir", "퍼"],
  ["spruce", "스프루스"],
  ["poplar", "포플러"],
  ["maple", "메이플"],
  ["willow", "윌로우"],
  ["linden", "린덴"],
  ["acacia", "아카시아"],
  ["redwood", "레드우드"],
  ["privet", "프리벳"],
  ["heather", "헤더"],
  ["fern", "펀"],
  ["ivy", "아이비"],
  ["hay", "헤이"],
  ["oak", "오크"],
  ["oakmoss|oak moss", "오크모스"],
  ["moss", "이끼"],
  ["rosewood", "로즈우드"],
  ["ebony", "에보니"],
  ["teak", "티크"],
  ["mahogany", "마호가니"],
  ["driftwood", "드리프트우드"],
  ["bamboo", "뱀부"],
  ["palo santo", "팔로 산토"],
  ["hinoki", "히노키"],
  ["papyrus", "파피루스"],
  ["cashmere", "캐시미어"],
  ["cashmeran", "캐시메란"],
  ["akigalawood", "아키갈라우드"],

  // 레진·발삼
  ["amber", "앰버"],
  ["ambergris", "앰버그리스"],
  ["incense", "인센스"],
  ["frankincense", "프랑킨센스"],
  ["olibanum", "올리바넘"],
  ["myrrh", "미르"],
  ["benzoin", "벤조인"],
  ["labdanum", "라브다넘"],
  ["cistus", "시스투스"],
  ["balsam", "발삼"],
  ["opoponax", "오포포낙스"],
  ["styrax", "스티락스"],
  ["elemi", "엘레미"],
  ["galbanum", "갈바넘"],
  ["tolu", "톨루"],
  ["peru", "페루"],
  ["copal", "코팔"],
  ["resin", "레진"],
  ["tar", "타르"],

  // 구르망·술·가죽
  ["vanilla", "바닐라"],
  ["bourbon", "버번"],
  ["tonka bean|tonka", "통카빈"],
  ["caramel", "카라멜"],
  ["chocolate", "초콜릿"],
  ["cocoa", "코코아"],
  ["cacao", "카카오"],
  ["coffee", "커피"],
  ["honey", "허니"],
  ["beeswax", "비즈왁스"],
  ["praline", "프랄린"],
  ["sugar", "슈가"],
  ["marshmallow", "마시멜로"],
  ["butter", "버터"],
  ["milk", "밀크"],
  ["cream", "크림"],
  ["rum", "럼"],
  ["whiskey|whisky", "위스키"],
  ["cognac", "코냑"],
  ["champagne", "샴페인"],
  ["wine", "와인"],
  ["tobacco", "토바코"],
  ["leather", "레더"],
  ["suede", "스웨이드"],
  ["salt", "솔트"],
  ["sea salt", "씨 솔트"],
  ["seaweed", "해조류"],

  // 머스크·합성 원료
  ["musk", "머스크"],
  ["skin musk", "스킨 머스크"],
  ["ambrette", "암브레트"],
  ["ambroxan|ambroxon|ambrox", "암브록산"],
  ["iso e super", "이소 이 슈퍼"],
  ["hedione", "헤디온"],
  ["aldehyde", "알데하이드"],
  ["calone", "칼론"],
  ["civet", "시벳"],
  ["castoreum", "카스토리움"],
];

/**
 * 원료가 아닌 일반 단어(부위·형태·수식어). 원료와 붙어 노트 이름을 이룬다(violet leaf → 바이올렛 리프).
 * 원료와 달리, 풍경·사물 표현에 섞여 있을 때는 LLM이 뜻으로 옮기는 것을 막지 않는다(wet wood → 젖은 나무).
 */
const GENERAL_TERMS: readonly (readonly [en: string, ko: string])[] = [
  // 부위·형태
  ["flower", "플라워"],
  ["blossom", "블로썸"],
  ["petal", "페탈"],
  ["leaf|leaves", "리프"],
  ["wood", "우드"],
  ["seed", "씨드"],
  ["root", "루트"],
  ["bark", "바크"],
  ["bud", "버드"],
  ["zest", "제스트"],
  ["peel", "필"],
  ["water", "워터"],
  ["nectar", "넥타"],
  ["powder", "파우더"],
  ["smoke", "스모크"],
  ["cotton", "코튼"],
  ["linen", "린넨"],
  ["accord", "어코드"],
  ["note", "노트"],

  // 수식어
  ["wild", "와일드"],
  ["green", "그린"],
  ["white", "화이트"],
  ["black", "블랙"],
  ["pink", "핑크"],
  ["red", "레드"],
  ["blue", "블루"],
  ["sweet", "스위트"],
  ["bitter", "비터"],
  ["fresh", "프레시"],
  ["dry", "드라이"],
  ["smoky", "스모키"],
  ["creamy", "크리미"],
  ["spicy", "스파이시"],
  ["woody", "우디"],
  ["floral", "플로럴"],
  ["fruity", "프루티"],
  ["aquatic", "아쿠아틱"],
  ["marine", "마린"],
  ["ozonic", "오조닉"],
  ["mineral", "미네랄"],
  ["powdery", "파우더리"],
  ["solar", "솔라"],
  ["aromatic", "아로마틱"],
  ["herbal", "허벌"],
  ["earthy", "어시"],
];

/**
 * 산지 표기 — 한국어에서는 원료 앞에 온다.
 * 예) "Sandalwood Australia" → "호주 샌달우드", "Persian lime" → "페르시안 라임"
 */
const ORIGINS: readonly (readonly [en: string, ko: string])[] = [
  ["australian|australia", "호주"],
  ["madagascan|madagascar", "마다가스카르"],
  ["javanese|java", "자바"],
  ["indonesian|indonesia", "인도네시아"],
  ["persian", "페르시안"],
  ["californian|california", "캘리포니아"],
  ["virginian|virginia", "버지니아"],
  ["sicilian|sicily", "시칠리아"],
  ["calabrian|calabria", "칼라브리아"],
  ["italian|italy", "이탈리아"],
  ["french|france", "프랑스"],
  ["bulgarian|bulgaria", "불가리아"],
  ["turkish", "터키"],
  ["moroccan|morocco", "모로코"],
  ["tunisian|tunisia", "튀니지"],
  ["egyptian|egypt", "이집트"],
  ["somali|somalia", "소말리아"],
  ["indian|india", "인도"],
  ["mysore", "마이소르"],
  ["haitian|haiti", "아이티"],
  ["tahitian|tahiti", "타히티"],
  ["brazilian|brazil", "브라질"],
  ["mexican|mexico", "멕시코"],
  ["japanese|japan", "일본"],
  ["atlas", "아틀라스"],
];

/** 원료 이름이 아니라 추출 방식·등급을 나타내는 단어 — 노트 이름에서 뺀다 */
const NOISE_WORDS: ReadonlySet<string> = new Set(["oil", "absolute", "essence", "extract", "essential", "co2"]);

function toMap(entries: readonly (readonly [string, string])[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const [en, ko] of entries) {
    for (const variant of en.split("|")) map.set(variant, ko);
  }
  return map;
}

const MATERIAL_MAP = toMap(MATERIAL_TERMS);
const TERM_MAP = toMap([...MATERIAL_TERMS, ...GENERAL_TERMS]);
const ORIGIN_MAP = toMap(ORIGINS);
const MAX_PHRASE_WORDS = Math.max(...[...TERM_MAP.keys()].map((key) => key.split(" ").length));

/** 악센트·대소문자·기호를 무시한 단어 목록 (추출 방식 단어 제외) */
export function noteWords(text: string): string[] {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word && !NOISE_WORDS.has(word));
}

/** 복수형일 수 있는 단어의 단수형 후보 (roses → rose, peaches → peach, berries → berry) */
function singularForms(word: string): string[] {
  const forms: string[] = [];
  if (word.endsWith("ies")) forms.push(`${word.slice(0, -3)}y`);
  if (word.endsWith("s")) forms.push(word.slice(0, -1));
  if (word.endsWith("es")) forms.push(word.slice(0, -2));
  return forms;
}

/** 그대로 찾고, 없으면 구의 마지막 단어를 단수형으로 바꿔 다시 찾는다 (tonka beans → tonka bean) */
function lookup(map: Map<string, string>, words: string[]): string | undefined {
  const head = words.slice(0, -1);
  const last = words[words.length - 1];
  for (const form of [last, ...singularForms(last)]) {
    const found = map.get([...head, form].join(" "));
    if (found) return found;
  }
  return undefined;
}

/** 노트 이름의 단어를 용어집 표기(그중 원료)·산지 표기·용어집에 없는 단어로 나눈다 */
function matchGlossary(en: string): { terms: string[]; materials: string[]; origins: string[]; unknown: string[] } {
  const words = noteWords(en);
  const terms: string[] = [];
  const materials: string[] = [];
  const origins: string[] = [];
  const unknown: string[] = [];

  for (let i = 0; i < words.length; ) {
    let matched = 0;
    for (let size = Math.min(MAX_PHRASE_WORDS, words.length - i); size >= 1; size--) {
      const phrase = words.slice(i, i + size);
      const term = lookup(TERM_MAP, phrase);
      if (term) {
        terms.push(term);
        if (lookup(MATERIAL_MAP, phrase)) materials.push(term);
        matched = size;
        break;
      }
    }
    if (!matched) {
      const origin = lookup(ORIGIN_MAP, [words[i]]);
      if (origin) origins.push(origin);
      else unknown.push(words[i]);
      matched = 1;
    }
    i += matched;
  }

  return { terms, materials, origins, unknown };
}

/**
 * 영문 노트 이름을 용어집 표기로 옮긴다 (순수 함수).
 * 모든 단어가 용어집(또는 산지 표기)에 있을 때만 값을 돌려주고, 하나라도 없으면 null이다.
 * 예) "Fir Balsam Absolute" → "퍼 발삼", "Tonka Beans" → "통카빈", "balm of Gilead" → null
 */
export function translateNoteWithGlossary(en: string): string | null {
  const { terms, origins, unknown } = matchGlossary(en);
  return unknown.length === 0 && terms.length > 0 ? [...origins, ...terms].join(" ") : null;
}

/**
 * 노트 이름에 들어 있는 원료의 용어집 표기 목록 (순수 함수). 없으면 빈 배열.
 * LLM이 옮긴 노트가 원료 부분만큼은 용어집 표기를 썼는지 확인하는 데 쓴다.
 * 예) "flowering privet" → ["프리벳"], "wet wood" → [], "holy dirt" → []
 */
export function glossaryMaterialsIn(en: string): string[] {
  return matchGlossary(en).materials;
}

/** 프롬프트에 넣는 용어집 — "english=한국어"를 쉼표로 나열한다 (철자가 여러 가지면 "/"로 함께 적는다) */
export const NOTE_GLOSSARY_PROMPT = [...MATERIAL_TERMS, ...GENERAL_TERMS, ...ORIGINS]
  .map(([en, ko]) => `${en.replaceAll("|", "/")}=${ko}`)
  .join(", ");

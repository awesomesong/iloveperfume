import { OPENAI_TEXT_MODEL } from "@/src/app/lib/ai/models";

/**
 * 향수 뉴스 파이프라인 설정.
 * 운영하면서 가장 자주 손보는 값(검색어·제외 키워드·기준 점수)은 모두 여기에 모은다.
 */

/**
 * 고정 검색어 — "향수" 단독 검색은 잡음이 많아 의도가 분명한 조합만 쓴다.
 * 네이버 검색은 단어 AND 검색이라 "향수 브랜드"는 "향수 브랜드 론칭"을 포함하고, 48시간 창에서 다른 검색어에 없는 기사를 더 가져온다.
 * 여기에 PERFUME_BRANDS의 "{브랜드} 향수" 검색어를 더한다(collectNews.buildQueries).
 */
export const BASE_QUERIES = [
  "향수 신제품",
  "향수 출시",
  "오 드 퍼퓸 출시",
  "향수 한정판",
  "니치 향수",
  "향수 팝업",
  "향수 브랜드",
] as const;

/**
 * 한 번 호출에 가져올 기사 수 (네이버 API 최대 100).
 * 20건이면 "향수 출시"처럼 기사가 많은 검색어는 최신 20건이 33시간만 덮어 48시간 창의 기사를 놓친다.
 */
export const PER_QUERY_DISPLAY = 100;

/** 검색어당 최대 페이지 수 — 페이지의 마지막 기사가 아직 WINDOW_HOURS 안이면 다음 페이지(start)를 더 가져온다 */
export const NAVER_MAX_PAGES_PER_QUERY = 3;

/** 네이버 검색 API 동시 호출 수 — 검색어 12개를 한꺼번에 보내면 429(Rate limit exceeded)가 났다 */
export const NAVER_CONCURRENCY = 3;

/**
 * 네이버 검색 API 요청 시작 간격(ms) — 동시 호출 수와 별개로 초당 요청 수를 묶는다(150ms ≈ 초당 6.7건).
 * 브랜드 검색어를 더해 검색어가 49개가 되자 동시 3개만으로는 응답이 빨라 초당 10건을 넘겨 429가 났다(2026-11 실측).
 * 검색어 49개 + 추가 페이지 기준 실행 시간은 10초 안팎 — 크론 maxDuration(120초) 안에서 OpenAI 호출(최대 40초)과 나눠 쓴다.
 */
export const NAVER_MIN_INTERVAL_MS = 150;

/** 429·5xx 응답 재시도 간격(ms) — 길이가 곧 최대 재시도 횟수 */
export const NAVER_RETRY_DELAYS_MS = [500, 1_000] as const;

/** 이 시간 이내에 발행된 기사만 후보로 삼는다 (하루 1회 실행 + 누락 방지 여유분) */
export const WINDOW_HOURS = 48;

/** 제목·발췌문에 포함되면 LLM 호출 전에 제외하는 키워드 */
export const EXCLUDE_KEYWORDS = [
  "주가",
  "주식",
  "실적",
  "영업이익",
  "매출액",
  "증권",
  "고향",
  "향수병",
  "노스탤지어",
  "부고",
] as const;

/**
 * 향수 기사 판별용 용어 (perfumeArticle.ts) — 제목·발췌문에서 몇 번 나오는지 센다.
 * 네이버 검색은 본문 어딘가에 "향수"만 있어도 걸려서, 이 판별 전에는 규칙 필터를 통과한 25건 중
 * 제목에 이 용어가 있는 6건만 향수 기사였다(나머지 19건은 발췌문에 한 번 — 판매 품목 나열·"향수를 자극" 등, 2026-11 실측).
 * "조향"은 자동차 조향 장치 기사를 피하려고 뒤에 장치·시스템 등이 오면 세지 않는다.
 * 전역(g) 정규식이므로 .test() 대신 String.match/replace로만 쓴다(lastIndex 상태 공유 방지).
 */
export const PERFUME_TERM_PATTERN =
  /향수|퍼퓸|퍼퓨머|perfume|fragrance|프래그런스|프레그런스|오 ?드 ?(?:퍼퓸|뚜왈렛|투알렛|코롱)|코롱|조향(?! ?(?:장치|시스템|보조|휠|축))/gi;

/**
 * 추억·그리움 뜻의 "향수"(鄕愁) — 세기 전에 지운다. 각 패턴은 "향수"를 정확히 한 번 포함한다.
 * 따옴표·낫표를 지운 뒤 맞춰 본다("‘13년 전 향수’를 넘어" → "13년 전 향수를 넘어").
 * "향수를 넘어"만으로는 넣지 않는다 — "스킨케어와 향수를 넘어 라이프스타일로"처럼 향수 뜻으로도 쓰인다.
 * "옛 향수"도 넣지 않는다 — "보존된 옛 향수에서 영감을 받은 제품"처럼 향수 뜻으로 쓰인다.
 */
export const NOSTALGIA_PATTERN = new RegExp(
  [
    "(?:시절|원작|과거|당시|년대|그때|그 때|추억)의? ?향수",
    "\\d+ ?년 ?전(?:의)? ?향수",
    "향수(?:를|에|가|와|도)? ?(?:자극|불러일으|불러 일으|젖|어린|달래|소환|간직|느끼)",
    "추억과 향수",
    "향수와 (?:추억|그리움)",
    "그리움과 향수",
  ].join("|"),
  "g",
);

/** 제목에 향수 용어가 없을 때 발췌문에서 이 횟수 이상 나와야 향수 기사로 본다 — 1회는 대부분 품목 나열·곁가지 언급이었다 */
export const MIN_DESCRIPTION_PERFUME_MENTIONS = 2;

/**
 * 향수 브랜드 — "{name} 향수" 검색어(collectNews.buildQueries)와 제목 브랜드 판별(perfumeArticle.ts)에 함께 쓴다.
 * 고정 검색어만으로는 샤넬·디올처럼 큰 브랜드의 향수 기사(제목에 "향수"가 없는 화보·행사 기사)를 놓쳤다
 * — 14일 실측에서 브랜드 검색어로만 잡힌 기사 29건 중 샤넬 뷰티×정국 향수 화보(17개 매체)·마르지엘라 향수 커버 인터뷰 등 (2026-11).
 *
 * - name: 검색어에 쓰는 한글 이름(띄어쓰기 그대로 — 네이버는 단어 AND 검색이라 "조르지오 아르마니"보다 "아르마니"가 넓다).
 * - aliases: 제목 판별용 표기. 소문자 + 글자·숫자만 남긴 형태(compactText)로 쓰고, 2글자 이상·흔한 단어와 겹치지 않는 것만 넣는다.
 *   비어 있으면 검색어 전용이다("크리드"는 영화 제목과 겹쳐 제목 판별에 쓰지 않는다).
 * - excludes: 별칭을 품은 다른 말 — 비교 전에 제목에서 지운다("불가리아" 안의 "불가리", "킬리안 음바페" 안의 "킬리안").
 * - kind
 *   · "house": 향수 전문 브랜드 — 제목에 있으면 향수 기사로 본다("킬리안 파리, 홀리데이 캠페인 공개").
 *   · "fashion": 패션·화장품을 겸하는 브랜드(핸드크림·바디 제품도 파는 탬버린즈·논픽션 포함) — 제목의 브랜드만으로는
 *     패션·가방 기사까지 걸리므로 발췌문에 향수 용어(제품명 포함)가 1번 이상 있어야 한다.
 */
export type PerfumeBrand = {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly excludes?: readonly string[];
  readonly kind: "house" | "fashion";
};

export const PERFUME_BRANDS: readonly PerfumeBrand[] = [
  // 향수 전문 브랜드
  { name: "킬리안", aliases: ["킬리안", "kilian"], excludes: ["킬리안음바페"], kind: "house" },
  { name: "딥티크", aliases: ["딥티크", "딥디크", "diptyque"], kind: "house" },
  { name: "조말론", aliases: ["조말론", "jomalone"], kind: "house" },
  { name: "바이레도", aliases: ["바이레도", "byredo"], kind: "house" },
  { name: "르라보", aliases: ["르라보", "lelabo"], kind: "house" },
  { name: "메종 프란시스 커정", aliases: ["프란시스커정", "kurkdjian"], kind: "house" },
  { name: "산타마리아노벨라", aliases: ["산타마리아노벨라", "santamarianovella"], kind: "house" },
  { name: "펜할리곤스", aliases: ["펜할리곤스", "penhaligon"], kind: "house" },
  { name: "아쿠아 디 파르마", aliases: ["아쿠아디파르마", "acquadiparma"], kind: "house" },
  { name: "세르주 루텐", aliases: ["세르주루텐", "세르주뤼땅", "sergelutens"], kind: "house" },
  { name: "프레데릭 말", aliases: ["프레데릭말", "fredericmalle"], kind: "house" },
  { name: "구딸", aliases: ["구딸", "goutal"], kind: "house" },
  { name: "크리드", aliases: [], kind: "house" },
  { name: "메모 파리", aliases: ["메모파리", "memoparis"], kind: "house" },
  { name: "엑스 니힐로", aliases: ["엑스니힐로", "exnihilo"], kind: "house" },
  { name: "줄리엣 해즈 어 건", aliases: ["줄리엣해즈어건", "juliettehasagun"], kind: "house" },
  { name: "퍼퓸 드 말리", aliases: ["퍼퓸드말리", "parfumsdemarly"], kind: "house" },
  // 패션·화장품 브랜드
  { name: "샤넬", aliases: ["샤넬", "chanel"], kind: "fashion" },
  { name: "디올", aliases: ["디올", "dior"], kind: "fashion" },
  { name: "에르메스", aliases: ["에르메스", "hermes", "hermès"], kind: "fashion" },
  { name: "구찌", aliases: ["구찌", "gucci"], kind: "fashion" },
  { name: "프라다", aliases: ["프라다", "prada"], kind: "fashion" },
  { name: "입생로랑", aliases: ["입생로랑", "생로랑", "ysl", "saintlaurent"], kind: "fashion" },
  { name: "아르마니", aliases: ["아르마니", "armani"], kind: "fashion" },
  { name: "톰포드", aliases: ["톰포드", "tomford"], kind: "fashion" },
  { name: "버버리", aliases: ["버버리", "burberry"], kind: "fashion" },
  { name: "겔랑", aliases: ["겔랑", "guerlain"], kind: "fashion" },
  { name: "지방시", aliases: ["지방시", "givenchy"], kind: "fashion" },
  { name: "메종 마르지엘라", aliases: ["마르지엘라", "margiela"], kind: "fashion" },
  { name: "불가리", aliases: ["불가리", "bulgari", "bvlgari"], excludes: ["불가리아", "bulgaria"], kind: "fashion" },
  { name: "루이비통", aliases: ["루이비통", "louisvuitton"], kind: "fashion" },
  { name: "랑콤", aliases: ["랑콤", "lancome", "lancôme"], kind: "fashion" },
  { name: "에스티 로더", aliases: ["에스티로더", "esteelauder"], kind: "fashion" },
  { name: "로에베", aliases: ["로에베", "loewe"], kind: "fashion" },
  { name: "발렌티노", aliases: ["발렌티노", "valentino"], kind: "fashion" },
  { name: "돌체앤가바나", aliases: ["돌체앤가바나", "돌체앤드가바나", "돌체가바나", "dolcegabbana"], kind: "fashion" },
  { name: "베르사체", aliases: ["베르사체", "versace"], kind: "fashion" },
  { name: "끌로에", aliases: ["끌로에", "chloé", "chloe"], kind: "fashion" },
  { name: "몽블랑", aliases: ["몽블랑", "montblanc"], kind: "fashion" },
  { name: "캘빈클라인", aliases: ["캘빈클라인", "calvinklein"], kind: "fashion" },
  { name: "탬버린즈", aliases: ["탬버린즈", "tamburins"], kind: "fashion" },
  { name: "논픽션", aliases: ["논픽션", "nonfiction"], kind: "fashion" },
];

/**
 * 유명 향수 제품명 — 향수 용어 1회로 친다("디올 소바쥬 새 캠페인"처럼 제목에 "향수" 없이 제품명만 있는 기사).
 * 비교는 소문자 + 글자·숫자·°만 남긴 텍스트에 포함되는지로 한다("N°5"·"N˚5" 표기를 살리려고 °·˚는 지우지 않는다).
 * "굿걸"·"샹스"·"리브르"·"블룸"처럼 다른 뜻으로 흔히 쓰이는 이름은 넣지 않는다.
 */
export const PERFUME_PRODUCT_NAMES: readonly string[] = [
  "n°5", "n˚5", "넘버5", "넘버파이브",
  "미스디올", "missdior",
  "쟈도르", "자도르", "jadore",
  "소바쥬", "sauvage",
  "블루드샤넬", "bleudechanel",
  "코코마드모아젤", "코코마드무아젤", "cocomademoiselle",
  "블랙오피움", "blackopium",
  "라비에벨", "lavieestbelle",
  "아쿠아디지오", "acquadigio",
  "떼르데르메스", "terredhermes",
  "아벤투스", "aventus",
  "몽파리", "monparis",
  "플라워바이겐조",
  "블랙오키드", "blackorchid",
];

/** 차단할 매체 도메인 (품질이 낮거나 광고성 기사가 많은 곳을 운영하며 추가) */
export const BLOCKED_DOMAINS: readonly string[] = [];

/**
 * 제목 유사도가 이 값 이상이면 같은 소식의 중복 보도로 본다 (dedupe.ts).
 * 유사도 = 제목 글자 바이그램의 IDF 가중 코사인 — 후보 기사 전체에서 흔한 단어(향수·출시)는 가볍게,
 * 고유명사(브랜드·제품명)는 무겁게 본다. 실데이터 측정: 같은 소식 0.5~1.0, 다른 소식 최대 ~0.45.
 */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.5;

/**
 * 같은 브랜드의 최근 글과 같은 소식으로 보는 제목 유사도 (selectAndSummarize.validateSelection).
 * 최근 DUPLICATE_LOOKBACK_DAYS일 글 제목에 같은 브랜드가 있고, 그 제목과의 유사도가 이 값 이상이면 싣지 않는다.
 * 브랜드가 같으면 다른 표현의 같은 소식일 가능성이 높아 DUPLICATE_SIMILARITY_THRESHOLD보다 낮게 둔다.
 * 2026-11 실측(14일 기사 코퍼스): 같은 브랜드 제목 쌍 중 같은 소식 691쌍은 0.3 이상이 74%, 다른 소식 800쌍은 0.3 이상이 1.3%(최대 0.37).
 * "샤넬 뷰티, 정국과 향수 3종 화보 공개" vs "정국, 샤넬 향수 3종 담은 보그 코리아 12월호 커버"(같은 소식) 0.33,
 * "디올, 성수 향수 팝업 오픈" vs "디올 소바쥬 엘릭서 국내 출시"(다른 소식) 0.22.
 */
export const SAME_BRAND_SIMILARITY_THRESHOLD = 0.3;

/**
 * 이미 게시한 글과 비교하는 기간(일). 후보가 48시간 창이라 같은 소식이 연속 2~3회 실행에 걸쳐 나올 수 있다.
 * 이 기간 안에 만들어진 글(내린 글 HIDDEN 포함)의 제목과 비슷하면 다시 싣지 않는다.
 */
export const DUPLICATE_LOOKBACK_DAYS = 3;

/** LLM에 넘기는 후보 최대 수 (최신순으로 자름) */
export const MAX_CANDIDATES = 40;

/** LLM 관련도 점수(0~100)가 이 값 미만이면 게시하지 않는다 */
export const MIN_RELEVANCE = 70;

/** 1회 실행당 최대 게시 수. 기준을 넘는 기사가 없으면 0건도 정상이다 */
export const MAX_PUBLISH_PER_RUN = 5;

export const TITLE_MAX_LENGTH = 60;
/** 요약 최소 길이. 상투어 없이 사실만 쓰면 두 문장 60~120자가 나온다(2026-11 실측) — 이보다 짧으면 소식을 전하기에 부족하다 */
export const SUMMARY_MIN_LENGTH = 60;
export const SUMMARY_MAX_LENGTH = 750;

/**
 * 선별·요약 모델 — AI 채팅·신제품 수집과 같은 모델을 쓴다(교체는 lib/ai/models.ts 한 곳에서).
 * 2026-11 같은 후보 29건 비교: gpt-4o-mini는 잘린 발췌문의 이름을 그대로 옮기고("디즈니 영화 '팀'"),
 * 한 기사에 나온 다른 브랜드의 사은품을 섞고, 이름 없이 "한 30대 사업가"로 쓰고,
 * 기사에 없는 전망("~경험을 제공할 것으로 기대됩니다")을 덧붙였다. gpt-4o-mini는 2027-01-14에 종료된다.
 */
export const OPENAI_MODEL = OPENAI_TEXT_MODEL;
export const NAVER_TIMEOUT_MS = 8_000;
export const OPENAI_TIMEOUT_MS = 45_000;

/**
 * 요약에서 지우는 문장 — 기사에 없는 전망·평가로 문장을 채우는 상투어, 독자에게 의미 없는 "발췌문에서 ~는 확인할 수 없습니다" 같은 작성 과정 언급.
 * 프롬프트로 금지해도 가끔 나오므로, 이 패턴이 든 문장은 코드에서 지운다(남은 요약이 너무 짧으면 그 글은 싣지 않는다).
 */
export const FILLER_SENTENCE_PATTERNS: readonly RegExp[] = [
  /경험을\s*(제공|선사|선보)/,
  /(것으로|것이라고)\s*(기대|보입니다|예상|전망)/,
  /(주목|관심|기대)(을|를)?\s*(받고|모으고)\s*있습니다/,
  /긍정적인\s*영향/,
  /발췌문|원문에서|기사에서는|확인할\s*수\s*없/,
  /(입지|위상)를?\s*(더욱\s*)?(강화|다질)/,
];

/** 원문 도메인 → 매체명. 없으면 도메인을 그대로 표시한다 */
export const SOURCE_NAME_BY_DOMAIN: Record<string, string> = {
  "yna.co.kr": "연합뉴스",
  "newsis.com": "뉴시스",
  "news1.kr": "뉴스1",
  "chosun.com": "조선일보",
  "joongang.co.kr": "중앙일보",
  "donga.com": "동아일보",
  "hani.co.kr": "한겨레",
  "khan.co.kr": "경향신문",
  "hankyung.com": "한국경제",
  "mk.co.kr": "매일경제",
  "sedaily.com": "서울경제",
  "edaily.co.kr": "이데일리",
  "mt.co.kr": "머니투데이",
  "asiae.co.kr": "아시아경제",
  "fnnews.com": "파이낸셜뉴스",
  "heraldcorp.com": "헤럴드경제",
  "etnews.com": "전자신문",
  "zdnet.co.kr": "지디넷코리아",
  "fashionbiz.co.kr": "패션비즈",
  "apparelnews.co.kr": "어패럴뉴스",
  "cosinkorea.com": "코스인코리아",
  "cosmorning.com": "코스모닝",
  "beautynury.com": "뷰티누리",
  "jangup.com": "장업신문",
  // 네이버 뉴스 제휴 주요 매체 — 제휴 여부와 별개로 매체명을 한글로 보여주기 위해 등록한다(등록하면 화이트리스트에도 들어간다)
  "segye.com": "세계일보",
  "munhwa.com": "문화일보",
  "inews24.com": "아이뉴스24",
  "busan.com": "부산일보",
  "kmib.co.kr": "국민일보",
  "hankookilbo.com": "한국일보",
  "seoul.co.kr": "서울신문",
  "etoday.co.kr": "이투데이",
  "ajunews.com": "아주경제",
  "newspim.com": "뉴스핌",
  "dt.co.kr": "디지털타임스",
  "dailian.co.kr": "데일리안",
  "yonhapnewstv.co.kr": "연합뉴스TV",
  "ytn.co.kr": "YTN",
  "sbs.co.kr": "SBS",
  "kbs.co.kr": "KBS",
  "imbc.com": "MBC",
  "jtbc.co.kr": "JTBC",
  "mbn.co.kr": "MBN",
};

/**
 * 검증된 매체 화이트리스트 — 위 SOURCE_NAME_BY_DOMAIN에 등록된 도메인.
 * 등록되지 않은 매체라도 네이버 뉴스 제휴 매체(검색 결과에 네이버 인링크가 있는 기사, NewsCandidate.naverPartner)는 통과시킨다.
 */
export const TRUSTED_DOMAINS: readonly string[] = Object.keys(SOURCE_NAME_BY_DOMAIN);

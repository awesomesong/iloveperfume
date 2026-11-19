/** 상품을 읽는 방식 — SHOPIFY: 상품 목록(/products.json), SITEMAP: 사이트맵 + 상품 페이지의 구조화 데이터 */
export type ArrivalSourceKind = "SHOPIFY" | "SITEMAP";

/** 수집 대상(브랜드 공식 사이트) — DB의 ArrivalSource 중 수집에 쓰는 값 */
export type ArrivalSource = {
  id: string;
  /** DB에 저장할 브랜드 표기 — 기존 관례대로 영문 대문자 */
  brand: string;
  /** 판매처에 적힌 다른 표기(한글 등) — 상품 이름 앞에 붙은 브랜드명을 떼는 데 쓴다 */
  aliases: string[];
  host: string;
  kind: ArrivalSourceKind;
  /** SITEMAP: 기존 상품 주소를 기준선으로 기록한 시각. 없으면 첫 실행이다 */
  baselineAt: Date | null;
};

/** 공식 사이트에서 읽은 제품 한 건 (향수가 아닌 것도 포함된 원본) */
export type RawArrival = {
  source: ArrivalSource;
  title: string;
  /** 공식 제품 페이지 주소 — 코드가 만들거나 사이트맵에서 읽는다 (LLM이 만들지 않는다) */
  url: string;
  /** 공식 소개문 (일반 텍스트) */
  bodyText: string;
  /** 상품 유형·태그·카테고리 경로 — 향수 판별에 쓴다 */
  category: string;
  tags: string[];
  variantTitles: string[];
  images: string[];
  /** 게시일(SHOPIFY) 또는 사이트맵에서 처음 본 날(SITEMAP) */
  publishedAt: Date;
};

/** 규칙 필터를 통과한 신제품 후보 */
export type ArrivalCandidate = {
  brand: string;
  /** 제목에서 브랜드명·농도·용량 표기를 뺀 이름 — DB 중복 확인용 */
  name: string;
  /** 제목 원문 — LLM이 돌려준 이름을 대조하는 기준 */
  title: string;
  /** 이름 비교용 키 (소문자 글자·숫자) */
  nameKey: string;
  /** 이름 앞에서 뗄 브랜드 표기 (브랜드 + 다른 표기) */
  brandNames: string[];
  officialUrl: string;
  bodyText: string;
  category: string;
  images: string[];
  /** 같은 이름의 제품이 처음 등장한 날 */
  firstSeenAt: Date;
};

/** LLM 판정·작성을 거쳐 검증까지 통과한 저장 대상 */
export type DescribedArrival = {
  candidate: ArrivalCandidate;
  name: string;
  description: string;
  notes: string | null;
  confidence: number;
};

export type ValidationRejectReason =
  | "noResponse"
  | "notPerfume"
  | "lowConfidence"
  | "nameMismatch"
  | "badDescription"
  | "overLimit";

export type ValidationResult = {
  accepted: DescribedArrival[];
  /** 저장하지 않는 후보와 그 사유 — 로그용 */
  rejected: { brand: string; title: string; reason: ValidationRejectReason }[];
};

export type RuleDropReason =
  | "notPerfume"
  | "excludedTag"
  | "multiPack"
  | "exclusiveChannel"
  | "noName"
  | "notNew"
  | "noImage"
  | "shortBody";

export type RuleFilterResult = {
  kept: ArrivalCandidate[];
  /** 사유별 탈락 수 — notNew·noImage·shortBody는 이름 단위, 나머지는 제품 단위 */
  dropped: Record<RuleDropReason, number>;
  /** 같은 향수의 용량·농도만 다른 제품을 하나로 합친 수 */
  mergedVariants: number;
};

export type ArrivalPipelineResult = {
  sources: number;
  failedSources: number;
  collected: number;
  afterRules: number;
  candidates: number;
  described: number;
  saved: number;
  skippedDuplicate: number;
  durationMs: number;
};

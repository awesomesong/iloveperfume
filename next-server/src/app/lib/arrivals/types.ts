import type { ArrivalSource } from "./config";

/** 브랜드 제품 피드의 제품 한 건 (향수가 아닌 것도 포함된 원본) */
export type RawArrival = {
  source: ArrivalSource;
  title: string;
  handle: string;
  /** body_html을 일반 텍스트로 바꾼 공식 소개문 */
  bodyText: string;
  productType: string;
  tags: string[];
  variantTitles: string[];
  images: string[];
  publishedAt: Date;
};

/** 규칙 필터를 통과한 신제품 후보 */
export type ArrivalCandidate = {
  brand: string;
  /** 피드 제목에서 농도·용량 표기를 뺀 이름 — DB 중복 확인용 */
  name: string;
  /** 피드 제목 원문 — LLM이 돌려준 이름을 대조하는 기준 */
  title: string;
  /** 이름 비교용 키 (소문자 영숫자) */
  nameKey: string;
  /** 코드가 만든 공식 제품 페이지 주소 — LLM이 만들지 않는다 */
  officialUrl: string;
  bodyText: string;
  productType: string;
  images: string[];
  /** 같은 이름의 제품이 피드에 처음 등장한 날 */
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
  | "notPerfumeType"
  | "excludedTitle"
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

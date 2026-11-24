import type { NewsCategory } from "./categories";

/** 네이버 뉴스 검색 결과를 정리한 후보 기사 */
export type NewsCandidate = {
  /** 원문 링크 (originallink 우선, 추적용 파라미터·해시 제거) — DB sourceUrl로 저장 */
  url: string;
  title: string;
  /** 검색 API가 주는 발췌문 */
  description: string;
  publishedAt: Date;
  sourceName: string;
  /** 네이버 뉴스 제휴 매체 기사 — 검색 결과의 link가 네이버 뉴스 인링크(n.news.naver.com 등)일 때 true */
  naverPartner: boolean;
};

/** LLM 선별·요약을 거쳐 검증까지 통과한 게시 대상 */
export type SelectedNews = {
  candidate: NewsCandidate;
  category: NewsCategory;
  relevance: number;
  brand: string | null;
  title: string;
  summary: string;
  /** 원문 og:image(최선형) — 못 가져오면 null. validateSelection 단계까지는 비어 있다가 runPipeline에서 채워진다 */
  image?: string | null;
};

export type PipelineResult = {
  queries: number;
  /** 모든 재시도 후에도 실패한 검색어 (이번 실행에서 결과가 빠진 검색어) */
  failedQueries: string[];
  /** 원문 URL 기준 중복을 뺀 수집 기사 수 */
  collected: number;
  candidates: number;
  selected: number;
  published: number;
  skippedDuplicate: number;
  durationMs: number;
};

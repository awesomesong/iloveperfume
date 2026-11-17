import type { NewsCategory } from "./categories";

/** 네이버 뉴스 검색 결과를 정리한 후보 기사 */
export type NewsCandidate = {
  /** 원문 링크 (originallink 우선) — DB sourceUrl로 저장 */
  url: string;
  title: string;
  /** 검색 API가 주는 발췌문 */
  description: string;
  publishedAt: Date;
  sourceName: string;
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
  collected: number;
  candidates: number;
  selected: number;
  published: number;
  skippedDuplicate: number;
  durationMs: number;
};

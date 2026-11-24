import { OPENAI_MODEL } from "./config";

const OPENAI_RESPONSES_API = "https://api.openai.com/v1/responses";

export type WebSearchRequest = {
  apiKey: string;
  /** Responses API의 input (문자열 또는 메시지 목록) */
  input: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs: number;
  /** 지정하면 이 도메인의 페이지만 검색한다 */
  allowedDomains?: readonly string[];
};

/**
 * 웹 검색을 쓰는 OpenAI 호출 1회 — 답(JSON 문자열)과 검색에서 실제로 읽은 페이지 주소를 돌려준다.
 * 공식 사이트 찾기(resolveBrandSites)와 판매처 향수의 공식 페이지 찾기(retailerArrivals)가 함께 쓴다.
 */
export async function webSearchJson(request: WebSearchRequest): Promise<{ text: string; sourceUrls: string[] }> {
  const { apiKey, input, schemaName, schema, timeoutMs, allowedDomains } = request;
  const res = await fetch(OPENAI_RESPONSES_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      tools: [{ type: "web_search", ...(allowedDomains && { filters: { allowed_domains: allowedDomains } }) }],
      include: ["web_search_call.action.sources"],
      input,
      text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI Responses API ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    output?: { type?: string; action?: { sources?: { url?: string }[] }; content?: { text?: string }[] }[];
  };
  const sourceUrls: string[] = [];
  let text = "";
  for (const item of data.output ?? []) {
    if (item.type === "web_search_call") {
      for (const source of item.action?.sources ?? []) if (source.url) sourceUrls.push(source.url);
    }
    if (item.type === "message") text += (item.content ?? []).map((part) => part.text ?? "").join("");
  }
  return { text, sourceUrls };
}

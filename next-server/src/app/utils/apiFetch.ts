type ApiFetchOptions = RequestInit & {
  defaultErrorMessage?: string;
  errorMessagesByStatus?: Record<number, string>;
};

/**
 * 클라이언트에서 내부 API 라우트를 호출할 때 쓰는 공통 fetch 래퍼.
 * 응답이 실패(!res.ok)하면 errorMessagesByStatus → 서버 message/error →
 * defaultErrorMessage 순으로 우선순위를 매겨 Error를 throw한다.
 */
export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { defaultErrorMessage, errorMessagesByStatus, headers, ...rest } = options;

  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", ...headers },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      errorMessagesByStatus?.[res.status] ??
        data?.message ??
        data?.error ??
        defaultErrorMessage ??
        "요청 처리 중 오류가 발생했습니다.",
    );
  }

  return data as T;
}

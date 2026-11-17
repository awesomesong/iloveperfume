import { parseHttpUrl } from "./collectNews";

/** 원문 페이지를 가져올 때 쓰는 데스크톱 User-Agent */
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MAX_BYTES = 300_000;
const TIMEOUT_MS = 5_000;

/** content/property 순서, 홑/겹따옴표 모두 허용하는 og:image · twitter:image meta 태그 추출 */
const META_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
];

/**
 * 응답 바디를 MAX_BYTES까지만 읽는다 (기사 이미지 메타만 필요 — 본문 전체를 받을 필요 없음).
 * TextDecoder를 스트리밍 모드로 써서, MAX_BYTES 경계가 한글 등 멀티바이트 문자 중간에 걸려도
 * 깨진 문자(U+FFFD)를 만들지 않고 그 미완성 바이트만 버린다.
 */
async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();

  const decoder = new TextDecoder("utf-8");
  let text = "";
  let received = 0;
  while (received < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      text += decoder.decode(value, { stream: true });
      received += value.length;
    }
  }
  try {
    await reader.cancel();
  } catch {
    // 조기 취소 실패는 무시 — 이미 필요한 만큼 읽었다
  }
  return text;
}

/**
 * 원문 페이지의 og:image(없으면 twitter:image)를 최선형으로 가져온다.
 * 이미지는 있으면 좋고 없어도 되는 부가 정보 — 어떤 이유로든 실패하면 null을 돌려주고 파이프라인은 계속 진행한다.
 */
export async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": DESKTOP_USER_AGENT },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const html = await readLimited(res);
    for (const pattern of META_PATTERNS) {
      const match = html.match(pattern);
      const candidate = match?.[1] ? parseHttpUrl(new URL(match[1], url).toString()) : null;
      if (candidate) return candidate.toString();
    }
    return null;
  } catch {
    return null;
  }
}

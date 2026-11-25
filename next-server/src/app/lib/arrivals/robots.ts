/**
 * robots.txt 해석 (RFC 9309의 필요한 부분만, 순수 함수).
 * 수집기는 모든 로봇에게 주는 규칙(User-agent: *)만 따른다.
 */

export type RobotsRules = {
  allow: string[];
  disallow: string[];
  sitemaps: string[];
};

export const EMPTY_ROBOTS: RobotsRules = { allow: [], disallow: [], sitemaps: [] };

/**
 * User-agent: * 그룹의 Allow/Disallow와 Sitemap 줄을 모은다.
 * "Disallow : /x"처럼 콜론 앞에 공백이 있어도 읽는다. 빈 Disallow는 "모두 허용"이라 무시한다.
 */
export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [], sitemaps: [] };
  let agents: string[] = [];
  let inRules = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "sitemap") {
      if (value) rules.sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      // 규칙 줄 다음에 오는 User-agent는 새 그룹의 시작이다
      if (inRules) {
        agents = [];
        inRules = false;
      }
      agents.push(value.toLowerCase());
      continue;
    }
    if (key !== "allow" && key !== "disallow") continue;
    inRules = true;
    if (!agents.includes("*") || !value) continue;
    rules[key].push(value);
  }
  return rules;
}

function toMatcher(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** 경로(쿼리 포함)가 허용되는지 — 가장 길게 맞는 규칙을 따르고, 길이가 같으면 Allow가 이긴다 */
export function isPathAllowed(rules: RobotsRules, path: string): boolean {
  let best: { length: number; allow: boolean } | null = null;
  const consider = (patterns: string[], allow: boolean) => {
    for (const pattern of patterns) {
      if (!toMatcher(pattern).test(path)) continue;
      if (!best || pattern.length > best.length || (pattern.length === best.length && allow)) {
        best = { length: pattern.length, allow };
      }
    }
  };
  consider(rules.disallow, false);
  consider(rules.allow, true);
  return best === null ? true : (best as { allow: boolean }).allow;
}

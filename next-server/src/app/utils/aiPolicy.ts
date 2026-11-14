// Shared AI topic/safety policy (isomorphic: usable on server and client)

export function normalizeText(input: string) {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // 제로폭 제거
    .replace(/[^\S\r\n]+/g, " "); // 공백 정리(개행 유지)
}

// `(?:^|[^가-힣])` = 단어 시작(문자열 시작이거나 바로 앞이 한글 음절이 아님).
// 이 모듈은 클라이언트에도 실리므로 lookbehind((?<!…)/(?<=…))는 쓰지 않는다
// — 구형 모바일 Safari는 lookbehind 리터럴에서 SyntaxError를 던진다.
export const PROHIBITED_PATTERNS: RegExp[] = [
  // 불법/마약/폭탄 + 제조/제작/만들기 (단독 '제조' 오탐 방지)
  /(?:불법|마약|폭탄)[\w\s]*?(?:제\s*조|제\s*작|만들\s*기)/u,
  // 성적(행위/콘텐츠/표현) 등 구체화 (학업 '성적' 오탐 방지)
  // 단어 시작에서만 매칭 → '감성적 표현', '여성적 묘사', '남성적 표현' 통과
  /(?:^|[^가-힣])성\s*적\s*(?:행위|콘텐츠|표현|묘사|착취)/u,
  // 증오/혐오/차별 + 발언/표현
  /(?:증\s*오|혐\s*오|차\s*별)[\w\s]*?(?:발\s*언|표\s*현)/u,
  // 자해/자살: 단어 시작 + 붙여 쓴 경우만
  // → '남자 해외', '여자 해변', '남자 살냄새', '남자살냄새' 통과
  /(?:^|[^가-힣])자(?:해|살)/u,
  // 학대: 단어 시작이거나 대표 복합어(아동학대, 동물학대 …)일 때만
  // → '과학대', '수학대회' 통과
  /(?:^|[^가-힣]|아동|동물|노인|장애인|아이|자녀)학대/u,
];


export function containsProhibited(message: string): boolean {
  const text = normalizeText(message ?? ""); // 한 번만 정규화
  if (text.length === 0) return false; // 빠른 종료(선택)
  return PROHIBITED_PATTERNS.some((re) => re.test(text));
}

export function validatePrompt(message: string): {
  isValid: boolean;
  error?: string;
} {
  if (!message || !message.trim())
    return { isValid: false, error: "메시지를 입력해 주세요." };
  if (containsProhibited(message))
    return { isValid: false, error: "부적절한 내용은 허용되지 않습니다." };
  return { isValid: true };
}

// General chat validation: only block prohibited content and empty input
export function validateUserMessage(message: string): {
  isValid: boolean;
  error?: string;
} {
  if (!message || !message.trim())
    return { isValid: false, error: "메시지를 입력해 주세요." };
  if (containsProhibited(message))
    return { isValid: false, error: "부적절한 내용은 허용되지 않습니다." };
  return { isValid: true };
}

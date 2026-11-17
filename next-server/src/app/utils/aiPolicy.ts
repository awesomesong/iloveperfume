// Shared AI topic/safety policy (isomorphic: usable on server and client)

// AI에게 보내는 질문의 최대 길이. 입력 단계(클라이언트)와 /api/ai/stream이 같은 값을 쓴다
export const AI_MESSAGE_MAX_LENGTH = 4000;

export function normalizeText(input: string) {
  return input
    .normalize("NFKC")
    .replace(/[​-‍﻿]/g, "") // 제로폭 제거
    .replace(/[^\S\r\n]+/g, " "); // 공백 정리(개행 유지)
}

// 금칙어(word)가 다른 단어 안에 우연히 들어 있는 경우를 피해서 매칭한다.
//  - 앞이 한글이 아니면(문장 시작·공백·기호) 매칭: '자살 방법', 'ㅋㅋ자살'
//  - 앞이 한글이면 합성어로 보고 매칭하되('동반자살', '가정학대'),
//    흔한 무해 접두(benign)는 제외한다('남자살냄새', '과학대', '감성적 표현')
// 띄어 쓴 형태('자 살')는 잡지 않는다 — '자 해보자', '자 살펴볼게' 같은 일상 문장이 걸린다.
// 이 모듈은 클라이언트에도 실리므로 lookbehind((?<!…)/(?<=…))는 쓰지 않는다
// — 구형 모바일 Safari는 lookbehind 리터럴에서 SyntaxError를 던진다.
function guarded(word: string, benign: string, tail = ""): RegExp {
  return new RegExp(
    `(?:^|[^가-힣]|(?!(?:${benign})${word})[가-힣])${word}${tail}`,
    "u",
  );
}

export const PROHIBITED_PATTERNS: RegExp[] = [
  // 불법/마약/폭탄 + 제조/제작/만들기 (단독 '제조' 오탐 방지)
  /(?:불법|마약|폭탄)[\w\s]*?(?:제\s*조|제\s*작|만들\s*기)/u,
  // 성적 + 행위/콘텐츠/표현 등 (학업 '성적' 오탐 방지). '감성적 표현', '여성적 묘사' 통과
  guarded(
    "성\\s*적",
    "감|이|개|여|남|중|지|본|야|모|부|양|음",
    "\\s*(?:행위|콘텐츠|표현|묘사|착취)",
  ),
  // 증오/혐오/차별 + 발언/표현
  /(?:증\s*오|혐\s*오|차\s*별)[\w\s]*?(?:발\s*언|표\s*현)/u,
  // 자해/자살. '남자 해외', '여자 살냄새'(띄어 씀), '남자살냄새', '혼자살기'(무해 접두) 통과
  guarded("자(?:해|살)", "남|여|혼|피|과|감|부|모"),
  // 학대. '과학대', '공학대'(무해 접두), '수학대회', '동물학대학원'(뒤가 회/학) 통과
  guarded("학대", "과|공|의|법|약|농|신|대|수|문|철|화", "(?![학회])"),
];

export function containsProhibited(message: string): boolean {
  const text = normalizeText(message ?? ""); // 한 번만 정규화
  if (text.length === 0) return false; // 빠른 종료(선택)
  return PROHIBITED_PATTERNS.some((re) => re.test(text));
}

type ValidationResult = { isValid: boolean; error?: string };

// 일반 채팅: 빈 입력과 금칙어만 막는다
export function validateUserMessage(message: string): ValidationResult {
  if (!message || !message.trim())
    return { isValid: false, error: "메시지를 입력해 주세요." };
  if (containsProhibited(message))
    return { isValid: false, error: "부적절한 내용은 허용되지 않습니다." };
  return { isValid: true };
}

// AI 질문: 일반 채팅 검증 + 길이 제한.
// 길이는 저장 전에 막아야 한다 — 저장된 뒤에는 /api/ai/stream이 매번 거절해 답변을 받을 수 없는 질문이 남는다
export function validatePrompt(message: string): ValidationResult {
  if (message && message.length > AI_MESSAGE_MAX_LENGTH)
    return {
      isValid: false,
      error: `메시지가 너무 깁니다. (최대 ${AI_MESSAGE_MAX_LENGTH}자)`,
    };
  return validateUserMessage(message);
}

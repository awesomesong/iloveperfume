import dayjs from "@/src/app/utils/day";

type DateInput = Date | string;

/** 뉴스 목록의 시간 표기 — 포털 뉴스 관례: 24시간 이내는 "N시간 전", 일주일 이내는 "N일 전", 그 이후는 날짜 */
export const formatNewsTime = (value: DateInput): string => {
  const date = dayjs(value);
  const now = dayjs();

  const minutes = now.diff(date, "minute");
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;

  const hours = now.diff(date, "hour");
  if (hours < 24) return `${hours}시간 전`;

  const days = now.startOf("day").diff(date.startOf("day"), "day");
  if (days < 7) return `${days}일 전`;

  return date.format("YYYY.MM.DD.");
};

/** 뉴스 상세의 발행 시각 — "2026.11.14. 오후 3:20" */
export const formatNewsDateTime = (value: DateInput): string =>
  dayjs(value).format("YYYY.MM.DD. A h:mm");

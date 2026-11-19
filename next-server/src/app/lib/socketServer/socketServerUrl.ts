// 서버 전용: 소켓 서버 주소 (Next → 소켓 서버 HTTP 호출용)
// 서버 전용 SOCKET_SERVER_URL → 클라이언트와 같은 NEXT_PUBLIC_SOCKET_URL → 운영 기본값 순서로 쓴다
const DEFAULT_SOCKET_SERVER_URL = "https://socket-server-muddy-shadow-6983.fly.dev";

export function getSocketServerUrl(): string {
  const url = process.env.SOCKET_SERVER_URL || process.env.NEXT_PUBLIC_SOCKET_URL || DEFAULT_SOCKET_SERVER_URL;
  return url.replace(/\/+$/, "");
}

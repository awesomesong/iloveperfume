# 채팅 WebSocket 점검 결과와 최적화 계획

작성일: 2026-11-19 · 대상: `socket-server/server.js`(Fly.io), `next-server`의 소켓 클라이언트

## 측정 방법

`socket-server/scripts/ws-audit.js`가 로컬에 `server.js`를 띄우고 문제를 재현한다. 운영 서버에는 접속하지 않는다. 최적화 전과 후에 같은 스크립트를 돌려 `pass` 값으로 비교한다.

```bash
NODE_PATH=next-server/node_modules node socket-server/scripts/ws-audit.js          # 전체 (약 60초)
NODE_PATH=next-server/node_modules node socket-server/scripts/ws-audit.js --quick  # half-open 측정 생략
```

### 현재 기준값 (2026-11-19, 수정 전)

| 항목 | 결과 | pass |
|---|---|---|
| 익명 연결이 온라인 사용자 이메일 수신 | `alice@example.com` 노출 | false |
| `auth.userId`만으로 사칭 | 사칭 소켓이 피해자 메시지 수신 | false |
| 위조 `send:message` (없는 방, 임의 참여자) | 피해자에게 전달됨 | false |
| 비멤버의 `room.deleted` | 피해자에게 전달됨 | false |
| 메시지 1건당 서버 로그 | 10줄, 본문 포함 | false |
| half-open 감지 시간 | 55초 | — |
| 그 사이 보낸 메시지 3건 중 소켓 복구 | 0건 | — |

## 문제점 (근거 포함)

### S. 보안 — 우선순위 가장 높음

**S1. 연결 인증이 없다.** 서버는 `socket.handshake.auth`의 `userId`·`useremail`을 그대로 믿는다(`server.js:305-319`). 클라이언트는 세션 값을 그대로 넣을 뿐 서명된 값이 아니다(`context/socketContext.tsx:37`). 다른 사람의 userId를 알면 그 사람의 개인 룸(`user:<id>`)에 들어가 메시지·읽음 상태·대화방 이벤트를 모두 받는다. 재현: `impersonation`.

**S2. 클라이언트가 보낸 내용을 그대로 중계한다.** 메시지는 Next API가 DB에 저장한 뒤, 클라이언트가 다시 `send:message`로 소켓 서버에 보낸다(`chat/Form.tsx:226`, `chat/MessageView.tsx:280,339`, `chat/AIChatForm.tsx:70,274`, `chat/DraftForm.tsx:132-134`, `chat/ConfirmModal.tsx:49`). 소켓 서버의 권한 검사는 "페이로드에 적힌 `conversation.userIds`에 내가 있는가"뿐이라(`server.js:480-488`), 참여자 목록·본문·발신자 이름을 모두 위조할 수 있다. 같은 이유로:
- `room.deleted`는 누구나 보낼 수 있다(`server.js:656-658`). 받은 쪽 클라이언트는 대화방을 지운 것처럼 처리한다(`hooks/useOtherUser.ts:146`).
- `notice:*`, `fragrance:review:*`는 검증 없이 전체 사용자에게 브로드캐스트된다(`server.js:555-597`).
- `join:room`은 멤버 확인 없이 아무 방에나 들어간다(`server.js:424-443`). `read:state`의 `isMember`(`server.js:529`)도 이 join 기록만 보므로 실제로는 검사가 아니다.

**S3. 이메일 노출.** 연결 직후 모든 소켓(익명 포함)에 온라인 사용자 이메일 목록을 보내고(`server.js:349`, `62-66`), 접속·퇴장 때 `io.emit`으로 이메일을 전체에 뿌린다(`server.js:407`, `633`). 클라이언트는 userId만 쓴다(`hooks/useActiveUser.ts:14-29`). 신규 가입 알림도 이메일을 전체에 보낸다(`server.js:269`).

### R. 신뢰성

**R1. 끊긴 연결 사이의 메시지가 사라진다.** 서버는 "온라인이면 바로 보내고, 오프라인이면 메모리 큐에 넣는다"(`server.js:502-510`). 그런데 모바일 네트워크 전환·터널처럼 응답 없이 끊긴 연결은 `pingInterval 25s + pingTimeout 30s`(`server.js:212-213`) 동안 계속 온라인으로 보인다. 그 사이 메시지는 죽은 연결로 보내지고 큐에도 안 들어간다. 재현: 55초, 3건 중 0건 복구.
클라이언트도 재접속 때 다시 불러오지 않는다. 메시지 쿼리는 `refetchOnReconnect: false`, `refetchOnWindowFocus: false`(`chat/Body.tsx:91-92`)이고, 재접속 처리(`components/SocketState.tsx:415-447`)는 대화 목록이 이미 있으면 재조회하지 않는다. 주석이 "서버 큐잉으로 메시지 복구 - 워터마크 불필요"라고 밝히듯 서버 큐에만 의존한다.

**R2. 메모리 큐는 재시작하면 사라지고, 정리되지 않는다.** `messageQueue`(`server.js:10`)는 배포·재시작 때 비워진다. 다시 접속하지 않는 사용자의 큐는 지워지지 않고, `globalRoomRev`(`server.js:69`)는 `room.deleted` 때만 지워져 계속 늘어난다. 큐가 `receive:message`를 보낼 때는 그 시점에 이미 join한 방만 보내는데(`server.js:383`), 재접속 직후에는 `online:user`와 `join:room` 순서가 정해져 있지 않아 대부분 빠진다.

**R3. 머신이 2대 이상이면 메시지가 엇갈린다.** 모든 상태가 프로세스 메모리에 있고 어댑터(Redis 등)가 없다. `fly.toml`은 머신당 `hard_limit = 100` 연결이다(탭마다 연결 1개). 100을 넘거나 Fly가 머신을 2대 띄운 경우, 서로 다른 머신에 붙은 사용자끼리는 메시지·접속 상태가 전달되지 않는다. **운영 머신 수는 아직 확인하지 못했다** — `fly machines list -a socket-server-muddy-shadow-6983`로 확인 필요.

### E. 효율

**E1. 로그가 과하고 본문이 남는다.** 메시지 1건에 10줄, 발신자 이름과 본문까지 기록한다(`server.js:461-492`, `521`). 웹훅 시크릿이 틀리면 받은 값을 그대로 로그에 남긴다(`server.js:254`).

**E2. 메시지 전체 객체를 소켓으로 보낸다.** 저장된 메시지 전체와 `conversation.userIds`를 그대로 실어 보낸다. 목록 갱신(`receive:conversation`)에는 미리보기 필드만 있으면 된다.

**E3. `online:user` 재전송이 잦다.** 포커스·`visibilitychange`·`pageshow`·`online` 때마다 다시 보낸다(`components/SocketComponents.tsx:70-110`). 이미 연결된 소켓이면 서버는 큐 조회와 로그만 반복한다.

**E4. 기타.** `process.stdout.setEncoding`(`server.js:6-7`)은 쓰기 스트림에는 의미가 없고, stdout이 파일이면 서버가 시작하자마자 죽는다(로컬 재현 중 확인). `join:room`·`send:message`에는 속도 제한이 없다(`room.event`에만 200ms, `server.js:645-649`).

## 최적화 계획

순서는 보안 → 메시지 유실 → 효율. 각 단계는 `ws-audit.js`의 해당 항목이 `pass: true`가 되는 것을 완료 기준으로 한다.

### 1단계 — 연결 인증 (S1, S3)
- Next에 `GET /api/socket/token` 추가: 로그인 사용자에게 `userId`와 만료(예: 5분)를 담은 HMAC 서명 토큰 발급. 비밀값은 새 환경변수 `SOCKET_AUTH_SECRET`(Next·Fly 양쪽).
- 소켓 서버에 `io.use` 미들웨어: 토큰 검증 실패 시 연결 거부. `socket.data.userId`는 토큰에서만 설정. `online:user`의 userId·email 인자는 무시.
- 클라이언트 `auth`를 콜백 형태로 바꿔 재연결 때마다 새 토큰을 받는다(socket.io-client는 `auth`에 함수를 받음).
- presence 이벤트·스냅샷에서 이메일 제거, userId만 전송. 신규 가입 알림도 이메일 제외.
- 완료 기준: `anonymousSeesEmails`, `impersonation` pass. (스크립트에 정상 사용자 토큰 발급을 추가해야 함)

#### 1단계 구현 메모 (2026-11-19)
- 토큰: `base64url({sub, exp}).base64url(HMAC-SHA256)`, 유효 5분. 발급 `lib/socketAuth/signSocketToken.ts`, 검증 `socket-server/socketAuth.js`의 `verifySocketToken`, 감사 스크립트의 `signToken` — 형식을 바꾸면 세 곳을 같이 바꾼다. 발급·검증 호환은 `cd socket-server && npm test`로 확인한다.
- 서버는 연결 시 토큰의 userId로 개인 룸 조인·접속 상태 등록을 끝낸다. `online:user`는 페이로드를 무시하고 큐 전달만 한다(3단계에서 큐 제거, 4단계에서 재전송 제거). 신원 없는 연결은 모드와 상관없이 거부한다.
- 소켓 서버 환경변수: `SOCKET_AUTH_SECRET`, `SOCKET_AUTH_REQUIRED`.
  - `REQUIRED`가 `"true"`가 아니면 호환 모드: 토큰 없는 구버전 클라이언트는 `auth.userId`로 연결을 허용(소켓 ID만 로그). 토큰이 있는데 틀리거나 만료되면 항상 거부.
  - 비밀값이 없으면: `REQUIRED=true`면 전부 거부 + 에러 로그, 아니면 토큰을 검증하지 않고 호환 모드로만 동작.
- 배포 순서: ① 소켓 서버 배포(`SOCKET_AUTH_SECRET`만 설정) → ② Next 배포(`SOCKET_AUTH_SECRET` 같은 값) → ③ 열려 있던 구버전 탭이 정리된 뒤 `fly secrets set SOCKET_AUTH_REQUIRED=true`.
- 새 클라이언트는 토큰과 함께 토큰에서 꺼낸 `userId`를 보낸다. 순서가 뒤바뀌어 새 클라이언트가 구버전 서버에 붙어도 개인 룸 이벤트(메시지·읽음·방 이벤트)는 계속 받게 하기 위함이다. 이메일은 보내지 않으므로 그 사이 구버전 서버에서는 접속 상태 표시와 오프라인 큐 전달이 멈춘다 — 그래서 ①을 먼저 한다. ③ 이후 `lib/socket.ts`의 `userId` 동봉은 지운다.

### 2단계 — 서버가 직접 전달 (S2)
- 메시지 저장 API(`api/messages/route.ts` 등)가 저장 직후 소켓 서버의 내부 엔드포인트(예: `POST /internal/message`)를 호출한다. 참여자 목록은 DB 기준. 이미 `api/user-registered`(`lib/auth.ts:127`, `x-webhook-secret`)에서 쓰는 방식과 같다.
- 클라이언트의 `send:message` 송신 제거, 소켓 서버의 `send:message` 핸들러 제거.
- `room.event`, 공지·리뷰 이벤트도 각각의 API가 처리 후 내부 엔드포인트로 알린다.
- `join:room`은 서버가 대화방 멤버인지 확인한다(내부 API 조회 또는 토큰에 담기 어려우므로 Next에 `GET /api/conversations/:id/members` 내부 호출 + 짧은 캐시).
- 완료 기준: `forgedMessage`, `roomDeletedByStranger` pass. 실제 브라우저 2개로 1:1·그룹·AI 채팅 송수신, 읽음 표시, 나가기 확인.
- 부수 효과: 전송 경로가 "API → 클라이언트 → 소켓"에서 "API → 소켓"으로 줄어 상대방 수신 지연이 한 구간 줄어든다. 전후 지연은 서버 수신 시각 기준으로 측정해 기록한다.

### 3단계 — 메시지 유실 방지 (R1, R2)
- 복구 기준을 DB로 바꾼다. 재접속(`connect`) 시 활성 대화방 메시지와 대화 목록을 무효화해 다시 불러온다. 가능하면 "마지막으로 받은 메시지 ID 이후"만 받는 API로 양을 줄인다.
- 서버 메모리 큐(`messageQueue`)와 관련 로직 제거. `globalRoomRev`는 TTL 정리 추가 또는 제거.
- 완료 기준: half-open 동안 보낸 3건이 재접속 후 화면에 모두 보인다(브라우저에서 네트워크 끊기로 확인).

### 4단계 — 효율 (E1~E4)
- 로그를 메시지당 0~1줄, 본문·이메일·시크릿 제외로 정리. `setEncoding` 제거.
- `receive:conversation` 페이로드를 미리보기 필드로 줄이고 전후 바이트 수를 기록.
- `online:user` 재전송 제거(1단계 후 서버가 연결 시 자동 등록).
- `join:room` 속도 제한.
- 완료 기준: `logging` pass, 페이로드 크기 전후 수치 기록.

### 운영 확인 (R3) — 2026-11-19 확인
- `fly machines list` 결과: 머신 1대(`nrt`, shared-cpu-1x, 512MB). 지금은 머신이 갈라져 메시지가 엇갈리는 문제는 없다.
- 대신 `hard_limit = 100`이 실제 한계다. 머신이 1대뿐이라 101번째 연결(탭)은 다른 곳으로 갈 수 없고, Fly 프록시에서 대기하다 실패할 수 있다.

#### 연결 수별 서버 메모리 (로컬 측정, 유휴 연결, 메시지 트래픽 없음)

| 연결 수 | RSS |
|---|---|
| 0 | 63.6MB |
| 100 | 75.9MB |
| 500 | 101.1MB |
| 1,000 | 101.4MB |
| 2,000 | 121.4MB |

연결 2,000개에 약 58MB(연결당 약 30KB)이다. 512MB 머신에서 100개 제한은 메모리의 2~3%만 쓰는 값이다. 단, macOS 로컬·유휴 상태 측정이므로 메시지가 오가는 상태에서 다시 확인해야 한다.

#### 연결 수가 늘 때 문제가 되는 것: 접속 상태(presence) 브로드캐스트
2,000명이 접속한 상태에서 1명이 들어오면:
- 들어온 사람은 2,000명분 스냅샷(이메일 포함 87.8KB)을 받고,
- 서버는 `online:user`를 2,000개 소켓 모두에 보낸다.

한 명이 들어올 때마다 전체에 보내므로, 배포처럼 모두가 한꺼번에 재접속하면 N명 × N건(2,000명이면 약 400만 건)이 몰린다. 메모리보다 이쪽이 먼저 한계가 된다.

#### 확장 단계
1. **머신 1대 유지 (수천 연결까지):** 1~4단계 + `hard_limit` 상향(예: soft 800 / hard 1000, 트래픽 부하 측정 후 확정) + presence를 "나와 대화 중인 사용자"에게만 보내도록 축소. 배포 때마다 전원이 재접속하므로 3단계(재접속 시 DB 재조회)가 전제다.
2. **머신 2대 이상:** `@socket.io/redis-adapter`로 `io.to(room).emit`을 머신 간에 공유하고, 프로세스 메모리에 있는 접속 상태(`onlineUsersMap`, `userIdToSocketsMap`)를 Redis로 옮긴다. 2단계의 내부 엔드포인트는 어느 머신이 받아도 어댑터를 통해 전체에 전달된다. transports가 websocket 전용이라 sticky session은 필요 없다.

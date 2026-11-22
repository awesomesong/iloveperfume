import { useSocket } from "../context/socketContext";
import { useEffect, useCallback } from "react";
import useActiveList from "./useActiveList";

// 연결 직후 스냅샷: 서버는 userId만 보낸다 (이메일은 보내지 않음)
interface OnlineUserPayload {
  userId: string;
}

// 서버가 1초마다 모아 보내는 접속 상태 변화 (연결 시 스냅샷 이후의 변화분)
interface PresenceDeltaPayload {
  online?: unknown;
  offline?: unknown;
}

const toIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((id) => String(id ?? "").trim()).filter((id) => id.length > 0)
    : [];

const useActiveUser = () => {
  const socket = useSocket();
  const { set, addMany, removeMany } = useActiveList();

  const handleOnlineUsers = useCallback((users: OnlineUserPayload[]) => {
    const validUserIds = (Array.isArray(users) ? users : [])
      .map(u => String(u?.userId || "").trim())
      .filter(id => id.length > 0);
    set(validUserIds);
  }, [set]);

  const handlePresenceDelta = useCallback((delta: PresenceDeltaPayload) => {
    const online = toIds(delta?.online);
    const offline = toIds(delta?.offline);
    if (online.length) addMany(online);
    if (offline.length) removeMany(offline);
  }, [addMany, removeMany]);

  useEffect(() => {
    if (!socket) return;

    socket.on("get:onlineUsers", handleOnlineUsers);
    socket.on("presence:delta", handlePresenceDelta);

    return () => {
      socket.off("get:onlineUsers", handleOnlineUsers);
      socket.off("presence:delta", handlePresenceDelta);
    };
  }, [socket, handleOnlineUsers, handlePresenceDelta]);
};

export default useActiveUser;

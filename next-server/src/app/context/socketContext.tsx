"use client";
import React, { createContext, useContext, useEffect, useMemo } from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/src/app/lib/socket";
import { useSession } from "next-auth/react";

// 마지막으로 연결한 사용자 — 사용자가 바뀌면 새 토큰으로 다시 연결하기 위해 기억한다
type TrackedSocket = Socket & { __prevUserId?: string };

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session, status } = useSession();

  // ✅ 인스턴스는 앱 생애주기 내 1회만 생성 (싱글턴)
  const socket = useMemo<Socket | null>(() => {
    try {
      return getSocket(); // 권장: getSocket()이 인자 없이 싱글턴 반환
    } catch {
      return null;
    }
  }, []);

  // ✅ 세션 변화에 따라 (재)연결
  // 인증 정보는 lib/socket.ts의 auth 콜백이 연결할 때마다 /api/socket/token에서 받아 온다.
  useEffect(() => {
    if (!socket) return;

    const userId = session?.user?.id ?? "";
    const authed = status === "authenticated" && !!userId;
    const tracked = socket as TrackedSocket;

    if (authed) {
      // 사용자가 바뀌었다면 재연결로 새 사용자의 토큰을 받게 한다
      const changed = tracked.__prevUserId !== userId;

      if (changed) {
        if (socket.connected) socket.disconnect();
        socket.connect();
        tracked.__prevUserId = userId;
      } else if (!socket.connected) {
        socket.connect();
      }
    } else {
      // 세션 정보 없으면 연결 해제
      if (socket.connected) socket.disconnect();
      tracked.__prevUserId = undefined;
    }
  }, [socket, status, session?.user?.id]);

  // ✅ 언마운트 시 정리
  useEffect(() => {
    return () => {
      try {
        if (socket?.connected) socket.disconnect();
      } catch {}
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

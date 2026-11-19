"use client";
import { useSocket } from "../context/socketContext";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useCallback } from "react";

// ✅ iOS 판별 상수 (매번 계산할 필요 없음)
const isiOS = typeof navigator !== 'undefined' && (
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes("Mac") && 
   'maxTouchPoints' in navigator && 
   navigator.maxTouchPoints > 1)
);

export default function SocketConnectionGuard() {
  const socket = useSocket();
  const { data: session, status } = useSession();

  // ✅ online:user 중복 전송 방지
  const hasEmittedOnlineRef = useRef(false);
  const delayedRetryRef = useRef<number | undefined>(undefined);

  // ✅ online:user emit 함수
  // 서버는 연결 인증 때 이미 사용자를 알고 있으므로 신원 정보는 보내지 않는다.
  // (빈 객체는 페이로드를 구조 분해하는 구버전 서버 핸들러가 죽지 않게 하기 위함)
  const emitOnlineUser = useCallback(() => {
    if (hasEmittedOnlineRef.current || !socket) {
      return;
    }
    
    if (
      socket.connected &&
      status === "authenticated" &&
      session?.user?.id
    ) {
      socket.emit("online:user", {});
      hasEmittedOnlineRef.current = true;
    } 
  }, [socket, status, session?.user?.id]);

  // ✅ 소켓 연결 이벤트 리스너 등록
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      hasEmittedOnlineRef.current = false;
      // 연결 성공 시 online:user 전송
      emitOnlineUser();
    };

    const onDisconnect = () => {
      hasEmittedOnlineRef.current = false;
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket, emitOnlineUser]);

  // ✅ 가시성 변화 시 online:user 재전송
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        hasEmittedOnlineRef.current = false;
        
        if (isiOS) {
          // iOS에서 지연 후 재시도
          if (delayedRetryRef.current) {
            clearTimeout(delayedRetryRef.current);
          }
          delayedRetryRef.current = window.setTimeout(() => {
            emitOnlineUser();
            delayedRetryRef.current = undefined;
          }, 200);
        } else {
          emitOnlineUser();
        }
      }
    };

    const onPageShow = () => {
      hasEmittedOnlineRef.current = false;
      emitOnlineUser();
    };

    const onFocus = () => {
      hasEmittedOnlineRef.current = false;
      emitOnlineUser();
    };

    const onOnline = () => {
      hasEmittedOnlineRef.current = false;
      emitOnlineUser();
    };

    document.addEventListener("visibilitychange", onVisibilityChange, { passive: true });
    window.addEventListener("pageshow", onPageShow, { passive: true });
    window.addEventListener("focus", onFocus, { passive: true });
    window.addEventListener("online", onOnline, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      
      if (delayedRetryRef.current) {
        clearTimeout(delayedRetryRef.current);
        delayedRetryRef.current = undefined;
      }
    };
  }, [emitOnlineUser]);

  // ✅ 사용자 변경 시 ref 리셋 및 online:user 재전송
  useEffect(() => {
    hasEmittedOnlineRef.current = false;
    emitOnlineUser();
  }, [session?.user?.id, emitOnlineUser]);

  return null;
}

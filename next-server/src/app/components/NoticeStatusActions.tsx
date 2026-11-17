"use client";
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useSocket } from "../context/socketContext";
import { updateNoticeStatus } from "@/src/app/lib/updateNoticeStatus";
import {
  NOTICE_LIST_KEY,
  noticeDetailKey,
  removeNoticeCardById,
} from "@/src/app/lib/react-query/noticeCache";
import { SOCKET_EVENTS } from "@/src/app/lib/react-query/utils";
import type { NoticeStatus } from "@/src/app/lib/news/categories";
import type { NoticeDetailQueryData, NoticeIdProps } from "@/src/app/types/notice";

type Props = NoticeIdProps & {
  status: NoticeStatus;
  noticeTitle: string;
};

/** 관리자 전용: 잘못 올라온 글 내리기 / 내린 글 다시 게시 (사전 검수 아님) */
const NoticeStatusActions = ({ noticeId, status, noticeTitle }: Props) => {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const [isLoading, setIsLoading] = useState(false);

  const changeStatus = useCallback(
    async (next: NoticeStatus) => {
      if (next === "HIDDEN" && !confirm(`"${noticeTitle}" 글을 내리겠습니까?`)) return;

      setIsLoading(true);
      try {
        const result = await updateNoticeStatus(noticeId, next);

        queryClient.setQueryData(noticeDetailKey(noticeId), (old: NoticeDetailQueryData) => {
          if (!old?.notice) return old;
          return { ...old, notice: { ...old.notice, status: result.notice.status } };
        });

        if (next === "HIDDEN") {
          // 다른 접속자의 목록에서도 즉시 제거
          removeNoticeCardById(queryClient, noticeId);
          socket?.emit(SOCKET_EVENTS.NOTICE_DELETED, { noticeId });
        }
        await queryClient.invalidateQueries({ queryKey: NOTICE_LIST_KEY });

        toast.success(result.message);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "상태를 변경하지 못했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [noticeId, noticeTitle, queryClient, socket],
  );

  return (
    <>
      {status !== "PUBLISHED" && (
        <button
          type="button"
          className="action-btn"
          onClick={() => changeStatus("PUBLISHED")}
          disabled={isLoading}
        >
          다시 게시
        </button>
      )}
      {status !== "HIDDEN" && (
        <button
          type="button"
          className="action-btn"
          onClick={() => changeStatus("HIDDEN")}
          disabled={isLoading}
        >
          내리기
        </button>
      )}
    </>
  );
};

export default NoticeStatusActions;

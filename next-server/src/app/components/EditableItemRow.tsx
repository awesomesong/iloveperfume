"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import dayjs from "@/src/app/utils/day";
import FallbackNextImage from "./FallbackNextImage";
import CircularProgress from "./CircularProgress";

/** 리스트 행 액션(수정/삭제) - fill pill 형태, 그라데이션 없이 단색 */
const rowActionBase =
  "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors";

export type EditableItemRowProps = {
  id: string;
  idPrefix: "review" | "comment";
  authorName?: string | null;
  authorImage?: string | null;
  createdAt: string | Date;
  canEdit: boolean;
  isEditing: boolean;
  isUpdating: boolean;
  onStartEdit: () => void;
  onDelete: () => void;
  deleteConfirmMessage: string;
  updatingLabel: string;
  avatarFallback: ReactNode;
  editForm: ReactNode;
  /** Sanitized HTML string for the main content (when not editing) */
  contentHtml: string;
};

export default function EditableItemRow({
  id,
  idPrefix,
  authorName,
  authorImage,
  createdAt,
  canEdit,
  isEditing,
  isUpdating,
  onStartEdit,
  onDelete,
  deleteConfirmMessage,
  updatingLabel,
  avatarFallback,
  editForm,
  contentHtml,
}: EditableItemRowProps) {
  const handleDelete = () => {
    if (typeof window !== "undefined" && window.confirm(deleteConfirmMessage)) {
      onDelete();
    }
  };

  return (
    <div
      id={`${idPrefix}-${id}`}
      className="flex flex-row gap-3 py-1"
    >
      <span className="shrink-0 overflow-hidden relative w-10 h-10 mt-1 rounded-full">
        {authorImage ? (
          <FallbackNextImage
            src={authorImage}
            alt={`${authorName ?? ""} 이미지`}
            fill
            className="object-cover"
            unoptimized={false}
          />
        ) : (
          avatarFallback
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="inline-flex items-center flex-wrap">
          <span className="break-all mr-2 text-sm text-[var(--color-text-primary)]">
            {authorName}
          </span>
          <span className="text-[var(--color-text-secondary)] mr-2 text-xs">
            {dayjs(createdAt).fromNow()}
          </span>
          {canEdit && (
            <span className="inline-flex items-center gap-1.5 ml-0.5">
              <button
                type="button"
                onClick={onStartEdit}
                title={String(id).startsWith("temp-") ? "서버에 저장 중입니다." : undefined}
                disabled={String(id).startsWith("temp-")}
                className={clsx(
                  rowActionBase,
                  "bg-[var(--color-accent-pale)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-border)] hover:text-[var(--color-text-primary)]",
                  // eslint-disable-next-line no-restricted-syntax
                  "dark:bg-[#9d8fb8] dark:text-[#1f1b29] dark:hover:bg-[#b5a8cc]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                수정
              </button>
              <button
                type="button"
                onClick={handleDelete}
                title={String(id).startsWith("temp-") ? "서버에 저장 중입니다." : undefined}
                disabled={String(id).startsWith("temp-")}
                className={clsx(
                  rowActionBase,
                  "bg-[var(--color-accent-pale)] text-[var(--color-text-secondary)]",
                  "hover:bg-[var(--color-accent-border)] hover:text-[var(--color-text-primary)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                삭제
              </button>
            </span>
          )}
        </div>
        {isEditing ? (
          isUpdating ? (
            <div className="flex items-center justify-center py-4">
              <CircularProgress aria-label={updatingLabel} />
            </div>
          ) : (
            editForm
          )
        ) : (
          <pre
            className="whitespace-pre-wrap text-[13px] md:text-[14px] leading-[1.7] text-[var(--color-text-secondary)]"
            dangerouslySetInnerHTML={{ __html: contentHtml }}
          />
        )}
      </div>
    </div>
  );
}

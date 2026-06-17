"use client";

import FallbackNextImage from "@/src/app/components/FallbackNextImage";
import ILPUserAvatar from "@/src/app/components/ILPUserAvatar";
import clsx from "clsx";

type Props = {
  authorName: string | null | undefined;
  authorImage: string | null | undefined;
  className?: string;
  variant?: "auto" | "light";
  align?: "start" | "center";
};

export default function FragranceAuthorMetaClient({
  authorName,
  authorImage,
  className,
  variant = "auto",
  align = "start",
}: Props) {
  if (!authorName) return null;

  return (
    <div
      className={clsx(
        "flex w-full text-[13px] md:text-[14px] text-[var(--color-text-secondary)]",
        align === "center" ? "justify-center" : "justify-start",
        variant === "light" ? "force-light-ilp-gradient" : "",
        className
      )}
    >
      <div className="flex max-w-full items-center gap-2">
        <span className="notice-meta__avatar shrink-0">
          {authorImage ? (
            <FallbackNextImage
              src={authorImage}
              alt={authorName}
              fill
              sizes="28px"
              unoptimized={false}
              className="object-cover"
            />
          ) : (
            <ILPUserAvatar className="drop-shadow-lg" />
          )}
        </span>
        <span className="min-w-0 break-all whitespace-normal text-left">
          {authorName}
        </span>
      </div>
    </div>
  );
}


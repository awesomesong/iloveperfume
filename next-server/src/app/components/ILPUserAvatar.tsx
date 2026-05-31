"use client";
import { useId } from "react";
import { PiUserCircleDuotone } from "react-icons/pi";
import clsx from "clsx";

type ILPUserAvatarProps = {
    className?: string;
};

/**
 * ILPUserAvatar
 * A reusable user avatar component with the brand's signature ilp-gradient.
 */
const ILPUserAvatar = ({ className }: ILPUserAvatarProps) => {
    const gradientId = useId();
    return (
        <span className="ilp-avatar-root block w-full h-full">
            <svg width="0" height="0" className="absolute">
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--ilp-gradient-start)" />
                    <stop offset="55%" stopColor="var(--ilp-gradient-mid)" />
                    <stop offset="100%" stopColor="var(--ilp-gradient-end)" />
                </linearGradient>
            </svg>
            <PiUserCircleDuotone
                className={clsx("icon-accent w-full h-full scale-[1.2]", className)}
                fill={`url(#${gradientId})`}
                style={{ opacity: 0.9 }}
            />
        </span>
    );
};

export default ILPUserAvatar;

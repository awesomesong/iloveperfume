"use client";
import { PiUserCircleDuotone } from "react-icons/pi";
import clsx from "clsx";

type ILPUserAvatarProps = {
  className?: string;
};

const ILPUserAvatar = ({ className }: ILPUserAvatarProps) => {
  return (
    <PiUserCircleDuotone
      className={clsx("w-full h-full text-fg-primary opacity-80", className)}
      aria-hidden
    />
  );
};

export default ILPUserAvatar;

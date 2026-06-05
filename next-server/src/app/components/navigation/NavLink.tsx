'use client';

import Link from 'next/link';
import { clsx } from 'clsx';

interface NavLinkProps {
  href: string;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  onMouseOver?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onMouseOut?: () => void;
  onFocus?: (e: React.FocusEvent<HTMLAnchorElement>) => void;
  onBlur?: () => void;
  showLineOnActive?: boolean;
}

const NavLink: React.FC<NavLinkProps> = ({
  href,
  label,
  isActive = false,
  onClick,
  onMouseOver,
  onMouseOut,
  onFocus,
  onBlur,
  showLineOnActive = false,
}) => {
  return (
    <span className="group relative inline-flex flex-col items-start leading-none">
      <Link
        href={href}
        onClick={onClick}
        onMouseOver={onMouseOver}
        onMouseOut={onMouseOut}
        onFocus={onFocus}
        onBlur={onBlur}
        className={clsx(
          'font-pretendard text-[14px] md:text-[15px] font-normal tracking-[0.04em] text-fg-primary nav-hover'
        )}
      >
        {label}
      </Link>
      {/* active 상태 표시만 유지 */}
      {showLineOnActive && isActive && (
        <span
          className="line-gradient-deco absolute left-0 -bottom-1 w-full"
          aria-hidden
        />
      )}
    </span>
  );
};

export default NavLink;

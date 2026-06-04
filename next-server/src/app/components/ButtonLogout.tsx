'use client';
import { signOut } from 'next-auth/react';

const ButtonLogout = () => {
    const onClick = () => {
        const result = confirm('로그아웃 하시겠습니까?');
        if (result) {
            // 현재 페이지에 머물기 (클라이언트에서만 pathname 사용)
            const callbackUrl = typeof window !== 'undefined' ? window.location.pathname : '/';
            signOut({ callbackUrl });
        }
    };

    return (
        <button
            type="button"
            className="font-pretendard text-[14px] md:text-[15px] font-normal tracking-[0.02em] text-text-primary nav-hover cursor-pointer focus:outline-none"
            onClick={onClick}
        >
            Logout
        </button>
    );
}

export default ButtonLogout

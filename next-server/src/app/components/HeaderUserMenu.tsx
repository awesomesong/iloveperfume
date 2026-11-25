'use client';

import { useSession } from 'next-auth/react';
import ButtonLogin from './ButtonLogin';
import ButtonLogout from './ButtonLogout';
import ButtonProfile from './ButtonProfile';
import ShapesSkeleton from './skeleton/ShapesSkeleton';

// 로그인 전/후 콘텐츠 폭이 달라도 내비게이션이 흔들리지 않도록 세 상태 모두 같은 폭을 확보
const SLOT_CLASS = 'flex items-center justify-end gap-3 min-w-[96px]';

const HeaderUserMenu = () => {
    const { data: session, status } = useSession();

    if (status === 'loading') {
        return (
            <li className={SLOT_CLASS} aria-hidden>
                <ShapesSkeleton width="30px" height="30px" radius="full" />
                <ShapesSkeleton width="49px" height="16px" radius="sm" />
            </li>
        );
    }

    if (session?.user?.name) {
        return (
            <li className={SLOT_CLASS}>
                <ButtonProfile />
                <ButtonLogout />
            </li>
        );
    }

    return (
        <li className={SLOT_CLASS}>
            <ButtonLogin />
        </li>
    );
};

export default HeaderUserMenu;

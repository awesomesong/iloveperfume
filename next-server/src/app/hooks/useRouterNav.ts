import { useMemo } from "react";
import { usePathname } from "next/navigation";

const useRouteNav = () => {
    const pathname = usePathname();

    const routerNav = useMemo(() => [
        {
            label: 'Chat',
            href: '/chatMember',
            active: false
        },
        {
            label: 'Notice',
            href: '/notice',
            active: pathname?.startsWith('/notice')
        },
        {
            label: 'Perfume',
            href: '/fragrance',
            active: pathname?.startsWith('/fragrance')
        },
    ], [pathname]);

    return routerNav;
};

export default useRouteNav;

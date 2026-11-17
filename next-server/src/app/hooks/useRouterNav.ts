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
            label: 'News',
            href: '/news',
            active: pathname?.startsWith('/news')
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

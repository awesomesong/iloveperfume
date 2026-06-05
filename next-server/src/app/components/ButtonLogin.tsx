'use client';
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ButtonLogin = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const queryString = searchParams?.toString();
    const fullPath = `${pathname}${queryString ? `?${queryString}` : ''}`;
    const signInHref = `/auth/signin${fullPath ? `?callbackUrl=${encodeURIComponent(fullPath)}` : ''}`;

    return (
        <Link
            href={signInHref}
            className="font-pretendard text-[14px] md:text-[15px] font-normal tracking-[0.02em] text-fg-primary nav-hover focus:outline-none"
        >
            login
        </Link>
    );
}

export default ButtonLogin;

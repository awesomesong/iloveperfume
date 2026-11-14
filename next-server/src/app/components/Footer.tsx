import Link from 'next/link';
import AnimatedLogo from './AnimatedLogo';
import {
    FOOTER_BRAND,
    FOOTER_CONTACT,
    FOOTER_LEGAL_LINKS,
    FOOTER_LINK_GROUPS,
    type FooterLink,
} from '@/src/app/config/footer';

function FooterLinkItem({ link, className }: { link: FooterLink; className: string }) {
    if (link.external) {
        return (
            <a href={link.href} target="_blank" rel="noopener noreferrer" className={className}>
                {link.label}
            </a>
        );
    }
    return (
        <Link href={link.href} className={className}>
            {link.label}
        </Link>
    );
}

export default function Footer() {
    const year = new Date().getFullYear();
    const linkGroups = FOOTER_LINK_GROUPS.filter((group) => group.links.length > 0);
    const hasContact = Boolean(FOOTER_CONTACT.email) || FOOTER_CONTACT.channels.length > 0;

    return (
        <footer className="footer-root">
            {/* 상단 구분선 */}
            <div className="footer-deco-line" />

            <div className="footer-inner">
                {/* 좌: 브랜드 */}
                <div className="footer-brand">
                    <div className="[&_.line-gradient-deco]:hidden">
                        <AnimatedLogo />
                    </div>
                    <p className="footer-brand-sub">{FOOTER_BRAND.tagline}</p>
                </div>

                {/* 우: 링크 그룹 + 문의 */}
                <div className="footer-links">
                    {linkGroups.map((group) => (
                        <nav key={group.title} aria-label={group.title}>
                            <p className="footer-nav-title">{group.title}</p>
                            <ul className="footer-nav-list">
                                {group.links.map((link) => (
                                    <li key={link.href}>
                                        <FooterLinkItem link={link} className="footer-nav-link" />
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    ))}

                    {hasContact && (
                        <div>
                            <p className="footer-nav-title">{FOOTER_CONTACT.title}</p>
                            <ul className="footer-nav-list">
                                {FOOTER_CONTACT.email && (
                                    <li>
                                        <a href={`mailto:${FOOTER_CONTACT.email}`} className="footer-nav-link">
                                            {FOOTER_CONTACT.email}
                                        </a>
                                    </li>
                                )}
                                {FOOTER_CONTACT.channels.map((link) => (
                                    <li key={link.href}>
                                        <FooterLinkItem link={link} className="footer-nav-link" />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* 하단: 저작권 + 법적 고지 */}
            <div className="footer-bottom">
                <p>© {year} {FOOTER_BRAND.copyrightHolder}. All rights reserved.</p>
                {FOOTER_LEGAL_LINKS.length > 0 && (
                    <ul className="footer-legal">
                        {FOOTER_LEGAL_LINKS.map((link) => (
                            <li key={link.href}>
                                <FooterLinkItem link={link} className="footer-legal-link" />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </footer>
    );
}

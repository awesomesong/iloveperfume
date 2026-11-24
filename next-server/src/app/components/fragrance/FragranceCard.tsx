import type { ReactNode } from "react";
import Link from "next/link";
import FallbackNextImage from "@/src/app/components/FallbackNextImage";

type Props = {
    slug: string;
    brand: string;
    name: string;
    image?: string | null;
    /** 이름 아래 덧붙이는 줄 — 목록은 "신제품", 향수 만들기 결과는 겹친 향 */
    children?: ReactNode;
};

/**
 * 향수 카드 한 장(li) — 홈 갤러리 카드와 같은 클래스(product-fragrance-card)를 쓰고, 이미지는 첫 장만 보여준다.
 * `ul.fragrance-list` 안에 놓는다. 규칙은 docs/design-system.md 6-2.
 */
const FragranceCard = ({ slug, brand, name, image, children }: Props) => (
    <li>
        <Link
            href={`/fragrance/${slug}`}
            className="fragrance-list-card product-fragrance-card product-fragrance-card-layout product-fragrance-card-rest"
        >
            <div className="card-image-slider-box product-fragrance-card-image-box">
                {image && (
                    <FallbackNextImage
                        src={image}
                        alt=""
                        fill
                        sizes="(max-width: 767px) 45vw, (max-width: 1024px) 22vw, 200px"
                        className="object-contain"
                    />
                )}
            </div>
            <div className="text-center w-full">
                <p className="product-fragrance-brand text-[0.68rem] font-medium tracking-[0.12em] uppercase mb-1">
                    {brand}
                </p>
                <p className="product-fragrance-name text-[0.9rem] font-medium m-0 leading-[1.35]">{name}</p>
                {children}
            </div>
        </Link>
    </li>
);

export default FragranceCard;

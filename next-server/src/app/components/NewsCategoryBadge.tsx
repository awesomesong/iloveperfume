import clsx from "clsx";
import { NEWS_CATEGORY_LABEL, type NewsCategory } from "@/src/app/lib/news/categories";

type Props = {
  category: NewsCategory;
  className?: string;
};

/** 향수 뉴스 분류 표시 (상세) — 배지(알약) 대신 강조색 글자만 쓴다 */
const NewsCategoryBadge = ({ category, className }: Props) => (
  <span className={clsx("news-category", className)}>
    {NEWS_CATEGORY_LABEL[category] ?? category}
  </span>
);

export default NewsCategoryBadge;

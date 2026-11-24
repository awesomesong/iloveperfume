import imageHosts from "@/image-hosts.json";

/** next/image가 최적화해 주는 호스트 (next.config.js remotePatterns와 같은 목록) */
const OPTIMIZED_HOSTS = new Set(imageHosts.map((host) => host.hostname));

/**
 * next/image에 넘길 src와 최적화 여부를 정한다.
 * - Cloudinary: f_auto,q_auto 변환을 넣어 CDN에서 직접 최적화한다
 * - 허용 목록에 없는 외부 호스트: 최적화 없이 원본 주소로 그린다. 수집된 향수의 이미지는 브랜드 공식 사이트 것을
 *   그대로 링크하는데, 수집 대상이 자동으로 늘어나 호스트를 미리 등록할 수 없다
 */
export function resolveImageSrc(src: string): { src: string; unoptimized: boolean } {
  if (src.includes("res.cloudinary.com")) {
    if (/\/upload\/[a-z]_/.test(src)) return { src, unoptimized: true };
    return { src: src.replace("/upload/", "/upload/f_auto,q_auto/"), unoptimized: true };
  }
  if (/^https?:\/\//i.test(src)) {
    try {
      return { src, unoptimized: !OPTIMIZED_HOSTS.has(new URL(src).hostname) };
    } catch {
      return { src, unoptimized: true };
    }
  }
  return { src, unoptimized: false };
}

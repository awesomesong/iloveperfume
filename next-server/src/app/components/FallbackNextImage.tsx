"use client";

import Image, { ImageProps } from "next/image";
import { useEffect, useState } from "react";
import { resolveImageSrc } from "@/src/app/lib/imageSrc";

const FallbackNextImage = ({
  src,
  alt,
  ...props
}: { src: string; alt: string } & ImageProps) => {
  const opt = resolveImageSrc(src);
  const [imgSrc, setImgSrc] = useState(opt.src);

  useEffect(() => {
    setImgSrc(resolveImageSrc(src).src);
  }, [src]);

  return (
    <Image
      {...props}
      src={imgSrc}
      alt={alt}
      unoptimized={opt.unoptimized}
      onError={() => setImgSrc("/image/error_404.png")}
    />
  );
};

export default FallbackNextImage;

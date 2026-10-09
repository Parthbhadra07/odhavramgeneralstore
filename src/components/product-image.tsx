"use client";

import NextImage, { type ImageProps } from "next/image";

const PLACEHOLDER = "/images/product-placeholder.svg";

type ProductImageProps = Omit<ImageProps, "src"> & {
  src?: string | null;
  fit?: "contain" | "cover" | "fill" | "scale-down";
};

/**
 * Renders product images from any URL (admin-pasted links) without
 * requiring each hostname in next.config.
 */
export function ProductImage({
  src,
  alt,
  className,
  fill,
  sizes,
  priority,
  fit,
  ...rest
}: ProductImageProps) {
  const imageSrc = src?.trim() || PLACEHOLDER;
  const isLocal = imageSrc.startsWith("/");

  const resolvedFit =
    fit ||
    (className?.includes("object-cover")
      ? "cover"
      : className?.includes("object-contain")
      ? "contain"
      : "contain");

  // Local / public files — use Next.js Image (aliased to avoid DOM Image conflict)
  if (isLocal) {
    return (
      <NextImage
        src={imageSrc}
        alt={alt}
        fill={fill}
        className={className}
        sizes={sizes}
        priority={priority}
        {...rest}
      />
    );
  }

  // External URLs — native img (any https host from product admin)
  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: resolvedFit,
        }}
        loading={priority ? "eager" : "lazy"}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      loading={priority ? "eager" : "lazy"}
    />
  );
}

export { PLACEHOLDER as PRODUCT_IMAGE_PLACEHOLDER };

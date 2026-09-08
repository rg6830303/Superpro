import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  /** "lockup" = mark + wordmark, "mark" = monogram only. */
  variant?: "lockup" | "mark";
  tone?: "white" | "black";
  className?: string;
  height?: number;
  href?: string | null;
  priority?: boolean;
};

const SOURCES = {
  lockup: { white: "/logo/superpro-logo-white.png", black: "/logo/superpro-logo-black.png", ratio: 672 / 381 },
  mark: { white: "/logo/superpro-mark-white.png", black: "/logo/superpro-mark-black.png", ratio: 374 / 242 },
} as const;

export function Logo({
  variant = "lockup",
  tone = "white",
  className = "",
  height = 34,
  href = "/",
  priority = false,
}: LogoProps) {
  const src = SOURCES[variant][tone];
  const width = Math.round(height * SOURCES[variant].ratio);

  const img = (
    <Image
      src={src}
      alt="SuperPro"
      width={width}
      height={height}
      priority={priority}
      className={className}
      style={{ height, width: "auto" }}
    />
  );

  if (!href) return img;
  return (
    <Link href={href} aria-label="SuperPro — home" className="inline-flex items-center">
      {img}
    </Link>
  );
}

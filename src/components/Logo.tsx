import { Link } from "@tanstack/react-router";

export function Logo({ variant = "default" }: { variant?: "default" | "light" }) {
  const isLight = variant === "light";
  return (
    <Link
      to="/"
      aria-label="GW English Flow"
      className={`group inline-flex items-center ${
        isLight
          ? "rounded-2xl bg-white/95 px-3 py-2 shadow-soft"
          : "rounded-2xl transition-transform hover:scale-[1.02]"
      }`}
    >
      <img
        src={isLight ? "/logo-gwenglishflow.png" : "/logo-gwenglishflow-header.png"}
        alt="GW English Flow by Eloiza GW"
        className={`${isLight ? "h-14" : "h-12 sm:h-14"} w-auto object-contain`}
        width={isLight ? 220 : 260}
        height={isLight ? 134 : 114}
      />
    </Link>
  );
}

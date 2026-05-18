import { Link } from "@tanstack/react-router";

export function Logo({ variant = "default" }: { variant?: "default" | "light" }) {
  const isLight = variant === "light";
  return (
    <Link
      to="/"
      aria-label="GWLanguageFlow"
      className={`group inline-flex items-center ${
        isLight
          ? "rounded-xl bg-white/95 px-3 py-2 shadow-soft"
          : "rounded-xl transition-transform hover:scale-[1.02]"
      }`}
    >
      <img
        src={isLight ? "/logo-gwenglishflow.png" : "/logo-gwenglishflow-header.png"}
        alt="GWLanguageFlow by Eloiza GW"
        className={`${isLight ? "h-12 sm:h-14" : "h-10 sm:h-12 md:h-[52px]"} w-auto object-contain`}
        width={isLight ? 220 : 260}
        height={isLight ? 134 : 114}
      />
    </Link>
  );
}

import { Link } from "@tanstack/react-router";

export function Logo({ variant = "default" }: { variant?: "default" | "light" }) {
  const textColor = variant === "light" ? "text-white" : "text-wine";
  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-warm shadow-bronze group-hover:scale-105 transition-transform">
        <span className="font-display text-white text-xl font-bold leading-none">G</span>
        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-bronze border-2 border-background" />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-display text-lg font-bold ${textColor}`}>GW</span>
        <span className="text-[10px] uppercase tracking-widest text-brown-soft">LanguageFlow</span>
      </div>
    </Link>
  );
}

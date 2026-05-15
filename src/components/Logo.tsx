import { Link } from "@tanstack/react-router";

export function Logo({ variant = "default" }: { variant?: "default" | "light" }) {
  const textColor = variant === "light" ? "text-white" : "text-wine";
  return (
    <Link to="/" className="group flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-gradient-warm shadow-bronze transition-transform group-hover:scale-105">
        <span className="font-display text-2xl font-bold leading-none text-white">G</span>
        <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-background bg-bronze" />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-display text-xl font-bold ${textColor}`}>GW</span>
        <span className="text-[10px] uppercase text-brown-soft">LanguageFlow</span>
      </div>
    </Link>
  );
}

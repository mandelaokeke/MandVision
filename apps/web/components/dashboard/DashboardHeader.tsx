

"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, Bot, Images, Menu, Upload, X } from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/library", label: "Library", icon: Images },
  { href: "/ask", label: "VisoAI", icon: Bot },
];

export function DashboardHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-white/10 bg-[#070b10]/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-3 rounded-xl transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 sm:gap-4"
            aria-label="Go to MandVision home"
          >
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-emerald-400/30 sm:h-11 sm:w-11">
              <Image
                src="/mandvision-logo.png"
                alt="MandVision logo"
                fill
                sizes="44px"
                className="object-cover"
                priority
              />
            </span>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
                MandVision
              </h1>
              <p className="truncate text-xs text-emerald-300/80 sm:text-sm">
                AI Image Intelligence Platform
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200 md:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="hidden items-center gap-3 md:flex">
            <nav className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => (
                <HeaderNavLink
                  key={item.href}
                  item={item}
                  active={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                />
              ))}
            </nav>

            <ThemeToggle />
          </div>
        </div>

        {menuOpen ? (
          <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-3 md:hidden">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <HeaderNavLink
                  key={item.href}
                  item={item}
                  active={active}
                  onClick={() => setMenuOpen(false)}
                  fullWidth
                />
              );
            })}

            <div className="flex justify-end">
              <ThemeToggle />
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function HeaderNavLink({
  item,
  active,
  onClick,
  fullWidth = false,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  onClick?: () => void;
  fullWidth?: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
        fullWidth ? "w-full justify-start" : ""
      } ${
        active
          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

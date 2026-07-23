"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bot, House, Images, Menu, Upload, UserRound, X } from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { useDashboard } from "@/components/dashboard/DashboardProvider";

const navItems = [
  { href: "/", label: "Home", icon: House },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/library", label: "Library", icon: Images },
  { href: "/ask", label: "VisoAI", icon: Bot },
];

export function DashboardHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { session } = useDashboard();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b10]/90 px-4 py-3 backdrop-blur-xl sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="flex min-w-0 items-center gap-3 rounded-xl transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50 sm:gap-4"
            aria-label="Go to MandVision home"
          >
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl ring-1 ring-emerald-400/30 sm:h-11 sm:w-11">
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
              <h1 className="truncate text-lg font-bold tracking-tight text-white sm:text-2xl">
                MandVision
              </h1>
              <p className="hidden truncate text-xs text-emerald-300/80 min-[420px]:block sm:text-sm">
                Media Intelligence Platform
              </p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <ThemeToggle compact />
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {session.user ? (
              <div className="inline-flex h-10 max-w-[15rem] items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-3 text-sm font-semibold text-emerald-100">
                <UserRound className="h-4 w-4" />
                <span className="truncate">{session.user.name}</span>
              </div>
            ) : (
              <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-300">
                <UserRound className="h-4 w-4" />
                Guest mode
              </div>
            )}

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
          <div className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-[#0d131c]/95 p-3 shadow-2xl shadow-black/30 md:hidden">
            <div
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                session.user
                  ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-100"
                  : "border-white/10 bg-white/[0.03] text-slate-300"
              }`}
            >
              <UserRound className="h-4 w-4" />
              <span className="truncate">
                {session.user ? `Signed in as ${session.user.name}` : "Guest mode"}
              </span>
            </div>

            <nav className="grid gap-2">
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
            </nav>

            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs leading-5 text-slate-400">
              Upload and inspect files in the Library, then ask VisoAI about the selected
              result.
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
      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
        fullWidth ? "w-full justify-start px-4" : ""
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

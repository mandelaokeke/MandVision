

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bot, Images, Sparkles, Upload } from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/library", label: "Library", icon: Images },
  { href: "/ask", label: "VisoAI", icon: Bot },
];

export function DashboardHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-white/10 bg-[#070b10]/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/30 sm:h-11 sm:w-11">
            <Sparkles className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
              MandVision
            </h1>
            <p className="truncate text-xs text-emerald-300/80 sm:text-sm">
              AI Image Intelligence Platform
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
                    active
                      ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200"
                      : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center">
            <Link
              href="/upload"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-transparent px-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-400/10 hover:text-emerald-200"
            >
              <Upload className="h-4 w-4" />
              Upload New
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

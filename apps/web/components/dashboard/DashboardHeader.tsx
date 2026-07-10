

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
    <header className="border-b border-white/10 bg-[#070b10]/95 px-6 py-5 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-400/30">
            <Sparkles className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              MandVision
            </h1>
            <p className="text-sm text-emerald-300/80">
              AI Image Intelligence Platform
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
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
    </header>
  );
}

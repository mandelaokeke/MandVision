

"use client";

import { Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardHeader() {
  return (
    <header className="border-b border-white/10 bg-[#070b10]/95 px-6 py-5 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
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

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("mandvision:new-upload"));
          }}
          className="border-emerald-400/40 bg-transparent text-emerald-300 hover:bg-emerald-400/10 hover:text-emerald-200"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload New
        </Button>
      </div>
    </header>
  );
}
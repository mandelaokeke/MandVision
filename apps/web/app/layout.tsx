import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardProvider } from "@/components/dashboard/DashboardProvider";
import { Footer } from "@/components/dashboard/Footer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MandVision",
  description: "AI image and document intelligence dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#070b10] text-white">
        <DashboardProvider>
          <main className="min-h-screen">
            <DashboardHeader />
            {children}
          </main>
          <Footer />
        </DashboardProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "NOM CURRY - Quản lý ca làm",
  description: "Shift registration, attendance, and payroll management for NomCurry.",
  icons: {
    icon: "/assets/logo.jpeg?v=1",
    apple: "/assets/logoiphone.png?v=1",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}

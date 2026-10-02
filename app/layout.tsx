import type { Metadata } from "next";
import { Noto_Sans_Thai, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบเบิกจ่ายพาเลท | Noritake",
  description: "ระบบเบิก-รับ-คืน-ซ่อม พาเลทของโรงงาน ผ่านเว็บและ LINE",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${notoSansThai.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-slate-900">
        {children}
      </body>
    </html>
  );
}

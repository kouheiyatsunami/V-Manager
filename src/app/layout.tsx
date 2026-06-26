import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import { AuthProvider } from "../contexts/AuthContext";
import LoginModal from "../components/LoginModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "V-Manager",
  description: "大学バレーボール スコア管理システム",
  appleWebApp: {
    capable: true,
    title: "V-Manager",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0891b2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={`${inter.className} bg-[#f2f4f5] text-gray-900 pb-20`}>
        <AuthProvider>
          <Header />
          <main className="min-h-screen">
            {children}
          </main>
          <BottomNav />
          <LoginModal />
        </AuthProvider>
      </body>
    </html>
  );
}
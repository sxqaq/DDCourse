import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DDCourse — Learning Player",
  description: "一个轻量、私密、会记住学习进度的本地课程视频播放器。",
  manifest: "/manifest.webmanifest",
  themeColor: "#111310",
  appleWebApp: {
    capable: true,
    title: "DDCourse",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
  openGraph: { title: "DDCourse", description: "专为本地课程设计的 Learning Player。", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

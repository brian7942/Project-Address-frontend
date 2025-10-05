import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Project:Address",
  description: "Generate digital addresses from buildings",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen flex flex-col antialiased overflow-hidden">
        <Header /> {/* fixed라면 여기엔 안 둬도 됨 */}
        <main className="flex-1 pt-14 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}

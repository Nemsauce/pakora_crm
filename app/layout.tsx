import { CountryProvider } from "@/components/CountryProvider";
import { TopNav } from "@/components/TopNav";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pakora CRM",
  description: "CRM premium para operaciones COD en Colombia y México"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <CountryProvider>
          <div className="min-h-screen bg-transparent">
            <TopNav />
            <main className="mt-28 w-full px-8 py-6 md:mt-20">{children}</main>
          </div>
        </CountryProvider>
      </body>
    </html>
  );
}

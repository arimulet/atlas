import type { Metadata, Viewport } from "next";
import "@/styles/index.scss";
import { BrowserTitle } from "@/components/BrowserTitle";
import { AuthProvider } from "@/context/AuthContext";
import { PlayerCountryProvider } from "@/context/PlayerCountryContext";

export const metadata: Metadata = {
  description: "Tactical management and analysis system for Sokker Manager",
  applicationName: "ATLAS"
};

export const viewport: Viewport = {
  themeColor: "#11181C"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <BrowserTitle />
        <AuthProvider>
          <PlayerCountryProvider>{children}</PlayerCountryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

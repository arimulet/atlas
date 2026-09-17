import type { Metadata } from "next";
import "@/styles/index.scss";
import { AuthProvider } from "@/context/AuthContext";
import { PlayerCountryProvider } from "@/context/PlayerCountryContext";

export const metadata: Metadata = {
  title: "ATLAS - Football Manager",
  description: "Tactical management and analysis system for Sokker Manager"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <PlayerCountryProvider>{children}</PlayerCountryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./styles/index.scss";
import { AuthProvider } from "./context/AuthContext";
import { ClubDataProvider } from "./context/ClubDataContext";
import { AtlasShell } from "./components/AtlasShell";

export const metadata: Metadata = {
  title: "ATLAS",
  description: "ATLAS Sokker Management Platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          <ClubDataProvider>
            <AtlasShell>{children}</AtlasShell>
          </ClubDataProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

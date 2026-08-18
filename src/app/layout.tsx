import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <html lang="nl">
      <body className="min-h-screen antialiased">
        {publishableKey ? (
          <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}

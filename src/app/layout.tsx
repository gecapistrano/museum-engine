import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Museum Engine — a walkable gallery in the browser",
  description:
    "A first-person 3D museum built with Next.js and React Three Fiber. Drop images into a folder and the engine builds the room, hangs the prints, and lights them.",
  icons: {
    icon: "/img/icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030304",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

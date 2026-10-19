import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Tidepost Console",
  description: "Plan and manage social media content from one workspace."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

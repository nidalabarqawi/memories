
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Memories | ذكريات",
  description:
    "Reconnect with your school, university, and unforgettable memories. استعد ذكريات المدرسة والجامعة وأجمل لحظات العمر.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar">
      <body>{children}</body>
    </html>
  );
}

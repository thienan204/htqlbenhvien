import { cookies } from 'next/headers';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AntdRegistry from "@/lib/AntdRegistry";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kiểm tra lỗi BHXH",
  description: "Công cụ kiểm tra và phân tích lỗi hồ sơ Bảo Hiểm Xã Hội",
};

import prisma from "@/lib/prisma";
import MainLayout from "@/components/architect/MainLayout";
import { getCurrentUser } from "@/actions/auth";
import { AuthProvider } from "@/contexts/AuthContext";
import FetchInterceptor from "@/components/FetchInterceptor";

async function getSpecializedRules() {
  try {
    const rules = await prisma.specializedRule.findMany({
      where: { 
        isActive: true,
        ruleType: { not: 'SYSTEM_CONFIG' }
      },
      orderBy: { order: 'asc' },
    });
    return JSON.parse(JSON.stringify(rules));
  } catch (error) {
    console.error("Failed to fetch specialized rules:", error);
    return [];
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const isLoggedIn = cookieStore.has('auth_token');
  const rules = await getSpecializedRules();
  const user = await getCurrentUser();
  
  // Fetch GUEST role for unauthenticated users
  let guestPermissions = null;
  try {
    const guestRole = await prisma.role.findUnique({
      where: { code: 'GUEST' }
    });
    if (guestRole) {
      guestPermissions = guestRole.permissions;
    }
  } catch (e) {
    console.error("Failed to fetch GUEST role", e);
  }

  // Fetch Menus
  let menus: any[] = [];
  try {
    menus = await prisma.menu.findMany({
      where: { isActive: true },
      orderBy: [
        { parentId: 'asc' },
        { order: 'asc' },
      ],
    });
  } catch (e) {
    console.error("Failed to fetch menus", e);
  }

  console.log("Current user from JWT:", user);

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AntdRegistry>
          <AuthProvider user={user} guestPermissions={guestPermissions}>
            <FetchInterceptor />
            {/* Main Layout Wrapper */}
            <MainLayout rules={rules} menus={menus}>
              {children}
            </MainLayout>
          </AuthProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}

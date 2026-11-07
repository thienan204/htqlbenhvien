import { cookies } from 'next/headers';
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AntdRegistry from "@/lib/AntdRegistry";
import { App } from 'antd';


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hệ thống Quản lý Bệnh viện - BVĐK tỉnh Lạng Sơn",
  description: "Hệ thống Quản lý Bệnh viện - Bệnh viện Đa khoa tỉnh Lạng Sơn",
  manifest: "/htqlbenhvien/manifest.json",
  icons: {
    icon: [
      { url: '/htqlbenhvien/app-icon.png', type: 'image/png' },
      { url: '/htqlbenhvien/logo.ico' },
      { url: '/htqlbenhvien/favicon.ico' }
    ],
    shortcut: '/htqlbenhvien/app-icon.png',
    apple: '/htqlbenhvien/app-icon.png',
  },
};

import prisma from "@/lib/prisma";
import MainLayout from "@/components/architect/MainLayout";
import { getCurrentUser } from "@/actions/auth";
import { AuthProvider } from "@/contexts/AuthContext";
import FetchInterceptor from "@/components/FetchInterceptor";
import DesktopShortcutPrompt from "@/components/DesktopShortcutPrompt";
import SessionTimeoutManager from "@/components/common/SessionTimeoutManager";
import { promises as fs } from 'fs';
import path from 'path';

async function getSpecializedRules() {
  try {
    const rules = await prisma.specializedRule.findMany({
      where: { 
        isActive: true,
        ruleType: { notIn: ['SYSTEM_CONFIG', 'USER_SOUND_CONFIG'] }
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

  // Fetch Admin Paths dynamically
  let adminOnlyPaths: string[] = [];
  try {
    const configPath = path.join(process.cwd(), 'data', 'admin-paths.json');
    const fileContent = await fs.readFile(configPath, 'utf-8');
    adminOnlyPaths = JSON.parse(fileContent);
  } catch (e) {
    console.error("Failed to read admin-paths.json in layout", e);
  }
  const dbAdminPaths = menus.filter(m => m.isAdminOnly && m.path && m.path !== '/').map(m => m.path);
  adminOnlyPaths = Array.from(new Set([...adminOnlyPaths, ...dbAdminPaths]));

  // Tính toán thời gian phiên làm việc (Session Timeout) theo cấu hình
  const isSupportUser = user ? (
    ['CNTT', 'VTYT', 'HCQT', 'ADMIN'].includes(user.role) || 
    ['KP046', 'KP038', 'KP040'].includes(user.ma_khoa || '')
  ) : false;

  let sessionTimeoutMinutes = 30;
  if (user) {
    try {
      const itConfigRule = await prisma.specializedRule.findUnique({
        where: { slug: 'it-request-fields-config' }
      });
      const itConfig: any = itConfigRule?.logicConfig || {};
      if (isSupportUser) {
        const hours = itConfig.supportSessionTimeoutHours !== undefined ? Number(itConfig.supportSessionTimeoutHours) : 8;
        sessionTimeoutMinutes = Math.max(hours * 60, 60); // Mặc định 8h = 480 phút
      } else {
        sessionTimeoutMinutes = itConfig.departmentSessionTimeoutMinutes !== undefined ? Number(itConfig.departmentSessionTimeoutMinutes) : 30;
      }
    } catch {
      sessionTimeoutMinutes = isSupportUser ? 480 : 30;
    }
  }
  const warningMinutes = Math.min(5, Math.max(1, Math.floor(sessionTimeoutMinutes * 0.05) || 2));

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AntdRegistry>
          <App>
            <AuthProvider user={user} guestPermissions={guestPermissions}>
              {user && <SessionTimeoutManager timeoutMinutes={sessionTimeoutMinutes} warningMinutes={warningMinutes} />}
              <FetchInterceptor />
              <DesktopShortcutPrompt />
              {/* Main Layout Wrapper */}
              <MainLayout rules={rules} menus={menus} adminOnlyPaths={adminOnlyPaths}>
                {children}
              </MainLayout>
            </AuthProvider>
          </App>
        </AntdRegistry>
      </body>
    </html>
  );
}

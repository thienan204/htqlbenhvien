'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import * as Icons from '@ant-design/icons';
import { Spin } from 'antd';

interface DashboardCard {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
    href: string;
    bgColor: string | null;
    borderColor: string | null;
    hoverColor: string | null;
    order: number;
    isActive: boolean;
}

export default function DashboardPage() {
  const [modules, setModules] = useState<DashboardCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const res = await fetch('/api/dashboard-cards');
        if (res.ok) {
          const data = await res.json();
          // Lọc ra các card đang active
          setModules(data.filter((c: DashboardCard) => c.isActive));
        }
      } catch (error) {
        console.error("Failed to load dashboard cards", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, []);

  const renderIcon = (iconName: string | null, colorClass: string) => {
    if (!iconName) return <Icons.AppstoreOutlined className={`text-4xl ${colorClass}`} />;
    const IconCmp = (Icons as any)[iconName];
    return IconCmp ? <IconCmp className={`text-4xl ${colorClass}`} /> : <Icons.AppstoreOutlined className={`text-4xl ${colorClass}`} />;
  };

  // Helper to extract text color from border color (e.g., border-cyan-200 -> text-cyan-500)
  const getIconColor = (borderClass: string | null) => {
      if (!borderClass) return 'text-slate-500';
      const parts = borderClass.split('-');
      if (parts.length >= 3) {
          return `text-${parts[1]}-500`; // Extract the color name (cyan, rose, etc.)
      }
      return 'text-blue-500';
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-[80vh]">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Hệ thống Quản lý Bệnh viện ĐKLS</h1>
        <p className="text-slate-500">Lựa chọn module chức năng bên dưới để bắt đầu làm việc.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod) => (
            <Link href={mod.href || '#'} key={mod.id} className="block">
              <div className={`p-6 rounded-2xl border-2 ${mod.bgColor} ${mod.borderColor} ${mod.hoverColor} transition-all duration-300 hover:shadow-lg cursor-pointer h-full group`}>
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
                    {renderIcon(mod.icon, getIconColor(mod.borderColor))}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {mod.description}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          
          {modules.length === 0 && (
              <div className="col-span-full text-center p-10 bg-white rounded-xl border border-dashed">
                  <p className="text-slate-500">Chưa có Thẻ Dashboard nào được cấu hình.</p>
              </div>
          )}
        </div>
      )}
      
      {/* Decorative Background */}
      <div className="fixed top-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-100/40 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-indigo-100/40 blur-[100px] rounded-full -z-10 pointer-events-none"></div>
    </div>
  );
}

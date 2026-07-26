import React from 'react';
import Link from 'next/link';
import {
    RocketOutlined, AppstoreOutlined,
    FileTextOutlined, FileExcelOutlined,
    SettingOutlined, DashboardOutlined,
    TableOutlined
} from '@ant-design/icons';
import { Button } from 'antd';
import prisma from '@/lib/prisma';

async function getSpecializedRules() {
    try {
        const rules = await prisma.specializedRule.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
        return rules;
    } catch (error) {
        console.error("Failed to fetch specialized rules:", error);
        return [];
    }
}

export default async function Sidebar() {
    const rules = await getSpecializedRules();

    return (
        <div className="w-[280px] bg-white h-screen fixed left-0 top-0 border-r border-slate-200 z-20 flex flex-col font-sans">
            {/* Logo Area */}
            <div className="h-[60px] flex items-center px-6 border-b border-slate-100">
                <Link href="/" className="flex items-center gap-2 text-slate-800 font-bold text-xl tracking-tight no-underline hover:text-slate-800">
                    <RocketOutlined className="text-blue-500 text-2xl" />
                    <span>ArchitectUI</span>
                </Link>
                <div className="ml-auto">
                    <Button type="text" icon={<AppstoreOutlined className="text-slate-400 text-lg" />} />
                </div>
            </div>

            {/* Scrollable Nav */}
            <div className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-slate-200">

                {/* Main Dashboard */}
                <div className="px-4 mb-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Tổng quan</p>
                    <Link href="/" className="bg-blue-50 text-blue-600 rounded-lg px-4 py-2.5 font-semibold flex items-center gap-3 cursor-pointer hover:bg-blue-100 transition-colors">
                        <DashboardOutlined className="text-lg" />
                        Trang chủ
                    </Link>
                </div>

                {/* Chuyên đề Section */}
                <div className="px-4 mb-2 mt-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Chuyên đề</p>

                    {/* Dynamic Rules List */}
                    {rules.length > 0 ? (
                        <div className="mb-2 space-y-1">
                            {rules.map((rule) => (
                                <Link
                                    key={rule.id}
                                    href={`/chuyen-de/${rule.slug}`}
                                    className="text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors"
                                >
                                    <FileTextOutlined className="text-lg opacity-70" />
                                    <span className="truncate">{rule.name}</span>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="px-4 py-2 text-slate-400 italic text-sm">Chưa có quy tắc</div>
                    )}

                    {/* Settings Link */}
                    <Link href="/chuyen-de" className="text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors mt-1">
                        <SettingOutlined className="text-lg opacity-70" />
                        Quy tắc chuyên đề
                    </Link>
                </div>

                {/* Tools Section */}
                <div className="px-4 mb-2 mt-6">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Công cụ & Tiện ích</p>

                    <Link href="/doc-file-excel" className="text-slate-600 hover:bg-slate-50 hover:text-green-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors">
                        <FileExcelOutlined className="text-lg opacity-70" />
                        Đọc dữ liệu Excel
                    </Link>

                    <Link href="/pttt-excel" className="text-slate-600 hover:bg-slate-50 hover:text-purple-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors mt-1">
                        <AuditOutlined className="text-lg opacity-70" />
                        Dữ liệu Excel PTTT
                    </Link>

                    <Link href="/rules" className="text-slate-600 hover:bg-slate-50 hover:text-orange-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors mt-1">
                        <FileTextOutlined className="text-lg opacity-70" />
                        Quy tắc XML
                    </Link>

                    <Link href="/excel-rules" className="text-slate-600 hover:bg-slate-50 hover:text-green-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors mt-1">
                        <TableOutlined className="text-lg opacity-70" />
                        Quy tắc Excel
                    </Link>

                    {/* Department Link - Ideally should check auth, but for now we put it here */}
                    <Link href="/departments" className="text-slate-600 hover:bg-slate-50 hover:text-purple-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors mt-1">
                        <AppstoreOutlined className="text-lg opacity-70" />
                        Q.Lý Khoa
                    </Link>

                    <Link href="/error-management/config" className="text-slate-600 hover:bg-slate-50 hover:text-red-600 rounded-lg px-4 py-2.5 font-medium flex items-center gap-3 cursor-pointer transition-colors mt-1">
                        <SettingOutlined className="text-lg opacity-70" />
                        Danh mục Lỗi IT
                    </Link>
                </div>

            </div>
        </div>
    );
}

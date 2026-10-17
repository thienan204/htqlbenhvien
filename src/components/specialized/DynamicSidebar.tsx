import React from 'react';
import Link from 'next/link';
import { Card } from 'antd';
import { FileTextOutlined, SettingOutlined, AppstoreOutlined } from '@ant-design/icons';
import prisma from '@/lib/prisma'; // Ensure this path is correct

async function getSpecializedRules() {
    try {
        const rules = await prisma.specializedRule.findMany({
            where: { 
                isActive: true,
                ruleType: { notIn: ['SYSTEM_CONFIG', 'USER_SOUND_CONFIG'] }
            },
            orderBy: { order: 'asc' },
        });
        return rules;
    } catch (error) {
        console.error("Failed to fetch specialized rules:", error);
        return [];
    }
}

export default async function DynamicSidebar() {
    const rules = await getSpecializedRules();

    return (
        <Card className="shadow-sm border-slate-200 rounded-2xl h-full bg-white flex flex-col">
            <div className="mb-4 px-2 pt-2 border-b border-slate-100 pb-2">
                <h2 className="text-lg font-bold text-slate-700 px-2 flex items-center gap-2">
                    <AppstoreOutlined className="text-blue-600" />
                    Chuyên đề
                </h2>
            </div>

            <nav className="flex-1 flex flex-col space-y-1 overflow-y-auto">
                <div className="mb-2">
                    <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Danh sách kiểm tra
                    </div>
                    {rules.length === 0 ? (
                        <div className="px-4 py-3 text-slate-500 text-sm italic">
                            Chưa có quy tắc nào.
                        </div>
                    ) : (
                        rules.map((rule) => (
                            <Link
                                key={rule.id}
                                href={`/chuyen-de/${rule.slug}`}
                                className="flex items-center gap-3 px-4 py-[5px] text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors font-medium group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 flex items-center justify-center transition-colors">
                                    <FileTextOutlined />
                                </div>
                                <span className="text-sm">{rule.name}</span>
                            </Link>
                        ))
                    )}
                </div>
            </nav>
        </Card>
    );
}

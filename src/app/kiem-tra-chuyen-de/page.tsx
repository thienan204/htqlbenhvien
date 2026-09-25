import React from 'react';
import { Card } from 'antd';

export default function KiemTraChuyenDePage() {
    return (
        <div className="p-6 max-w-[98%] mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Kiểm tra chuyên đề</h1>
                <p className="text-slate-500 font-medium">Các báo cáo và kiểm tra chuyên sâu (Đang phát triển)</p>
            </div>

            <Card className="shadow-sm border-slate-200 rounded-2xl min-h-[400px] flex items-center justify-center">
                <div className="text-center text-slate-400">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <p className="text-lg">Tính năng đang được xây dựng...</p>
                </div>
            </Card>
        </div>
    );
}

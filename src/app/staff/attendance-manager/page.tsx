'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

export default function AttendanceManagerRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/staff/attendance');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
            <Spin size="large" />
            <span className="text-slate-500 font-medium text-sm">
                Đang chuyển hướng sang Bảng Chấm Công & Chấm Trực...
            </span>
        </div>
    );
}

'use client';

import React, { Suspense } from 'react';
import DetailedReport from '@/components/report/DetailedReport';
import { Spin } from 'antd';

export default function ReportPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center items-center min-h-screen">
                <Spin size="large" tip="Đang tải dữ liệu báo cáo..." />
            </div>
        }>
            <DetailedReport />
        </Suspense>
    );
}

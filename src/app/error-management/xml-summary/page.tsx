'use client';

import React, { Suspense } from 'react';
import XmlErrorSummaryClient from '@/components/error-management/XmlErrorSummaryClient';
import { Spin } from 'antd';

export default function XmlErrorSummaryPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center items-center min-h-screen">
                <Spin size="large" tip="Đang tải dữ liệu..." />
            </div>
        }>
            <XmlErrorSummaryClient />
        </Suspense>
    );
}

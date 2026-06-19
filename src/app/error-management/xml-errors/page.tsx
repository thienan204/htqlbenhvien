'use client';

import React, { Suspense } from 'react';
import XmlErrorManager from '@/components/error-management/XmlErrorManager';
import { Spin } from 'antd';

export default function XmlErrorsPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center items-center min-h-screen">
                <Spin size="large" tip="Đang tải dữ liệu..." />
            </div>
        }>
            <XmlErrorManager />
        </Suspense>
    );
}

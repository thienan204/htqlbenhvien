'use client';

import React from 'react';
import { Card, Typography } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { DeleteSnapshotPanel } from '@/components/common/DeleteSnapshotManagerModal';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;

export default function DeleteSnapshotsPage() {
    const { user } = useAuth();

    if (user && user.role !== 'ADMIN') {
        return (
            <div className="p-12 text-center text-rose-600 font-semibold">
                Chỉ tài khoản Quản trị viên (ADMIN) mới được phép truy cập trang Quản lý Snapshot.
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-[98%] mx-auto space-y-5">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shrink-0">
                    <HistoryOutlined />
                </div>
                <div>
                    <Title level={3} className="!m-0 !text-slate-800">
                        Quản lý Snapshot Sao lưu trước khi xóa
                    </Title>
                    <Text className="text-slate-500">
                        Xem lịch sử bản chụp JSON tự động trước các thao tác xóa toàn bộ, tải về máy, khôi phục hoặc dọn sạch sau khi hoàn tất.
                    </Text>
                </div>
            </div>

            <Card className="shadow-sm rounded-2xl border-slate-100">
                <DeleteSnapshotPanel active />
            </Card>
        </div>
    );
}


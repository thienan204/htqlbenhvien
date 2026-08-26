'use client';
import React from 'react';
import { Card, Typography } from 'antd';
import KskForm from '../components/KskForm';
import { FormOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function KskNhapLieuPage() {
    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <Title level={2}><FormOutlined className="mr-2" /> Nhập Hồ Sơ Khám Sức Khỏe Toàn Dân</Title>
                <Paragraph className="text-gray-500">
                    Vui lòng điền đầy đủ và chính xác các thông tin dưới đây. Các trường có dấu * là bắt buộc.
                </Paragraph>
            </div>
            <Card className="shadow-sm">
                <KskForm />
            </Card>
        </div>
    );
}

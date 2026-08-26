'use client';
import React, { useState, useEffect } from 'react';
import { Card, Typography, Input, Button, Form, message, Alert } from 'antd';
import { SearchOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import KskForm from '../components/KskForm';
import { useSearchParams } from 'next/navigation';

const { Title, Paragraph } = Typography;

export default function KskTraCuuPage() {
    const searchParams = useSearchParams();
    const initSdt = searchParams.get('sdt');
    
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [record, setRecord] = useState<any>(null);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        if (initSdt) {
            form.setFieldsValue({ sdt: initSdt });
            handleSearch({ sdt: initSdt });
        }
    }, [initSdt, form]);

    const handleSearch = async (values: any) => {
        setLoading(true);
        setSearched(true);
        setRecord(null);
        try {
            let url = `/api/ksk-toan-dan?sdt=${values.sdt}`;
            if (values.cccd) url += `&cccd=${values.cccd}`;
            
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setRecord(data);
                message.success('Đã tải thông tin hồ sơ cũ');
            } else {
                message.warning('Không tìm thấy hồ sơ với thông tin này');
            }
        } catch (error) {
            message.error('Lỗi khi tra cứu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <Title level={2}><SearchOutlined className="mr-2" /> Tra Cứu & Cập Nhật Thông Tin KSK</Title>
                <Paragraph className="text-gray-500">
                    Tra cứu hồ sơ bằng Số điện thoại (SĐT) để chỉnh sửa các thông tin chưa chính xác.
                </Paragraph>
            </div>
            
            <Card className="mb-6 shadow-sm border-t-4 border-t-blue-500">
                <Form form={form} layout="inline" onFinish={handleSearch}>
                    <Form.Item name="sdt" rules={[{ required: true, message: 'Nhập SĐT' }]}>
                        <Input placeholder="Nhập Số điện thoại..." prefix={<SafetyCertificateOutlined />} className="w-64" />
                    </Form.Item>
                    <Form.Item name="cccd">
                        <Input placeholder="Số CCCD (không bắt buộc)" className="w-64" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} icon={<SearchOutlined />}>
                            Tìm Kiếm
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            {searched && !record && !loading && (
                <Alert message="Không tìm thấy hồ sơ. Vui lòng kiểm tra lại SĐT hoặc CCCD." type="warning" showIcon />
            )}

            {record && (
                <Card className="shadow-sm" title="Thông tin hồ sơ (Chỉnh sửa và Lưu lại để cập nhật)">
                    <KskForm initialData={record} onSuccess={() => handleSearch({ sdt: record.sdtBenhNhan, cccd: record.cccd })} />
                </Card>
            )}
        </div>
    );
}

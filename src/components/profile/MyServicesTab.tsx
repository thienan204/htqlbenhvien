'use client';

import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Spin, Alert, Row, Col } from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function MyServicesTab() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const res = await fetch('/api/auth/profile/services');
                if (!res.ok) {
                    throw new Error('Không thể tải dữ liệu dịch vụ');
                }
                const result = await res.json();
                setData(result);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
    }, []);

    if (loading) {
        return <div className="p-10 flex justify-center"><Spin size="large" /></div>;
    }

    if (error) {
        return <Alert message="Lỗi" description={error} type="error" showIcon className="m-4" />;
    }

    if (!data || !data.certificates || data.certificates.length === 0) {
        return (
            <div className="p-8 text-center">
                <Alert
                    message="Chưa có Chứng chỉ hành nghề"
                    description="Tài khoản của bạn chưa được liên kết với bất kỳ Chứng chỉ hành nghề nào trên hệ thống."
                    type="warning"
                    showIcon
                    icon={<WarningOutlined />}
                />
            </div>
        );
    }

    const allowedColumns = [
        { title: 'Mã Dịch vụ', dataIndex: 'ma_dich_vu', key: 'ma_dich_vu', width: 120 },
        { title: 'Tên Dịch vụ (Theo danh mục)', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu' },
        { 
            title: 'Mã Phạm vi', 
            dataIndex: 'ma_pham_vi', 
            key: 'ma_pham_vi',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
            width: 150
        },
    ];

    const performedColumns = [
        { title: 'Mã Dịch vụ', dataIndex: 'ma_dich_vu', key: 'ma_dich_vu', width: 120 },
        { title: 'Tên Dịch vụ đã thực hiện', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu' },
        { 
            title: 'Trạng thái', 
            dataIndex: 'status', 
            key: 'status',
            render: (status: string) => {
                if (status === 'VALID' || status === 'APPROVED') return <Tag color="success" icon={<CheckCircleOutlined />}>Hợp lệ</Tag>;
                if (status === 'PENDING_REVIEW') return <Tag color="warning" icon={<InfoCircleOutlined />}>Chờ duyệt</Tag>;
                if (status === 'INVALID') return <Tag color="error">Không hợp lệ</Tag>;
                return <Tag>{status}</Tag>;
            },
            width: 150
        },
        { 
            title: 'Nguồn', 
            dataIndex: 'source', 
            key: 'source',
            render: (text: string) => <Tag>{text}</Tag>,
            width: 120
        },
    ];

    return (
        <div className="p-6 bg-slate-50 min-h-[500px]">
            <Card className="mb-6 shadow-sm" size="small">
                <Title level={5} className="!mt-0 !mb-4 text-slate-700">Thông tin Chứng chỉ Hành nghề</Title>
                <Row gutter={[16, 16]}>
                    {data.certificates.map((cert: any, index: number) => (
                        <Col xs={24} md={12} key={cert.id || index}>
                            <div className="p-3 border border-blue-100 bg-blue-50/50 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <Text strong className="text-blue-800 text-lg">{cert.so_cchn}</Text>
                                    <Tag color={cert.isActive ? "success" : "default"}>
                                        {cert.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
                                    </Tag>
                                </div>
                                <div className="text-sm text-slate-600 grid grid-cols-3 gap-2">
                                    <span className="col-span-1 text-slate-400">Ngày cấp:</span>
                                    <span className="col-span-2 font-medium">{cert.ngay_cap ? dayjs(cert.ngay_cap).format('DD/MM/YYYY') : '---'}</span>
                                    
                                    <span className="col-span-1 text-slate-400">Phạm vi CM:</span>
                                    <span className="col-span-2 font-medium">
                                        {cert.pham_vi_hanh_nghe ? (
                                            <>{cert.pham_vi_hanh_nghe} {cert.ten_pham_vi ? `- ${cert.ten_pham_vi}` : ''}</>
                                        ) : '---'}
                                    </span>
                                    
                                    <span className="col-span-1 text-slate-400">Chức danh:</span>
                                    <span className="col-span-2 font-medium">{cert.chuc_danh_cchn || '---'}</span>
                                </div>
                            </div>
                        </Col>
                    ))}
                </Row>
            </Card>

            <Card className="mb-6 shadow-sm border-t-4 border-t-green-500" title={<span className="text-green-700">Dịch vụ Kỹ thuật Được Phép Thực Hiện</span>}>
                <Table 
                    dataSource={data.allowedServices} 
                    columns={allowedColumns} 
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                    bordered
                    locale={{ emptyText: 'Không tìm thấy dữ liệu dịch vụ được phép thực hiện' }}
                />
            </Card>

            <Card className="shadow-sm border-t-4 border-t-blue-500" title={<span className="text-blue-700">Dịch vụ Kỹ thuật Đã Thực Hiện (Dữ liệu HIS/XML)</span>}>
                <Table 
                    dataSource={data.performedServices} 
                    columns={performedColumns} 
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    size="small"
                    bordered
                    locale={{ emptyText: 'Chưa ghi nhận dịch vụ thực tế nào' }}
                />
            </Card>
        </div>
    );
}

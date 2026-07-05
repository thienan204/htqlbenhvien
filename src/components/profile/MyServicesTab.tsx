'use client';

import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Spin, Alert, Row, Col, Statistic, Switch, Tabs } from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined, WarningOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function MyServicesTab() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [showViolationsOnly, setShowViolationsOnly] = useState(false);
    const [showChiDinh, setShowChiDinh] = useState(true);
    const [showThucHien, setShowThucHien] = useState(true);
    const [allowedPagination, setAllowedPagination] = useState({ current: 1, pageSize: 10 });
    const [performedPagination, setPerformedPagination] = useState({ current: 1, pageSize: 10 });

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
        { title: 'STT', key: 'stt', width: 60, render: (_: any, __: any, index: number) => (allowedPagination.current - 1) * allowedPagination.pageSize + index + 1, align: 'center' as const },
        { title: 'Mã Dịch vụ', dataIndex: 'ma_dich_vu', key: 'ma_dich_vu', width: 120 },
        { title: 'Tên Dịch vụ (Theo danh mục)', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu' },
        { 
            title: 'Phạm vi chuyên môn', 
            key: 'ma_pham_vi',
            render: (text: string, record: any) => {
                const scopeName = record.ScopeOfPracticeCatalog?.ten_chuc_danh;
                if (scopeName) {
                    return <span><Tag color="blue">{record.ma_pham_vi}</Tag> {scopeName}</span>;
                }
                return <Tag color="blue">{record.ma_pham_vi}</Tag>;
            },
            width: 300
        },
    ];

    const performedColumns = [
        { title: 'STT', key: 'stt', width: 60, render: (_: any, __: any, index: number) => (performedPagination.current - 1) * performedPagination.pageSize + index + 1, align: 'center' as const },
        { title: 'Mã Dịch vụ', dataIndex: 'ma_dich_vu', key: 'ma_dich_vu', width: 120 },
        { title: 'Tên Dịch vụ đã thực hiện', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu' },
        { 
            title: 'Đánh giá Đối chiếu', 
            dataIndex: 'isAllowed', 
            key: 'isAllowed',
            render: (isAllowed: boolean) => {
                return isAllowed ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>Trong phạm vi</Tag>
                ) : (
                    <Tag color="error" icon={<StopOutlined />}>Vượt phạm vi</Tag>
                );
            },
            width: 150
        },
        {
            title: 'Vai trò HIS',
            key: 'vai_tro',
            render: (_: any, record: any) => {
                const tags = [];
                if (record.isChiDinh) tags.push(<Tag color="purple" key="cd">Chỉ định</Tag>);
                if (record.isThucHien) tags.push(<Tag color="blue" key="th">Thực hiện</Tag>);
                if (tags.length === 0) return <Tag>Không rõ</Tag>;
                return <>{tags}</>;
            },
            width: 160
        },
        { 
            title: 'Trạng thái HIS', 
            dataIndex: 'status', 
            key: 'status',
            render: (status: string) => {
                if (status === 'VALID' || status === 'APPROVED') return <Tag color="success" icon={<CheckCircleOutlined />}>Hợp lệ</Tag>;
                if (status === 'PENDING_REVIEW') return <Tag color="warning" icon={<InfoCircleOutlined />}>Chờ duyệt</Tag>;
                if (status === 'INVALID') return <Tag color="error">Không hợp lệ</Tag>;
                return <Tag>{status}</Tag>;
            },
            width: 140
        },
        { 
            title: 'Nguồn', 
            dataIndex: 'source', 
            key: 'source',
            render: (text: string) => <Tag>{text}</Tag>,
            width: 120
        },
    ];

    // Tính toán đối chiếu
    const allowedServiceCodes = new Set(data.allowedServices.map((s: any) => s.ma_dich_vu));
    const enrichedPerformedServices = data.performedServices.map((s: any) => ({
        ...s,
        isAllowed: allowedServiceCodes.has(s.ma_dich_vu)
    }));

    const totalAllowed = data.allowedServices.length;
    const totalPerformed = enrichedPerformedServices.length;
    const totalViolations = enrichedPerformedServices.filter((s: any) => !s.isAllowed).length;

    const filteredPerformedServices = enrichedPerformedServices.filter((s: any) => {
        // Nếu tắt cả 2 filter thì ẩn hết
        if (!showChiDinh && !showThucHien) return false;

        // Xử lý dữ liệu cũ (Không rõ Vai trò)
        const noFlags = !s.isChiDinh && !s.isThucHien;
        
        if (!noFlags) {
            // Dữ liệu mới có cờ rõ ràng
            const matchChiDinh = showChiDinh && s.isChiDinh;
            const matchThucHien = showThucHien && s.isThucHien;
            if (!matchChiDinh && !matchThucHien) return false;
        }

        // Lọc vi phạm
        if (showViolationsOnly && !s.isAllowed) return true; // Show violations
        if (showViolationsOnly && s.isAllowed) return false; // Hide allowed when violations only

        return true;
    });

    return (
        <div className="p-6 bg-slate-50 min-h-[500px]">
            {/* Dashboard Thống kê */}
            <Row gutter={[16, 16]} className="mb-6">
                <Col xs={24} md={8}>
                    <Card className="shadow-sm border-l-4 border-l-blue-500">
                        <Statistic title="Tổng dịch vụ được phép" value={totalAllowed} styles={{ content: { color: '#3b82f6' } }} />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card className="shadow-sm border-l-4 border-l-green-500">
                        <Statistic title="Tổng dịch vụ đã thực hiện" value={totalPerformed} styles={{ content: { color: '#22c55e' } }} />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card className={`shadow-sm border-l-4 ${totalViolations > 0 ? 'border-l-red-500 bg-red-50' : 'border-l-slate-300'}`}>
                        <Statistic 
                            title={<span className={totalViolations > 0 ? 'text-red-600 font-semibold' : ''}>Dịch vụ VƯỢT PHẠM VI</span>} 
                            value={totalViolations} 
                            styles={{ content: { color: totalViolations > 0 ? '#ef4444' : '#94a3b8', fontWeight: totalViolations > 0 ? 'bold' : 'normal' } }} 
                            suffix={totalViolations > 0 ? <WarningOutlined /> : null}
                        />
                    </Card>
                </Col>
            </Row>

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
                                        {cert.scopes && cert.scopes.length > 0 ? (
                                            cert.scopes.map((s: any, i: number) => (
                                                <div key={i}>
                                                    <Tag color="blue" className="mr-1">{s.ma_pham_vi}</Tag> 
                                                    {s.ten_pham_vi}
                                                </div>
                                            ))
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

            <Tabs
                defaultActiveKey="performed"
                type="card"
                className="bg-white p-4 rounded-lg shadow-sm border border-slate-100"
                items={[
                    {
                        key: 'performed',
                        label: <span className="font-medium text-blue-700">Dịch vụ Kỹ thuật Đã Thực hiện (Đối chiếu HIS/XML)</span>,
                        children: (
                            <div>
                                <div className="flex justify-end items-center mb-4 mt-2">
                                    <div className="flex items-center gap-4 font-normal text-sm bg-slate-50 p-2 rounded-md border border-slate-200">
                                        <div className="flex items-center gap-1 border-r pr-4 border-slate-200">
                                            <Switch size="small" checked={showChiDinh} onChange={(val) => { setShowChiDinh(val); setPerformedPagination(prev => ({ ...prev, current: 1 })); }} />
                                            <span className={showChiDinh ? "text-purple-700 font-medium" : "text-slate-400"}>Chỉ định</span>
                                        </div>
                                        <div className="flex items-center gap-1 border-r pr-4 border-slate-200">
                                            <Switch size="small" checked={showThucHien} onChange={(val) => { setShowThucHien(val); setPerformedPagination(prev => ({ ...prev, current: 1 })); }} />
                                            <span className={showThucHien ? "text-blue-700 font-medium" : "text-slate-400"}>Thực hiện</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Switch size="small" checked={showViolationsOnly} onChange={(val) => { setShowViolationsOnly(val); setPerformedPagination(prev => ({ ...prev, current: 1 })); }} />
                                            <span className={showViolationsOnly ? "text-red-600 font-medium" : "text-slate-500"}>Chỉ hiện Vi phạm</span>
                                        </div>
                                    </div>
                                </div>
                                <Table 
                                    dataSource={filteredPerformedServices} 
                                    columns={performedColumns} 
                                    rowKey="id"
                                    pagination={{
                                        current: performedPagination.current,
                                        pageSize: performedPagination.pageSize,
                                        showSizeChanger: true,
                                        pageSizeOptions: ['10', '20', '50', '100']
                                    }}
                                    onChange={(pagination) => setPerformedPagination({ current: pagination.current || 1, pageSize: pagination.pageSize || 10 })}
                                    size="small"
                                    bordered
                                    locale={{ emptyText: 'Chưa ghi nhận dịch vụ thực tế nào' }}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'allowed',
                        label: <span className="font-medium text-green-700">Dịch vụ Kỹ thuật Được Phép Thực Hiện</span>,
                        children: (
                            <div className="pt-2">
                                <Table 
                                    dataSource={data.allowedServices} 
                                    columns={allowedColumns} 
                                    rowKey="id"
                                    pagination={{
                                        current: allowedPagination.current,
                                        pageSize: allowedPagination.pageSize,
                                        showSizeChanger: true,
                                        pageSizeOptions: ['10', '20', '50', '100']
                                    }}
                                    onChange={(pagination) => setAllowedPagination({ current: pagination.current || 1, pageSize: pagination.pageSize || 10 })}
                                    size="small"
                                    bordered
                                    locale={{ emptyText: 'Không tìm thấy dữ liệu dịch vụ được phép thực hiện' }}
                                />
                            </div>
                        )
                    }
                ]}
            />
        </div>
    );
}

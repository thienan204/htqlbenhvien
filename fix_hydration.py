import sys

new_content = """'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Card, Table, Typography, Spin, Button, Result, Tag, Input, Space, message, Popconfirm, Row, Col } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';

function SavedSchedulesContent() {
    const searchParams = useSearchParams();
    const date = searchParams.get('date');
    const maKhoa = searchParams.get('maKhoa');

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Filters
    const [searchName, setSearchName] = useState('');
    const [searchService, setSearchService] = useState('');
    const [searchSoPhieu, setSearchSoPhieu] = useState('');
    const [searchNguoiThucHien, setSearchNguoiThucHien] = useState('');

    const fetchData = () => {
        if (!date || !maKhoa) {
            setError('Thiếu thông tin ngày hoặc khoa.');
            setLoading(false);
            return;
        }
        
        setLoading(true);
        fetch(`/api/clinical-scheduling/get-schedule?date=${date}&maKhoa=${maKhoa}`)
            .then(res => res.json())
            .then(res => {
                if (res.success) {
                    setData(res.schedules || []);
                } else {
                    setError(res.message || 'Lỗi khi tải dữ liệu');
                }
            })
            .catch(e => {
                setError('Lỗi kết nối máy chủ');
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchData();
    }, [date, maKhoa]);

    const handleDeleteAll = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/clinical-scheduling/delete-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date, maKhoa, deleteAll: true })
            });
            const result = await res.json();
            if (result.success) {
                message.success('Đã xóa toàn bộ lịch của khoa trong ngày này!');
                setData([]);
            } else {
                message.error('Lỗi: ' + result.message);
            }
        } catch (e) {
            message.error('Lỗi khi xóa dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRecord = async (id: number) => {
        try {
            const res = await fetch('/api/clinical-scheduling/delete-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, deleteAll: false })
            });
            const result = await res.json();
            if (result.success) {
                message.success('Đã xóa thành công!');
                setData(prev => prev.filter(item => item.id !== id));
            } else {
                message.error('Lỗi: ' + result.message);
            }
        } catch (e) {
            message.error('Lỗi khi xóa dữ liệu');
        }
    };

    const columns = [
        { title: 'Tên Bệnh nhân', dataIndex: 'ten_benh_nhan', key: 'ten_benh_nhan', width: 200, render: (text: string) => <strong>{text}</strong> },
        { title: 'Tên Dịch vụ', dataIndex: 'ten_dich_vu', key: 'ten_dich_vu', width: 250 },
        { title: 'Số phiếu', dataIndex: 'so_phieu', key: 'so_phieu', width: 100 },
        { title: 'Bắt đầu', dataIndex: 'bat_dau', key: 'bat_dau', width: 100, align: 'center' as const, render: (t: string) => <Tag color="blue">{t}</Tag> },
        { title: 'Kết thúc', dataIndex: 'ket_thuc', key: 'ket_thuc', width: 100, align: 'center' as const, render: (t: string) => <Tag color="magenta">{t}</Tag> },
        { title: 'Người thực hiện', dataIndex: 'nguoi_thuc_hien', key: 'nguoi_thuc_hien', render: (text: string) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{text}</span> },
        { title: 'Máy', dataIndex: 'ten_may', key: 'ten_may' },
        { 
            title: 'Thao tác', 
            key: 'action', 
            width: 80, 
            align: 'center' as const,
            render: (_: any, record: any) => (
                <Popconfirm title="Xóa bệnh nhân này khỏi lịch?" onConfirm={() => handleDeleteRecord(record.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
                    <Button type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
            )
        }
    ];

    const filteredData = data.filter(item => {
        const matchName = item.ten_benh_nhan?.toLowerCase().includes(searchName.toLowerCase());
        const matchService = item.ten_dich_vu?.toLowerCase().includes(searchService.toLowerCase());
        const matchSoPhieu = item.so_phieu?.toLowerCase().includes(searchSoPhieu.toLowerCase());
        const matchNguoi = item.nguoi_thuc_hien?.toLowerCase().includes(searchNguoiThucHien.toLowerCase());
        return matchName && matchService && matchSoPhieu && matchNguoi;
    });

    if (error) {
        return (
            <div style={{ padding: 40 }}>
                <Result status="error" title="Lỗi tải dữ liệu" subTitle={error} />
            </div>
        );
    }

    return (
        <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
            <Card 
                title={
                    <Typography.Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                        Danh sách Lịch đã lưu trong Cơ sở dữ liệu
                    </Typography.Title>
                }
                extra={
                    <Space>
                        <Popconfirm 
                            title="Xóa TOÀN BỘ lịch của ngày này?" 
                            description="Tất cả dữ liệu lịch đã xếp sẽ bị xóa sạch."
                            onConfirm={handleDeleteAll} 
                            okText="Xóa Hết" 
                            cancelText="Hủy" 
                            okButtonProps={{ danger: true }}
                        >
                            <Button danger type="primary" icon={<DeleteOutlined />}>Xóa tất cả (Reset)</Button>
                        </Popconfirm>
                        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
                            In danh sách
                        </Button>
                    </Space>
                }
            >
                <div style={{ marginBottom: 16 }}>
                    <strong>Ngày:</strong> <Tag color="purple">{date ? dayjs(date).format('DD/MM/YYYY') : '---'}</Tag>
                    <strong style={{ marginLeft: 16 }}>Mã Khoa:</strong> <Tag color="purple">{maKhoa || '---'}</Tag>
                </div>

                <div style={{ marginBottom: 16, background: '#fafafa', padding: 12, borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <Row gutter={16}>
                        <Col span={6}>
                            <Input 
                                placeholder="Lọc theo Tên Bệnh nhân..." 
                                prefix={<SearchOutlined />} 
                                value={searchName}
                                onChange={e => setSearchName(e.target.value)}
                                allowClear
                            />
                        </Col>
                        <Col span={6}>
                            <Input 
                                placeholder="Lọc theo Tên Dịch vụ..." 
                                prefix={<SearchOutlined />} 
                                value={searchService}
                                onChange={e => setSearchService(e.target.value)}
                                allowClear
                            />
                        </Col>
                        <Col span={6}>
                            <Input 
                                placeholder="Lọc theo Số phiếu..." 
                                prefix={<SearchOutlined />} 
                                value={searchSoPhieu}
                                onChange={e => setSearchSoPhieu(e.target.value)}
                                allowClear
                            />
                        </Col>
                        <Col span={6}>
                            <Input 
                                placeholder="Lọc theo Người thực hiện..." 
                                prefix={<SearchOutlined />} 
                                value={searchNguoiThucHien}
                                onChange={e => setSearchNguoiThucHien(e.target.value)}
                                allowClear
                            />
                        </Col>
                    </Row>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
                ) : (
                    <Table
                        dataSource={filteredData}
                        rowKey={(r) => r.id || `${r.so_phieu}_${r.ma_dich_vu}_${r.bat_dau}`}
                        size="middle"
                        pagination={{ pageSize: 50 }}
                        columns={columns}
                        bordered
                    />
                )}
            </Card>
        </div>
    );
}

export default function SavedSchedulesPage() {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>;
    }

    return (
        <Suspense fallback={<div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>}>
            <SavedSchedulesContent />
        </Suspense>
    );
}
"""

open('src/app/clinical-scheduling/saved-schedules/page.tsx', 'w', encoding='utf-8').write(new_content)
print('Done writing filter UI and fixing hydration error')

'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Breadcrumb, Space, Popconfirm, message, Tag } from 'antd';
import { DeleteOutlined, DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import Link from 'next/link';

interface SavedReport {
    id: string;
    url: string;
    ten_bao_cao: string;
    loai_bao_cao: string | null;
    ma_khoa: string | null;
    nguoi_tao: string | null;
    createdAt: string;
}

export default function PdfReportsPage() {
    const [data, setData] = useState<SavedReport[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/pdf-reports');
            if (res.ok) {
                const response = await res.json();
                if (response.success) {
                    setData(response.data);
                } else {
                    message.error(response.message || 'Lỗi khi tải danh sách file');
                }
            } else {
                message.error('Lỗi kết nối máy chủ');
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            message.error('Có lỗi xảy ra khi tải danh sách file');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/pdf-reports?id=${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                const result = await res.json();
                if (result.success) {
                    message.success('Đã xóa file thành công');
                    fetchFiles();
                } else {
                    message.error('Lỗi khi xóa: ' + result.message);
                }
            } else {
                message.error('Lỗi kết nối máy chủ');
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            message.error('Có lỗi xảy ra khi xóa file');
        }
    };

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1,
        },
        {
            title: 'Tên Báo Cáo',
            dataIndex: 'ten_bao_cao',
            key: 'ten_bao_cao',
            render: (text: string, record: SavedReport) => (
                <a href={record.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline font-medium">
                    <FilePdfOutlined className="text-red-500 text-lg" />
                    {text}
                </a>
            ),
        },
        {
            title: 'Loại',
            dataIndex: 'loai_bao_cao',
            key: 'loai_bao_cao',
            width: 200,
            render: (val: string) => val ? <Tag color="blue">{val}</Tag> : '-',
        },
        {
            title: 'Khoa / Phòng',
            dataIndex: 'ma_khoa',
            key: 'ma_khoa',
            width: 150,
            render: (val: string) => val ? <Tag color="green">{val}</Tag> : '-',
        },
        {
            title: 'Người tạo',
            dataIndex: 'nguoi_tao',
            key: 'nguoi_tao',
            width: 200,
        },
        {
            title: 'Ngày lưu',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 200,
            render: (dateStr: string) => new Date(dateStr).toLocaleString('vi-VN'),
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 150,
            align: 'center' as const,
            render: (_: any, record: SavedReport) => (
                <Space>
                    <a href={record.url} download={record.url.split('/').pop()}>
                        <Button type="primary" icon={<DownloadOutlined />} size="small" style={{ background: '#10b981', borderColor: '#10b981' }}>
                            Tải
                        </Button>
                    </a>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa báo cáo này?"
                        description="File vật lý trên máy chủ cũng sẽ bị xóa."
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger icon={<DeleteOutlined />} size="small">
                            Xóa
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-6 pt-12">
            <div className="max-w-[1200px] mx-auto space-y-6">
                <Breadcrumb
                    items={[
                        { title: <Link href="/">Trang chủ</Link> },
                        { title: 'Quản lý Báo cáo PDF đã lưu' },
                    ]}
                />

                <Card
                    title={
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent">
                            Danh sách Báo cáo PDF đã lưu trữ
                        </span>
                    }
                    variant="borderless"
                    className="shadow-md rounded-2xl"
                    extra={
                        <Button onClick={fetchFiles} type="default">
                            Làm mới
                        </Button>
                    }
                >
                    <Table
                        dataSource={data}
                        columns={columns}
                        rowKey="id"
                        loading={loading}
                        pagination={{ defaultPageSize: 20 }}
                        bordered
                    />
                </Card>
            </div>
        </div>
    );
}

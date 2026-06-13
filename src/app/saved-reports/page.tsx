'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Breadcrumb, Space, Popconfirm, message } from 'antd';
import { DeleteOutlined, DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import Link from 'next/link';

interface SavedReport {
    fileName: string;
    fileSize: number;
    createdAt: string;
    url: string;
    note?: string;
}

export default function SavedReportsPage() {
    const [data, setData] = useState<SavedReport[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/saved-reports');
            if (res.ok) {
                const files = await res.json();
                setData(files);
            } else {
                message.error('Lỗi khi tải danh sách file');
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

    const handleDelete = async (fileName: string) => {
        try {
            const res = await fetch(`/api/saved-reports/${fileName}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                message.success('Đã xóa file thành công');
                fetchFiles();
            } else {
                const err = await res.json();
                message.error('Lỗi khi xóa: ' + err.error);
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            message.error('Có lỗi xảy ra khi xóa file');
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
            title: 'Tên File',
            dataIndex: 'fileName',
            key: 'fileName',
            render: (text: string, record: SavedReport) => (
                <a href={record.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline">
                    <FileExcelOutlined className="text-green-600" />
                    {text}
                </a>
            ),
        },
        {
            title: 'Kích thước',
            dataIndex: 'fileSize',
            key: 'fileSize',
            width: 150,
            render: (size: number) => formatBytes(size),
        },
        {
            title: 'Ghi chú',
            dataIndex: 'note',
            key: 'note',
            width: 300,
            render: (text: string) => <span className="text-slate-600 italic whitespace-pre-wrap">{text || '-'}</span>,
        },
        {
            title: 'Thời gian tạo',
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
                    <a href={record.url} download={record.fileName}>
                        <Button type="primary" icon={<DownloadOutlined />} size="small" className="bg-green-600 hover:bg-green-700">
                            Tải
                        </Button>
                    </a>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa file này?"
                        onConfirm={() => handleDelete(record.fileName)}
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
                        { title: 'Quản lý Báo cáo đã lưu' },
                    ]}
                />

                <Card
                    title={
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent">
                            Danh sách Báo cáo Excel Đã Lưu
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
                        rowKey="fileName"
                        loading={loading}
                        pagination={{ defaultPageSize: 20 }}
                        bordered
                    />
                </Card>
            </div>
        </div>
    );
}

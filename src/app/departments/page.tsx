'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Upload, Breadcrumb, Card, Space, Drawer, Popconfirm } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined, SaveOutlined, SearchOutlined, HomeOutlined, FileExcelOutlined } from '@ant-design/icons';
import { getBasePath } from '@/utils/config';
import * as XLSX from 'xlsx';
import Link from 'next/link';

interface Department {
    ma_khoa: string;
    ten_khoa: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function DepartmentPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [form] = Form.useForm();

    const fetchDepartments = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/departments?t=${new Date().getTime()}`, {
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
            if (res.ok) {
                const data = await res.json();
                setDepartments(data);
            } else {
                message.error('Lỗi tải danh sách khoa');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    const handleSave = async (values: Department) => {
        try {
            const res = await fetch(`${getBasePath()}/api/departments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            if (res.ok) {
                message.success('Lưu thành công');
                setIsDrawerOpen(false);
                form.resetFields();
                setEditingDept(null);
                fetchDepartments();
            } else {
                message.error('Lỗi khi lưu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleDelete = async (ma_khoa: string) => {
        try {
            const res = await fetch(`${getBasePath()}/api/departments?ma_khoa=${ma_khoa}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Xóa thành công');
                fetchDepartments();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi xóa');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleImportExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const bstr = e.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Map data to expected format if needed
                // Expecting column headers: ma_khoa, ten_khoa or similar
                const mappedData = data.map((row: any) => ({
                    ma_khoa: String(row['ma_khoa'] || row['Mã khoa'] || row['MA_KHOA'] || ''),
                    ten_khoa: String(row['ten_khoa'] || row['Tên khoa'] || row['TEN_KHOA'] || '')
                })).filter(item => item.ma_khoa && item.ten_khoa);

                if (mappedData.length === 0) {
                    message.warning('Không tìm thấy dữ liệu hợp lệ (cần cột ma_khoa, ten_khoa)');
                    return;
                }

                const res = await fetch(`${getBasePath()}/api/departments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mappedData),
                });

                if (res.ok) {
                    const result = await res.json();
                    message.success(`Đã import thành công ${result.count || mappedData.length} bản ghi`);
                    fetchDepartments();
                } else {
                    message.error('Lỗi import');
                }

            } catch (error) {
                message.error('Lỗi đọc file Excel');
            }
        };
        reader.readAsBinaryString(file);
        return false; // Prevent upload
    };

    const columns = [
        {
            title: 'Mã Khoa',
            dataIndex: 'ma_khoa',
            key: 'ma_khoa',
            width: 150,
            sorter: (a: Department, b: Department) => a.ma_khoa.localeCompare(b.ma_khoa),
        },
        {
            title: 'Tên Khoa',
            dataIndex: 'ten_khoa',
            key: 'ten_khoa',
            width: 300,
            sorter: (a: Department, b: Department) => a.ten_khoa.localeCompare(b.ten_khoa),
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                <div style={{ padding: 8 }}>
                    <Input
                        placeholder="Tìm tên khoa"
                        value={selectedKeys[0]}
                        onChange={e => setSelectedKeys(e.target.value ? [e.target.value] : [])}
                        onPressEnter={() => confirm()}
                        style={{ width: 188, marginBottom: 8, display: 'block' }}
                    />
                    <Space>
                        <Button type="primary" onClick={() => confirm()} icon={<SearchOutlined />} size="small" style={{ width: 90 }}>
                            Tìm
                        </Button>
                        <Button onClick={() => clearFilters()} size="small" style={{ width: 90 }}>
                            Reset
                        </Button>
                    </Space>
                </div>
            ),
            onFilter: (value: any, record: Department) => record.ten_khoa.toLowerCase().includes(value.toLowerCase()),
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: Department) => (
                <Space size="middle">
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => {
                            setEditingDept(record);
                            form.setFieldsValue(record);
                            setIsDrawerOpen(true);
                        }}
                    />
                    <Popconfirm title="Bạn có chắc chắn muốn xóa?" onConfirm={() => handleDelete(record.ma_khoa)}>
                        <Button icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    const filteredData = departments.filter(d =>
        d.ma_khoa.toLowerCase().includes(searchText.toLowerCase()) ||
        d.ten_khoa.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 pt-12">
            <div className="max-w-[1200px] mx-auto space-y-6">
                <Breadcrumb items={[{ title: <Link href="/"><HomeOutlined /> Trang chủ</Link> }, { title: 'Quản lý Khoa Phòng' }]} />

                <Card
                    title={<span className="text-xl font-bold text-slate-800">Quản lý Khoa Phòng</span>}
                    extra={
                        <Space>
                            <Input
                                placeholder="Tìm kiếm..."
                                prefix={<SearchOutlined />}
                                onChange={e => setSearchText(e.target.value)}
                                style={{ width: 200 }}
                            />
                            <Button
                                icon={<FileExcelOutlined />}
                                onClick={() => {
                                    const wb = XLSX.utils.book_new();
                                    const ws = XLSX.utils.json_to_sheet([
                                        { ma_khoa: 'K01', ten_khoa: 'Khoa Nội' },
                                        { ma_khoa: 'K02', ten_khoa: 'Khoa Ngoại' }
                                    ]);
                                    XLSX.utils.book_append_sheet(wb, ws, "Departments");
                                    XLSX.writeFile(wb, "Mau_nhap_khoa.xlsx");
                                }}
                            >
                                Tải file mẫu
                            </Button>
                            <Upload beforeUpload={handleImportExcel} showUploadList={false} accept=".xlsx,.xls">
                                <Button icon={<UploadOutlined />}>Import Excel</Button>
                            </Upload>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                setEditingDept(null);
                                form.resetFields();
                                setIsDrawerOpen(true);
                            }}>
                                Thêm mới
                            </Button>
                        </Space>
                    }
                >
                    <Table
                        columns={columns}
                        dataSource={filteredData}
                        rowKey="ma_khoa"
                        loading={loading}
                        pagination={{ pageSize: 10 }}
                    />
                </Card>

                <Drawer
                    title={editingDept ? "Cập nhật Khoa" : "Thêm mới Khoa"}
                    size="default"
                    onClose={() => setIsDrawerOpen(false)}
                    open={isDrawerOpen}
                    extra={
                        <Space>
                            <Button onClick={() => setIsDrawerOpen(false)}>Hủy</Button>
                            <Button type="primary" onClick={() => form.submit()}>Lưu</Button>
                        </Space>
                    }
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <Form.Item
                            name="ma_khoa"
                            label="Mã Khoa"
                            rules={[{ required: true, message: 'Vui lòng nhập mã khoa' }]}
                        >
                            <Input disabled={!!editingDept} />
                        </Form.Item>
                        <Form.Item
                            name="ten_khoa"
                            label="Tên Khoa"
                            rules={[{ required: true, message: 'Vui lòng nhập tên khoa' }]}
                        >
                            <Input />
                        </Form.Item>
                    </Form>
                </Drawer>
            </div>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Modal, Form, message, Upload, Breadcrumb, Card, Space, Drawer, Popconfirm, Select } from 'antd';
import { PlusOutlined, UploadOutlined, EditOutlined, DeleteOutlined, SaveOutlined, SearchOutlined, HomeOutlined, FileExcelOutlined } from '@ant-design/icons';
import { getBasePath } from '@/utils/config';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface Department {
    ma_khoa: string;
    ten_khoa: string;
    ma_khoa_bv?: string;
    ten_khoa_bv?: string;
    ma_khoa_bhyt?: string;
    type?: string;
    createdAt?: string;
    updatedAt?: string;
}

export default function DepartmentPage() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingDept, setEditingDept] = useState<Department | null>(null);
    const [departmentTypes, setDepartmentTypes] = useState<any[]>([]);
    const [form] = Form.useForm();
    const { user } = useAuth();

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
        fetchDepartmentTypes();
    }, []);

    const fetchDepartmentTypes = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/system-categories?type=DEPARTMENT_TYPE`);
            if (res.ok) {
                const data = await res.json();
                setDepartmentTypes(data);
            }
        } catch (error) {
            console.error('Lỗi tải danh mục phân loại', error);
        }
    };

    const handleSave = async (values: Department) => {
        try {
            const payload = {
                ...values,
                old_ma_khoa: editingDept ? editingDept.ma_khoa : undefined
            };

            const res = await fetch(`${getBasePath()}/api/departments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                message.success('Lưu thành công');
                setIsDrawerOpen(false);
                form.resetFields();
                setEditingDept(null);
                fetchDepartments();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi lưu');
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

    const handleDeleteAll = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/departments?deleteAll=true`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa tất cả danh mục Khoa Phòng');
                fetchDepartments();
            } else {
                const err = await res.json().catch(() => ({}));
                message.error(err.error || 'Lỗi khi xóa tất cả. Có thể dữ liệu đang được sử dụng ở bảng khác.');
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
                    ten_khoa: String(row['ten_khoa'] || row['Tên khoa'] || row['TEN_KHOA'] || ''),
                    ma_khoa_bv: row['ma_khoa_bv'] || row['Mã khoa nội bộ'] || row['MA_KHOA_BV'] ? String(row['ma_khoa_bv'] || row['Mã khoa nội bộ'] || row['MA_KHOA_BV']) : undefined,
                    ten_khoa_bv: row['ten_khoa_bv'] || row['Tên khoa nội bộ'] || row['TEN_KHOA_BV'] ? String(row['ten_khoa_bv'] || row['Tên khoa nội bộ'] || row['TEN_KHOA_BV']) : undefined,
                    ma_khoa_bhyt: row['ma_khoa_bhyt'] || row['Mã khoa BHYT'] || row['MA_KHOA_BHYT'] ? String(row['ma_khoa_bhyt'] || row['Mã khoa BHYT'] || row['MA_KHOA_BHYT']) : undefined,
                    type: row['type'] || row['Phân loại'] || row['phan_loai'] || row['TYPE'] ? String(row['type'] || row['Phân loại'] || row['phan_loai'] || row['TYPE']) : 'CLINICAL'
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
            title: 'Mã Khoa Nội Bộ',
            dataIndex: 'ma_khoa_bv',
            key: 'ma_khoa_bv',
            width: 150,
            sorter: (a: Department, b: Department) => (a.ma_khoa_bv || '').localeCompare(b.ma_khoa_bv || ''),
        },
        {
            title: 'Tên Khoa Nội Bộ',
            dataIndex: 'ten_khoa_bv',
            key: 'ten_khoa_bv',
            width: 250,
            sorter: (a: Department, b: Department) => (a.ten_khoa_bv || '').localeCompare(b.ten_khoa_bv || ''),
        },
        {
            title: 'Mã Khoa BHYT',
            dataIndex: 'ma_khoa_bhyt',
            key: 'ma_khoa_bhyt',
            width: 150,
            sorter: (a: Department, b: Department) => (a.ma_khoa_bhyt || '').localeCompare(b.ma_khoa_bhyt || ''),
        },
        {
            title: 'Phân loại',
            dataIndex: 'type',
            key: 'type',
            width: 150,
            render: (type: string) => {
                const found = departmentTypes.find(t => t.code === type);
                return found ? found.name : type;
            },
            filters: departmentTypes.map(t => ({ text: t.name, value: t.code })),
            onFilter: (value: any, record: Department) => record.type === value,
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
        d.ten_khoa.toLowerCase().includes(searchText.toLowerCase()) ||
        (d.ma_khoa_bv && d.ma_khoa_bv.toLowerCase().includes(searchText.toLowerCase())) ||
        (d.ten_khoa_bv && d.ten_khoa_bv.toLowerCase().includes(searchText.toLowerCase()))
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
                                        { ma_khoa: 'K01', ten_khoa: 'Khoa Khám bệnh', ma_khoa_bv: 'KP001', ten_khoa_bv: 'Khám bệnh', type: 'CLINICAL' },
                                        { ma_khoa: 'K02', ten_khoa: 'Khoa Cấp cứu', ma_khoa_bv: 'KP002', ten_khoa_bv: 'Cấp cứu', type: 'CLINICAL' },
                                        { ma_khoa: 'K03', ten_khoa: 'Phòng Kế hoạch tổng hợp', ma_khoa_bv: 'KP003', ten_khoa_bv: 'KHTH', type: 'MANAGEMENT' }
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
                            {user?.role === 'ADMIN' && (
                                <Popconfirm title="Bạn có chắc chắn muốn xóa TOÀN BỘ danh mục Khoa Phòng?" onConfirm={handleDeleteAll} okText="Xóa hết" cancelText="Hủy" okButtonProps={{ danger: true }}>
                                    <Button danger icon={<DeleteOutlined />}>Xóa tất cả</Button>
                                </Popconfirm>
                            )}
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                                setEditingDept(null);
                                form.resetFields();
                                form.setFieldsValue({ type: 'CLINICAL' }); // Default value
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
                    size="large"
                    onClose={() => setIsDrawerOpen(false)}
                    open={isDrawerOpen}
                    extra={
                        <Space>
                            <Button onClick={() => setIsDrawerOpen(false)}>Hủy</Button>
                            <Button type="primary" onClick={() => form.submit()}>Lưu</Button>
                        </Space>
                    }
                >
                    <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ type: 'CLINICAL' }}>
                        <Form.Item
                            name="ma_khoa"
                            label="Mã Khoa"
                            rules={[{ required: true, message: 'Vui lòng nhập mã khoa' }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="ten_khoa"
                            label="Tên Khoa"
                            rules={[{ required: true, message: 'Vui lòng nhập tên khoa' }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item
                            name="type"
                            label="Phân loại"
                            rules={[{ required: true, message: 'Vui lòng chọn phân loại' }]}
                        >
                            <Select placeholder="Chọn phân loại">
                                {departmentTypes.map(t => (
                                    <Select.Option key={t.code} value={t.code}>{t.name}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                        <Form.Item
                            name="ma_khoa_bv"
                            label="Mã Khoa Nội Bộ"
                        >
                            <Input placeholder="Nhập mã quản lý nội bộ bệnh viện..." />
                        </Form.Item>
                        <Form.Item
                            name="ten_khoa_bv"
                            label="Tên Khoa Nội Bộ"
                        >
                            <Input placeholder="Nhập tên gọi nội bộ..." />
                        </Form.Item>
                        <Form.Item
                            name="ma_khoa_bhyt"
                            label="Mã Khoa BHYT (Mẫu 02)"
                            tooltip="Mã cấu hình dùng để đồng bộ sang Mẫu 02 XML. Ví dụ: K31;17.31"
                        >
                            <Input placeholder="VD: K30;14.30" />
                        </Form.Item>
                    </Form>
                </Drawer>
            </div>
        </div>
    );
}

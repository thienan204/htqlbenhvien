'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Input, Modal, Form, Select, InputNumber, message, Popconfirm, Tag, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, SettingOutlined, SyncOutlined, AppstoreAddOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';

export default function BedCatalogPage() {
    // Removed unused useAuth()
    const [beds, setBeds] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState<any[]>([]);
    const [bedTypes, setBedTypes] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    
    // Filters
    const [filterDept, setFilterDept] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 20;

    // Auto-generate Modal state
    const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
    const [autoForm] = Form.useForm();
    const [autoLoading, setAutoLoading] = useState(false);

    useEffect(() => {
        fetchDepartments();
        fetchBedTypes();
    }, []);

    useEffect(() => {
        fetchBeds();
    }, [filterDept, searchText, currentPage]);

    const fetchDepartments = async () => {
        try {
            const res = await fetch('/api/departments');
            if (res.ok) {
                const data = await res.json();
                setDepartments(data);
            }
        } catch (error) {
            console.error('Failed to fetch departments:', error);
        }
    };

    const fetchBedTypes = async () => {
        try {
            const res = await fetch('/api/system-categories?type=BED_TYPE');
            if (res.ok) {
                const data = await res.json();
                setBedTypes(data);
            }
        } catch (error) {
            console.error('Failed to fetch bed types:', error);
        }
    };

    const fetchBeds = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('pageSize', pageSize.toString());
            if (filterDept) params.append('ma_khoa', filterDept);
            if (searchText) params.append('search', searchText);

            const res = await fetch(`/api/beds?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setBeds(data.items);
                setTotal(data.total);
            }
        } catch (error) {
            message.error('Lỗi khi tải danh sách giường');
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/beds?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Xóa giường thành công');
                fetchBeds();
            } else {
                message.error('Lỗi khi xóa giường');
            }
        } catch (error) {
            message.error('Lỗi khi xóa giường');
        }
    };

    const handleAutoGenerate = async (values: any) => {
        setAutoLoading(true);
        try {
            const res = await fetch('/api/beds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'auto_generate',
                    ma_khoa: values.ma_khoa,
                    loai_giuong: values.loai_giuong,
                    prefix: values.prefix || '',
                    start: values.start,
                    end: values.end,
                    padding: values.padding || 3
                })
            });

            if (res.ok) {
                const data = await res.json();
                message.success(data.message || 'Sinh mã thành công');
                setIsAutoModalOpen(false);
                autoForm.resetFields();
                if (filterDept === values.ma_khoa) {
                    fetchBeds();
                } else {
                    setFilterDept(values.ma_khoa); // Switch to that department
                }
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi sinh mã');
            }
        } catch (error) {
            message.error('Lỗi khi thực hiện sinh mã');
        }
        setAutoLoading(false);
    };

    const getBedTypeName = (code: string) => {
        const t = bedTypes.find(x => x.code === code);
        return t ? t.name : code;
    };

    const getDeptName = (code: string) => {
        const d = departments.find(x => x.ma_khoa === code);
        return d ? d.ten_khoa : code;
    };

    const columns = [
        {
            title: 'Mã Khoa',
            dataIndex: 'ma_khoa',
            key: 'ma_khoa',
            render: (text: string) => (
                <Space>
                    <span className="font-semibold text-blue-600">{text}</span>
                    <span className="text-slate-500">- {getDeptName(text)}</span>
                </Space>
            )
        },
        {
            title: 'Mã Giường',
            dataIndex: 'ma_giuong',
            key: 'ma_giuong',
            render: (text: string) => <Tag color="blue" className="text-[14px] px-3 font-mono">{text}</Tag>
        },
        {
            title: 'Loại Giường',
            dataIndex: 'loai_giuong',
            key: 'loai_giuong',
            render: (text: string) => text ? <Tag color="purple">{getBedTypeName(text)}</Tag> : <span className="text-slate-400 italic">Chưa phân loại</span>
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_: any, record: any) => (
                <Popconfirm title="Xóa giường này?" onConfirm={() => handleDelete(record.id)}>
                    <Button danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>
            )
        }
    ];

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3 m-0">
                        <AppstoreAddOutlined className="text-blue-600" /> Quản lý Danh mục Giường Bệnh
                    </h1>
                    <p className="text-slate-500 mt-2 mb-0">Thiết lập mã giường cho từng khoa để kiểm tra cấu trúc BHYT</p>
                </div>
                <Space>
                    <Button 
                        type="primary" 
                        icon={<SyncOutlined />} 
                        size="large"
                        onClick={() => setIsAutoModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                    >
                        Tự sinh mã giường
                    </Button>
                </Space>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex gap-4 mb-6">
                    <Select
                        showSearch
                        allowClear
                        placeholder="Lọc theo Khoa phòng"
                        className="w-80"
                        size="large"
                        value={filterDept}
                        onChange={setFilterDept}
                        options={departments.map(d => ({
                            label: `${d.ma_khoa} - ${d.ten_khoa}`,
                            value: d.ma_khoa
                        }))}
                        filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                    />
                    <Input.Search
                        placeholder="Tìm theo mã giường (vd: H001)..."
                        allowClear
                        size="large"
                        className="w-80"
                        onSearch={setSearchText}
                    />
                </div>

                <Table
                    columns={columns}
                    dataSource={beds}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: total,
                        onChange: setCurrentPage,
                        showSizeChanger: false,
                        showTotal: (total) => `Tổng ${total} giường`
                    }}
                />
            </div>

            <Modal
                title={
                    <div className="flex items-center gap-2 text-xl font-bold text-blue-700">
                        <SettingOutlined /> Tự sinh mã giường hàng loạt
                    </div>
                }
                open={isAutoModalOpen}
                onCancel={() => !autoLoading && setIsAutoModalOpen(false)}
                footer={null}
                width={600}
                destroyOnHidden
            >
                <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mb-6 mt-4 border border-blue-100">
                    <p className="m-0 text-[14px]">
                        <strong>💡 Mẹo:</strong> Nếu bạn nhập Tiền tố là <b>H</b>, Số bắt đầu là <b>1</b>, Số kết thúc là <b>20</b>, định dạng <b>3 chữ số</b>, hệ thống sẽ sinh ra 20 mã từ <b>H001</b> đến <b>H020</b>.
                    </p>
                </div>
                
                <Form
                    form={autoForm}
                    layout="vertical"
                    onFinish={handleAutoGenerate}
                    initialValues={{ padding: 3, start: 1, end: 20 }}
                >
                    <Form.Item
                        name="ma_khoa"
                        label={<span className="font-semibold">Khoa phòng</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
                    >
                        <Select
                            showSearch
                            placeholder="Chọn khoa"
                            size="large"
                            options={departments.map(d => ({
                                label: `${d.ma_khoa} - ${d.ten_khoa}`,
                                value: d.ma_khoa
                            }))}
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                        />
                    </Form.Item>

                    <Form.Item
                        name="loai_giuong"
                        label={<span className="font-semibold">Loại giường (Kế hoạch, Tự nguyện, ICU...)</span>}
                    >
                        <Select
                            showSearch
                            allowClear
                            placeholder="Chọn loại giường"
                            size="large"
                            options={bedTypes.map(t => ({
                                label: t.name,
                                value: t.code
                            }))}
                        />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            name="prefix"
                            label={<span className="font-semibold">Tiền tố chữ (VD: H, K)</span>}
                        >
                            <Input size="large" placeholder="Ví dụ: H" />
                        </Form.Item>
                        <Form.Item
                            name="padding"
                            label={<span className="font-semibold">Độ dài chữ số (Padding)</span>}
                        >
                            <InputNumber size="large" min={1} max={5} className="w-full" />
                        </Form.Item>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            name="start"
                            label={<span className="font-semibold">Từ số</span>}
                            rules={[{ required: true }]}
                        >
                            <InputNumber size="large" min={1} className="w-full" />
                        </Form.Item>
                        <Form.Item
                            name="end"
                            label={<span className="font-semibold">Đến số</span>}
                            rules={[{ required: true }]}
                        >
                            <InputNumber size="large" min={1} className="w-full" />
                        </Form.Item>
                    </div>

                    <Form.Item className="mt-8 mb-0 flex justify-end">
                        <Space>
                            <Button size="large" onClick={() => setIsAutoModalOpen(false)}>Hủy</Button>
                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                size="large" 
                                loading={autoLoading}
                                className="bg-blue-600"
                            >
                                Thực hiện Sinh mã
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Popconfirm, message, Upload, Card, Tooltip, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined, DesktopOutlined, ContainerOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getBasePath } from '@/utils/config';

export default function Mau06CatalogPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/mau06-catalog`);
            if (!res.ok) throw new Error('Failed to fetch data');
            const result = await res.json();
            setData(result);
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (isModalOpen) {
            if (editingRecord) {
                form.setFieldsValue(editingRecord);
            } else {
                form.resetFields();
            }
        }
    }, [isModalOpen, editingRecord, form]);

    const handleAdd = () => {
        setEditingRecord(null);
        setIsModalOpen(true);
    };

    const handleEdit = (record: any) => {
        setEditingRecord(record);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`${getBasePath()}/api/mau06-catalog/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa dòng');
                fetchData();
            } else {
                message.error('Xóa thất bại');
            }
        } catch (error) {
            message.error('Lỗi khi xóa');
        }
    };

    const handleDeleteAll = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${getBasePath()}/api/mau06-catalog`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa toàn bộ danh mục');
                fetchData();
            } else {
                message.error('Xóa thất bại');
            }
        } catch (error) {
            message.error('Xóa thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values: any) => {
        try {
            const url = editingRecord ? `${getBasePath()}/api/mau06-catalog/${editingRecord.id}` : `${getBasePath()}/api/mau06-catalog`;
            const method = editingRecord ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });

            if (res.ok) {
                message.success('Lưu thành công');
                setIsModalOpen(false);
                fetchData();
            } else {
                message.error('Lỗi khi lưu');
            }
        } catch (error) {
            message.error('Lỗi hệ thống');
        }
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'TEN_TB', 'KY_HIEU', 'CONGTY_SX', 'NUOC_SX', 'NAM_SX', 'NAM_SD',
            'MA_MAY', 'SO_LUU_HANH', 'HD_TU', 'HD_DEN', 'TU_NGAY', 'DEN_NGAY', 'MA_CSKCB'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Mau06_DM');
        XLSX.writeFile(wb, 'Mau06_TBYT_Template.xlsx');
    };

    const handleImportExcel = (info: any) => {
        const file = info.file;
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const dataBuffer = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(dataBuffer, { type: 'array' });
                const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

                if (jsonData.length === 0) return message.warning('File trống!');

                setLoading(true);
                const res = await fetch(`${getBasePath()}/api/mau06-catalog`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(jsonData)
                });

                if (res.ok) {
                    const result = await res.json();
                    message.success(`Đã Import thành công ${result.count || jsonData.length} dòng.`);
                    fetchData();
                } else {
                    message.error('Import thất bại');
                }
            } catch (error) {
                message.error('Lỗi đọc file');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file as any as Blob);
        return false;
    };

    const columns = [
        { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: any, __: any, index: number) => (currentPage - 1) * pageSize + index + 1 },
        { title: 'Mã Máy', dataIndex: 'MA_MAY', width: 150 },
        { title: 'Tên Thiết Bị', dataIndex: 'TEN_TB', width: 250 },
        { title: 'Model (Ký hiệu)', dataIndex: 'KY_HIEU', width: 150 },
        { title: 'Công ty SX', dataIndex: 'CONGTY_SX', width: 200 },
        { title: 'Nước SX', dataIndex: 'NUOC_SX', width: 120 },
        { title: 'Năm SX', dataIndex: 'NAM_SX', width: 100, align: 'center' as const },
        {
            title: 'Hành động',
            key: 'action',
            width: 100,
            align: 'center' as const,
            fixed: 'right' as const,
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="Sửa"><Button type="text" icon={<EditOutlined className="text-blue-500" />} onClick={() => handleEdit(record)} /></Tooltip>
                    <Popconfirm title="Xác nhận xóa?" onConfirm={() => handleDelete(record.id)} okText="Có" cancelText="Không">
                        <Tooltip title="Xóa"><Button type="text" icon={<DeleteOutlined className="text-red-500" />} /></Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const filteredData = data.filter(item =>
        (item.TEN_TB?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.MA_MAY?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.KY_HIEU?.toLowerCase().includes(searchText.toLowerCase()))
    );

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            <Card title={<span className="text-xl font-bold text-slate-700">Danh mục Thiết bị Y tế thực hiện DVKT (Mẫu 06/DM)</span>} className="flex-1 drop-shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <Space>
                        <Input.Search placeholder="Tìm Tên TB, Mã máy, Model..." allowClear onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }} style={{ width: 300 }} />
                        <Button icon={<SyncOutlined />} onClick={fetchData}>Làm mới</Button>
                    </Space>
                    <Space>
                        <Popconfirm
                            title="Xóa toàn bộ danh mục?"
                            description="Hành động này sẽ xóa sạch dữ liệu hiện tại. Bạn có chắc chắn?"
                            onConfirm={handleDeleteAll}
                            okText="Có, Xóa hết"
                            cancelText="Không"
                            okButtonProps={{ danger: true }}
                        >
                            <Button danger type="primary" icon={<DeleteOutlined />}>
                                Xóa toàn bộ
                            </Button>
                        </Popconfirm>
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleDownloadTemplate} className="border-green-500 text-green-600">Tải file mẫu</Button>
                        <Upload beforeUpload={(file) => handleImportExcel({ file })} showUploadList={false} accept=".xlsx, .xls">
                            <Button type="default" icon={<UploadOutlined />} className="bg-blue-50 border-blue-200 text-blue-700">Import Excel</Button>
                        </Upload>
                        <Button type="primary" className="bg-teal-600 hover:bg-teal-700" icon={<PlusOutlined />} onClick={handleAdd}>Thêm Máy Mới</Button>
                    </Space>
                </div>

                <Table
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="id"
                    loading={loading}
                    pagination={{ 
                        current: currentPage,
                        pageSize: pageSize, 
                        showSizeChanger: true,
                        onChange: (page, size) => {
                            setCurrentPage(page);
                            setPageSize(size);
                        }
                    }}
                    size="middle"
                    bordered
                    scroll={{ x: 'max-content', y: 'calc(100vh - 350px)' }}
                />

                <Modal
                    title={<span className="text-lg font-bold text-slate-700">{editingRecord ? 'Cập nhật Mẫu 06/DM' : 'Thêm mới Mẫu 06/DM'}</span>}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    onOk={() => form.submit()}
                    width={900}
                    style={{ top: 20 }}
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <div className="max-h-[70vh] overflow-y-auto pr-4 space-y-6">

                            {/* Khối 1: Thông tin Máy móc */}
                            <div className="bg-white p-5 rounded-xl border border-teal-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-teal-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-teal-800 uppercase mb-4 flex items-center gap-2"><DesktopOutlined /> 1. Thông tin Máy / Thiết bị Y tế</h3>
                                <Row gutter={16}>
                                    <Col span={10}><Form.Item name="TEN_TB" label="Tên Thiết bị"><Input size="large" /></Form.Item></Col>
                                    <Col span={7}><Form.Item name="KY_HIEU" label="Ký hiệu (Model)"><Input size="large" /></Form.Item></Col>
                                    <Col span={7}><Form.Item name="MA_MAY" label="Mã máy"><Input size="large" className="font-mono text-teal-600 font-bold" /></Form.Item></Col>

                                    <Col span={10}><Form.Item name="CONGTY_SX" label="Công ty Sản xuất"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="NUOC_SX" label="Nước sản xuất"><Input size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="NAM_SX" label="Năm SX"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="NAM_SD" label="Năm Sử dụng"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                </Row>
                            </div>

                            {/* Khối 2: Pháp lý & Điều tiết */}
                            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2"><ContainerOutlined /> 2. Pháp lý & Hiệu lực Hợp đồng</h3>
                                <Row gutter={16}>
                                    <Col span={12}><Form.Item name="SO_LUU_HANH" label="Số lưu hành thiết bị"><Input size="large" /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="MA_CSKCB" label="Mã Cơ sở KCB"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="HD_TU" label="Hợp đồng Từ Ngày (YYYYMMDD)"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="HD_DEN" label="Hợp đồng Đến Ngày"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="TU_NGAY" label="BHYT hiệu lực Từ Ngày"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DEN_NGAY" label="BHYT hiệu lực Đến Ngày"><Input size="large" /></Form.Item></Col>

                                </Row>
                            </div>

                        </div>
                    </Form>
                </Modal>
            </Card>
        </div>
    );
}

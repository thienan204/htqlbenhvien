'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Popconfirm, message, Upload, Card, Tooltip, Select, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined, MedicineBoxOutlined, BankOutlined, FileDoneOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getBasePath } from '@/utils/config';

export default function Mau03CatalogPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/mau03-catalog`);
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
            const res = await fetch(`${getBasePath()}/api/mau03-catalog/${id}`, { method: 'DELETE' });
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
            const res = await fetch(`${getBasePath()}/api/mau03-catalog`, { method: 'DELETE' });
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
            const url = editingRecord ? `${getBasePath()}/api/mau03-catalog/${editingRecord.id}` : `${getBasePath()}/api/mau03-catalog`;
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
            'MA_THUOC', 'TEN_HOAT_CHAT', 'TEN_THUOC', 'DON_VI_TINH', 'HAM_LUONG',
            'DUONG_DUNG', 'MA_DUONG_DUNG', 'DANG_BAO_CHE', 'SO_DANG_KY', 'SO_LUONG',
            'DON_GIA', 'DON_GIA_BH', 'QUY_CACH', 'NHA_SX', 'NUOC_SX', 'NHA_THAU',
            'TT_THAU', 'TU_NGAY_HD', 'DEN_NGAY_HD', 'MA_CSKCB', 'LOAI_THUOC',
            'LOAI_THAU', 'HT_THAU', 'MA_DVKT', 'TCCL', 'BO_PHAN_VT', 'TEN_KHOA_HOC',
            'NGUON_GOC', 'PP_CHEBIEN', 'MA_DL_NHAP', 'MA_DL_CB', 'TLHH_CB', 'TLHH_BQ',
            'MA_CSKCB_THUOC', 'TU_NGAY', 'DEN_NGAY'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Mau03_DM');
        XLSX.writeFile(wb, 'Mau03_Thuoc_Template.xlsx');
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
                const res = await fetch(`${getBasePath()}/api/mau03-catalog`, {
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
        { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
        { title: 'Mã Thuốc', dataIndex: 'MA_THUOC', width: 120 },
        { title: 'Tên Thuốc', dataIndex: 'TEN_THUOC', width: 250 },
        { title: 'Hoạt chất', dataIndex: 'TEN_HOAT_CHAT', width: 200 },
        { title: 'Hàm lượng', dataIndex: 'HAM_LUONG', width: 150 },
        { title: 'ĐVT', dataIndex: 'DON_VI_TINH', width: 80 },
        { title: 'Số lượng', dataIndex: 'SO_LUONG', width: 100, align: 'right' as const },
        { title: 'Đơn giá', dataIndex: 'DON_GIA', width: 120, align: 'right' as const, render: (val: number) => val?.toLocaleString() },
        { title: 'Nhà SX', dataIndex: 'NHA_SX', width: 200 },
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
        (item.TEN_THUOC?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.MA_THUOC?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.TEN_HOAT_CHAT?.toLowerCase().includes(searchText.toLowerCase()))
    );

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            <Card title={<span className="text-xl font-bold text-slate-700">Danh mục Thuốc, Máu, Chế phẩm (Mẫu 03/DM)</span>} className="flex-1 drop-shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <Space>
                        <Input.Search placeholder="Tìm Mã thuốc, Tên thuốc..." allowClear onChange={e => setSearchText(e.target.value)} style={{ width: 300 }} />
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
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Thêm Thuốc Mới</Button>
                    </Space>
                </div>

                <Table
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 15 }}
                    size="middle"
                    bordered
                    scroll={{ x: 'max-content', y: 'calc(100vh - 350px)' }}
                />

                <Modal
                    title={<span className="text-lg font-bold text-slate-700">{editingRecord ? 'Cập nhật Mẫu 03/DM' : 'Thêm mới Mẫu 03/DM'}</span>}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    onOk={() => form.submit()}
                    width={1100}
                    style={{ top: 20 }}
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <div className="h-[70vh] overflow-y-auto pr-4 space-y-6">

                            {/* Khối 1: Định danh Thuốc */}
                            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2"><MedicineBoxOutlined /> 1. Thông tin Định danh Thuốc / Vật tư</h3>
                                <Row gutter={16}>
                                    <Col span={6}><Form.Item name="MA_THUOC" label="Mã Thuốc"><Input size="large" className="font-mono text-blue-600 font-semibold" /></Form.Item></Col>
                                    <Col span={10}><Form.Item name="TEN_THUOC" label="Tên Thuốc"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="TEN_HOAT_CHAT" label="Tên Hoạt chất"><Input size="large" /></Form.Item></Col>

                                    <Col span={4}><Form.Item name="DON_VI_TINH" label="Đơn vị tính"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="HAM_LUONG" label="Hàm lượng"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="DUONG_DUNG" label="Đường dùng"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="MA_DUONG_DUNG" label="Mã đường dùng"><Input size="large" /></Form.Item></Col>

                                    <Col span={8}><Form.Item name="DANG_BAO_CHE" label="Dạng bào chế"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="SO_DANG_KY" label="Số đăng ký"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="QUY_CACH" label="Quy cách đóng gói"><Input size="large" /></Form.Item></Col>

                                    <Col span={4}><Form.Item name="LOAI_THUOC" label="Loại thuốc (Số)"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                </Row>
                            </div>

                            {/* Khối 2: Sản xuất & Nguồn gốc */}
                            <div className="bg-white p-5 rounded-xl border border-emerald-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-emerald-800 uppercase mb-4 flex items-center gap-2"><BankOutlined /> 2. Sản xuất & Đông y</h3>
                                <Row gutter={16}>
                                    <Col span={12}><Form.Item name="NHA_SX" label="Nhà sản xuất"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="NUOC_SX" label="Nước sản xuất"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="TCCL" label="Tiêu chuẩn CL"><Input size="large" /></Form.Item></Col>

                                    <Col span={8}><Form.Item name="TEN_KHOA_HOC" label="Tên khoa học (Đông y)"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="NGUON_GOC" label="Nguồn gốc"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="PP_CHEBIEN" label="PP Chế biến"><Input size="large" /></Form.Item></Col>

                                    <Col span={4}><Form.Item name="BO_PHAN_VT" label="Bộ phận VT"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="MA_DL_NHAP" label="Mã DL Nhập"><Input size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="MA_DL_CB" label="Mã DL CB"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="TLHH_CB" label="Tỉ lệ hao hụt CB"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="TLHH_BQ" label="Tỉ lệ hao hụt BQ"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                </Row>
                            </div>

                            {/* Khối 3: Đấu thầu & Giá cả */}
                            <div className="bg-white p-5 rounded-xl border border-purple-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-purple-800 uppercase mb-4 flex items-center gap-2"><FileDoneOutlined /> 3. Thông tin Đấu thầu & Đơn giá</h3>
                                <Row gutter={16}>
                                    <Col span={12}><Form.Item name="NHA_THAU" label="Tên nhà thầu"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="TT_THAU" label="Thông tin thầu"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="MA_DVKT" label="Mã DVKT Khác"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="SO_LUONG" label="Số lượng"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DON_GIA" label="Đơn giá (VNĐ)"><InputNumber className="w-full" size="large" formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DON_GIA_BH" label="Đơn giá BHYT"><InputNumber className="w-full text-indigo-700 border-indigo-200" size="large" formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="HT_THAU" label="Hình thức thầu (Số)"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="LOAI_THAU" label="Loại thầu"><InputNumber className="w-full" size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="TU_NGAY_HD" label="Từ Ngày HĐ (YYYYMMDD)"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DEN_NGAY_HD" label="Đến Ngày HĐ"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="TU_NGAY" label="Hiệu lực Từ Ngày"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DEN_NGAY" label="Hiệu lực Đến Ngày"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="MA_CSKCB" label="Mã CS KCB"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="MA_CSKCB_THUOC" label="Mã CSKCB Thuốc"><Input size="large" /></Form.Item></Col>
                                </Row>
                            </div>

                        </div>
                    </Form>
                </Modal>
            </Card>
        </div>
    );
}

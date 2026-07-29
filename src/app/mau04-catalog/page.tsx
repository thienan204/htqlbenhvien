'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Popconfirm, message, Upload, Card, Tooltip, Row, Col, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined, ToolOutlined, DollarOutlined, FileDoneOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getBasePath } from '@/utils/config';
import { useAuth } from '@/contexts/AuthContext';

export default function Mau04CatalogPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const { user } = useAuth();

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/mau04-catalog`);
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

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        setTogglingId(id);
        try {
            const res = await fetch(`${getBasePath()}/api/mau04-catalog/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            if (res.ok) {
                message.success(`Đã ${!currentStatus ? 'kích hoạt' : 'vô hiệu hóa'} bản ghi`);
                fetchData();
            } else message.error('Lỗi khi cập nhật trạng thái');
        } catch (error) {
            message.error('Lỗi hệ thống');
        } finally {
            setTogglingId(null);
        }
    };

    const handleBulkUpdateStatus = async (isActive: boolean) => {
        if (selectedRowKeys.length === 0) return;
        try {
            const res = await fetch(`${getBasePath()}/api/mau04-catalog/bulk`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedRowKeys, isActive })
            });
            if (res.ok) {
                message.success(`Đã ${isActive ? 'kích hoạt' : 'vô hiệu hóa'} ${selectedRowKeys.length} bản ghi`);
                setSelectedRowKeys([]);
                fetchData();
            } else message.error('Lỗi khi cập nhật trạng thái');
        } catch (error) {
            message.error('Lỗi hệ thống');
        }
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(newSelectedRowKeys);
        },
    };

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
            const res = await fetch(`${getBasePath()}/api/mau04-catalog/${id}`, { method: 'DELETE' });
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
            const res = await fetch(`${getBasePath()}/api/mau04-catalog`, { method: 'DELETE' });
            if (res.ok) {
                const result = await res.json();
                message.success(`Đã xóa thành công ${result.count} dòng dữ liệu.`);
                fetchData();
            } else {
                message.error('Xóa toàn bộ thất bại');
            }
        } catch (error) {
            message.error('Lỗi khi xóa toàn bộ');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (values: any) => {
        try {
            const url = editingRecord ? `${getBasePath()}/api/mau04-catalog/${editingRecord.id}` : `${getBasePath()}/api/mau04-catalog`;
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
            'MA_VAT_TU', 'NHOM_VAT_TU', 'TEN_VAT_TU', 'MA_HIEU', 'SO_LUU_HANH',
            'TINHNANG_KT', 'QUY_CACH', 'HANG_SX', 'NUOC_SX', 'DON_VI_TINH',
            'DON_GIA', 'DON_GIA_BH', 'TYLE_TT_BH', 'SO_LUONG', 'DINH_MUC',
            'NHA_THAU', 'TT_THAU', 'TU_NGAY_HD', 'DEN_NGAY_HD', 'MA_CSKCB',
            'LOAI_THAU', 'HT_THAU', 'MA_CSKCB_TBYT', 'TU_NGAY', 'DEN_NGAY'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Mau04_DM');
        XLSX.writeFile(wb, 'Mau04_VTYT_Template.xlsx');
    };

    const handleExportData = () => {
        const headers = [
            'MA_VAT_TU', 'NHOM_VAT_TU', 'TEN_VAT_TU', 'MA_HIEU', 'SO_LUU_HANH',
            'TINHNANG_KT', 'QUY_CACH', 'HANG_SX', 'NUOC_SX', 'DON_VI_TINH',
            'DON_GIA', 'DON_GIA_BH', 'TYLE_TT_BH', 'SO_LUONG', 'DINH_MUC',
            'NHA_THAU', 'TT_THAU', 'TU_NGAY_HD', 'DEN_NGAY_HD', 'MA_CSKCB',
            'LOAI_THAU', 'HT_THAU', 'MA_CSKCB_TBYT', 'TU_NGAY', 'DEN_NGAY'
        ];

        const exportData = data.map(item => headers.map(key => item[key] !== undefined && item[key] !== null ? item[key] : ''));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...exportData]);
        XLSX.utils.book_append_sheet(wb, ws, 'Mau04_DM_Export');
        XLSX.writeFile(wb, 'Mau04_VTYT_Export.xlsx');
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
                const res = await fetch(`${getBasePath()}/api/mau04-catalog`, {
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
        { title: 'Mã Vật Tư', dataIndex: 'MA_VAT_TU', width: 120 },
        { title: 'Tên Vật Tư', dataIndex: 'TEN_VAT_TU', width: 250 },
        { title: 'Nhóm VTYT', dataIndex: 'NHOM_VAT_TU', width: 200 },
        { title: 'ĐVT', dataIndex: 'DON_VI_TINH', width: 80 },
        { title: 'Số lượng', dataIndex: 'SO_LUONG', width: 100, align: 'right' as const },
        { title: 'Đơn giá', dataIndex: 'DON_GIA', width: 120, align: 'right' as const, render: (val: number) => val?.toLocaleString() },
        { title: 'Tỷ lệ BH', dataIndex: 'TYLE_TT_BH', width: 90, align: 'right' as const, render: (val: number) => val != null ? `${val}%` : '' },
        { title: 'Hãng SX', dataIndex: 'HANG_SX', width: 150 },
        { title: 'Nước SX', dataIndex: 'NUOC_SX', width: 100 },
        { title: 'Trạng thái', dataIndex: 'isActive', width: 120, align: 'center' as const, render: (isActive: boolean, record: any) => (
            <Switch 
                checked={isActive} 
                checkedChildren="Đang dùng" 
                unCheckedChildren="Lịch sử"
                onChange={(checked) => handleToggleStatus(record.id, checked)}
                loading={togglingId === record.id}
            />
        )},
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
        (item.TEN_VAT_TU?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.MA_VAT_TU?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.NHOM_VAT_TU?.toLowerCase().includes(searchText.toLowerCase()))
    );

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            <Card title={<span className="text-xl font-bold text-slate-700">Danh mục Thiết bị y tế, Vật tư (Mẫu 04/DM)</span>} className="flex-1 drop-shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <Space>
                        <Input.Search placeholder="Tìm Mã VTYT, Tên VTYT..." allowClear onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }} style={{ width: 300 }} />
                        <Button icon={<SyncOutlined />} onClick={fetchData}>Làm mới</Button>
                        {selectedRowKeys.length > 0 && (
                            <>
                                <Button className="bg-green-500 text-white border-none hover:bg-green-600" onClick={() => handleBulkUpdateStatus(true)}>
                                    Đánh dấu Đang dùng ({selectedRowKeys.length})
                                </Button>
                                <Button className="bg-gray-400 text-white border-none hover:bg-gray-500" onClick={() => handleBulkUpdateStatus(false)}>
                                    Đánh dấu Lịch sử ({selectedRowKeys.length})
                                </Button>
                            </>
                        )}
                    </Space>
                    <Space>
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleExportData} className="border-indigo-500 text-indigo-600 font-medium">Export Dữ liệu</Button>
                        {user?.role === 'ADMIN' && (
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
                        )}
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleDownloadTemplate} className="border-green-500 text-green-600 hover:bg-green-50">Tải file mẫu</Button>
                        <Upload beforeUpload={(file) => handleImportExcel({ file })} showUploadList={false} accept=".xlsx, .xls">
                            <Button type="default" icon={<UploadOutlined />} className="bg-blue-50 border-blue-200 text-blue-700">Import Excel</Button>
                        </Upload>
                        <Button type="primary" className="bg-orange-500 hover:bg-orange-600" icon={<PlusOutlined />} onClick={handleAdd}>Thêm VTYT Mới</Button>
                    </Space>
                </div>

                <Table
                    rowSelection={rowSelection}
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
                    title={<span className="text-lg font-bold text-slate-700">{editingRecord ? 'Cập nhật Mẫu 04/DM' : 'Thêm mới Mẫu 04/DM'}</span>}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    onOk={() => form.submit()}
                    width={1000}
                    style={{ top: 20 }}
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <div className="h-[70vh] overflow-y-auto pr-4 space-y-6">

                            {/* Khối 1: Định danh VTYT */}
                            <div className="bg-white p-5 rounded-xl border border-orange-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-orange-800 uppercase mb-4 flex items-center gap-2"><ToolOutlined /> 1. Định danh Vật tư & Tính năng</h3>
                                <Row gutter={16}>
                                    <Col span={6}><Form.Item name="MA_VAT_TU" label="Mã VTYT"><Input size="large" className="font-mono text-orange-600 font-semibold" /></Form.Item></Col>
                                    <Col span={10}><Form.Item name="TEN_VAT_TU" label="Tên Vật tư"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="NHOM_VAT_TU" label="Nhóm VTYT"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="MA_HIEU" label="Mã hiệu"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="SO_LUU_HANH" label="Số lưu hành"><Input size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="DON_VI_TINH" label="Đơn vị tính"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="TINHNANG_KT" label="Tính năng KT"><Input size="large" /></Form.Item></Col>
                                </Row>
                            </div>

                            {/* Khối 2: Sản xuất & Kinh tế */}
                            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2"><DollarOutlined /> 2. Sản xuất & Kinh tế (BHYT)</h3>
                                <Row gutter={16}>
                                    <Col span={10}><Form.Item name="QUY_CACH" label="Quy cách đóng gói"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="HANG_SX" label="Hãng sản xuất"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="NUOC_SX" label="Nước sản xuất"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="DON_GIA" label="Đơn giá (VNĐ)"><InputNumber className="w-full" size="large" formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DON_GIA_BH" label="Đơn giá BHYT"><InputNumber className="w-full text-indigo-700 border-indigo-200" size="large" formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="TYLE_TT_BH" label="Tỷ lệ TT BH (%)"><InputNumber className="w-full" size="large" /></Form.Item></Col>

                                    <Col span={4}><Form.Item name="SO_LUONG" label="Số lượng"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="DINH_MUC" label="Định mức (Lần)"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                </Row>
                            </div>

                            {/* Khối 3: Đấu thầu & Thời gian */}
                            <div className="bg-white p-5 rounded-xl border border-purple-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-purple-800 uppercase mb-4 flex items-center gap-2"><FileDoneOutlined /> 3. Thông tin Đấu thầu & Điều tiết</h3>
                                <Row gutter={16}>
                                    <Col span={10}><Form.Item name="NHA_THAU" label="Tên nhà thầu"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="TT_THAU" label="Thông tin thầu"><Input size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="LOAI_THAU" label="Loại thầu (SỐ)"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="HT_THAU" label="HT thầu (Số)"><InputNumber className="w-full" size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="TU_NGAY_HD" label="Từ Ngày HĐ (YYYYMMDD)"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DEN_NGAY_HD" label="Đến Ngày HĐ"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="TU_NGAY" label="Hiệu lực Từ Ngày"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DEN_NGAY" label="Hiệu lực Đến Ngày"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="MA_CSKCB" label="Mã CS KCB"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="MA_CSKCB_TBYT" label="Mã CSKCB TBYT"><Input size="large" /></Form.Item></Col>
                                </Row>
                            </div>

                        </div>
                    </Form>
                </Modal>
            </Card>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Popconfirm, message, Upload, Card, Tooltip, Row, Col, Tag, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined, HeartOutlined, ContainerOutlined, ExperimentOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getBasePath } from '@/utils/config';
import { useAuth } from '@/contexts/AuthContext';

export default function Mau05CatalogPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const { user } = useAuth();

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/mau05-catalog`);
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
            const res = await fetch(`${getBasePath()}/api/mau05-catalog/${id}`, { method: 'DELETE' });
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
            const res = await fetch(`${getBasePath()}/api/mau05-catalog`, { method: 'DELETE' });
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
            const url = editingRecord ? `${getBasePath()}/api/mau05-catalog/${editingRecord.id}` : `${getBasePath()}/api/mau05-catalog`;
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

    const handleToggleStatus = async (id: string, checked: boolean) => {
        try {
            setTogglingId(id);
            const res = await fetch(`${getBasePath()}/api/mau05-catalog/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: checked })
            });
            if (res.ok) {
                message.success('Đã cập nhật trạng thái');
                setData(prev => prev.map(item => item.id === id ? { ...item, isActive: checked } : item));
            } else {
                message.error('Cập nhật thất bại');
            }
        } catch (error) {
            message.error('Lỗi hệ thống');
        } finally {
            setTogglingId(null);
        }
    };

    const handleBulkUpdateStatus = async (isActive: boolean) => {
        if (selectedRowKeys.length === 0) return;
        try {
            setLoading(true);
            const res = await fetch(`${getBasePath()}/api/mau05-catalog/bulk`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedRowKeys, isActive })
            });
            if (res.ok) {
                message.success(`Đã cập nhật trạng thái cho ${selectedRowKeys.length} dòng`);
                setSelectedRowKeys([]);
                fetchData();
            } else {
                message.error('Cập nhật thất bại');
            }
        } catch (error) {
            message.error('Lỗi hệ thống');
        } finally {
            setLoading(false);
        }
    };

    const rowSelection = {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[]) => {
            setSelectedRowKeys(newSelectedRowKeys);
        },
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'MA_DICH_VU', 'TEN_DICH_VU', 'TEN_DVKT_GIA', 'DON_GIA', 'QUY_TRINH',
            'SO_LUONG_CGKT', 'CSKCB_CGKT', 'CSKCB_CLS', 'QD_DVKT', 'QD_PD_GIA',
            'GHI_CHU', 'MA_THUOC', 'TEN_THUOC', 'SO_DANG_KY', 'DON_VI_TINH',
            'TT_THAU', 'DON_GIA_THUOC', 'DM_NSX_CDD', 'DM_THUCTE_CDD', 'LIEU_BQ_PX',
            'TL_THUCTE_BQ_PX', 'THANH_TIEN_THUOC', 'GIA_THANH_TOAN', 'TU_NGAY',
            'DEN_NGAY', 'MA_CSKCB'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Mau05_DM');
        XLSX.writeFile(wb, 'Mau05_DVKT_Template.xlsx');
    };

    const handleExportData = () => {
        const headers = [
            'MA_DICH_VU', 'TEN_DICH_VU', 'TEN_DVKT_GIA', 'DON_GIA', 'QUY_TRINH',
            'SO_LUONG_CGKT', 'CSKCB_CGKT', 'CSKCB_CLS', 'QD_DVKT', 'QD_PD_GIA',
            'GHI_CHU', 'MA_THUOC', 'TEN_THUOC', 'SO_DANG_KY', 'DON_VI_TINH',
            'TT_THAU', 'DON_GIA_THUOC', 'DM_NSX_CDD', 'DM_THUCTE_CDD', 'LIEU_BQ_PX',
            'TL_THUCTE_BQ_PX', 'THANH_TIEN_THUOC', 'GIA_THANH_TOAN', 'TU_NGAY',
            'DEN_NGAY', 'MA_CSKCB'
        ];

        const exportData = data.map(item => headers.map(key => item[key] !== undefined && item[key] !== null ? item[key] : ''));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, ...exportData]);
        XLSX.utils.book_append_sheet(wb, ws, 'Mau05_DM_Export');
        XLSX.writeFile(wb, 'Mau05_DVKT_Export.xlsx');
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
                const res = await fetch(`${getBasePath()}/api/mau05-catalog`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(jsonData)
                });

                if (res.ok) {
                    const result = await res.json();
                    if (result.inserted !== undefined || result.updated !== undefined) {
                        message.success(`Import hoàn tất! Thêm mới: ${result.inserted}, Cập nhật: ${result.updated}, Bỏ qua: ${result.skipped} (không đổi).`, 5);
                    } else {
                        message.success(`Đã Import thành công ${result.count || jsonData.length} dòng.`);
                    }
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
        { title: 'Mã Dịch Vụ', dataIndex: 'MA_DICH_VU', width: 120 },
        { title: 'Tên Dịch Vụ', dataIndex: 'TEN_DICH_VU', width: 250 },
        { title: 'Tên DVKT Giá', dataIndex: 'TEN_DVKT_GIA', width: 250 },
        { title: 'Đơn giá', dataIndex: 'DON_GIA', width: 120, align: 'right' as const, render: (val: number) => val?.toLocaleString() },
        { title: 'Quy trình', dataIndex: 'QUY_TRINH', width: 150 },
        { title: 'Ghi chú', dataIndex: 'GHI_CHU', width: 200 },
        { title: 'QĐ DVKT', dataIndex: 'QD_DVKT', width: 120 },
        { title: 'Mã Thuốc CĐ', dataIndex: 'MA_THUOC', width: 120 },
        { title: 'Tên Thuốc CĐ', dataIndex: 'TEN_THUOC', width: 200 },
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
        (item.TEN_DICH_VU?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.MA_DICH_VU?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.TEN_DVKT_GIA?.toLowerCase().includes(searchText.toLowerCase()))
    );

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50">
            <Card title={<span className="text-xl font-bold text-slate-700">Danh mục Dịch vụ Khám bệnh, Chữa bệnh (Mẫu 05/DM)</span>} className="flex-1 drop-shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <Space>
                        <Input.Search placeholder="Tìm Mã DV, Tên DV..." allowClear onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }} style={{ width: 300 }} />
                    </Space>
                    <Space>
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleExportData} className="border-indigo-500 text-indigo-600 font-medium">Export Dữ liệu</Button>
                        {user?.role === 'ADMIN' && (
                            <Popconfirm 
                                title="Xác nhận xóa TOÀN BỘ dữ liệu?" 
                                description="Hành động này sẽ xóa sạch danh mục và không thể hoàn tác. Bạn có chắc chắn không?"
                                onConfirm={handleDeleteAll} 
                                okText="Có, Xóa hết" 
                                cancelText="Không"
                                okButtonProps={{ danger: true }}
                            >
                                <Button danger type="primary" icon={<DeleteOutlined />}>Xóa toàn bộ</Button>
                            </Popconfirm>
                        )}
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleDownloadTemplate} className="border-green-500 text-green-600">Tải file mẫu</Button>
                        <Upload beforeUpload={(file) => handleImportExcel({ file })} showUploadList={false} accept=".xlsx, .xls">
                            <Button type="default" icon={<UploadOutlined />} className="bg-blue-50 border-blue-200 text-blue-700">Import Excel</Button>
                        </Upload>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Thêm DV Mới</Button>
                        <Button icon={<SyncOutlined />} onClick={fetchData}>Làm mới</Button>
                        {selectedRowKeys.length > 0 && (
                            <>
                                <Button 
                                    className="bg-green-500 text-white border-none hover:bg-green-600" 
                                    onClick={() => handleBulkUpdateStatus(true)}
                                >
                                    Đánh dấu Đang dùng ({selectedRowKeys.length})
                                </Button>
                                <Button 
                                    className="bg-gray-400 text-white border-none hover:bg-gray-500" 
                                    onClick={() => handleBulkUpdateStatus(false)}
                                >
                                    Đánh dấu Lịch sử ({selectedRowKeys.length})
                                </Button>
                            </>
                        )}
                    </Space>
                </div>

                <Table
                    rowSelection={rowSelection}
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="id"
                    loading={loading}
                    rowClassName={(record) => !record.isActive ? 'bg-gray-50 opacity-60' : ''}
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
                    title={<span className="text-lg font-bold text-slate-700">{editingRecord ? 'Cập nhật Mẫu 05/DM' : 'Thêm mới Mẫu 05/DM'}</span>}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    onOk={() => form.submit()}
                    width={1100}
                    style={{ top: 20 }}
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <div className="h-[70vh] overflow-y-auto pr-4 space-y-6">

                            {/* Khối 1: Thông tin Dịch Vụ */}
                            <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-red-800 uppercase mb-4 flex items-center gap-2"><HeartOutlined /> 1. Thông tin Dịch vụ Y tế</h3>
                                <Row gutter={16}>
                                    <Col span={6}><Form.Item name="MA_DICH_VU" label="Mã Dịch Vụ"><Input size="large" className="font-mono text-red-600 font-semibold" /></Form.Item></Col>
                                    <Col span={9}><Form.Item name="TEN_DICH_VU" label="Tên Dịch Vụ / Kỹ Thuật"><Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} size="large" /></Form.Item></Col>
                                    <Col span={9}><Form.Item name="TEN_DVKT_GIA" label="Tên Dịch Vụ (Giá)"><Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="DON_GIA" label="Đơn giá (VNĐ)"><InputNumber className="w-full text-indigo-700 border-indigo-200" size="large" formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="QUY_TRINH" label="Ngày/Số quyết định QT"><Input size="large" /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="GHI_CHU" label="Ghi chú"><Input size="large" /></Form.Item></Col>
                                </Row>
                            </div>

                            {/* Khối 2: Chuyển giao & Pháp lý */}
                            <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2"><ContainerOutlined /> 2. Quyết định Pháp lý & Chuyển giao</h3>
                                <Row gutter={16}>
                                    <Col span={8}><Form.Item name="QD_DVKT" label="Quyết định DVKT"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="QD_PD_GIA" label="Quyết định phê duyệt giá"><Input size="large" /></Form.Item></Col>

                                    <Col span={4}><Form.Item name="SO_LUONG_CGKT" label="SL Chuyển giao"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="CSKCB_CGKT" label="Mã CSKCB (Chuyển giao)"><Input size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="CSKCB_CLS" label="Mã CSKCB (Cận LS)"><Input size="large" /></Form.Item></Col>

                                    <Col span={4}><Form.Item name="TU_NGAY" label="Hiệu lực Từ Ngày"><Input size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="DEN_NGAY" label="Hiệu lực Đến Ngày"><Input size="large" /></Form.Item></Col>
                                    <Col span={4}><Form.Item name="MA_CSKCB" label="Mã CS KCB"><Input size="large" /></Form.Item></Col>
                                </Row>
                            </div>

                            {/* Khối 3: Thuốc phóng xạ / Đánh dấu */}
                            <div className="bg-white p-5 rounded-xl border border-purple-100 shadow-sm relative">
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-500 rounded-l-xl"></div>
                                <h3 className="text-sm font-bold text-purple-800 uppercase mb-4 flex items-center gap-2"><ExperimentOutlined /> 3. Thuốc phóng xạ / Hóa chất đánh dấu</h3>
                                <Row gutter={16}>
                                    <Col span={6}><Form.Item name="MA_THUOC" label="Mã Thuốc ĐD"><Input size="large" /></Form.Item></Col>
                                    <Col span={10}><Form.Item name="TEN_THUOC" label="Tên thuốc / Hóa chất ĐD"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="SO_DANG_KY" label="Số đăng ký"><Input size="large" /></Form.Item></Col>

                                    <Col span={12}><Form.Item name="TT_THAU" label="Thông tin thầu"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DON_GIA_THUOC" label="Đơn giá thuốc (VNĐ)"><InputNumber className="w-full" size="large" formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DON_VI_TINH" label="Đơn vị tính (Thuốc)"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="DM_NSX_CDD" label="Định mức NSX (Chất ĐD)"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="DM_THUCTE_CDD" label="Định mức Thực tế (CDD)"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="LIEU_BQ_PX" label="Liều bình quân (Phóng xạ)"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="TL_THUCTE_BQ_PX" label="Tỷ lệ thực tế BQ (Phóng xạ)"><InputNumber className="w-full" size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="THANH_TIEN_THUOC" label="Thành tiền thuốc (VNĐ)"><InputNumber className="w-full text-indigo-700" size="large" formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="GIA_THANH_TOAN" label="Giá thanh toán BHYT"><InputNumber className="w-full text-pink-700 font-bold" size="large" formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} /></Form.Item></Col>
                                </Row>
                            </div>

                        </div>
                    </Form>
                </Modal>
            </Card>
        </div>
    );
}

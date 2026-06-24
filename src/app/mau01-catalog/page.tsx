'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Popconfirm, message, Upload, Card, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined, AppstoreOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getBasePath } from '@/utils/config';

export default function Mau01CatalogPage() {
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
            const res = await fetch(`${getBasePath()}/api/mau01-catalog`);
            if (!res.ok) throw new Error('Network response was not ok');
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

    // Giải pháp hoàn hảo cho "useForm warning" thay vì ép Modal forceRender:
    // Chờ đến khi Modal được mở lên xong xuôi, thẻ <Form> đã chắc chắn nằm trong DOM thì mới bơm dữ liệu vào.
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
            const res = await fetch(`${getBasePath()}/api/mau01-catalog/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa dòng');
                fetchData();
            } else {
                message.error('Xóa thất bại');
            }
        } catch (error) {
            message.error('Xóa thất bại');
        }
    };

    const handleDeleteAll = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${getBasePath()}/api/mau01-catalog`, { method: 'DELETE' });
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
            if (editingRecord) {
                // Update
                const res = await fetch(`${getBasePath()}/api/mau01-catalog/${editingRecord.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values)
                });
                if (res.ok) {
                    message.success('Cập nhật thành công');
                    setIsModalOpen(false);
                    fetchData();
                }
            } else {
                // Create
                const res = await fetch(`${getBasePath()}/api/mau01-catalog`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values)
                });
                if (res.ok) {
                    message.success('Thêm mới thành công');
                    setIsModalOpen(false);
                    fetchData();
                }
            }
        } catch (error) {
            message.error('Lưu thất bại');
        }
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'MA_KHOA', 'TEN_KHOA', 'BAN_KHAM', 'GIUONG_PD',
            'GIUONG_TK', 'GIUONG_HSTC', 'GIUONG_HSCC', 'TU_NGAY', 'DEN_NGAY', 'MA_CSKCB'
        ];
        // Add a sample row to guide the user
        const sampleRow = [
            'K01', 'Khoa Nội', 2, 50,
            48, 5, 2, '20240101', '20241231', '01001'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

        // Auto size columns slightly
        ws['!cols'] = [
            { wpx: 80 }, { wpx: 150 }, { wpx: 80 }, { wpx: 80 },
            { wpx: 80 }, { wpx: 80 }, { wpx: 80 }, { wpx: 80 }, { wpx: 80 }, { wpx: 80 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Mau01_DM');
        XLSX.writeFile(wb, 'Mau01_DanhMuc_Template.xlsx');
    };

    const handleImportExcel = (info: any) => {
        const file = info.file;
        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const dataBuffer = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(dataBuffer, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                // Read as array of objects mapping to headers
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    message.warning('File Excel trống!');
                    return;
                }

                // Call backend bulk create
                setLoading(true);
                const res = await fetch(`${getBasePath()}/api/mau01-catalog`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(jsonData)
                });

                if (res.ok) {
                    const result = await res.json();
                    message.success(`Đã Import thành công ${result.count || jsonData.length} dòng dữ liệu.`);
                    fetchData();
                } else {
                    message.error('Import thất bại! Hãy kiểm tra lại file của bạn gốc.');
                }
            } catch (error) {
                console.error(error);
                message.error('Lỗi đọc file Excel');
            } finally {
                setLoading(false);
            }
            // Explicitly prevent default upload action to rely on FileReader instead
            // We only need the payload logic.
        };

        reader.readAsArrayBuffer(file as any as Blob);
        return false; // Prevent default upload
    };

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (currentPage - 1) * pageSize + index + 1
        },
        { title: 'Mã Khoa', dataIndex: 'MA_KHOA', width: 100 },
        { title: 'Tên Khoa', dataIndex: 'TEN_KHOA', width: 200 },
        { title: 'Bàn Khám', dataIndex: 'BAN_KHAM', width: 90, align: 'right' as const },
        { title: 'Giường PD', dataIndex: 'GIUONG_PD', width: 90, align: 'right' as const },
        { title: 'Giường TK', dataIndex: 'GIUONG_TK', width: 90, align: 'right' as const },
        { title: 'HSTC', dataIndex: 'GIUONG_HSTC', width: 70, align: 'right' as const },
        { title: 'HSCC', dataIndex: 'GIUONG_HSCC', width: 70, align: 'right' as const },
        { title: 'Từ Ngày', dataIndex: 'TU_NGAY', width: 100, align: 'center' as const },
        { title: 'Đến Ngày', dataIndex: 'DEN_NGAY', width: 100, align: 'center' as const },
        { title: 'Mã CSKCB', dataIndex: 'MA_CSKCB', width: 100 },
        {
            title: 'Hành động',
            key: 'action',
            width: 120,
            align: 'center' as const,
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="Sửa">
                        <Button type="text" icon={<EditOutlined className="text-blue-500" />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Có"
                        cancelText="Không"
                    >
                        <Tooltip title="Xóa">
                            <Button type="text" icon={<DeleteOutlined className="text-red-500" />} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const filteredData = data.filter(item =>
        (item.MA_KHOA?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.TEN_KHOA?.toLowerCase().includes(searchText.toLowerCase()))
    );

    return (
        <div className="p-6 h-full flex flex-col bg-gray-50">
            <Card title={<span className="text-xl font-bold text-slate-700">Bộ phận chuyên môn khám chữa bệnh (Mẫu số 01/DM)</span>} className="flex-1 drop-shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <Space>
                        <Input.Search
                            placeholder="Tìm kiếm Mã hoặc Tên khoa..."
                            allowClear
                            onSearch={(value) => { setSearchText(value); setCurrentPage(1); }}
                            onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                            style={{ width: 300 }}
                        />
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
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleDownloadTemplate} className="border-green-500 text-green-600 hover:bg-green-50">
                            Tải file Excel mẫu
                        </Button>
                        <Upload beforeUpload={(file) => handleImportExcel({ file })} showUploadList={false} accept=".xlsx, .xls">
                            <Button type="default" icon={<UploadOutlined />} className="bg-blue-50 border-blue-200 text-blue-700">
                                Import Excel
                            </Button>
                        </Upload>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            Thêm mới thủ công
                        </Button>
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
                    scroll={{ x: 'max-content' }}
                />

                <Modal
                    title={editingRecord ? "Sửa bản ghi" : "Thêm bản ghi mới"}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    onOk={() => form.submit()}
                    width={800}
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <div className="space-y-6">
                            {/* Panel 1: Thông tin cơ bản */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg"><AppstoreOutlined /></span>
                                    Thông tin cơ bản
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                    <Form.Item name="MA_KHOA" label={<span className="font-medium text-slate-600">Mã Khoa</span>} rules={[{ required: true, message: 'Vui lòng nhập Mã Khoa' }]}>
                                        <Input placeholder="VD: K01" maxLength={50} size="large" className="font-mono text-blue-700" />
                                    </Form.Item>
                                    <Form.Item name="MA_CSKCB" label={<span className="font-medium text-slate-600">Mã CS KCB</span>}>
                                        <Input placeholder="VD: 01001" maxLength={5} size="large" />
                                    </Form.Item>
                                    <Form.Item name="TEN_KHOA" label={<span className="font-medium text-slate-600">Tên Khoa</span>} className="md:col-span-2">
                                        <Input placeholder="VD: Khoa Nội Tiêu Hóa" size="large" />
                                    </Form.Item>
                                </div>
                            </div>

                            {/* Panel 2: Quy mô giường bệnh & Bàn khám */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg"><PlusOutlined /></span>
                                    Quy mô Giường & Bàn khám
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-2">
                                    <Form.Item name="BAN_KHAM" label={<span className="font-medium text-slate-600">Bàn Khám</span>}>
                                        <InputNumber className="w-full" placeholder="0" max={999} size="large" />
                                    </Form.Item>
                                    <Form.Item name="GIUONG_PD" label={<span className="font-medium text-emerald-700">Giường PD</span>} tooltip="Giường phê duyệt">
                                        <InputNumber className="w-full" placeholder="0" max={99999} size="large" />
                                    </Form.Item>
                                    <Form.Item name="GIUONG_TK" label={<span className="font-medium text-emerald-700">Giường TK</span>} tooltip="Giường thống kê / thực tế">
                                        <InputNumber className="w-full" placeholder="0" max={99999} size="large" />
                                    </Form.Item>
                                    <Form.Item name="GIUONG_HSTC" label={<span className="font-medium text-red-600">Giường HSTC</span>} tooltip="Hồi sức tích cực">
                                        <InputNumber className="w-full" placeholder="0" max={999} size="large" />
                                    </Form.Item>
                                    <Form.Item name="GIUONG_HSCC" label={<span className="font-medium text-orange-500">Giường HSCC</span>} tooltip="Hồi sức cấp cứu">
                                        <InputNumber className="w-full" placeholder="0" max={999} size="large" />
                                    </Form.Item>
                                </div>
                            </div>

                            {/* Panel 3: Thời gian áp dụng */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="bg-purple-100 text-purple-600 p-1.5 rounded-lg"><SyncOutlined /></span>
                                    Thời gian áp dụng
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                    <Form.Item name="TU_NGAY" label={<span className="font-medium text-slate-600">Từ Ngày hiệu lực</span>} tooltip="Định dạng bắt buộc: YYYYMMDD (Ví dụ: 20240101)">
                                        <Input placeholder="YYYYMMDD (VD: 20240101)" maxLength={8} size="large" className="font-mono text-center tracking-widest" />
                                    </Form.Item>
                                    <Form.Item name="DEN_NGAY" label={<span className="font-medium text-slate-600">Đến Ngày (Ngày ngưng trễ)</span>} tooltip="Định dạng bắt buộc: YYYYMMDD (Ví dụ: 20241231)">
                                        <Input placeholder="YYYYMMDD (VD: 20241231)" maxLength={8} size="large" className="font-mono text-center tracking-widest" />
                                    </Form.Item>
                                </div>
                            </div>
                        </div>
                    </Form>
                </Modal>
            </Card>
        </div>
    );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Popconfirm, message, Upload, Card, Tooltip, Select, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined, AppstoreOutlined, UserOutlined, ClockCircleOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getBasePath } from '@/utils/config';
import { useAuth } from '@/contexts/AuthContext';

export default function Mau02CatalogPage() {
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
            const res = await fetch(`${getBasePath()}/api/mau02-catalog`);
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
            const res = await fetch(`${getBasePath()}/api/mau02-catalog/${id}`, {
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
            const res = await fetch(`${getBasePath()}/api/mau02-catalog/bulk`, {
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
            const res = await fetch(`${getBasePath()}/api/mau02-catalog/${id}`, { method: 'DELETE' });
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
            const res = await fetch(`${getBasePath()}/api/mau02-catalog`, { method: 'DELETE' });
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
                const res = await fetch(`${getBasePath()}/api/mau02-catalog/${editingRecord.id}`, {
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
                const res = await fetch(`${getBasePath()}/api/mau02-catalog`, {
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
            'MA_KHOA', 'TEN_KHOA', 'HO_TEN', 'GIOI_TINH', 'SO_DINH_DANH', 'CHUCDANH_NN', 'VI_TRI',
            'MACCHN', 'NGAYCAP_CCHN', 'NOICAP_CCHN', 'PHAMVI_CM', 'PHAMVI_CMBS', 'DVKT_KHAC',
            'VB_PHANCONG', 'THOIGIAN_DK', 'THOIGIAN_NGAY', 'THOIGIAN_TUAN', 'CSKCB_KHAC',
            'CSKCB_CGKT', 'QD_CGKT', 'TU_NGAY', 'DEN_NGAY', 'MA_CSKCB'
        ];

        const sampleRow = [
            'K01', 'Khoa Nội', 'Nguyễn Văn A', 1, '012345678912', '1', '1',
            'CCHN12345', '20200101', 'SYT Hà Nội', '0101', '', '',
            '', 1, '0800-1700', 'T2T3T4T5T6', '',
            '', '', '20240101', '20241231', '01001'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

        // Auto size columns roughly
        const cols = headers.map(h => ({ wpx: Math.max(80, h.length * 8) }));
        ws['!cols'] = cols;

        XLSX.utils.book_append_sheet(wb, ws, 'Mau02_DM');
        XLSX.writeFile(wb, 'Mau02_NhanLuc_Template.xlsx');
    };

    const handleExportExcel = () => {
        if (data.length === 0) {
            message.warning('Không có dữ liệu để xuất Excel');
            return;
        }

        const exportData = filteredData.map((item, index) => ({
            'STT': index + 1,
            'MA_KHOA': item.MA_KHOA || '',
            'TEN_KHOA': item.TEN_KHOA || '',
            'HO_TEN': item.HO_TEN || '',
            'GIOI_TINH': item.GIOI_TINH || '',
            'SO_DINH_DANH': item.SO_DINH_DANH || '',
            'CHUCDANH_NN': item.CHUCDANH_NN || '',
            'VI_TRI': item.VI_TRI || '',
            'MACCHN': item.MACCHN || '',
            'NGAYCAP_CCHN': item.NGAYCAP_CCHN || '',
            'NOICAP_CCHN': item.NOICAP_CCHN || '',
            'PHAMVI_CM': item.PHAMVI_CM || '',
            'PHAMVI_CMBS': item.PHAMVI_CMBS || '',
            'DVKT_KHAC': item.DVKT_KHAC || '',
            'VB_PHANCONG': item.VB_PHANCONG || '',
            'THOIGIAN_DK': item.THOIGIAN_DK || '',
            'THOIGIAN_NGAY': item.THOIGIAN_NGAY || '',
            'THOIGIAN_TUAN': item.THOIGIAN_TUAN || '',
            'CSKCB_KHAC': item.CSKCB_KHAC || '',
            'CSKCB_CGKT': item.CSKCB_CGKT || '',
            'QD_CGKT': item.QD_CGKT || '',
            'TU_NGAY': item.TU_NGAY || '',
            'DEN_NGAY': item.DEN_NGAY || '',
            'MA_CSKCB': item.MA_CSKCB || ''
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Mau02_DM');

        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const fileName = `02.MAU_02DM_NHANVIEN${dd}${mm}${yyyy}.xlsx`;

        XLSX.writeFile(wb, fileName);
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

                setLoading(true);
                const res = await fetch(`${getBasePath()}/api/mau02-catalog`, {
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
        };

        reader.readAsArrayBuffer(file as any as Blob);
        return false;
    };

    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (currentPage - 1) * pageSize + index + 1
        },
        { title: 'Họ Tên', dataIndex: 'HO_TEN', width: 180 },
        { title: 'Giới tính', dataIndex: 'GIOI_TINH', width: 90, render: (val: any) => val === 1 ? 'Nam' : (val === 2 ? 'Nữ' : 'Chưa XĐ') },
        { title: 'Khoa/Phòng', dataIndex: 'MA_KHOA', width: 100 },
        { title: 'Tên Khoa', dataIndex: 'TEN_KHOA', width: 180 },
        { title: 'Mã CCHN', dataIndex: 'MACCHN', width: 120 },
        { title: 'Phạm vi CM', dataIndex: 'PHAMVI_CM', width: 120 },
        { title: 'Vị trí', dataIndex: 'VI_TRI', width: 80 },
        { title: 'TG Đăng ký', dataIndex: 'THOIGIAN_DK', width: 120, render: (val: any) => val === 1 ? 'Toàn T.Gian' : 'Ko Toàn T.Gian' },
        { title: 'Mã CS', dataIndex: 'MA_CSKCB', width: 80 },
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
        (item.HO_TEN?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.MACCHN?.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.MA_KHOA?.toLowerCase().includes(searchText.toLowerCase()))
    );

    return (
        <div className="p-6 h-full flex flex-col bg-gray-50">
            <Card title={<span className="text-xl font-bold text-slate-700">Nhân lực thực hiện KCB BHYT (Mẫu số 02/DM)</span>} className="flex-1 drop-shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <Space>
                        <Input.Search
                            placeholder="Tìm Họ tên, Mã CCHN, Mã khoa..."
                            allowClear
                            onSearch={(value) => { setSearchText(value); setCurrentPage(1); }}
                            onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                            style={{ width: 350 }}
                        />
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
                        <Button type="default" className="border-indigo-500 text-indigo-600 font-medium" icon={<DownloadOutlined />} onClick={handleExportExcel}>
                            Export Dữ liệu
                        </Button>
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
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleDownloadTemplate} className="border-green-500 text-green-600 hover:bg-green-50">
                            Tải file Excel mẫu
                        </Button>
                        <Upload beforeUpload={(file) => handleImportExcel({ file })} showUploadList={false} accept=".xlsx, .xls">
                            <Button type="default" icon={<UploadOutlined />} className="bg-blue-50 border-blue-200 text-blue-700">
                                Import Excel
                            </Button>
                        </Upload>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            Thêm Nhân sự
                        </Button>
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
                    title={editingRecord ? "Cập nhật Nhân lực (Mẫu 02/DM)" : "Khai báo Nhân lực (Mẫu 02/DM)"}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    onOk={() => form.submit()}
                    width={1000}
                    style={{ top: 20 }}
                >
                    <Form form={form} layout="vertical" onFinish={handleSave}>
                        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 pb-4">
                            {/* Panel 1: Hành chính Khoa */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg"><AppstoreOutlined /></span>
                                    Thông tin Hành chính - Công tác
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-2">
                                    <Form.Item name="MA_KHOA" label={<span className="font-medium text-slate-600">Mã Khoa</span>} rules={[{ required: true, message: 'Vui lòng nhập Mã Khoa' }]}>
                                        <Input placeholder="VD: K01" maxLength={100} size="large" className="font-mono text-blue-700" />
                                    </Form.Item>
                                    <Form.Item name="TEN_KHOA" label={<span className="font-medium text-slate-600">Tên Khoa</span>} className="col-span-2">
                                        <Input placeholder="VD: Khoa Nội Tiêu Hóa" size="large" />
                                    </Form.Item>
                                    <Form.Item name="MA_CSKCB" label={<span className="font-medium text-slate-600">Mã CS KCB QT</span>}>
                                        <Input placeholder="VD: 01001" maxLength={5} size="large" />
                                    </Form.Item>
                                </div>
                            </div>

                            {/* Panel 2: Thông tin cá nhân & Chuyên môn */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg"><UserOutlined /></span>
                                    Lý lịch & Bằng cấp chuyên môn
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-0">
                                    <Form.Item name="HO_TEN" label={<span className="font-medium text-slate-600">Họ và Tên</span>} className="col-span-2">
                                        <Input placeholder="Nguyễn Văn A" size="large" />
                                    </Form.Item>
                                    <Form.Item name="GIOI_TINH" label={<span className="font-medium text-slate-600">Giới tính</span>}>
                                        <Select placeholder="Chọn..." size="large">
                                            <Select.Option value={1}>1 - Nam</Select.Option>
                                            <Select.Option value={2}>2 - Nữ</Select.Option>
                                            <Select.Option value={3}>3 - Chưa XĐ</Select.Option>
                                        </Select>
                                    </Form.Item>
                                    <Form.Item name="SO_DINH_DANH" label={<span className="font-medium text-slate-600">Số CCCD/Định danh</span>}>
                                        <Input placeholder="01234..." size="large" maxLength={15} />
                                    </Form.Item>

                                    <Form.Item name="CHUCDANH_NN" label={<span className="font-medium text-slate-600">Chức danh NN</span>} tooltip="1: Bác sỹ, 2: Y sỹ, 3: Điều dưỡng, 4: Hộ sinh...">
                                        <Input placeholder="VD: 1" size="large" maxLength={2} />
                                    </Form.Item>
                                    <Form.Item name="VI_TRI" label={<span className="font-medium text-slate-600">Vị trí</span>}>
                                        <Input placeholder="VD: 1" size="large" maxLength={5} />
                                    </Form.Item>
                                    <Form.Item name="MACCHN" label={<span className="font-medium text-slate-600">Số CCHN</span>}>
                                        <Input placeholder="VD: CCHN_123" size="large" />
                                    </Form.Item>
                                    <Form.Item name="NGAYCAP_CCHN" label={<span className="font-medium text-slate-600">Ngày cấp CCHN</span>}>
                                        <Input placeholder="YYYYMMDD" size="large" maxLength={8} className="font-mono text-center tracking-wider" />
                                    </Form.Item>

                                    <Form.Item name="NOICAP_CCHN" label={<span className="font-medium text-slate-600">Nơi cấp CCHN</span>} className="col-span-2">
                                        <Input placeholder="VD: Sở Y Tế TPHCM" size="large" />
                                    </Form.Item>
                                    <Form.Item name="PHAMVI_CM" label={<span className="font-medium text-slate-600">Phạm vi CM</span>}>
                                        <Input placeholder="" size="large" maxLength={15} />
                                    </Form.Item>
                                    <Form.Item name="PHAMVI_CMBS" label={<span className="font-medium text-slate-600">Phạm vi CM Bổ sung</span>}>
                                        <Input placeholder="" size="large" maxLength={50} />
                                    </Form.Item>
                                </div>
                            </div>

                            {/* Panel 3: Phân công & Thời gian đăng ký */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="bg-purple-100 text-purple-600 p-1.5 rounded-lg"><ClockCircleOutlined /></span>
                                    Tổ chức công việc & Thời gian
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-0">
                                    <Form.Item name="THOIGIAN_DK" label={<span className="font-medium text-slate-600">TG Đăng ký</span>}>
                                        <Select placeholder="Chọn..." size="large">
                                            <Select.Option value={1}>1 - Toàn thời gian</Select.Option>
                                            <Select.Option value={2}>2 - Bán thời gian</Select.Option>
                                        </Select>
                                    </Form.Item>
                                    <Form.Item name="THOIGIAN_NGAY" label={<span className="font-medium text-purple-700">TG Bắt đầu - Kt trong ngày</span>} className="col-span-3" tooltip="Ví dụ làm việc 8g đến 12g ghi 0800-1200. Các ngày khác nhau phân cách bởi dấu chấm phẩy">
                                        <Input placeholder="VD: T20800-1500;T30700-1100" size="large" />
                                    </Form.Item>

                                    <Form.Item name="THOIGIAN_TUAN" label={<span className="font-medium text-purple-700">Lịch tuần (Cho Bán TG)</span>} className="col-span-2">
                                        <Input placeholder="VD: T2T3T5" size="large" />
                                    </Form.Item>
                                    <Form.Item name="VB_PHANCONG" label={<span className="font-medium text-slate-600">V.Bản phân công</span>} className="col-span-2">
                                        <Input placeholder="" size="large" maxLength={50} />
                                    </Form.Item>

                                    <Form.Item name="DVKT_KHAC" label={<span className="font-medium text-slate-600">DVKT Khác (Ngoại vi)</span>} className="col-span-4">
                                        <Input.TextArea placeholder="Nhập mã dịch vụ kỹ thuật chuyển giao..." rows={2} />
                                    </Form.Item>

                                    <Form.Item name="TU_NGAY" label={<span className="font-medium text-slate-600">Từ Ngày (YYYYMMDD)</span>}>
                                        <Input placeholder="20240101" maxLength={8} size="large" className="font-mono text-center tracking-widest" />
                                    </Form.Item>
                                    <Form.Item name="DEN_NGAY" label={<span className="font-medium text-slate-600">Đến Ngày (YYYYMMDD)</span>}>
                                        <Input placeholder="20241231" maxLength={8} size="large" className="font-mono text-center tracking-widest" />
                                    </Form.Item>
                                    <Form.Item name="CSKCB_KHAC" label={<span className="font-medium text-orange-600">CSKCB Khác</span>}>
                                        <Input placeholder="Mã CS khác (nếu có)" size="large" maxLength={30} />
                                    </Form.Item>
                                    <Form.Item name="CSKCB_CGKT" label={<span className="font-medium text-orange-600">CS Chuyển Giao KT</span>}>
                                        <Input placeholder="Mã CS giao" size="large" maxLength={5} />
                                    </Form.Item>
                                    <Form.Item name="QD_CGKT" label={<span className="font-medium text-slate-600">QĐ Chuyển Giao KT</span>} className="col-span-4 mt-[-10px]">
                                        <Input placeholder="20240101_1" size="large" maxLength={50} />
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

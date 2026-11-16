'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Popconfirm, message, Upload, Card, Tooltip, Row, Col, Tag, Switch, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined, HeartOutlined, ContainerOutlined, ExperimentOutlined, CloudSyncOutlined, FileExcelOutlined } from '@ant-design/icons';
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
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
    const [machineFilter, setMachineFilter] = useState<'ALL' | 'REQUIRED' | 'NOT_REQUIRED'>('ALL');
    const [sourceFilter, setSourceFilter] = useState<'ALL' | 'BENH_VIEN' | 'BHYT_PORTAL'>('ALL');
    const [syncLoading, setSyncLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [togglingMachineId, setTogglingMachineId] = useState<string | null>(null);
    const { user } = useAuth();

    const handleSyncFromBHYTServer = async () => {
        try {
            setSyncLoading(true);
            const res = await fetch(`${getBasePath()}/api/mau05-catalog/sync-bhyt-machines`, {
                method: 'POST'
            });
            const result = await res.json();
            if (res.ok && result.success) {
                const d = result.data;
                message.success(
                    `Đồng bộ hoàn tất! Thêm mới: ${d.insertedNew}, Cập nhật lịch sử: ${d.updatedOldDisabled}, Bỏ qua (không đổi): ${d.skipped}. Tổng bắt buộc mã máy: ${d.totalBatBuocMaMay}.`,
                    6
                );
                fetchData();
            } else {
                message.error(result.error || 'Đồng bộ thất bại');
            }
        } catch (error) {
            message.error('Lỗi khi đồng bộ từ máy chủ');
        } finally {
            setSyncLoading(false);
        }
    };

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
                form.setFieldsValue({
                    ...editingRecord,
                    bat_buoc_co_ma_may: Boolean(editingRecord.bat_buoc_co_ma_may),
                    isActive: editingRecord.isActive !== false,
                    nguon_du_lieu: editingRecord.nguon_du_lieu || 'BENH_VIEN'
                });
            } else {
                form.resetFields();
                form.setFieldsValue({
                    isActive: true,
                    bat_buoc_co_ma_may: false,
                    nguon_du_lieu: 'BENH_VIEN'
                });
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

    const handleToggleMachine = async (id: string, checked: boolean) => {
        try {
            setTogglingMachineId(id);
            const res = await fetch(`${getBasePath()}/api/mau05-catalog/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bat_buoc_co_ma_may: checked })
            });
            if (res.ok) {
                message.success(checked ? 'Đã bật bắt buộc mã máy' : 'Đã bỏ yêu cầu mã máy');
                setData(prev => prev.map(item => item.id === id ? { ...item, bat_buoc_co_ma_may: checked } : item));
            } else {
                message.error('Cập nhật thất bại');
            }
        } catch (error) {
            message.error('Lỗi hệ thống');
        } finally {
            setTogglingMachineId(null);
        }
    };

    const handleBulkUpdateMachine = async (bat_buoc_co_ma_may: boolean) => {
        if (selectedRowKeys.length === 0) return;
        try {
            setLoading(true);
            const res = await fetch(`${getBasePath()}/api/mau05-catalog/bulk`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedRowKeys, bat_buoc_co_ma_may })
            });
            if (res.ok) {
                message.success(`Đã cập nhật yêu cầu mã máy cho ${selectedRowKeys.length} dòng`);
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
        { 
            title: 'Yêu cầu mã máy', 
            dataIndex: 'bat_buoc_co_ma_may', 
            width: 140, 
            align: 'center' as const,
            render: (val: boolean, record: any) => (
                <Switch 
                    checked={Boolean(val)} 
                    checkedChildren="Bắt buộc" 
                    unCheckedChildren="Không"
                    onChange={(checked) => handleToggleMachine(record.id, checked)}
                    loading={togglingMachineId === record.id}
                    className={val ? 'bg-red-500' : ''}
                />
            )
        },
        { 
            title: 'Nguồn', 
            dataIndex: 'nguon_du_lieu', 
            width: 120, 
            align: 'center' as const,
            render: (src: string) => src === 'BHYT_PORTAL' ? (
                <Tag color="orange">Cổng BHYT</Tag>
            ) : (
                <Tag color="blue">Bệnh viện</Tag>
            )
        },
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

    const activeCount = data.filter(d => d.isActive).length;
    const historyCount = data.filter(d => !d.isActive).length;
    const machineReqCount = data.filter(d => d.isActive && d.bat_buoc_co_ma_may).length;
    const bhytPortalCount = data.filter(d => d.isActive && d.nguon_du_lieu === 'BHYT_PORTAL').length;

    const filteredData = data.filter(item => {
        const matchesSearch = !searchText || (
            (item.TEN_DICH_VU?.toLowerCase().includes(searchText.toLowerCase())) ||
            (item.MA_DICH_VU?.toLowerCase().includes(searchText.toLowerCase())) ||
            (item.TEN_DVKT_GIA?.toLowerCase().includes(searchText.toLowerCase()))
        );
        if (!matchesSearch) return false;

        if (statusFilter === 'ACTIVE' && !item.isActive) return false;
        if (statusFilter === 'INACTIVE' && item.isActive) return false;

        if (machineFilter === 'REQUIRED' && !item.bat_buoc_co_ma_may) return false;
        if (machineFilter === 'NOT_REQUIRED' && item.bat_buoc_co_ma_may) return false;

        if (sourceFilter === 'BENH_VIEN' && item.nguon_du_lieu === 'BHYT_PORTAL') return false;
        if (sourceFilter === 'BHYT_PORTAL' && item.nguon_du_lieu !== 'BHYT_PORTAL') return false;

        return true;
    });

    return (
        <div className="p-6 h-full flex flex-col bg-slate-50 space-y-4">
            {/* KPI Summary Cards */}
            <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                    <Card size="small" className="bg-white border-slate-200 shadow-sm">
                        <div className="text-xs text-slate-500 font-medium">Tổng dịch vụ</div>
                        <div className="text-2xl font-bold text-slate-800">{data.length.toLocaleString()}</div>
                        <div className="text-xs text-slate-400 mt-1">Gồm cả bản ghi lịch sử</div>
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" className="bg-white border-green-200 shadow-sm">
                        <div className="text-xs text-green-600 font-medium">Đang sử dụng</div>
                        <div className="text-2xl font-bold text-green-700">{activeCount.toLocaleString()}</div>
                        <div className="text-xs text-slate-400 mt-1">Lịch sử (ngưng): {historyCount.toLocaleString()}</div>
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" className="bg-white border-red-200 shadow-sm">
                        <div className="text-xs text-red-600 font-medium">Bắt buộc có mã máy</div>
                        <div className="text-2xl font-bold text-red-700">{machineReqCount.toLocaleString()}</div>
                        <div className="text-xs text-slate-400 mt-1">Kiểm soát chặt chẽ XML3</div>
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card size="small" className="bg-white border-amber-200 shadow-sm">
                        <div className="text-xs text-amber-600 font-medium">Bổ sung từ Cổng BHYT</div>
                        <div className="text-2xl font-bold text-amber-700">{bhytPortalCount.toLocaleString()}</div>
                        <div className="text-xs text-slate-400 mt-1">Dịch vụ chuẩn BHYT</div>
                    </Card>
                </Col>
            </Row>

            <Card title={<span className="text-xl font-bold text-slate-700">Danh mục Dịch vụ Khám bệnh, Chữa bệnh (Mẫu 05/DM)</span>} className="flex-1 drop-shadow-sm flex flex-col">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                    <Space wrap>
                        <Input.Search 
                            placeholder="Tìm Mã DV, Tên DV..." 
                            allowClear 
                            onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }} 
                            style={{ width: 240 }} 
                        />
                        <Select 
                            value={statusFilter} 
                            onChange={val => { setStatusFilter(val); setCurrentPage(1); }}
                            style={{ width: 140 }}
                            options={[
                                { label: 'Tất cả trạng thái', value: 'ALL' },
                                { label: 'Đang dùng', value: 'ACTIVE' },
                                { label: 'Lịch sử (ngưng)', value: 'INACTIVE' },
                            ]}
                        />
                        <Select 
                            value={machineFilter} 
                            onChange={val => { setMachineFilter(val); setCurrentPage(1); }}
                            style={{ width: 180 }}
                            options={[
                                { label: 'Tất cả mã máy', value: 'ALL' },
                                { label: 'Bắt buộc có mã máy', value: 'REQUIRED' },
                                { label: 'Không yêu cầu mã máy', value: 'NOT_REQUIRED' },
                            ]}
                        />
                        <Select 
                            value={sourceFilter} 
                            onChange={val => { setSourceFilter(val); setCurrentPage(1); }}
                            style={{ width: 160 }}
                            options={[
                                { label: 'Tất cả nguồn', value: 'ALL' },
                                { label: 'Danh mục Bệnh viện', value: 'BENH_VIEN' },
                                { label: 'Cổng BHYT bổ sung', value: 'BHYT_PORTAL' },
                            ]}
                        />
                    </Space>
                    <Space wrap>
                        <Popconfirm
                            title="Xác nhận đồng bộ từ Server?"
                            description="Hệ thống sẽ đọc file BHYT trên máy chủ: DVKT chưa có sẽ thêm mới, DVKT đã có sẽ cập nhật cờ mã máy và lưu bản cũ vào lịch sử."
                            onConfirm={handleSyncFromBHYTServer}
                            okText="Đồng bộ ngay"
                            cancelText="Hủy"
                        >
                            <Button 
                                type="primary" 
                                icon={<CloudSyncOutlined />} 
                                loading={syncLoading}
                                className="bg-emerald-600 hover:bg-emerald-500 border-none"
                            >
                                Đồng bộ từ Server
                            </Button>
                        </Popconfirm>

                        <Button 
                            type="default" 
                            icon={<DownloadOutlined />} 
                            href={`${getBasePath()}/Mau_Import_DVKT_Bat_Buoc_Ma_May.xlsx`} 
                            download="Mau_Import_DVKT_Bat_Buoc_Ma_May.xlsx"
                            className="border-amber-500 text-amber-600"
                        >
                            Tải mẫu BHYT
                        </Button>

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
                                <Button 
                                    className="bg-red-500 text-white border-none hover:bg-red-600" 
                                    onClick={() => handleBulkUpdateMachine(true)}
                                >
                                    Bắt buộc mã máy ({selectedRowKeys.length})
                                </Button>
                                <Button 
                                    className="bg-slate-500 text-white border-none hover:bg-slate-600" 
                                    onClick={() => handleBulkUpdateMachine(false)}
                                >
                                    Bỏ mã máy ({selectedRowKeys.length})
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

                                    <Col span={6}>
                                        <Form.Item name="bat_buoc_co_ma_may" label="Yêu cầu mã máy" valuePropName="checked">
                                            <Switch checkedChildren="Bắt buộc có mã máy" unCheckedChildren="Không yêu cầu" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item name="nguon_du_lieu" label="Nguồn danh mục">
                                            <Select
                                                size="large"
                                                options={[
                                                    { label: 'Bệnh viện', value: 'BENH_VIEN' },
                                                    { label: 'Cổng BHYT bổ sung', value: 'BHYT_PORTAL' }
                                                ]}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item name="isActive" label="Trạng thái sử dụng" valuePropName="checked">
                                            <Switch checkedChildren="Đang dùng" unCheckedChildren="Lịch sử (ngưng)" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={6}>
                                        <Form.Item name="ngay_hieu_luc_bhyt" label="Ngày hiệu lực BHYT">
                                            <Input size="large" placeholder="10/02/2026" />
                                        </Form.Item>
                                    </Col>
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

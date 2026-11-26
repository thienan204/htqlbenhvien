'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Popconfirm, message, Upload, Card, Tooltip, Row, Col, Switch, Select, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, SyncOutlined, DesktopOutlined, ContainerOutlined, SwapOutlined, DiffOutlined, SettingOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { getBasePath } from '@/utils/config';
import { useAuth } from '@/contexts/AuthContext';
import MachineReconciliationModal from './_components/MachineReconciliationModal';

export default function Mau06CatalogPage() {
    const [data, setData] = useState<any[]>([]);
    const [machineTypes, setMachineTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<any>(null);
    const [selectedMachineForLocation, setSelectedMachineForLocation] = useState<any>(null);
    const [departments, setDepartments] = useState<any[]>([]);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [form] = Form.useForm();
    const [locationForm] = Form.useForm();
    const [searchText, setSearchText] = useState('');
    const [filterDept, setFilterDept] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('ACTIVE');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [isMounted, setIsMounted] = useState(false);
    const { user, hasPermission } = useAuth();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Đọc cấu hình phân quyền xem toàn viện động từ SystemConfig (không fix cứng Role trong code)
            let filterByDept = true;
            let viewAllRoles: string[] = ['ADMIN'];
            try {
                const configRes = await fetch(`${getBasePath()}/api/system-config?module=DANH_MUC_BHYT`);
                if (configRes.ok) {
                    const cfgJson = await configRes.json();
                    const configsList = Array.isArray(cfgJson?.configs) ? cfgJson.configs : [];
                    const filterCfg = configsList.find((c: any) => c.key === 'MAU06_FILTER_BY_DEPARTMENT');
                    const rolesCfg = configsList.find((c: any) => c.key === 'MAU06_VIEW_ALL_ROLES');
                    if (filterCfg) {
                        filterByDept = filterCfg.value === 'true' || filterCfg.value === '1';
                    }
                    if (rolesCfg && typeof rolesCfg.value === 'string') {
                        viewAllRoles = rolesCfg.value.split(',').map((s: string) => s.trim()).filter(Boolean);
                    }
                }
            } catch {
                // Giữ mặc định an toàn nếu chưa lấy được cấu hình
            }

            const canViewAll = user && (
                viewAllRoles.includes(user.role) ||
                hasPermission('MENU_CATALOG_06', 'EDIT')
            );

            let url = `${getBasePath()}/api/mau06-catalog`;
            if (filterByDept && user && !canViewAll && user.ma_khoa) {
                url += `?ma_khoa=${user.ma_khoa}`;
            }

            const [res, typeRes, deptRes] = await Promise.all([
                fetch(url),
                fetch(`${getBasePath()}/api/system-categories?type=LOAI_MAY`),
                fetch(`${getBasePath()}/api/departments`)
            ]);
            
            if (!res.ok) throw new Error('Failed to fetch data');
            const result = await res.json();
            setData(result);
            
            if (typeRes.ok) {
                const types = await typeRes.json();
                setMachineTypes(types);
            }
            if (deptRes.ok) {
                const depts = await deptRes.json();
                setDepartments(depts);
            }
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user?.role, user?.ma_khoa]);

    useEffect(() => {
        if (isModalOpen) {
            if (editingRecord) {
                form.setFieldsValue(editingRecord);
            } else {
                form.resetFields();
            }
        }
    }, [isModalOpen, editingRecord, form]);

    useEffect(() => {
        if (isLocationModalOpen && selectedMachineForLocation) {
            locationForm.resetFields();
            fetch(`${getBasePath()}/api/machine-location?ma_may=${selectedMachineForLocation.MA_MAY}`)
                .then(res => res.ok ? res.json() : [])
                .then(locations => {
                    if (locations && locations.length > 0) {
                        locationForm.setFieldsValue({ ma_khoa: locations[0].ma_khoa });
                    }
                })
                .catch(err => console.error('Error fetching location', err));
        }
    }, [isLocationModalOpen, selectedMachineForLocation, locationForm]);

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        setTogglingId(id);
        try {
            const res = await fetch(`${getBasePath()}/api/mau06-catalog/${id}`, {
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
            const res = await fetch(`${getBasePath()}/api/mau06-catalog/bulk`, {
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

    const handleDeleteBulk = async () => {
        if (selectedRowKeys.length === 0) return;
        try {
            setLoading(true);
            const res = await fetch(`${getBasePath()}/api/mau06-catalog/bulk`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedRowKeys })
            });
            if (res.ok) {
                message.success(`Đã xóa ${selectedRowKeys.length} bản ghi đã chọn`);
                setSelectedRowKeys([]);
                fetchData();
            } else {
                message.error('Xóa thất bại');
            }
        } catch (error) {
            message.error('Lỗi khi xóa');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateMachineType = async (recordId: string, loaiMayCode: string | null) => {
        try {
            const res = await fetch(`${getBasePath()}/api/mau06-catalog/${recordId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ loai_may_code: loaiMayCode })
            });
            if (res.ok) {
                message.success('Đã cập nhật phân loại máy');
                setData(prev => prev.map(item => item.id === recordId ? { ...item, loai_may_code: loaiMayCode } : item));
            } else {
                message.error('Không thể cập nhật phân loại máy');
            }
        } catch (error) {
            message.error('Lỗi khi cập nhật phân loại máy');
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

    const handleSaveLocation = async (values: any) => {
        try {
            const res = await fetch(`${getBasePath()}/api/machine-location`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ma_may: selectedMachineForLocation.MA_MAY, ma_khoa: values.ma_khoa })
            });

            if (res.ok) {
                message.success('Đã phân bổ thiết bị cho khoa');
                setIsLocationModalOpen(false);
            } else {
                message.error('Lỗi khi phân bổ');
            }
        } catch (error) {
            message.error('Lỗi hệ thống');
        }
    };

    const handleOpenLocation = (record: any) => {
        setSelectedMachineForLocation(record);
        setIsLocationModalOpen(true);
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'TEN_TB', 'TEN_BV', 'KY_HIEU', 'CONGTY_SX', 'NUOC_SX', 'NAM_SX', 'NAM_SD',
            'MA_MAY', 'SO_LUU_HANH', 'HD_TU', 'HD_DEN', 'TU_NGAY', 'DEN_NGAY', 'MA_CSKCB', 'loai_may_code'
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        XLSX.utils.book_append_sheet(wb, ws, 'Mau06_DM');
        XLSX.writeFile(wb, 'Mau06_TBYT_Template.xlsx');
    };

    const handleExportData = () => {
        const exportHeaders = [
            'STT', 'MA_MAY', 'TEN_TB', 'TEN_BV', 'KHOA_PHONG',
            'PHAN_LOAI_MAY', 'MA_LOAI_MAY', 'KY_HIEU', 'CONGTY_SX', 'NUOC_SX',
            'NAM_SX', 'NAM_SD', 'SO_LUU_HANH', 'HD_TU', 'HD_DEN', 'TU_NGAY', 'DEN_NGAY', 'MA_CSKCB'
        ];

        // Ưu tiên danh sách đã chọn qua checkbox, nếu không chọn thì lấy danh sách đang lọc trên bảng
        const sourceData = selectedRowKeys.length > 0 
            ? data.filter(item => selectedRowKeys.includes(item.id)) 
            : filteredData;

        if (sourceData.length === 0) {
            message.warning('Không có dữ liệu để xuất!');
            return;
        }

        const exportRows = sourceData.map((item, index) => {
            const matchedType = machineTypes.find(t => t.code === item.loai_may_code);
            return [
                index + 1,
                item.MA_MAY || '',
                item.TEN_TB || '',
                item.TEN_BV || '',
                item.ten_khoa_su_dung || '',
                matchedType ? matchedType.name : (item.loai_may_code || ''),
                item.loai_may_code || '',
                item.KY_HIEU || '',
                item.CONGTY_SX || '',
                item.NUOC_SX || '',
                item.NAM_SX ?? '',
                item.NAM_SD ?? '',
                item.SO_LUU_HANH || '',
                item.HD_TU || '',
                item.HD_DEN || '',
                item.TU_NGAY || '',
                item.DEN_NGAY || '',
                item.MA_CSKCB || ''
            ];
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
        XLSX.utils.book_append_sheet(wb, ws, 'Mau06_DM_Export');
        const fileName = `Mau06_TBYT_Export_${selectedRowKeys.length > 0 ? 'DaChon_' : ''}${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
        message.success(`Đã xuất Excel thành công (${sourceData.length} thiết bị)!`);
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
                    if (result.skipped !== undefined) {
                        message.success(`Import hoàn tất! Thêm mới: ${result.count || 0}, Cập nhật: ${result.updatedCount || 0}, Giữ nguyên: ${result.skipped || 0}.`, 5);
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
        { title: 'Mã Máy', dataIndex: 'MA_MAY', width: 150 },
        { title: 'Tên Thiết Bị', dataIndex: 'TEN_TB', width: 250 },
        { title: 'Tên Bệnh viện', dataIndex: 'TEN_BV', width: 250 },
        { 
            title: 'Khoa phòng sử dụng', 
            key: 'ten_khoa_su_dung',
            width: 200,
            render: (_: any, record: any) => {
                if (record.ten_khoa_su_dung) {
                    return <span className="text-teal-700 font-medium">{record.ten_khoa_su_dung}</span>;
                }
                return <span className="text-slate-400 italic">Chưa phân bổ</span>;
            }
        },
        { 
            title: 'Phân loại (Loại máy)', 
            dataIndex: 'loai_may_code', 
            width: 230,
            render: (code: string, record: any) => (
                <Select
                    size="small"
                    showSearch
                    allowClear
                    placeholder="-- Chọn loại máy --"
                    value={code || undefined}
                    className="w-full"
                    onChange={(newCode) => handleUpdateMachineType(record.id, newCode || null)}
                    filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={machineTypes.map(t => ({ value: t.code, label: t.name }))}
                />
            )
        },
        { title: 'Model (Ký hiệu)', dataIndex: 'KY_HIEU', width: 150 },
        { title: 'Công ty SX', dataIndex: 'CONGTY_SX', width: 200 },
        { title: 'Nước SX', dataIndex: 'NUOC_SX', width: 120 },
        { title: 'Năm SX', dataIndex: 'NAM_SX', width: 100, align: 'center' as const },
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
            width: 150,
            align: 'center' as const,
            fixed: 'right' as const,
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Tooltip title="Sửa"><Button type="text" icon={<EditOutlined className="text-blue-500" />} onClick={() => handleEdit(record)} /></Tooltip>
                    <Tooltip title="Phân bổ Khoa"><Button type="text" icon={<SwapOutlined className="text-teal-600" />} onClick={() => handleOpenLocation(record)} /></Tooltip>
                    <Popconfirm title="Xác nhận xóa?" onConfirm={() => handleDelete(record.id)} okText="Có" cancelText="Không">
                        <Tooltip title="Xóa"><Button type="text" icon={<DeleteOutlined className="text-red-500" />} /></Tooltip>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const uniqueDepartments = Array.from(new Set(data.map(item => item.ten_khoa_su_dung))).filter(Boolean);

    const filteredData = data.filter(item => {
        const matchText = (item.TEN_TB?.toLowerCase().includes(searchText.toLowerCase())) ||
                          (item.MA_MAY?.toLowerCase().includes(searchText.toLowerCase())) ||
                          (item.KY_HIEU?.toLowerCase().includes(searchText.toLowerCase())) ||
                          (item.TEN_BV?.toLowerCase().includes(searchText.toLowerCase()));
        
        const matchDept = filterDept ? item.ten_khoa_su_dung === filterDept : true;
        
        const matchStatus = activeTab === 'ACTIVE' ? item.isActive === true : item.isActive === false;
        
        return matchText && matchDept && matchStatus;
    });

    return (
        <div className="p-6 h-full w-full min-w-0 flex flex-col bg-slate-50 space-y-4 overflow-x-hidden">
            <div className="flex flex-wrap justify-between items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-800 m-0">Danh mục Thiết bị Y tế (Mẫu 06/DM)</h1>
                {isMounted && user?.role === 'ADMIN' && (
                    <Tooltip title="Tùy chỉnh cấu hình danh sách Role được xem toàn bộ thiết bị (không bị lọc theo khoa)">
                        <Link href="/system-config">
                            <Button icon={<SettingOutlined />} size="small" className="text-slate-600 border-slate-300">
                                Cấu hình phân quyền xem
                            </Button>
                        </Link>
                    </Tooltip>
                )}
            </div>

            <Tabs 
                type="card"
                activeKey={activeTab}
                onChange={(key) => { setActiveTab(key); setCurrentPage(1); }}
                items={[
                    { key: 'ACTIVE', label: 'Đang sử dụng' },
                    { key: 'INACTIVE', label: 'Lịch sử (Không sử dụng)' }
                ]}
                className="mb-[-16px]"
            />

            <Card className="flex-1 min-w-0 drop-shadow-sm flex flex-col border-slate-200">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                    <Space wrap>
                        <Input.Search placeholder="Tìm Tên TB, Mã máy, Model, Tên BV..." allowClear onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }} style={{ width: 260 }} />
                        <Select
                            placeholder="Lọc Khoa/Phòng"
                            allowClear
                            showSearch
                            className="min-w-[180px]"
                            value={filterDept}
                            onChange={(value) => { setFilterDept(value); setCurrentPage(1); }}
                            options={uniqueDepartments.map(dept => ({ label: String(dept), value: String(dept) }))}
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
                    <Space wrap>
                        <Button
                            icon={<DiffOutlined />}
                            onClick={() => setIsReconciliationModalOpen(true)}
                            style={{ backgroundColor: '#4f46e5', color: 'white', border: 'none' }}
                            className="font-semibold hover:opacity-90 shadow-sm"
                            title="Đối soát danh mục thiết bị trong Database với file Cổng BHXH và file HIS"
                        >
                            Đối soát Cổng - HIS
                        </Button>
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleExportData} className="border-indigo-500 text-indigo-600 font-medium">Export Dữ liệu</Button>
                        {selectedRowKeys.length > 0 ? (
                            <Popconfirm 
                                title={`Xác nhận xóa ${selectedRowKeys.length} thiết bị đã chọn?`}
                                description="Hành động này sẽ xóa vĩnh viễn các dòng đã chọn theo checkbox và không thể hoàn tác."
                                onConfirm={handleDeleteBulk} 
                                okText="Có, Xóa" 
                                cancelText="Không"
                                okButtonProps={{ danger: true }}
                            >
                                <Button danger type="primary" icon={<DeleteOutlined />}>
                                    Xóa đã chọn ({selectedRowKeys.length})
                                </Button>
                            </Popconfirm>
                        ) : (
                            isMounted && user?.role === 'ADMIN' && (
                                <Popconfirm 
                                    title="Xác nhận xóa TOÀN BỘ dữ liệu?" 
                                    description="Hành động này sẽ xóa sạch danh mục và không thể hoàn tác. Bạn có chắc chắn không?"
                                    onConfirm={handleDeleteAll} 
                                    okText="Có, Xóa hết" 
                                    cancelText="Không"
                                    okButtonProps={{ danger: true }}
                                >
                                    <Button danger type="primary" icon={<DeleteOutlined />}>
                                        Xóa toàn bộ
                                    </Button>
                                </Popconfirm>
                            )
                        )}
                        <Button type="default" icon={<DownloadOutlined />} onClick={handleDownloadTemplate} className="border-green-500 text-green-600">Tải file mẫu</Button>
                        <Upload beforeUpload={(file) => handleImportExcel({ file })} showUploadList={false} accept=".xlsx, .xls">
                            <Button type="default" icon={<UploadOutlined />} className="bg-blue-50 border-blue-200 text-blue-700">Import Excel</Button>
                        </Upload>
                        <Button type="primary" className="bg-teal-600 hover:bg-teal-700" icon={<PlusOutlined />} onClick={handleAdd}>Thêm Máy Mới</Button>
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
                                    <Col span={8}><Form.Item name="TEN_TB" label="Tên Thiết bị"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}>
                                        <Form.Item name="loai_may_code" label="Phân loại (Loại máy)">
                                            <Select size="large" allowClear placeholder="Chọn loại máy..." showSearch optionFilterProp="children">
                                                {machineTypes.map(t => (
                                                    <Select.Option key={t.code} value={t.code}>{t.name}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}><Form.Item name="TEN_BV" label="Tên Bệnh viện"><Input size="large" /></Form.Item></Col>

                                    <Col span={6}><Form.Item name="KY_HIEU" label="Ký hiệu (Model)"><Input size="large" /></Form.Item></Col>
                                    <Col span={6}><Form.Item name="MA_MAY" label="Mã máy"><Input size="large" className="font-mono text-teal-600 font-bold" /></Form.Item></Col>
                                    <Col span={12}><Form.Item name="CONGTY_SX" label="Công ty Sản xuất"><Input size="large" /></Form.Item></Col>

                                    <Col span={8}><Form.Item name="NUOC_SX" label="Nước sản xuất"><Input size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="NAM_SX" label="Năm SX"><InputNumber className="w-full" size="large" /></Form.Item></Col>
                                    <Col span={8}><Form.Item name="NAM_SD" label="Năm Sử dụng"><InputNumber className="w-full" size="large" /></Form.Item></Col>
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
                <Modal
                    title={<span className="text-lg font-bold text-teal-700">Điều chuyển Thiết bị Y tế</span>}
                    open={isLocationModalOpen}
                    onCancel={() => setIsLocationModalOpen(false)}
                    onOk={() => locationForm.submit()}
                    width={500}
                >
                    {selectedMachineForLocation && (
                        <div className="mb-4 p-3 bg-teal-50 rounded border border-teal-100">
                            <div><strong>Tên máy:</strong> {selectedMachineForLocation.TEN_TB}</div>
                            <div><strong>Mã máy:</strong> {selectedMachineForLocation.MA_MAY}</div>
                            <div><strong>Model:</strong> {selectedMachineForLocation.KY_HIEU}</div>
                        </div>
                    )}
                    <Form form={locationForm} layout="vertical" onFinish={handleSaveLocation}>
                        <Form.Item 
                            name="ma_khoa" 
                            label="Khoa đang sử dụng" 
                            rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
                        >
                            <Select size="large" showSearch optionFilterProp="children" placeholder="-- Chọn khoa phân bổ --">
                                {departments.filter(d => d.ma_khoa).map((d, index) => (
                                    <Select.Option key={d.ma_khoa || index} value={d.ma_khoa}>{d.ten_khoa}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Form>
                </Modal>
                <MachineReconciliationModal
                    isOpen={isReconciliationModalOpen}
                    onClose={() => setIsReconciliationModalOpen(false)}
                    dbMachines={data}
                />
            </Card>
        </div>
    );
}

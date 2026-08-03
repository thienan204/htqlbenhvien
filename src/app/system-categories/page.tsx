'use client';
// Force Next.js recompilation
import React, { useState, useEffect } from 'react';
import { Layout, Menu, Table, Button, Card, Space, Tag, Popconfirm, message, Upload, Dropdown } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, TagsOutlined, PartitionOutlined, UserOutlined, IdcardOutlined, BookOutlined, UploadOutlined, DownloadOutlined, DownOutlined } from '@ant-design/icons';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';
import * as XLSX from 'xlsx';

const { Sider, Content } = Layout;

const HARDCODED_TYPES = [
    { key: 'PROVINCE', label: 'Danh mục Tỉnh/Thành phố', icon: <PartitionOutlined /> },
    { key: 'WARD', label: 'Danh mục Xã/Phường', icon: <PartitionOutlined /> },
    { key: 'LOAI_HOP_DONG', label: 'Loại Hợp đồng', icon: <BookOutlined /> },
    { key: 'VI_TRI_VIEC_LAM', label: 'Vị trí Việc làm', icon: <PartitionOutlined /> },
    { key: 'TRINH_DO', label: 'Trình độ Chuyên môn', icon: <BookOutlined /> },
    { key: 'CHUC_DANH', label: 'Chức danh Nghề nghiệp', icon: <TagsOutlined /> },
    { key: 'CHUC_VU', label: 'Chức vụ', icon: <IdcardOutlined /> },
    { key: 'GENDER', label: 'Giới tính', icon: <UserOutlined /> },
    { key: 'DAN_TOC', label: 'Dân tộc', icon: <UserOutlined /> },
    { key: 'NOI_CAP_CCHN', label: 'Nơi cấp CCHN', icon: <IdcardOutlined /> },
    { key: 'VI_TRI_BHYT', label: 'Vị trí chuyên môn BHYT', icon: <IdcardOutlined /> },
    { key: 'DEPARTMENT_TYPE', label: 'Phân loại Khoa Phòng', icon: <PartitionOutlined /> },
    { key: 'DANH_MUC_THIET_BI', label: 'Phân loại Thiết bị', icon: <TagsOutlined /> },
    { key: 'NHOM_THIET_BI', label: 'Nhóm Thiết bị', icon: <PartitionOutlined /> },
    { key: 'LOAI_THIET_BI', label: 'Loại Thiết bị', icon: <BookOutlined /> },
    { key: 'TEN_THIET_BI', label: 'Tên Thiết bị', icon: <TagsOutlined /> },
    { key: 'NHA_CUNG_CAP', label: 'Nhà cung cấp / Đơn vị', icon: <BookOutlined /> },
    { key: 'HANG_SAN_XUAT', label: 'Hãng sản xuất', icon: <BookOutlined /> },
    { key: 'NGUON_KINH_PHI', label: 'Nguồn kinh phí', icon: <BookOutlined /> },
    { key: 'NHOM_DICH_VU', label: 'Nhóm Dịch vụ (Mẫu 05)', icon: <TagsOutlined /> },
    { key: 'PHUONG_PHAP_VO_CAM', label: 'Phương pháp vô cảm', icon: <TagsOutlined /> },
];

export default function SystemCategoriesPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [provinces, setProvinces] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedType, setSelectedType] = useState('PROVINCE');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [customTypes, setCustomTypes] = useState<any[]>([]);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);

    const handleDeleteGroup = async (id: string) => {
        try {
            const res = await fetch(`/api/system-categories?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Xóa nhóm danh mục thành công');
                fetchCustomTypes();
                // Nếu nhóm bị xóa đang được chọn, chuyển về LOAI_HOP_DONG
                setSelectedType(prev => {
                    // Cần fetch lại hoặc xử lý sau, tạm thời cứ giữ hoặc chuyển về mặc định
                    return 'LOAI_HOP_DONG';
                });
            } else {
                const err = await res.json();
                message.error(err.error || 'Không thể xóa nhóm này');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const fetchCustomTypes = async () => {
        try {
            const res = await fetch(`/api/system-categories?type=CATEGORY_GROUP`);
            if (res.ok) {
                const data = await res.json();
                setCustomTypes(data.map((item: any) => ({
                    key: item.code,
                    label: (
                        <div className="flex justify-between items-center group w-full pr-2">
                            <span>{item.name}</span>
                            <Popconfirm 
                                title="Xóa nhóm này?" 
                                onConfirm={(e) => { 
                                    e?.stopPropagation(); 
                                    handleDeleteGroup(item.id); 
                                }}
                                onCancel={(e) => e?.stopPropagation()}
                                okText="Xóa" 
                                cancelText="Hủy"
                            >
                                <DeleteOutlined 
                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity" 
                                    onClick={(e) => e.stopPropagation()} 
                                />
                            </Popconfirm>
                        </div>
                    ),
                    icon: <TagsOutlined />,
                    title: item.name // Set title for tooltip/display
                })));
            }
        } catch (error) {
            console.error('Lỗi tải nhóm danh mục', error);
        }
    };

    useEffect(() => {
        fetchCustomTypes();
    }, []);

    const fetchCategories = async (type: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/system-categories?type=${type}`);
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            }
        } catch (error) {
            message.error('Lỗi tải danh mục');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories(selectedType);
        
        if (selectedType === 'WARD') {
            fetch('/api/system-categories?type=PROVINCE')
                .then(res => res.json())
                .then(data => setProvinces(data))
                .catch(() => message.error('Lỗi tải danh sách Tỉnh/Thành'));
        }
    }, [selectedType]);

    const openModal = (item: any = null) => {
        if (item) {
            setSelectedItem(item);
        } else {
            setSelectedItem({ type: selectedType, isActive: true, order: 0 });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (values: any) => {
        const isUpdate = !!selectedItem?.id;
        const method = isUpdate ? 'PUT' : 'POST';
        
        let code = values.code || selectedItem?.code;
        if (!code && values.name) {
            code = values.name
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .replace(/^_|_$/g, '');
        }
        
        const payload = { ...values, code, id: selectedItem?.id, type: selectedType };

        try {
            const res = await fetch('/api/system-categories', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success(`${isUpdate ? 'Cập nhật' : 'Thêm'} danh mục thành công`);
                setIsModalOpen(false);
                fetchCategories(selectedType);
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi lưu danh mục');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/system-categories?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Xóa danh mục thành công');
                fetchCategories(selectedType);
            } else {
                const err = await res.json();
                message.error(err.error || 'Không thể xóa danh mục đang sử dụng');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleFileUpload = (file: File) => {
        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (jsonData.length <= 1) {
                    message.error('File không có dữ liệu');
                    setLoading(false);
                    return;
                }

                const headers: any = jsonData[0];
                // Tìm vị trí các cột dựa trên tên trong DB (code, name, description, order)
                const nameIndex = headers.findIndex((h: string) => typeof h === 'string' && h.trim().toLowerCase() === 'name');
                const codeIndex = headers.findIndex((h: string) => typeof h === 'string' && h.trim().toLowerCase() === 'code');
                const descIndex = headers.findIndex((h: string) => typeof h === 'string' && h.trim().toLowerCase() === 'description');
                const orderIndex = headers.findIndex((h: string) => typeof h === 'string' && h.trim().toLowerCase() === 'order');

                if (nameIndex === -1) {
                    message.error('File Excel cần có ít nhất cột "name" (Tên hiển thị)');
                    setLoading(false);
                    return;
                }

                const payload = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const row: any = jsonData[i];
                    if (!row[nameIndex]) continue; // Skip empty rows
                    
                    const name = String(row[nameIndex]).trim();
                    let code = codeIndex !== -1 && row[codeIndex] ? String(row[codeIndex]).trim() : '';
                    
                    // Auto-generate code if missing
                    if (!code) {
                        code = name
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, '_')
                            .replace(/_+/g, '_')
                            .replace(/^_|_$/g, '');
                    }

                    payload.push({
                        type: selectedType,
                        name,
                        code,
                        description: descIndex !== -1 && row[descIndex] ? String(row[descIndex]) : '',
                        order: orderIndex !== -1 && row[orderIndex] ? Number(row[orderIndex]) : 0,
                        isActive: true
                    });
                }

                if (payload.length === 0) {
                    message.warning('Không tìm thấy dữ liệu hợp lệ trong file');
                    setLoading(false);
                    return;
                }

                const res = await fetch('/api/system-categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const result = await res.json();
                    message.success(`Đã import thành công ${result.count || payload.length} danh mục`);
                    fetchCategories(selectedType);
                } else {
                    const err = await res.json();
                    message.error(err.error || 'Lỗi khi import dữ liệu');
                }
            } catch (error) {
                console.error(error);
                message.error('File không đúng định dạng hoặc bị lỗi');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
        return false; // Ngăn không cho Upload component tự động gửi request
    };

    const downloadSampleFile = () => {
        // Tạo dữ liệu mẫu
        const wsData = [
            ['code', 'name', 'description', 'order'], // Header match database
            ['', 'Dữ liệu mẫu 1', 'Đây là ghi chú 1', 1],
            ['MA_02', 'Dữ liệu mẫu 2', 'Có sẵn mã code', 2],
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Chỉnh độ rộng cột
        ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 40 }, { wch: 10 }];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sample');
        XLSX.writeFile(wb, `Mau_Import_Danh_Muc.xlsx`);
    };

    const allTypes: any[] = [...HARDCODED_TYPES];
    customTypes.forEach(ct => {
        if (!allTypes.find(t => t.key === ct.key)) {
            allTypes.push(ct);
        }
    });
    const currentTypeLabel = allTypes.find(t => t.key === selectedType)?.title || allTypes.find(t => t.key === selectedType)?.label;

    const columns = [
        {
            title: 'Mã (Code)',
            dataIndex: 'code',
            key: 'code',
            render: (text: string) => <span className="font-semibold text-slate-600">{text}</span>
        },
        {
            title: 'Tên hiển thị',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: any) => (
                <div className="flex flex-col">
                    <span className="font-bold text-blue-600">{text}</span>
                    {record.parent && (
                        <span className="text-xs text-slate-500 mt-1">
                            Thuộc: {record.parent.name}
                        </span>
                    )}
                </div>
            )
        },
        {
            title: 'Mô tả',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Mã BHYT',
            dataIndex: 'bhyt_code',
            key: 'bhyt_code',
            render: (text: string) => text ? <Tag color="blue">{text}</Tag> : null
        },
        {
            title: 'Sắp xếp',
            dataIndex: 'order',
            key: 'order',
        },
        {
            title: 'Trạng thái',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (active: boolean) => active ? <Tag color="success">Hoạt động</Tag> : <Tag color="default">Đã ẩn</Tag>
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Button size="small" type="primary" ghost icon={<EditOutlined />} onClick={() => openModal(record)} />
                    <Popconfirm title="Bạn có chắc muốn xóa?" onConfirm={() => handleDelete(record.id)} okText="Xóa" cancelText="Hủy">
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="w-full h-full p-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl">
                        <TagsOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Danh mục Hệ thống</h1>
                        <p className="text-slate-500 m-0">Quản lý tập trung các lựa chọn (Dropdown) trong toàn hệ thống.</p>
                    </div>
                </div>
            </div>

            <Layout className="bg-transparent gap-6">
                <Sider width={280} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100" style={{ background: '#fff' }}>
                    <div className="p-4 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700">
                        Loại Danh mục
                    </div>
                    <Menu
                        mode="inline"
                        selectedKeys={[selectedType]}
                        onClick={(e) => setSelectedType(e.key)}
                        items={allTypes}
                        className="border-none"
                    />
                    <div className="p-4 border-t border-slate-100">
                        <Button type="dashed" block icon={<PlusOutlined />} onClick={() => setIsGroupModalOpen(true)}>
                            Thêm Nhóm Danh Mục
                        </Button>
                    </div>
                </Sider>
                <Content>
                    <Card 
                        title={<span className="text-lg font-bold">Danh sách: {currentTypeLabel}</span>}
                        extra={
                            <Space>
                                <Button icon={<DownloadOutlined />} onClick={downloadSampleFile}>
                                    Tải file mẫu
                                </Button>
                                <Upload beforeUpload={handleFileUpload} showUploadList={false} accept=".xlsx, .xls, .csv">
                                    <Button icon={<UploadOutlined />} loading={loading}>
                                        Import
                                    </Button>
                                </Upload>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                                    Thêm {currentTypeLabel}
                                </Button>
                            </Space>
                        }
                        className="shadow-sm rounded-2xl border-slate-100"
                        styles={{ body: { padding: 0 } }}
                    >
                        <Table 
                            dataSource={categories} 
                            columns={columns} 
                            rowKey="id" 
                            loading={loading}
                            pagination={false}
                        />
                    </Card>
                </Content>
            </Layout>

            <DynamicForm
                formId="system_category_form"
                title={selectedItem?.id ? `Sửa ${currentTypeLabel}` : `Thêm ${currentTypeLabel}`}
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSave}
                initialData={selectedItem}
                fieldsConfig={[
                    { 
                        id: 'code', 
                        label: 'Mã (Code - Bắt buộc cho Nhóm Dịch vụ, để trống sẽ tự tạo)', 
                        type: 'input', 
                        span: 24
                    },
                    { id: 'name', label: 'Tên hiển thị', type: 'input', required: true, span: 24 },
                    ...(selectedType === 'WARD' ? [{
                        id: 'parentId',
                        label: 'Thuộc Tỉnh / Thành phố',
                        type: 'select' as const,
                        options: provinces.map(p => ({ value: p.id, label: p.name })),
                        required: true,
                        span: 24
                    }] : []),
                    { id: 'bhyt_code', label: 'Mã BHYT chuẩn (Tùy chọn, điền số 1, 2, 3...)', type: 'input', span: 24 },
                    { id: 'description', label: 'Ghi chú (Tùy chọn)', type: 'textarea', span: 24 },
                    { id: 'order', label: 'Thứ tự sắp xếp', type: 'number', span: 12 },
                    { id: 'isActive', label: 'Trạng thái hoạt động', type: 'switch', span: 12, valuePropName: 'checked' }
                ]}
            />

            <DynamicForm
                formId="system_category_group_form"
                title="Thêm Nhóm Danh mục Mới"
                open={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                onSubmit={async (values) => {
                    let code = values.code;
                    if (!code && values.name) {
                        code = values.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
                    }
                    const payload = { ...values, code, type: 'CATEGORY_GROUP', isActive: true, order: 0 };
                    try {
                        const res = await fetch('/api/system-categories', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        if (res.ok) {
                            message.success('Thêm nhóm danh mục thành công');
                            setIsGroupModalOpen(false);
                            fetchCustomTypes();
                        } else {
                            const err = await res.json();
                            message.error(err.error || 'Lỗi lưu nhóm danh mục');
                        }
                    } catch (error) {
                        message.error('Lỗi kết nối');
                    }
                }}
                fieldsConfig={[
                    { id: 'name', label: 'Tên Nhóm Danh mục', type: 'input', required: true, span: 24 },
                    { id: 'code', label: 'Mã Nhóm (Tự động tạo nếu để trống, viết hoa không dấu)', type: 'input', span: 24 },
                    { id: 'description', label: 'Ghi chú', type: 'textarea', span: 24 },
                ]}
            />
        </div>
    );
}

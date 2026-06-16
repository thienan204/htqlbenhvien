'use client';

import React, { useState, useEffect } from 'react';
import { Form, Button, Card, message, Space, Typography, Table, Tag } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';

const { Title } = Typography;

export default function CreateExportVoucherPage() {
    const [masterForm] = Form.useForm();
    const [detailForm] = Form.useForm();
    const router = useRouter();
    
    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [equipments, setEquipments] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [detailsList, setDetailsList] = useState<any[]>([]);
    const [subType, setSubType] = useState('XUAT_CHUYEN_KHO');
    const [fromWarehouse, setFromWarehouse] = useState<string | null>(null);

    useEffect(() => {
        fetchDependencies();
        masterForm.setFieldsValue({
            voucher_code: `PX-${Date.now()}`,
            sub_type: 'XUAT_CHUYEN_KHO'
        });
        detailForm.setFieldsValue({ quantity: 1 });
    }, []);

    const fetchDependencies = async () => {
        try {
            const [whRes, supRes] = await Promise.all([
                fetch('/api/warehouses'),
                fetch('/api/system-categories?type=NHA_CUNG_CAP'),
            ]);
            
            if (whRes.ok) setWarehouses(await whRes.json());
            
            if (supRes.ok) {
                const sups = await supRes.json();
                setSuppliers(sups.map((s: any) => ({ value: s.name, label: s.name })));
            }
        } catch (error) {
            message.error('Lỗi tải danh mục');
        }
    };

    const fetchEquipments = async (warehouse_id: string) => {
        try {
            // Cần API /api/equipments?warehouse_id=... nhưng tạm mock
            // TODO: Fetch real equipments based on warehouse_id
            // For now we will just use a generic fetch if it exists, or let user type.
            // Ideally: fetch(`/api/equipments?warehouse_id=${warehouse_id}&status=TRONG_KHO`)
        } catch (error) {}
    }

    const handleMasterChange = (changedValues: any, allValues: any) => {
        if (changedValues.sub_type) {
            setSubType(changedValues.sub_type);
        }
        if (changedValues.from_warehouse_id) {
            setFromWarehouse(changedValues.from_warehouse_id);
            fetchEquipments(changedValues.from_warehouse_id);
            // Reset details when changing source warehouse
            setDetailsList([]);
        }
    };

    const handleAddDetail = async () => {
        try {
            const values = await detailForm.validateFields();
            
            setDetailsList([...detailsList, {
                ...values,
                key: Date.now().toString(),
            }]);
            
            detailForm.resetFields();
            detailForm.setFieldsValue({ quantity: 1 });
            message.success('Đã thêm vào danh sách xuất');
        } catch (error) {
            // Form validation failed
        }
    };

    const handleRemoveDetail = (key: string) => {
        setDetailsList(detailsList.filter(item => item.key !== key));
    };

    const onFinishMaster = async (masterValues: any, status: 'PENDING' | 'APPROVED') => {
        try {
            if (detailsList.length === 0) {
                message.error('Vui lòng thêm ít nhất một thiết bị/vật tư vào danh sách xuất');
                return;
            }

            if (masterValues.sub_type === 'XUAT_CHUYEN_KHO' && !masterValues.to_warehouse_id) {
                message.error('Vui lòng chọn Kho nhận');
                return;
            }
            
            if (masterValues.sub_type === 'XUAT_TRA_NCC' && !masterValues.supplier_name) {
                message.error('Vui lòng chọn Nhà cung cấp');
                return;
            }

            setLoading(true);
            const payload = {
                ...masterValues,
                type: 'XUAT_KHO',
                document_date: masterValues.document_date ? masterValues.document_date.toISOString() : null,
                created_by: 'Admin',
                details: detailsList,
                status: status
            };

            const res = await fetch('/api/inventory-vouchers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success(status === 'APPROVED' ? 'Đã duyệt Phiếu Xuất Kho thành công!' : 'Đã lưu nháp Phiếu Xuất Kho!');
                router.push('/equipment-management/export-vouchers'); // Adjust route as needed
            } else {
                const err = await res.json();
                message.error(err.error || 'Có lỗi xảy ra khi lưu phiếu');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const masterFields: FieldConfig[] = [
        { id: 'voucher_code', label: 'Mã phiếu xuất', type: 'input', span: 6, required: true },
        { 
            id: 'sub_type', 
            label: 'Loại Xuất Kho', 
            type: 'select', 
            span: 6, 
            required: true, 
            options: [
                {value: 'XUAT_CHUYEN_KHO', label: 'Xuất Chuyển Kho'}, 
                {value: 'XUAT_SU_DUNG', label: 'Xuất Sử Dụng (Cho Khoa)'},
                {value: 'XUAT_TRA_NCC', label: 'Xuất Trả Nhà Cung Cấp'}
            ] 
        },
        { id: 'from_warehouse_id', label: 'Kho xuất (Từ kho)', type: 'select', span: 6, required: true, options: warehouses.map(w => ({ value: w.id, label: w.name })) },
        
        ...(subType === 'XUAT_CHUYEN_KHO' || subType === 'XUAT_SU_DUNG' ? [{ 
            id: 'to_warehouse_id', 
            label: subType === 'XUAT_SU_DUNG' ? 'Khoa phòng nhận (Kho)' : 'Kho nhận', 
            type: 'select', 
            span: 6, 
            required: subType === 'XUAT_CHUYEN_KHO', 
            options: warehouses.map(w => ({ value: w.id, label: w.name })) 
        } as FieldConfig] : []),

        ...(subType === 'XUAT_TRA_NCC' ? [{ 
            id: 'supplier_name', 
            label: 'Nhà cung cấp nhận', 
            type: 'autocomplete', 
            span: 6, 
            required: true,
            options: suppliers 
        } as FieldConfig] : []),

        { id: 'document_date', label: 'Ngày xuất', type: 'date', span: 6 },
        { id: 'deliverer_name', label: 'Người nhận hàng', type: 'input', span: 6 },
    ];

    const detailFields: FieldConfig[] = [
        { id: 'equipment_id', label: 'Mã ID Thiết bị/Vật tư', type: 'input', span: 6, required: true, placeholder: 'Nhập ID hoặc quét mã vạch' },
        { id: 'ten_vttb', label: 'Tên Thiết bị / Vật tư (*)', type: 'input', span: 6, required: true },
        { id: 'quantity', label: 'Số lượng xuất (*)', type: 'number', span: 6, required: true },
    ];

    const columns = [
        { title: 'Mã ID', dataIndex: 'equipment_id', key: 'equipment_id' },
        { title: 'Tên Thiết bị', dataIndex: 'ten_vttb', key: 'ten_vttb' },
        { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity' },
        { title: 'Thao tác', key: 'action', render: (_: any, record: any) => <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemoveDetail(record.key)} /> }
    ];

    const [submitStatus, setSubmitStatus] = useState<'PENDING' | 'APPROVED'>('PENDING');

    const handleFormSubmit = async (values: any) => {
        await onFinishMaster(values, submitStatus);
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>Quay lại</Button>
                    <Title level={3} className="!mb-0 text-slate-800">Lập Phiếu Xuất Kho</Title>
                </Space>
                <Space>
                    <Button type="default" icon={<SaveOutlined />} onClick={() => { setSubmitStatus('PENDING'); masterForm.submit(); }} loading={loading} size="large" className="border-orange-600 text-orange-600 font-medium">
                        Lưu Phiếu (Lưu Nháp)
                    </Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={() => { setSubmitStatus('APPROVED'); masterForm.submit(); }} loading={loading} size="large" className="bg-orange-600 font-medium">
                        Lưu & Duyệt Xuất Kho
                    </Button>
                </Space>
            </div>

            <DynamicForm 
                formId="export_voucher_master"
                title={<span className="text-orange-700 uppercase">1. Thông tin chứng từ xuất</span>}
                open={true}
                onClose={() => {}}
                onSubmit={handleFormSubmit}
                fieldsConfig={masterFields}
                mode="inline"
                hideFooter={true}
                formInstance={masterForm}
                onValuesChange={handleMasterChange}
            />

            <DynamicForm 
                formId="export_voucher_detail"
                title={<span className="text-orange-700 uppercase">2. Thêm Thiết bị / Vật tư để xuất</span>}
                open={true}
                onClose={() => {}}
                onSubmit={handleAddDetail}
                fieldsConfig={detailFields}
                mode="inline"
                hideFooter={true}
                formInstance={detailForm}
                initialData={{ quantity: 1 }}
            />
            
            <div className="flex justify-center -mt-2 mb-6 relative z-10">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => detailForm.submit()} size="large" className="bg-green-600 w-1/4 shadow-md">
                    Thêm vào danh sách xuất
                </Button>
            </div>

            <Card title={<span className="text-orange-700 font-bold uppercase">3. Danh sách xuất</span>} className="shadow-sm border-orange-200">
                <Table 
                    dataSource={detailsList} 
                    columns={columns} 
                    pagination={false}
                    locale={{ emptyText: 'Chưa có thiết bị nào' }}
                />
            </Card>
        </div>
    );
}

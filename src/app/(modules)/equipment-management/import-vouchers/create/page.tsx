'use client';

import React, { useState, useEffect } from 'react';
import { Form, Button, Card, message, Space, Typography, Table, Tag } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';

const { Title } = Typography;

export default function CreateImportVoucherPage() {
    const [masterForm] = Form.useForm();
    const [detailForm] = Form.useForm();
    const router = useRouter();
    
    const [loading, setLoading] = useState(false);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [manufacturers, setManufacturers] = useState<any[]>([]);
    const [fundingSources, setFundingSources] = useState<any[]>([]);
    const [detailsList, setDetailsList] = useState<any[]>([]);

    useEffect(() => {
        fetchDependencies();
        masterForm.setFieldsValue({
            voucher_code: `PN-${Date.now()}`
        });
        detailForm.setFieldsValue({ quantity: 1, vat: 0 });
    }, []);

    const fetchDependencies = async () => {
        try {
            const [whRes, equipRes, supRes, mfgRes, fundRes] = await Promise.all([
                fetch('/api/warehouses'),
                fetch('/api/system-categories?type=TEN_THIET_BI'),
                fetch('/api/system-categories?type=NHA_CUNG_CAP'),
                fetch('/api/system-categories?type=HANG_SAN_XUAT'),
                fetch('/api/system-categories?type=NGUON_KINH_PHI')
            ]);
            
            if (whRes.ok) setWarehouses(await whRes.json());
            
            if (equipRes.ok) {
                const cats = await equipRes.json();
                setCategories(cats.map((c: any) => ({ value: c.name, label: c.name })));
            }
            
            if (supRes.ok) {
                const sups = await supRes.json();
                setSuppliers(sups.map((s: any) => ({ value: s.name, label: s.name })));
            }

            if (mfgRes.ok) {
                const mfgs = await mfgRes.json();
                setManufacturers(mfgs.map((m: any) => ({ value: m.id, label: m.name })));
            }

            if (fundRes.ok) {
                const funds = await fundRes.json();
                setFundingSources(funds.map((f: any) => ({ value: f.id, label: f.name })));
            }
        } catch (error) {
            message.error('Lỗi tải danh mục');
        }
    };

    // Auto calculate Detail Form
    const handleDetailCalc = (changedValues: any, allValues: any, form: any) => {
        if (changedValues.quantity !== undefined || changedValues.dongia !== undefined || changedValues.vat !== undefined) {
            const qty = allValues.quantity || 0;
            const dongia = allValues.dongia || 0;
            const vat = allValues.vat || 0;

            const dongia_vat = dongia + (dongia * vat / 100);
            const thanh_tien = dongia_vat * qty;

            form.setFieldsValue({
                dongia_vat: dongia_vat,
                thanh_tien: thanh_tien
            });
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
            detailForm.setFieldsValue({ quantity: 1, vat: 0 });
            message.success('Đã thêm vào danh sách');
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
                message.error('Vui lòng thêm ít nhất một mặt hàng vào danh sách thiết bị nhập');
                return;
            }

            setLoading(true);
            const payload = {
                ...masterValues,
                type: 'NHAP_KHO',
                sub_type: masterValues.sub_type || 'NHAP_MOI',
                document_date: masterValues.document_date ? masterValues.document_date.toISOString() : null,
                received_date: masterValues.received_date ? masterValues.received_date.toISOString() : null,
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
                message.success(status === 'APPROVED' ? 'Đã lưu phiếu và sinh tài sản thành công!' : 'Đã lưu nháp phiếu nhập kho!');
                router.push('/equipment-management/import-vouchers');
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
        { id: 'voucher_code', label: 'Mã phiếu nhập', type: 'input', span: 6, required: true },
        { id: 'sub_type', label: 'Loại Nhập Kho', type: 'select', span: 6, required: true, options: [{value: 'NHAP_MOI', label: 'Nhập Mới (Từ NCC)'}, {value: 'NHAP_HOAN_TRA', label: 'Nhập Hoàn Trả (Từ Khoa)'}], defaultValue: 'NHAP_MOI' },
        { id: 'to_warehouse_id', label: 'Kho nhập (Bắt buộc)', type: 'select', span: 6, required: true, options: warehouses.map(w => ({ value: w.id, label: w.name })) },
        { id: 'supplier_name', label: 'Nhà cung cấp / Khoa trả', type: 'autocomplete', span: 6, options: suppliers },
        { id: 'document_number', label: 'Số HĐ', type: 'input', span: 6 },
        { id: 'document_date', label: 'Ngày HĐ', type: 'date', span: 6 },
        { id: 'deliverer_name', label: 'Người giao hàng', type: 'input', span: 6 },
        { id: 'received_date', label: 'Ngày thực nhận', type: 'date', span: 6 }
    ];

    const detailFields: FieldConfig[] = [
        { id: 'ten_vttb', label: 'Tên Thiết bị / Vật tư (*)', type: 'autocomplete', span: 6, required: true, options: categories },
        { id: 'quantity', label: 'Số lượng (*)', type: 'number', span: 3, required: true },
        { id: 'dongia', label: 'Đơn giá', type: 'number', span: 3 },
        { id: 'vat', label: 'VAT (%)', type: 'number', span: 2 },
        { id: 'dongia_vat', label: 'Đơn giá (Có VAT)', type: 'number', span: 5 },
        { id: 'thanh_tien', label: 'Thành tiền', type: 'number', span: 5 },
        { id: 'manufacturer_id', label: 'Hãng sản xuất', type: 'select', span: 6, options: manufacturers },
        { id: 'funding_source_id', label: 'Nguồn kinh phí', type: 'select', span: 6, options: fundingSources },
        { id: 'is_auto_generate', label: 'Tự động sinh từng mã thiết bị vào Kho', type: 'switch', span: 12 },
        { id: 'serial_numbers', label: 'Danh sách Serial (cách nhau bằng dấu phẩy, dùng khi có mã tự động)', type: 'textarea', span: 24 }
    ];

    const columns = [
        { title: 'Tên Thiết bị', dataIndex: 'ten_vttb', key: 'ten_vttb' },
        { title: 'SL', dataIndex: 'quantity', key: 'quantity' },
        { title: 'Đơn giá', dataIndex: 'dongia', key: 'dongia', render: (val: number) => val?.toLocaleString('vi-VN') },
        { title: 'VAT (%)', dataIndex: 'vat', key: 'vat' },
        { title: 'Đơn giá VAT', dataIndex: 'dongia_vat', key: 'dongia_vat', render: (val: number) => val?.toLocaleString('vi-VN') },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', key: 'thanh_tien', render: (val: number) => val?.toLocaleString('vi-VN') },
        { title: 'Sinh tự động', dataIndex: 'is_auto_generate', key: 'is_auto_generate', render: (val: boolean) => val ? <Tag color="green">Có</Tag> : <Tag color="orange">Không</Tag> },
        { title: 'Thao tác', key: 'action', render: (_: any, record: any) => <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleRemoveDetail(record.key)} /> }
    ];

    const [submitStatus, setSubmitStatus] = useState<'PENDING' | 'APPROVED'>('PENDING');

    const handleFormSubmit = (values: any) => {
        onFinishMaster(values, submitStatus);
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/equipment-management/import-vouchers')}>Quay lại</Button>
                    <Title level={3} className="!mb-0 text-slate-800">Lập Phiếu Nhập Kho</Title>
                </Space>
                <Space>
                    <Button type="default" icon={<SaveOutlined />} onClick={() => { setSubmitStatus('PENDING'); masterForm.submit(); }} loading={loading} size="large" className="border-blue-600 text-blue-600 font-medium">
                        Lưu Phiếu (Lưu Nháp)
                    </Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={() => { setSubmitStatus('APPROVED'); masterForm.submit(); }} loading={loading} size="large" className="bg-blue-600 font-medium">
                        Lưu & Nhập Kho
                    </Button>
                </Space>
            </div>

            {/* BLOCK 1: MASTER FORM */}
            <DynamicForm 
                formId="import_voucher_master"
                title={<span className="text-blue-700 uppercase">1. Thông tin chứng từ</span>}
                open={true}
                onClose={() => {}}
                onSubmit={handleFormSubmit}
                fieldsConfig={masterFields}
                mode="inline"
                hideFooter={true}
                formInstance={masterForm}
            />

            {/* BLOCK 2: DETAIL FORM */}
            <DynamicForm 
                formId="import_voucher_detail"
                title={<span className="text-blue-700 uppercase">2. Thêm Thiết bị / Vật tư vào phiếu</span>}
                open={true}
                onClose={() => {}}
                onSubmit={handleAddDetail}
                fieldsConfig={detailFields}
                mode="inline"
                hideFooter={true}
                formInstance={detailForm}
                onValuesChange={handleDetailCalc}
                initialData={{ quantity: 1, vat: 0, is_auto_generate: true }}
            />
            
            <div className="flex justify-center -mt-2 mb-6 relative z-10">
                <Button type="primary" icon={<PlusOutlined />} onClick={() => detailForm.submit()} size="large" className="bg-green-600 w-1/4 shadow-md">
                    Thêm thiết bị này
                </Button>
            </div>

            {/* BLOCK 3: DETAILS LIST TABLE */}
            <Card title={<span className="text-blue-700 font-bold uppercase">3. Danh sách thiết bị đã thêm</span>} className="shadow-sm border-blue-200">
                <Table 
                    dataSource={detailsList} 
                    columns={columns} 
                    pagination={false}
                    locale={{ emptyText: 'Chưa có thiết bị nào được thêm vào phiếu' }}
                    summary={pageData => {
                        let totalQty = 0; let totalPrice = 0;
                        pageData.forEach(({ quantity, thanh_tien }) => { totalQty += quantity || 0; totalPrice += thanh_tien || 0; });
                        return (
                            <Table.Summary.Row className="bg-slate-50 font-bold">
                                <Table.Summary.Cell index={0}>Tổng cộng</Table.Summary.Cell>
                                <Table.Summary.Cell index={1}>{totalQty}</Table.Summary.Cell>
                                <Table.Summary.Cell index={2}></Table.Summary.Cell>
                                <Table.Summary.Cell index={3}></Table.Summary.Cell>
                                <Table.Summary.Cell index={4}></Table.Summary.Cell>
                                <Table.Summary.Cell index={5}><span className="text-red-600">{totalPrice.toLocaleString('vi-VN')}</span></Table.Summary.Cell>
                                <Table.Summary.Cell index={6}></Table.Summary.Cell>
                            </Table.Summary.Row>
                        );
                    }}
                />
            </Card>
        </div>
    );
}

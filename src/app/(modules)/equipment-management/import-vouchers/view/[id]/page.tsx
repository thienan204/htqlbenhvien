'use client';

import React, { useState, useEffect, use } from 'react';
import { Form, Button, Card, message, Space, Typography, Table, Spin, Tag } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function ViewImportVoucherPage(props: { params: Promise<{ id: string }> }) {
    const params = use(props.params);
    const id = params.id;
    
    const [masterForm] = Form.useForm();
    const router = useRouter();
    
    const [pageLoading, setPageLoading] = useState(true);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [detailsList, setDetailsList] = useState<any[]>([]);
    const [masterInitialData, setMasterInitialData] = useState<any>(null);

    useEffect(() => {
        if (id) {
            fetchDependenciesAndVoucher();
        }
    }, [id]);

    const fetchDependenciesAndVoucher = async () => {
        try {
            const [whRes, equipRes, voucherRes, supRes] = await Promise.all([
                fetch('/api/warehouses'),
                fetch('/api/system-categories?type=TEN_THIET_BI'),
                fetch(`/api/inventory-vouchers/${id}`),
                fetch('/api/system-categories?type=NHA_CUNG_CAP')
            ]);
            
            if (whRes.ok) setWarehouses(await whRes.json());

            if (supRes.ok) {
                const sups = await supRes.json();
                setSuppliers(sups.map((s: any) => ({ value: s.name, label: s.name })));
            }
            
            if (voucherRes.ok) {
                const v = await voucherRes.json();
                
                setMasterInitialData({
                    voucher_code: v.voucher_code,
                    to_warehouse_id: v.to_warehouse_id,
                    supplier_name: v.supplier_name,
                    document_number: v.document_number,
                    document_date: v.document_date ? dayjs(v.document_date) : undefined,
                    deliverer_name: v.deliverer_name,
                    received_date: v.received_date ? dayjs(v.received_date) : undefined,
                });
                
                if (v.details) {
                    setDetailsList(v.details.map((d: any) => ({ ...d, key: d.id || Math.random().toString() })));
                }
            } else {
                message.error('Không tìm thấy phiếu!');
                router.push('/equipment-management/import-vouchers');
            }
        } catch (error) {
            message.error('Lỗi tải dữ liệu');
        } finally {
            setPageLoading(false);
        }
    };

    const masterFields: FieldConfig[] = [
        { id: 'voucher_code', label: 'Mã phiếu nhập', type: 'input', span: 6 },
        { id: 'to_warehouse_id', label: 'Kho nhập', type: 'select', span: 6, options: warehouses.map(w => ({ value: w.id, label: w.name })) },
        { id: 'supplier_name', label: 'Nhà cung cấp', type: 'autocomplete', span: 6, options: suppliers },
        { id: 'document_number', label: 'Số HĐ', type: 'input', span: 6 },
        { id: 'document_date', label: 'Ngày HĐ', type: 'date', span: 6 },
        { id: 'deliverer_name', label: 'Người giao hàng', type: 'input', span: 6 },
        { id: 'received_date', label: 'Ngày thực nhận', type: 'date', span: 6 }
    ];

    const columns = [
        { title: 'Tên Thiết bị', dataIndex: 'ten_vttb', key: 'ten_vttb' },
        { title: 'SL', dataIndex: 'quantity', key: 'quantity' },
        { title: 'Đơn giá', dataIndex: 'dongia', key: 'dongia', render: (val: number) => val?.toLocaleString('vi-VN') },
        { title: 'VAT (%)', dataIndex: 'vat', key: 'vat' },
        { title: 'Đơn giá VAT', dataIndex: 'dongia_vat', key: 'dongia_vat', render: (val: number) => val?.toLocaleString('vi-VN') },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', key: 'thanh_tien', render: (val: number) => val?.toLocaleString('vi-VN') },
        { title: 'Sinh tự động', dataIndex: 'is_auto_generate', key: 'is_auto_generate', render: (val: boolean) => val !== false ? <Tag color="green">Có</Tag> : <Tag color="orange">Không</Tag> }
    ];

    if (pageLoading) return <div className="p-12 text-center"><Spin size="large" /></div>;

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/equipment-management/import-vouchers')}>Quay lại</Button>
                    <Title level={3} className="!mb-0 text-slate-800">Xem Chi Tiết Phiếu Nhập Kho</Title>
                </Space>
            </div>

            {/* BLOCK 1: MASTER FORM */}
            <DynamicForm 
                formId="import_voucher_master"
                title={<span className="text-blue-700 uppercase">1. Thông tin chứng từ</span>}
                open={true}
                onClose={() => {}}
                onSubmit={async () => {}}
                fieldsConfig={masterFields}
                mode="inline"
                hideFooter={true}
                formInstance={masterForm}
                initialData={masterInitialData}
                disabled={true}
            />

            {/* BLOCK 2: DETAILS LIST TABLE */}
            <Card title={<span className="text-blue-700 font-bold uppercase">2. Danh sách thiết bị đã nhập</span>} className="shadow-sm border-blue-200 mt-6">
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
                            </Table.Summary.Row>
                        );
                    }}
                />
            </Card>
        </div>
    );
}

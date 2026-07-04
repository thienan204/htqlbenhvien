'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Space, message, Tag, Popconfirm, Form } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined, SettingOutlined } from '@ant-design/icons';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';
import ServiceSelectorModal from '@/components/shared/ServiceSelectorModal';
import dayjs from 'dayjs';

interface CertificatesModalProps {
    open: boolean;
    onClose: () => void;
    staffId: string | null;
    staffName: string | null;
    onSuccess: () => void;
}

export default function CertificatesModal({ open, onClose, staffId, staffName, onSuccess }: CertificatesModalProps) {
    const [certificates, setCertificates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCert, setEditingCert] = useState<any>(null);
    const [tt32Categories, setTt32Categories] = useState<any[]>([]);
    const [scopeOfPracticeList, setScopeOfPracticeList] = useState<any[]>([]);
    const [certForm] = Form.useForm();
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

    const fetchCertificatesAndCats = async () => {
        if (!staffId) return;
        setLoading(true);
        try {
            const [certRes, catRes, scopeRes] = await Promise.all([
                fetch(`/api/practicing-certificates?staffId=${staffId}`),
                fetch(`/api/tt32`),
                fetch(`/api/pham-vi-chuyen-mon?activeOnly=true`)
            ]);
            
            if (certRes.ok) setCertificates(await certRes.json());
            if (catRes.ok) setTt32Categories(await catRes.json());
            if (scopeRes.ok) setScopeOfPracticeList(await scopeRes.json());
            
        } catch (error) {
            console.error('Lỗi khi tải CCHN', error);
            message.error('Lỗi hệ thống');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && staffId) {
            fetchCertificatesAndCats();
        }
    }, [open, staffId]);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/practicing-certificates?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Xóa CCHN thành công');
                fetchCertificatesAndCats();
                onSuccess(); // refresh staff table
            } else {
                const err = await res.json();
                message.error(err.error || 'Xóa thất bại');
            }
        } catch (error) {
            message.error('Lỗi khi xóa');
        }
    };

    const handleSaveForm = async (values: any) => {
        if (!staffId) return;
        
        const isUpdate = !!editingCert;
        const method = isUpdate ? 'PUT' : 'POST';
        
        const payload = {
            ...values,
            id: editingCert?.id,
            staffId,
            pham_vi_hanh_nghe: Array.isArray(values.pham_vi_hanh_nghe) ? values.pham_vi_hanh_nghe.join('; ') : values.pham_vi_hanh_nghe,
            ngay_cap: values.ngay_cap ? values.ngay_cap.toISOString() : null,
            isActive: values.isActive ?? true
        };

        const res = await fetch('/api/practicing-certificates', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            message.success(`${isUpdate ? 'Cập nhật' : 'Thêm'} CCHN thành công`);
            setIsFormOpen(false);
            fetchCertificatesAndCats();
            onSuccess(); // refresh staff table
        } else {
            const err = await res.json();
            message.error(err.error || 'Lỗi khi lưu CCHN');
            throw new Error(err.error);
        }
    };

    const columns = [
        {
            title: 'Số CCHN',
            dataIndex: 'so_cchn',
            key: 'so_cchn',
            render: (text: string, record: any) => (
                <Space>
                    <span className="font-medium text-slate-800">{text}</span>
                    {record.isActive && <Tag color="green" icon={<CheckCircleOutlined />}>Đang sử dụng</Tag>}
                </Space>
            )
        },
        {
            title: 'Ngày cấp',
            dataIndex: 'ngay_cap',
            key: 'ngay_cap',
            render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '-'
        },
        {
            title: 'Chức danh CCHN',
            dataIndex: 'chuc_danh_cchn',
            key: 'chuc_danh_cchn',
        },
        {
            title: 'Nhóm phân quyền (TT32)',
            dataIndex: ['TT32Category', 'name'],
            key: 'tt32_category',
            render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-'
        },
        {
            title: 'Phạm vi hành nghề',
            dataIndex: 'pham_vi_hanh_nghe',
            key: 'pham_vi_hanh_nghe',
            ellipsis: true
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Button size="small" icon={<EditOutlined />} onClick={() => {
                        setEditingCert(record);
                        certForm.resetFields();
                        setIsFormOpen(true);
                    }}>Sửa</Button>
                    <Popconfirm title="Xóa CCHN này?" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const fieldsConfig: FieldConfig[] = [
        { id: 'so_cchn', label: 'Số CCHN (Bắt buộc)', type: 'input', required: true, span: 12 },
        { id: 'ngay_cap', label: 'Ngày cấp', type: 'date', span: 12 },
        { id: 'chuc_danh_cchn', label: 'Chức danh trong CCHN', type: 'input', span: 24 },
        { 
            id: 'tt32_category_id', 
            label: 'Nhóm phân quyền (Thông tư 32)', 
            type: 'select', 
            span: 24,
            options: tt32Categories.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))
        },
        { 
            id: 'pham_vi_hanh_nghe', 
            label: 'Phạm vi hành nghề', 
            type: 'select', 
            mode: 'multiple',
            span: 24,
            options: scopeOfPracticeList.map(s => ({ value: `${s.ma_pham_vi} - ${s.ten_chuc_danh}`, label: `${s.ma_pham_vi} - ${s.ten_chuc_danh}` }))
        },
        { id: 'pham_vi_bo_sung', label: 'Phạm vi chuyên môn bổ sung', type: 'textarea', span: 24 },
        { 
            id: 'dich_vu_ky_thuat', 
            label: 'Dịch vụ kỹ thuật khác', 
            type: 'textarea', 
            span: 24,
            customNode: (
                <div className="mt-2 text-right">
                    <Button 
                        type="dashed" 
                        icon={<SettingOutlined />} 
                        onClick={() => setIsServiceModalOpen(true)}
                        className="border-blue-400 text-blue-600 font-medium"
                        size="small"
                    >
                        Chọn từ danh mục (Mẫu 05)
                    </Button>
                </div>
            )
        },
        { id: 'isActive', label: 'Đang sử dụng chính', type: 'switch', span: 24 }
    ];

    const initialData = React.useMemo(() => {
        return editingCert ? {
            ...editingCert,
            pham_vi_hanh_nghe: editingCert.pham_vi_hanh_nghe ? editingCert.pham_vi_hanh_nghe.split(';').map((s: string) => s.trim()) : undefined,
            ngay_cap: editingCert.ngay_cap ? dayjs(editingCert.ngay_cap) : null
        } : { isActive: true };
    }, [editingCert]);

    return (
        <>
            <Modal
                title={`Quản lý CCHN - ${staffName || ''}`}
                open={open}
                onCancel={onClose}
                footer={null}
                width={800}
                centered
            >
                <div className="mb-4 flex justify-between items-center">
                    <p className="text-slate-500 m-0">Quản lý các chứng chỉ hành nghề của nhân sự này.</p>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => {
                        setEditingCert(null);
                        certForm.resetFields();
                        setIsFormOpen(true);
                    }}>Thêm CCHN mới</Button>
                </div>

                <Table
                    dataSource={certificates}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    bordered
                    size="small"
                />
            </Modal>

            {isFormOpen && (
                <DynamicForm
                    formInstance={certForm}
                    formId="cert_form"
                    title={editingCert ? "Cập nhật CCHN" : "Thêm mới CCHN"}
                    open={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    onSubmit={handleSaveForm}
                    fieldsConfig={fieldsConfig}
                    initialData={initialData}
                />
            )}

            {isServiceModalOpen && (
                <ServiceSelectorModal
                    open={isServiceModalOpen}
                    onCancel={() => setIsServiceModalOpen(false)}
                    onOk={(selectedKeys) => {
                        certForm.setFieldsValue({ dich_vu_ky_thuat: selectedKeys.join(';') });
                        setIsServiceModalOpen(false);
                    }}
                    initialKeys={(certForm.getFieldValue('dich_vu_ky_thuat') || '').split(';').filter(Boolean)}
                />
            )}
        </>
    );
}

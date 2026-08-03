'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Space, message, Popconfirm, Form } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';

interface TrainingModalProps {
    open: boolean;
    onClose: () => void;
    staffId: string | null;
    staffName: string | null;
}

export default function TrainingModal({ open, onClose, staffId, staffName }: TrainingModalProps) {
    const [trainings, setTrainings] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTraining, setEditingTraining] = useState<any>(null);
    const [trainingTypes, setTrainingTypes] = useState<any[]>([]);
    const [certForm] = Form.useForm();

    const fetchTrainingsAndCats = async () => {
        if (!staffId) return;
        setLoading(true);
        try {
            const [trainRes, catRes] = await Promise.all([
                fetch(`/api/staff-training?staffId=${staffId}`),
                fetch(`/api/system-categories?type=LOAI_DAO_TAO`)
            ]);
            
            if (trainRes.ok) setTrainings(await trainRes.json());
            if (catRes.ok) setTrainingTypes(await catRes.json());
        } catch (error) {
            console.error('Lỗi khi tải Đào tạo', error);
            message.error('Lỗi hệ thống');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && staffId) {
            fetchTrainingsAndCats();
        }
    }, [open, staffId]);

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/staff-training?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Xóa chứng chỉ đào tạo thành công');
                fetchTrainingsAndCats();
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
        
        const isUpdate = !!editingTraining;
        const method = isUpdate ? 'PUT' : 'POST';
        
        const payload = {
            ...values,
            id: editingTraining?.id,
            staffId,
        };

        const res = await fetch('/api/staff-training', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            message.success(`${isUpdate ? 'Cập nhật' : 'Thêm'} chứng chỉ thành công`);
            setIsFormOpen(false);
            fetchTrainingsAndCats();
        } else {
            const err = await res.json();
            message.error(err.error || 'Lỗi khi lưu');
            throw new Error(err.error);
        }
    };

    const columns = [
        {
            title: 'Tên chứng chỉ / Khóa học',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span className="font-medium text-slate-800">{text}</span>
        },
        {
            title: 'Loại hình',
            dataIndex: ['trainingType', 'name'],
            key: 'training_type',
        },
        {
            title: 'Nơi đào tạo',
            dataIndex: 'institution',
            key: 'institution',
        },
        {
            title: 'Năm TN',
            dataIndex: 'graduationYear',
            key: 'graduationYear',
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Button 
                        type="text" 
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50" 
                        icon={<EditOutlined />} 
                        onClick={() => {
                            setEditingTraining(record);
                            setIsFormOpen(true);
                        }} 
                        size="small"
                        title="Sửa"
                    />
                    <Popconfirm
                        title="Xóa chứng chỉ này?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button 
                            type="text" 
                            danger 
                            icon={<DeleteOutlined />} 
                            size="small"
                            title="Xóa"
                        />
                    </Popconfirm>
                </Space>
            ),
        }
    ];

    const fieldsConfig: FieldConfig[] = [
        { 
            id: 'trainingType_id', 
            label: 'Loại hình đào tạo', 
            type: 'select', 
            required: true, 
            span: 12,
            options: trainingTypes.map(t => ({ value: t.id, label: t.name }))
        },
        { id: 'name', label: 'Tên chứng chỉ / Khóa học', type: 'input', required: true, span: 12 },
        { id: 'institution', label: 'Nơi đào tạo', type: 'input', span: 12 },
        { id: 'graduationYear', label: 'Năm tốt nghiệp', type: 'number', span: 12 }
    ];

    return (
        <>
            <Modal
                title={
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-slate-800">Quản lý Đào tạo</span>
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-200">
                            {staffName}
                        </span>
                    </div>
                }
                open={open}
                onCancel={onClose}
                width={800}
                footer={null}
            >
                <div className="flex justify-between items-center mb-4 mt-4">
                    <div className="text-sm text-slate-500">Danh sách các chứng chỉ, bằng cấp, khóa đào tạo</div>
                    <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => {
                            setEditingTraining(null);
                            setIsFormOpen(true);
                        }}
                    >
                        Thêm Chứng chỉ
                    </Button>
                </div>
                
                <Table
                    columns={columns}
                    dataSource={trainings}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    className="border border-slate-200 rounded-lg overflow-hidden [&_.ant-table-thead_th]:bg-slate-50"
                    size="middle"
                    locale={{ emptyText: 'Chưa có dữ liệu đào tạo' }}
                />
            </Modal>

            <DynamicForm
                formId="staff_training_form"
                title={editingTraining ? "Sửa Chứng chỉ / Khóa học" : "Thêm mới Chứng chỉ"}
                open={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={handleSaveForm}
                initialData={editingTraining}
                fieldsConfig={fieldsConfig}
            />
        </>
    );
}

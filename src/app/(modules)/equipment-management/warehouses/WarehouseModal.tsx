'use client';

import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';

interface WarehouseModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    warehouseData?: any;
}

export default function WarehouseModal({ open, onClose, onSuccess, warehouseData }: WarehouseModalProps) {
    const [departments, setDepartments] = useState<any[]>([]);
    const [staffs, setStaffs] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetchDependencies();
        }
    }, [open]);

    const fetchDependencies = async () => {
        try {
            const [deptRes, staffRes] = await Promise.all([
                fetch('/api/departments'),
                fetch('/api/staff')
            ]);
            
            if (deptRes.ok) setDepartments(await deptRes.json());
            if (staffRes.ok) {
                const staffDataRes = await staffRes.json();
                setStaffs(staffDataRes.data || staffDataRes); 
            }
        } catch (error) {
            console.error('Lỗi tải danh mục', error);
            message.error('Lỗi tải danh mục khoa phòng/nhân viên');
        }
    };

    const handleSave = async (values: any) => {
        const isUpdate = !!warehouseData;
        const method = isUpdate ? 'PUT' : 'POST';
        const url = isUpdate ? `/api/warehouses/${warehouseData.id}` : '/api/warehouses';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values)
        });

        if (res.ok) {
            message.success(`${isUpdate ? 'Cập nhật' : 'Thêm'} kho thành công`);
            onSuccess();
        } else {
            const err = await res.json();
            message.error(err.error || 'Lỗi khi lưu kho');
            throw new Error(err.error);
        }
    };

    const fieldsConfig: FieldConfig[] = [
        { id: 'code', label: 'Mã Kho (Bắt buộc)', type: 'input', required: true, span: 12 },
        { id: 'name', label: 'Tên Kho (Bắt buộc)', type: 'input', required: true, span: 12 },
        { 
            id: 'department_id', 
            label: 'Khoa/Phòng quản lý', 
            type: 'select', 
            required: true, 
            span: 12,
            options: departments.map(d => ({ value: d.ma_khoa, label: d.ten_khoa }))
        },
        { 
            id: 'warehouse_type', 
            label: 'Loại kho', 
            type: 'select', 
            required: true, 
            span: 12,
            options: [
                { value: 'KHO_CHINH', label: 'Kho Chính (Phòng chuyên trách)' },
                { value: 'KHO_KHOA', label: 'Kho Khoa (Lâm sàng)' }
            ]
        },
        { 
            id: 'storekeeper_id', 
            label: 'Thủ kho', 
            type: 'select', 
            span: 12,
            options: staffs.map(s => ({ value: s.id, label: s.ho_ten }))
        },
        { id: 'room', label: 'Phòng lưu trữ (Vị trí)', type: 'input', span: 12 },
        { 
            id: 'status', 
            label: 'Trạng thái', 
            type: 'select', 
            span: 24,
            options: [
                { value: 'ACTIVE', label: 'Đang hoạt động' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' }
            ]
        }
    ];

    const initialData = warehouseData ? {
        ...warehouseData
    } : { status: 'ACTIVE' };

    return (
        <DynamicForm
            formId="warehouse_form"
            title={warehouseData ? "Cập nhật Thông tin Kho" : "Thêm mới Kho"}
            open={open}
            onClose={onClose}
            onSubmit={handleSave}
            fieldsConfig={fieldsConfig}
            initialData={initialData}
        />
    );
}

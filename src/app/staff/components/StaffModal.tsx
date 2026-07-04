'use client';

import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';

interface StaffModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    staffData?: any;
}

export default function StaffModal({ open, onClose, onSuccess, staffData }: StaffModalProps) {
    const [departments, setDepartments] = useState<any[]>([]);
    const [genders, setGenders] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [jobTitles, setJobTitles] = useState<any[]>([]);
    const [jobPositions, setJobPositions] = useState<any[]>([]);
    const [qualifications, setQualifications] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetchCategories();
        }
    }, [open]);

    const fetchCategories = async () => {
        try {
            const [deptRes, catRes] = await Promise.all([
                fetch('/api/departments'),
                fetch('/api/system-categories')
            ]);
            
            if (deptRes.ok) setDepartments(await deptRes.json());
            
            if (catRes.ok) {
                const cats = await catRes.json();
                setGenders(cats.filter((c: any) => c.type === 'GENDER'));
                setContracts(cats.filter((c: any) => c.type === 'LOAI_HOP_DONG'));
                setPositions(cats.filter((c: any) => c.type === 'CHUC_VU'));
                setJobTitles(cats.filter((c: any) => c.type === 'CHUC_DANH'));
                setJobPositions(cats.filter((c: any) => c.type === 'VI_TRI_VIEC_LAM'));
                setQualifications(cats.filter((c: any) => c.type === 'TRINH_DO'));
            }
        } catch (error) {
            console.error('Lỗi tải danh mục', error);
        }
    };

    const handleSave = async (values: any) => {
        const isUpdate = !!staffData;
        const method = 'POST'; // Backend handles update via POST when id is present
        
        const payload = {
            ...values,
            id: staffData?.id,
            ngay_sinh: values.ngay_sinh ? values.ngay_sinh.toISOString() : null
        };

        const res = await fetch('/api/staff', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            message.success(`${isUpdate ? 'Cập nhật' : 'Thêm'} nhân sự thành công`);
            onSuccess();
        } else {
            const err = await res.json();
            message.error(err.error || 'Lỗi khi lưu nhân sự');
            throw new Error(err.error);
        }
    };

    // Chuẩn bị initialData
    const initialData = staffData ? {
        ...staffData,
        ngay_sinh: staffData.ngay_sinh ? dayjs(staffData.ngay_sinh) : null
    } : undefined;

    // Cấu hình các trường (Ánh xạ các danh mục vào options)
    const fieldsConfig: FieldConfig[] = [
        { id: 'ma_nv', label: 'Mã NV (Bắt buộc)', type: 'input', required: true, span: 12 },
        { id: 'ho_ten', label: 'Họ và tên (Bắt buộc)', type: 'input', required: true, span: 12 },
        { id: 'ngay_sinh', label: 'Ngày sinh', type: 'date', span: 8 },
        { 
            id: 'gioi_tinh_id', 
            label: 'Giới tính', 
            type: 'select', 
            span: 8,
            options: genders.map(g => ({ value: g.id, label: g.name })) 
        },
        { id: 'so_dien_thoai', label: 'Số điện thoại', type: 'input', span: 8 },
        { id: 'cccd', label: 'Căn cước công dân', type: 'input', span: 8 },
        { id: 'dia_chi', label: 'Địa chỉ thường trú', type: 'input', span: 16 },
        { 
            id: 'ma_khoa', 
            label: 'Khoa / Phòng (Bắt buộc)', 
            type: 'select', 
            required: true, 
            span: 12,
            options: departments.map(d => ({ value: d.ma_khoa, label: d.ten_khoa }))
        },
        { 
            id: 'loai_hop_dong_id', 
            label: 'Loại hợp đồng', 
            type: 'select', 
            span: 12,
            options: contracts.map(c => ({ value: c.id, label: c.name }))
        },
        { 
            id: 'chuc_vu_id', 
            label: 'Chức vụ', 
            type: 'select', 
            span: 12,
            options: positions.map(p => ({ value: p.id, label: p.name }))
        },
        { 
            id: 'vi_tri_viec_lam_id', 
            label: 'Vị trí việc làm', 
            type: 'select', 
            span: 12,
            options: jobPositions.map(p => ({ value: p.id, label: p.name }))
        },
        { 
            id: 'chuc_danh_id', 
            label: 'Chức danh nghề nghiệp', 
            type: 'select', 
            span: 12,
            options: jobTitles.map(t => ({ value: t.id, label: t.name }))
        },
        { 
            id: 'trinh_do_id', 
            label: 'Trình độ chuyên môn', 
            type: 'select', 
            span: 12,
            options: qualifications.map(q => ({ value: q.id, label: q.name }))
        }
    ];

    return (
        <DynamicForm
            formId="staff_form"
            title={staffData ? "Cập nhật Hồ sơ Nhân sự" : "Thêm mới Nhân sự"}
            open={open}
            onClose={onClose}
            onSubmit={handleSave}
            fieldsConfig={fieldsConfig}
            initialData={initialData}
        />
    );
}

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
    const [ethnicities, setEthnicities] = useState<any[]>([]);
    const [bhytPositions, setBhytPositions] = useState<any[]>([]);
    const [wards, setWards] = useState<any[]>([]);
    const [ngachLuongs, setNgachLuongs] = useState<any[]>([]);
    const [heSoLuongs, setHeSoLuongs] = useState<any[]>([]);
    const [bacLuongs, setBacLuongs] = useState<any[]>([]);
    const [phuCaps, setPhuCaps] = useState<any[]>([]);
    const [workingStatuses, setWorkingStatuses] = useState<any[]>([]);

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
                setEthnicities(cats.filter((c: any) => c.type === 'DAN_TOC'));
                setBhytPositions(cats.filter((c: any) => c.type === 'VI_TRI_BHYT'));
                setWards(cats.filter((c: any) => c.type === 'WARD'));
                setNgachLuongs(cats.filter((c: any) => c.type === 'NGACH_LUONG'));
                setHeSoLuongs(cats.filter((c: any) => c.type === 'HE_SO_LUONG'));
                setBacLuongs(cats.filter((c: any) => c.type === 'BAC_LUONG'));
                setPhuCaps(cats.filter((c: any) => c.type === 'PHU_CAP_TNVK'));
                setWorkingStatuses(cats.filter((c: any) => c.type === 'WORKING_STATUS'));
            }
        } catch (error) {
            console.error('Lỗi tải danh mục', error);
        }
    };

    const handleSave = async (values: any) => {
        const isUpdate = !!staffData;
        
        const payload = {
            ...values,
            id: staffData?.id,
        };

        const dateFields = ['ngay_sinh', 'ngay_cap_cccd', 'ngay_tuyen_dung', 'thoi_diem_nang_luong'];
        dateFields.forEach(field => {
            if (payload[field]) {
                payload[field] = payload[field].toISOString();
            }
        });

        const res = await fetch('/api/staff', {
            method: 'POST',
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

    const initialData = staffData ? { ...staffData } : {
        trang_thai_id: workingStatuses.find(s => s.code === 'DANG_LAM_VIEC')?.id
    };
    if (initialData) {
        const dateFields = ['ngay_sinh', 'ngay_cap_cccd', 'ngay_tuyen_dung', 'thoi_diem_nang_luong'];
        dateFields.forEach(field => {
            if (initialData[field]) {
                initialData[field] = dayjs(initialData[field]);
            }
        });
    }

    const wardOptions = wards.map(w => ({ value: w.id, label: w.parent ? `${w.name} (${w.parent.name})` : w.name }));

    const fieldsConfig: FieldConfig[] = [
        { id: 'ma_nv', label: 'Mã NV (Bắt buộc)', type: 'input', required: true, span: 12 },
        { id: 'ho_ten', label: 'Họ và tên (Bắt buộc)', type: 'input', required: true, span: 12 },
        { id: 'ngay_sinh', label: 'Ngày sinh', type: 'date', span: 8 },
        { id: 'gioi_tinh_id', label: 'Giới tính', type: 'select', span: 8, options: genders.map(g => ({ value: g.id, label: g.name })) },
        { id: 'so_dien_thoai', label: 'Số điện thoại', type: 'input', span: 8 },
        { id: 'cccd', label: 'Căn cước công dân', type: 'input', span: 8 },
        { id: 'ngay_cap_cccd', label: 'Ngày cấp CCCD', type: 'date', span: 8 },
        { id: 'noi_cap_cccd', label: 'Nơi cấp CCCD', type: 'input', span: 8 },
        { id: 'ma_bhxh', label: 'Mã số BHXH', type: 'input', span: 8 },
        { id: 'ma_ho_gia_dinh', label: 'Mã hộ gia đình', type: 'input', span: 8 },
        { id: 'dan_toc_id', label: 'Dân tộc', type: 'select', span: 8, options: ethnicities.map(e => ({ value: e.id, label: e.name })) },
        { id: 'dia_chi', label: 'Địa chỉ thường trú (Mô tả)', type: 'input', span: 24 },
        
        { id: 'noi_sinh_ward_id', label: 'Nơi đăng ký khai sinh (Xã/Phường)', type: 'autocomplete', span: 12, options: wardOptions },
        { id: 'noi_sinh_thon', label: 'Chi tiết (Thôn/Xóm/Số nhà)', type: 'input', span: 12 },
        { id: 'que_quan_ward_id', label: 'Quê quán (Xã/Phường)', type: 'autocomplete', span: 12, options: wardOptions },
        { id: 'que_quan_thon', label: 'Chi tiết (Thôn/Xóm/Số nhà)', type: 'input', span: 12 },
        { id: 'noi_o_ward_id', label: 'Nơi ở hiện tại (Xã/Phường)', type: 'autocomplete', span: 12, options: wardOptions },
        { id: 'noi_o_thon', label: 'Chi tiết (Thôn/Xóm/Số nhà)', type: 'input', span: 12 },

        { id: 'ma_khoa', label: 'Khoa / Phòng (Bắt buộc)', type: 'select', required: true, span: 12, options: departments.map(d => ({ value: d.ma_khoa, label: d.ten_khoa })) },
        { id: 'trang_thai_id', label: 'Trạng thái làm việc', type: 'select', span: 12, options: workingStatuses.map(s => ({ value: s.id, label: s.name })) },
        { id: 'loai_hop_dong_id', label: 'Loại hợp đồng', type: 'select', span: 12, options: contracts.map(c => ({ value: c.id, label: c.name })) },
        { id: 'chuc_vu_id', label: 'Chức vụ', type: 'select', span: 12, options: positions.map(p => ({ value: p.id, label: p.name })) },
        { id: 'vi_tri_viec_lam_id', label: 'Vị trí việc làm', type: 'select', span: 12, options: jobPositions.map(p => ({ value: p.id, label: p.name })) },
        { id: 'chuc_danh_id', label: 'Chức danh nghề nghiệp', type: 'select', span: 12, options: jobTitles.map(t => ({ value: t.id, label: t.name })) },
        { id: 'trinh_do_id', label: 'Trình độ chuyên môn', type: 'select', span: 12, options: qualifications.map(q => ({ value: q.id, label: q.name })) },
        { id: 'vi_tri_bhyt_id', label: 'Vị trí chuyên môn (Mẫu 02 BHYT)', type: 'select', span: 24, options: bhytPositions.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` })) },

        { id: 'so_qd_tuyen_dung', label: 'Số QĐ Tuyển dụng', type: 'input', span: 8 },
        { id: 'ngay_tuyen_dung', label: 'Ngày tuyển dụng', type: 'date', span: 8 },
        { id: 'thoi_diem_nang_luong', label: 'Thời điểm nâng lương', type: 'date', span: 8 },
        { id: 'ma_ngach_id', label: 'Mã ngạch', type: 'select', span: 6, options: ngachLuongs.map(t => ({ value: t.id, label: t.name })) },
        { id: 'he_so_luong_id', label: 'Hệ số lương', type: 'select', span: 6, options: heSoLuongs.map(t => ({ value: t.id, label: t.name })) },
        { id: 'bac_luong_id', label: 'Bậc lương', type: 'select', span: 6, options: bacLuongs.map(t => ({ value: t.id, label: t.name })) },
        { id: 'phu_cap_tnvk_id', label: 'Phụ cấp TNVK (%)', type: 'select', span: 6, options: phuCaps.map(t => ({ value: t.id, label: t.name })) },
    ];

    return (
        <DynamicForm
            formId="staff_management_form"
            title={staffData?.id ? 'Sửa thông tin Nhân sự' : 'Thêm Nhân sự mới'}
            open={open}
            onClose={onClose}
            onSubmit={handleSave}
            initialData={initialData}
            fieldsConfig={fieldsConfig}
        />
    );
}

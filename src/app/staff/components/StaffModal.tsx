'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import ModularFormModal, { FormSectionDef } from '@/components/shared/ModularFormModal';
import { 
    UserOutlined, 
    HomeOutlined, 
    MedicineBoxOutlined, 
    DollarOutlined, 
    DisconnectOutlined 
} from '@ant-design/icons';

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

        const dateFields = ['ngay_sinh', 'ngay_cap_cccd', 'ngay_tuyen_dung', 'thoi_diem_nang_luong', 'ngay_nghi_viec', 'ngay_qd_nghi_viec'];
        dateFields.forEach(field => {
            if (payload[field] && dayjs.isDayjs(payload[field])) {
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

    const initialData = useMemo(() => {
        const data = staffData ? { ...staffData } : {
            trang_thai_id: workingStatuses.find(s => s.code === 'DANG_LAM_VIEC')?.id
        };
        if (data) {
            const dateFields = ['ngay_sinh', 'ngay_cap_cccd', 'ngay_tuyen_dung', 'thoi_diem_nang_luong', 'ngay_nghi_viec', 'ngay_qd_nghi_viec'];
            dateFields.forEach(field => {
                if (data[field]) {
                    data[field] = dayjs(data[field]);
                }
            });
        }
        return data;
    }, [staffData, workingStatuses]);

    const wardOptions = useMemo(() => {
        return wards.map(w => ({ 
            value: w.id, 
            label: w.parent ? `${w.name} (${w.parent.name})` : w.name 
        }));
    }, [wards]);

    // Định nghĩa 5 phân nhóm nghiệp vụ hồ sơ nhân sự chuẩn Bộ Y tế
    const sections: FormSectionDef[] = useMemo(() => {
        return [
            {
                key: 'personal',
                title: 'Định danh & Cá nhân',
                icon: <UserOutlined />,
                description: 'Thông tin cá nhân, định danh CCCD và bảo hiểm y tế/xã hội',
                fields: [
                    // Hàng 1 (24 cols): Mã NV (6) | Họ tên (10) | Giới tính (4) | Ngày sinh (4)
                    { name: 'ma_nv', label: 'Mã NV', type: 'text', required: true, span: 6, placeholder: 'VD: BV001...' },
                    { name: 'ho_ten', label: 'Họ và tên', type: 'text', required: true, span: 10, placeholder: 'Họ và tên cán bộ...' },
                    { name: 'gioi_tinh_id', label: 'Giới tính', type: 'select', span: 4, options: genders.map(g => ({ value: g.id, label: g.name })) },
                    { name: 'ngay_sinh', label: 'Ngày sinh', type: 'date', span: 4 },

                    // Hàng 2 (24 cols): Số ĐT (6) | Số CCCD (6) | Ngày cấp (6) | Nơi cấp (6)
                    { name: 'so_dien_thoai', label: 'Số điện thoại', type: 'text', span: 6, placeholder: 'Số di động liên hệ...' },
                    { name: 'cccd', label: 'Số CCCD', type: 'text', span: 6, placeholder: '12 chữ số...' },
                    { name: 'ngay_cap_cccd', label: 'Ngày cấp CCCD', type: 'date', span: 6 },
                    { name: 'noi_cap_cccd', label: 'Nơi cấp CCCD', type: 'text', span: 6, placeholder: 'Cục Cảnh sát QLHC...' },

                    // Hàng 3 (24 cols): Dân tộc (6) | Mã BHXH (9) | Mã hộ gia đình (9)
                    { name: 'dan_toc_id', label: 'Dân tộc', type: 'select', span: 6, options: ethnicities.map(e => ({ value: e.id, label: e.name })) },
                    { name: 'ma_bhxh', label: 'Mã số BHXH', type: 'text', span: 9, placeholder: 'Mã sổ BHXH...' },
                    { name: 'ma_ho_gia_dinh', label: 'Mã hộ gia đình', type: 'text', span: 9, placeholder: 'Mã HGĐ BHYT...' },

                    // Hàng 4 (24 cols): Địa chỉ thường trú mô tả
                    { name: 'dia_chi', label: 'Địa chỉ thường trú (Mô tả chi tiết)', type: 'text', span: 24, placeholder: 'Số nhà, đường, thôn/xóm...' },
                ]
            },
            {
                key: 'address',
                title: 'Hộ khẩu & Địa chỉ',
                icon: <HomeOutlined />,
                description: 'Địa chỉ khai sinh, quê quán và nơi ở hiện tại theo 3 cấp hành chính',
                fields: [
                    { name: 'noi_sinh_ward_id', label: 'Nơi đăng ký khai sinh (Xã/Phường)', type: 'autocomplete', span: 12, options: wardOptions, placeholder: 'Gõ để tìm xã/phường...' },
                    { name: 'noi_sinh_thon', label: 'Chi tiết nơi sinh (Thôn/Xóm/Số nhà)', type: 'text', span: 12, placeholder: 'Thôn, xóm, bản, tổ dân phố...' },
                    { name: 'que_quan_ward_id', label: 'Quê quán (Xã/Phường)', type: 'autocomplete', span: 12, options: wardOptions, placeholder: 'Gõ để tìm quê quán...' },
                    { name: 'que_quan_thon', label: 'Chi tiết quê quán (Thôn/Xóm/Số nhà)', type: 'text', span: 12, placeholder: 'Thôn, xóm, bản, tổ dân phố...' },
                    { name: 'noi_o_ward_id', label: 'Nơi ở hiện tại (Xã/Phường)', type: 'autocomplete', span: 12, options: wardOptions, placeholder: 'Gõ để tìm nơi ở...' },
                    { name: 'noi_o_thon', label: 'Chi tiết nơi ở (Thôn/Xóm/Số nhà)', type: 'text', span: 12, placeholder: 'Thôn, xóm, bản, tổ dân phố...' },
                ]
            },
            {
                key: 'employment',
                title: 'Công tác & Chuyên môn',
                icon: <MedicineBoxOutlined />,
                description: 'Vị trí công tác, khoa phòng, chức danh chuyên môn y tế và chức vụ',
                fields: [
                    { name: 'ma_khoa', label: 'Khoa / Phòng', type: 'select', required: true, span: 8, options: departments.map(d => ({ value: d.ma_khoa, label: d.ten_khoa })) },
                    { name: 'trang_thai_id', label: 'Trạng thái làm việc', type: 'select', span: 8, options: workingStatuses.map(s => ({ value: s.id, label: s.name })) },
                    { name: 'loai_hop_dong_id', label: 'Loại hợp đồng', type: 'select', span: 8, options: contracts.map(c => ({ value: c.id, label: c.name })) },
                    { name: 'chuc_vu_id', label: 'Chức vụ', type: 'select', span: 6, options: positions.map(p => ({ value: p.id, label: p.name })) },
                    { name: 'vi_tri_viec_lam_id', label: 'Vị trí việc làm', type: 'select', span: 6, options: jobPositions.map(p => ({ value: p.id, label: p.name })) },
                    { name: 'chuc_danh_id', label: 'Chức danh nghề nghiệp', type: 'select', span: 6, options: jobTitles.map(t => ({ value: t.id, label: t.name })) },
                    { name: 'trinh_do_id', label: 'Trình độ chuyên môn', type: 'select', span: 6, options: qualifications.map(q => ({ value: q.id, label: q.name })) },
                    { name: 'vi_tri_bhyt_id', label: 'Vị trí chuyên môn (Mẫu 02 BHYT)', type: 'select', span: 24, options: bhytPositions.map(p => ({ value: p.id, label: `${p.code} - ${p.name}` })) },
                ]
            },
            {
                key: 'salary',
                title: 'Tuyển dụng & Lương',
                icon: <DollarOutlined />,
                description: 'Quyết định tuyển dụng, nâng lương, ngạch bậc và hệ số lương',
                fields: [
                    { name: 'so_qd_tuyen_dung', label: 'Số QĐ Tuyển dụng', type: 'text', span: 8, placeholder: 'Số quyết định tuyển dụng...' },
                    { name: 'ngay_tuyen_dung', label: 'Ngày tuyển dụng', type: 'date', span: 8 },
                    { name: 'thoi_diem_nang_luong', label: 'Thời điểm nâng lương', type: 'date', span: 8 },
                    { name: 'ma_ngach_id', label: 'Mã ngạch', type: 'select', span: 6, options: ngachLuongs.map(t => ({ value: t.id, label: t.name })) },
                    { name: 'he_so_luong_id', label: 'Hệ số lương', type: 'select', span: 6, options: heSoLuongs.map(t => ({ value: t.id, label: t.name })) },
                    { name: 'bac_luong_id', label: 'Bậc lương', type: 'select', span: 6, options: bacLuongs.map(t => ({ value: t.id, label: t.name })) },
                    { name: 'phu_cap_tnvk_id', label: 'Phụ cấp TNVK (%)', type: 'select', span: 6, options: phuCaps.map(t => ({ value: t.id, label: t.name })) },
                ]
            },
            {
                key: 'resignation',
                title: 'Nghỉ việc / Chuyển đi',
                icon: <DisconnectOutlined />,
                description: 'Thông tin khi nhân viên chuyển viện, chuyển công tác hoặc nghỉ chế độ',
                fields: [
                    { name: 'ngay_nghi_viec', label: 'Ngày nghỉ việc / chuyển công tác', type: 'date', span: 8 },
                    { name: 'so_qd_nghi_viec', label: 'Số QĐ nghỉ việc / chuyển công tác', type: 'text', span: 8, placeholder: 'Số quyết định thôi việc...' },
                    { name: 'ngay_qd_nghi_viec', label: 'Ngày ký QĐ', type: 'date', span: 8 },
                    { name: 'don_vi_chuyen_den', label: 'Cơ quan / Đơn vị chuyển đến (nếu có)', type: 'text', span: 12, placeholder: 'Tên đơn vị, bệnh viện chuyển đến...' },
                    { name: 'ly_do_nghi_viec', label: 'Lý do / Ghi chú nghỉ việc, chuyển đi', type: 'textarea', span: 12, placeholder: 'Nghỉ hưu, chuyển công tác theo nguyện vọng...' },
                ]
            }
        ];
    }, [departments, genders, contracts, positions, jobTitles, jobPositions, qualifications, ethnicities, bhytPositions, wardOptions, ngachLuongs, heSoLuongs, bacLuongs, phuCaps, workingStatuses]);

    return (
        <ModularFormModal
            formId="staff_management_form"
            title={
                staffData?.id ? (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span>✏️ Cập nhật Hồ sơ Nhân sự:</span>
                        <span className="text-blue-600 font-bold">{staffData.ho_ten}</span>
                        <span className="text-xs font-mono font-normal bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200">
                            {staffData.ma_nv}
                        </span>
                    </div>
                ) : (
                    <span>➕ Thêm Nhân sự mới</span>
                )
            }
            open={open}
            onClose={onClose}
            onSubmit={handleSave}
            initialData={initialData}
            sections={sections}
            width={1050}
        />
    );
}

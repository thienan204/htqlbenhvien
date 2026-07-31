'use client';

import React, { useEffect, useState } from 'react';
import { message } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import DynamicForm, { FieldConfig } from '@/components/shared/DynamicForm';
import { Modal, Tabs } from 'antd';
import MyServicesTab from './MyServicesTab';

interface EditProfileModalProps {
    open: boolean;
    onClose: () => void;
    initialTab?: string;
}

export default function EditProfileModal({ open, onClose, initialTab = '1' }: EditProfileModalProps) {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [initialData, setInitialData] = useState<any>(null);
    const [hasStaff, setHasStaff] = useState(false);
    
    // Categories state
    const [departments, setDepartments] = useState<any[]>([]);
    const [genders, setGenders] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [jobTitles, setJobTitles] = useState<any[]>([]);
    const [jobPositions, setJobPositions] = useState<any[]>([]);
    const [qualifications, setQualifications] = useState<any[]>([]);

    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (open) {
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
            fetchCategories();
        }
    }, [open]);

    useEffect(() => {
        if (open && user) {
            const fetchProfile = async () => {
                try {
                    const res = await fetch('/api/auth/profile');
                    if (res.ok) {
                        const data = await res.json();
                        setHasStaff(!!data.staffId);
                        setInitialData({
                            username: data.username,
                            name: data.name,
                            telegram_id: data.telegram_id,
                            isAvailable: data.isAvailable,
                            ho_ten: data.staff?.ho_ten,
                            so_dien_thoai: data.staff?.so_dien_thoai,
                            dia_chi: data.staff?.dia_chi,
                            ma_nv: data.staff?.ma_nv,
                            ngay_sinh: data.staff?.ngay_sinh ? dayjs(data.staff.ngay_sinh) : null,
                            gioi_tinh_id: data.staff?.gioi_tinh_id,
                            ma_khoa: data.staff?.ma_khoa,
                            loai_hop_dong_id: data.staff?.loai_hop_dong_id,
                            chuc_vu_id: data.staff?.chuc_vu_id,
                            vi_tri_viec_lam_id: data.staff?.vi_tri_viec_lam_id,
                            chuc_danh_id: data.staff?.chuc_danh_id,
                            trinh_do_id: data.staff?.trinh_do_id,
                        });
                    }
                } catch (error) {
                    console.error('Error fetching profile:', error);
                }
            };
            fetchProfile();
        } else if (!open) {
            setInitialData(null);
        }
    }, [open, user]);

    useEffect(() => {
        if (open) {
            setActiveTab(initialTab);
        }
    }, [open, initialTab]);

    const handleSave = async (values: any) => {
        try {
            const payload = { ...values };
            if (payload.ngay_sinh) {
                payload.ngay_sinh = payload.ngay_sinh.toISOString();
            }

            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success('Cập nhật hồ sơ thành công! Yêu cầu tải lại trang.');
                onClose();
                router.refresh();
                return true;
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi cập nhật hồ sơ');
                return false;
            }
        } catch (error) {
            message.error('Lỗi kết nối');
            return false;
        }
    };

    const fieldsConfig: FieldConfig[] = [
        { id: 'username', label: 'Tên đăng nhập', type: 'input', disabled: true, span: 12 },
        { id: 'name', label: 'Tên hiển thị', type: 'input', required: true, span: 12 },
        { id: 'telegram_id', label: 'Telegram ID', type: 'input', span: 24 },
    ];

    if (user?.role === 'CNTT') {
        fieldsConfig.push({
            id: 'isAvailable',
            label: 'Sẵn sàng nhận việc (Trực ban)',
            type: 'switch',
            valuePropName: 'checked',
            span: 24
        });
    }

    if (hasStaff) {
        fieldsConfig.push(
            { id: 'ma_nv', label: 'Mã NV (Nhân viên)', type: 'input', span: 12 },
            { id: 'ho_ten', label: 'Họ và tên (Nhân viên)', type: 'input', span: 12 },
            { id: 'ngay_sinh', label: 'Ngày sinh', type: 'date', span: 8 },
            { 
                id: 'gioi_tinh_id', 
                label: 'Giới tính', 
                type: 'select', 
                span: 8,
                options: genders.map(g => ({ value: g.id, label: g.name })) 
            },
            { id: 'so_dien_thoai', label: 'Số điện thoại', type: 'input', span: 8 },
            { id: 'dia_chi', label: 'Địa chỉ', type: 'input', span: 24 },
            { 
                id: 'ma_khoa', 
                label: 'Khoa / Phòng', 
                type: 'select', 
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
        );
    }

    return (
        <Modal
            title={<span className="text-blue-600 text-xl font-bold">Cập nhật Hồ sơ Cá nhân</span>}
            open={open}
            onCancel={onClose}
            footer={null}
            width="80vw"
            destroyOnHidden
            style={{ top: 20 }}
            styles={{ body: { padding: '0 24px 24px 24px' } }}
        >
            <Tabs type="card" 
                activeKey={activeTab} 
                onChange={setActiveTab}
                items={[
                    {
                        key: '1',
                        label: 'Thông tin cá nhân',
                        children: (
                            <DynamicForm
                                formId="profile_update_form"
                                title={<span className="text-lg font-semibold">Chi tiết hồ sơ</span>}
                                open={open}
                                onClose={onClose}
                                onSubmit={handleSave}
                                fieldsConfig={fieldsConfig}
                                initialData={initialData}
                                mode="inline"
                            />
                        )
                    },
                    {
                        key: '2',
                        label: 'Phạm vi chuyên môn & Dịch vụ',
                        children: <MyServicesTab />
                    }
                ]}
            />
        </Modal>
    );
}

'use client';

import React, { useState } from 'react';
import { Form, Button, Tabs, Modal, message } from 'antd';
import { ArrowLeftOutlined, BugOutlined, MessageOutlined, FormOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { getBasePath } from '@/utils/config';

import { useITRequestData } from '../hooks/useITRequestData';
import { useImageUpload } from '../hooks/useImageUpload';
import { ChatTab } from '../components/ChatTab';
import { FormTab } from '../components/FormTab';

interface SharedCreateRequestPageProps {
    targetDepartment: string;
    backPath: string;
}

export function SharedCreateRequestPage({ targetDepartment, backPath }: SharedCreateRequestPageProps) {
    const [form] = Form.useForm();
    const router = useRouter();
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === targetDepartment;
    const isManager = user?.isManager || user?.role === 'ADMIN';

    const [activeTab, setActiveTab] = useState('chat');
    const [loading, setLoading] = useState(false);

    const {
        softwareErrors,
        hardwareErrors,
        allStaffs,
        departments,
        departmentStaff,
        setDepartmentStaff,
        itUsers,
        maxImageSizeMB,
        savedStaffId,
        setSavedStaffId
    } = useITRequestData(isAdmin, user?.role, user?.ma_khoa, user?.staffId, form, targetDepartment);

    const {
        fileList,
        previewOpen,
        previewImage,
        setPreviewOpen,
        uploadProps,
        handleFileChange
    } = useImageUpload(maxImageSizeMB);

    const handleCreateTicket = async (values: any) => {
        setLoading(true);
        const dynamicObj: any = {};
        
        let finalTenLoi = '';

        if (values.category === 'SOFTWARE') {
            dynamicObj['Trạng thái BA'] = values.trang_thai_ba;
            dynamicObj['Ghi chú'] = values.ghi_chu;
            finalTenLoi = Array.isArray(values.ten_loi_software) ? values.ten_loi_software.join(', ') : (values.ten_loi_software || '');
        } else {
            dynamicObj['Ghi chú'] = values.ghi_chu;
            finalTenLoi = values.ten_loi_hardware || '';
        }

        const staff = departmentStaff.find((s: any) => s.id === values.nguoi_bao_id);
        const autoSdt = staff?.so_dien_thoai || '';
        
        dynamicObj['SĐT'] = autoSdt;

        if (staff) {
            dynamicObj['Người báo'] = staff.ho_ten;
            localStorage.setItem('last_it_request_staff_id', staff.id);
        }

        if (fileList.length > 0) {
            dynamicObj['Hình ảnh đính kèm'] = fileList.map((f: any) => f.url);
        }

        if (values.ke_hoach) {
            dynamicObj['Kế hoạch xử lý'] = values.ke_hoach;
        }

        try {
            const res = await fetch('/api/error-management/it-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ma_ba: values.category === 'SOFTWARE' ? values.ma_ba : null,
                    category: values.category || 'SOFTWARE',
                    ten_loi: finalTenLoi,
                    ma_khoa: isAdmin ? values.ma_khoa : 'KHOA_HIENTAI', 
                    assigneeId: values.assigneeId,
                    dynamicFields: dynamicObj,
                    nguoi_bao_id: values.nguoi_bao_id,
                    sdt: autoSdt,
                    targetDepartment
                })
            });

            if (res.ok) {
                message.success('Gửi yêu cầu thành công!');
                router.push(backPath);
            } else {
                const err = await res.json();
                message.error(err.error || 'Gửi yêu cầu thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    let title = 'Tạo Yêu Cầu Mới';
    let description = 'Điền thông tin sự cố để gửi cho phòng CNTT';
    if (targetDepartment === 'VTYT') description = 'Điền thông tin sự cố để gửi cho phòng Vật tư Y tế';
    if (targetDepartment === 'HCQT') description = 'Điền thông tin sự cố để gửi cho phòng Hành chính Quản trị';

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-[30px] py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                        <BugOutlined />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1 leading-tight">{title}</h1>
                        <p className="text-sm sm:text-base text-slate-500 m-0">{description}</p>
                    </div>
                </div>
                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto items-center">
                    <Link href={backPath}>
                        <Button size="large" icon={<ArrowLeftOutlined />} className="w-full sm:w-auto">Quay Lại</Button>
                    </Link>
                </div>
            </div>

            <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab}
                type="card" 
                className="mt-2"
                items={[
                    {
                        key: 'chat',
                        label: <span className="font-medium px-2 py-1 flex items-center gap-2"><MessageOutlined /> Tạo Nhanh (Khuyên dùng)</span>,
                        children: (
                            <ChatTab 
                                user={user}
                                isAdmin={isAdmin}
                                softwareErrors={softwareErrors}
                                hardwareErrors={hardwareErrors}
                                departmentStaff={departmentStaff}
                                departments={departments}
                                savedStaffId={savedStaffId}
                                setSavedStaffId={setSavedStaffId}
                                fileList={fileList}
                                uploadProps={uploadProps}
                                handleFileChange={handleFileChange}
                                setActiveTab={setActiveTab}
                                form={form}
                                targetDepartment={targetDepartment}
                            />
                        )
                    },
                    {
                        key: 'form',
                        label: <span className="font-medium px-2 py-1 flex items-center gap-2"><FormOutlined /> Điền Form (Truyền thống)</span>,
                        forceRender: true,
                        children: (
                            <FormTab 
                                form={form}
                                handleCreateTicket={handleCreateTicket}
                                isAdmin={isAdmin}
                                isManager={isManager}
                                softwareErrors={softwareErrors}
                                hardwareErrors={hardwareErrors}
                                departments={departments}
                                departmentStaff={departmentStaff}
                                setDepartmentStaff={setDepartmentStaff}
                                allStaffs={allStaffs}
                                itUsers={itUsers}
                                user={user}
                                setSavedStaffId={setSavedStaffId}
                                fileList={fileList}
                                uploadProps={uploadProps}
                                loading={loading}
                                targetDepartment={targetDepartment}
                            />
                        )
                    }
                ]}
            />

            <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} centered>
                <img alt="Preview" style={{ width: '100%', marginTop: '20px', borderRadius: '8px' }} src={previewImage?.startsWith('http') || previewImage?.startsWith('blob') || previewImage?.startsWith('data') ? previewImage : `${getBasePath()}${previewImage}`} />
            </Modal>
        </div>
    );
}

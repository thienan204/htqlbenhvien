'use client';

import React, { useState } from 'react';
import { Form, Button, Tabs, Modal, message } from 'antd';
import { ArrowLeftOutlined, BugOutlined, MessageOutlined, FormOutlined, FileTextOutlined, DesktopOutlined, ToolOutlined } from '@ant-design/icons';
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
        maBaLength,
        savedStaffId,
        setSavedStaffId
    } = useITRequestData(isAdmin, user?.role, user?.ma_khoa, user?.staffId, form, targetDepartment, isManager);

    const {
        fileList,
        previewOpen,
        previewImage,
        setPreviewOpen,
        uploadProps,
        handleFileChange,
        uploadPendingFiles,
        uploadingFiles,
        clearFiles
    } = useImageUpload(maxImageSizeMB);

    const handleCreateTicket = async (values: any) => {
        setLoading(true);
        const dynamicObj: any = {};
        
        let finalTenLoi = '';
        const currentCategory = values.category || (activeTab === 'hardware' ? 'HARDWARE' : 'SOFTWARE');

        if (currentCategory === 'SOFTWARE') {
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

        try {
            // Chỉ upload tệp lên máy chủ khi người dùng nhấn Gửi yêu cầu
            const uploadedUrls = await uploadPendingFiles();
            if (uploadedUrls.length > 0) {
                dynamicObj['Hình ảnh đính kèm'] = uploadedUrls;
                dynamicObj['Tệp đính kèm'] = uploadedUrls;
            }

            if (values.ke_hoach) {
                dynamicObj['Kế hoạch xử lý'] = values.ke_hoach;
            }

            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ma_ba: currentCategory === 'SOFTWARE' ? values.ma_ba : null,
                    category: currentCategory,
                    ten_loi: finalTenLoi,
                    ma_khoa: isAdmin ? values.ma_khoa : 'KHOA_HIENTAI', 
                    assigneeId: values.selfAssign ? user?.id : values.assigneeId,
                    selfAssign: Boolean(values.selfAssign),
                    dynamicFields: dynamicObj,
                    nguoi_bao_id: values.nguoi_bao_id,
                    sdt: autoSdt,
                    targetDepartment,
                    isFocusTask: Boolean(values.isFocusTask),
                    focusReason: values.focusReason,
                    status: values.status
                })
            });

            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                clearFiles();
                if (data.warningMessage) {
                    Modal.warning({
                        title: 'Đã gửi yêu cầu - Lưu ý tiếp nhận',
                        content: (
                            <div className="py-2">
                                <p className="text-amber-800 font-medium whitespace-pre-line leading-relaxed">{data.warningMessage}</p>
                            </div>
                        ),
                        okText: 'Đã hiểu và hoàn tất',
                        onOk: () => {
                            router.push(backPath);
                        }
                    });
                } else {
                    message.success('Gửi yêu cầu thành công!');
                    router.push(backPath);
                }
            } else {
                const err = await res.json();
                message.error(err.error || 'Gửi yêu cầu thất bại');
            }
        } catch (error: any) {
            console.error('Error submitting ticket:', error);
            message.error(error.message || 'Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    let title = 'Tạo Yêu Cầu Mới';
    let description = 'Điền thông tin sự cố để gửi cho phòng CNTT';
    if (targetDepartment === 'VTYT') description = 'Điền thông tin sự cố để gửi cho phòng Vật tư Y tế';
    if (targetDepartment === 'HCQT') description = 'Điền thông tin sự cố để gửi cho phòng Hành chính Quản trị';

    const handleTabChange = (key: string) => {
        setActiveTab(key);
    };

    const tabItems = [
        {
            key: 'chat',
            label: (
                <span className="font-medium px-1 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                    <MessageOutlined />
                    <span>Tạo Nhanh <span className="hidden sm:inline">(Khuyên dùng)</span></span>
                </span>
            ),
            children: (
                <ChatTab 
                    user={user}
                    isAdmin={isAdmin}
                    isManager={isManager}
                    itUsers={itUsers}
                    softwareErrors={softwareErrors}
                    hardwareErrors={hardwareErrors}
                    departmentStaff={departmentStaff}
                    departments={departments}
                    savedStaffId={savedStaffId}
                    setSavedStaffId={setSavedStaffId}
                    fileList={fileList}
                    uploadProps={uploadProps}
                    handleFileChange={handleFileChange}
                    uploadPendingFiles={uploadPendingFiles}
                    uploadingFiles={uploadingFiles}
                    clearFiles={clearFiles}
                    setActiveTab={handleTabChange}
                    form={form}
                    targetDepartment={targetDepartment}
                    maBaLength={maBaLength}
                />
            )
        },
        ...(targetDepartment === 'CNTT' ? [
            {
                key: 'software',
                label: (
                    <span className="font-medium px-1 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <FileTextOutlined />
                        <span>Bệnh án <span className="hidden sm:inline">(Phần mềm)</span></span>
                    </span>
                ),
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
                        savedStaffId={savedStaffId}
                        setSavedStaffId={setSavedStaffId}
                        fileList={fileList}
                        uploadProps={uploadProps}
                        loading={loading}
                        targetDepartment={targetDepartment}
                        maBaLength={maBaLength}
                        activeCategory="SOFTWARE"
                    />
                )
            },
            {
                key: 'hardware',
                label: (
                    <span className="font-medium px-1 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <DesktopOutlined />
                        <span>Thiết bị <span className="hidden sm:inline">(Phần cứng)</span></span>
                    </span>
                ),
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
                        savedStaffId={savedStaffId}
                        setSavedStaffId={setSavedStaffId}
                        fileList={fileList}
                        uploadProps={uploadProps}
                        loading={loading}
                        targetDepartment={targetDepartment}
                        maBaLength={maBaLength}
                        activeCategory="HARDWARE"
                    />
                )
            }
        ] : [
            {
                key: 'hardware',
                label: (
                    <span className="font-medium px-1 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <ToolOutlined />
                        <span>Điền Form Yêu cầu</span>
                    </span>
                ),
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
                        savedStaffId={savedStaffId}
                        setSavedStaffId={setSavedStaffId}
                        fileList={fileList}
                        uploadProps={uploadProps}
                        loading={loading}
                        targetDepartment={targetDepartment}
                        maBaLength={maBaLength}
                        activeCategory="HARDWARE"
                    />
                )
            }
        ])
    ];

    return (
        <div className="w-full max-w-[98%] mx-auto px-2.5 sm:px-[30px] py-3 sm:py-6 space-y-3 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                        <BugOutlined />
                    </div>
                    <div>
                        <h1 className="text-lg sm:text-2xl font-bold text-slate-800 mb-0.5 sm:mb-1 leading-tight">{title}</h1>
                        <p className="text-xs sm:text-base text-slate-500 m-0">{description}</p>
                    </div>
                </div>
                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto items-center">
                    <Link href={backPath} className="w-full sm:w-auto">
                        <Button size="middle" icon={<ArrowLeftOutlined />} className="w-full sm:w-auto h-9 font-medium">Quay Lại</Button>
                    </Link>
                </div>
            </div>

            <div className="overflow-x-auto">
                <Tabs 
                    activeKey={activeTab} 
                    onChange={handleTabChange}
                    type="card" 
                    className="mt-1 sm:mt-2"
                    items={tabItems}
                    destroyOnHidden
                />
            </div>

            <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} centered>
                <img alt="Preview" style={{ width: '100%', marginTop: '20px', borderRadius: '8px' }} src={previewImage?.startsWith('http') || previewImage?.startsWith('blob') || previewImage?.startsWith('data') ? previewImage : `${getBasePath()}${previewImage}`} />
            </Modal>
        </div>
    );
}

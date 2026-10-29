'use client';

import React, { useState, useEffect } from 'react';
import { Avatar, Button, Upload, message, Tooltip, Popconfirm, Tag } from 'antd';
import { 
    CameraOutlined, 
    DeleteOutlined, 
    LoadingOutlined, 
    UserOutlined,
    ApartmentOutlined,
    IdcardOutlined 
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { formatAvatarUrl } from '@/utils/avatar';

interface AvatarUploaderProps {
    value?: string | null;
    onChange: (url: string | null) => void;
    fallbackText?: string;
    disabled?: boolean;
    userName?: string;
    userRole?: string;
    userUsername?: string;
    deptName?: string;
    staffMaNv?: string;
    staffCccd?: string;
}

export default function AvatarUploader({
    value,
    onChange,
    fallbackText = 'U',
    disabled = false,
    userName,
    userRole,
    userUsername,
    deptName,
    staffMaNv,
    staffCccd,
}: AvatarUploaderProps) {
    const [uploading, setUploading] = useState(false);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setImgError(false);
    }, [value]);

    const handleCustomUpload: UploadProps['customRequest'] = async (options) => {
        const { file, onSuccess, onError } = options;
        const uploadFile = file as File;

        // Kiểm tra dung lượng
        if (uploadFile.size > 5 * 1024 * 1024) {
            message.error('Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.');
            onError?.(new Error('File too large'));
            return;
        }

        // Kiểm tra định dạng
        const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!acceptedTypes.includes(uploadFile.type)) {
            message.error('Chỉ chấp nhận định dạng ảnh JPG, PNG, WEBP hoặc GIF.');
            onError?.(new Error('Invalid file type'));
            return;
        }

        const formData = new FormData();
        formData.append('file', uploadFile);

        try {
            setUploading(true);
            const response = await fetch('/api/upload/avatar', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok && data.url) {
                message.success('Cập nhật ảnh đại diện thành công!');
                onChange(data.url);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('user-avatar-updated', { detail: data.url }));
                }
                onSuccess?.(data);
            } else {
                message.error(data.error || 'Lỗi khi tải ảnh lên');
                onError?.(new Error(data.error || 'Upload error'));
            }
        } catch (error: any) {
            console.error('Upload avatar error:', error);
            message.error('Lỗi kết nối khi tải ảnh lên');
            onError?.(error);
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveAvatar = async () => {
        try {
            setUploading(true);
            const res = await fetch('/api/upload/avatar', { method: 'DELETE' });
            if (res.ok) {
                onChange(null);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('user-avatar-updated', { detail: null }));
                }
                message.success('Đã gỡ ảnh đại diện!');
            } else {
                message.error('Không thể gỡ ảnh đại diện');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi gỡ ảnh');
        } finally {
            setUploading(false);
        }
    };

    const getInitials = (text?: string) => {
        if (!text) return null;
        const clean = text.trim();
        // Nếu toàn số (ví dụ CCCD, mã số) -> không hiển thị số cắt cụt
        if (/^\d+$/.test(clean)) return null;
        
        const words = clean.split(/\s+/).filter(Boolean);
        if (words.length === 0) return null;
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        
        // Lấy chữ cái đầu của từ cuối cùng (tên người Việt: "Hoàng Thế Lâm" -> "L")
        const lastName = words[words.length - 1];
        return lastName.charAt(0).toUpperCase();
    };

    const getRoleColor = (role?: string) => {
        switch (role?.toUpperCase()) {
            case 'ADMIN': return 'magenta';
            case 'CNTT': return 'blue';
            case 'DOCTOR': case 'BAC_SI': return 'cyan';
            case 'NURSE': case 'DIEU_DUONG': return 'green';
            case 'LEADER': return 'orange';
            default: return 'geekblue';
        }
    };

    const displayName = userName || (fallbackText !== 'U' ? fallbackText : 'Cán bộ nhân viên');
    const initials = getInitials(displayName || fallbackText);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 p-3.5 sm:p-4 mb-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-slate-50/70 rounded-2xl border border-blue-100/90 shadow-xs relative">
            {/* Vùng hiển thị Avatar (dùng object-contain trên nền trắng để logo/ảnh không bao giờ bị cắt cụt) */}
            <div className="relative group shrink-0 self-center">
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full p-1 bg-white shadow-md ring-2 ring-blue-500/20 flex items-center justify-center overflow-hidden">
                    {uploading ? (
                        <div className="w-full h-full rounded-full bg-slate-50 flex items-center justify-center text-blue-600 text-xl">
                            <LoadingOutlined spin />
                        </div>
                    ) : (value && !imgError) ? (
                        <img
                            src={formatAvatarUrl(value)}
                            alt={displayName}
                            className="w-full h-full object-contain p-0.5 bg-white rounded-full transition-transform duration-300 group-hover:scale-105"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <Avatar
                            size={72}
                            className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-2xl font-bold flex items-center justify-center shadow-inner"
                        >
                            {initials || <UserOutlined className="text-2xl text-white" />}
                        </Avatar>
                    )}
                </div>

                {/* Badge camera nhỏ trên góc */}
                <Upload
                    customRequest={handleCustomUpload}
                    showUploadList={false}
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={disabled || uploading}
                >
                    <Tooltip title="Tải ảnh lên / Thay đổi">
                        <button
                            type="button"
                            disabled={disabled || uploading}
                            aria-label="Đổi ảnh đại diện"
                            className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md border-2 border-white transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            <CameraOutlined className="text-xs" />
                        </button>
                    </Tooltip>
                </Upload>
            </div>

            {/* Thông tin hồ sơ tóm tắt */}
            <div className="flex-1 flex flex-col justify-center min-w-0 text-center sm:text-left space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-base sm:text-lg font-bold text-slate-800 tracking-tight truncate max-w-full">
                        {displayName}
                    </span>
                    {userRole && (
                        <Tag color={getRoleColor(userRole)} className="font-semibold text-xs rounded-md px-2 py-0.5 border-none m-0 shadow-xs">
                            {userRole}
                        </Tag>
                    )}
                    {userUsername && (
                        <span className="text-xs text-slate-400 font-mono">@{userUsername}</span>
                    )}
                </div>

                {deptName && (
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs sm:text-sm text-slate-600 font-medium">
                        <ApartmentOutlined className="text-blue-500 shrink-0" />
                        <span className="truncate">{deptName}</span>
                    </div>
                )}

                {(staffMaNv || staffCccd) && (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-slate-500 pt-0.5">
                        {staffMaNv && (
                            <span className="inline-flex items-center gap-1 bg-white/90 border border-slate-200/90 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700 shadow-xs">
                                <IdcardOutlined className="text-slate-400" />
                                Mã NV: <strong className="text-blue-600">{staffMaNv}</strong>
                            </span>
                        )}
                        {staffCccd && (
                            <span className="inline-flex items-center gap-1 bg-white/90 border border-slate-200/90 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700 shadow-xs">
                                CCCD: <span className="font-mono text-slate-600">{staffCccd}</span>
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Cụm hành động đổi / gỡ ảnh */}
            <div className="flex flex-col items-center sm:items-end justify-center gap-1.5 shrink-0 self-center">
                <div className="flex items-center gap-2">
                    <Upload
                        customRequest={handleCustomUpload}
                        showUploadList={false}
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        disabled={disabled || uploading}
                    >
                        <Button
                            type="primary"
                            size="middle"
                            icon={uploading ? <LoadingOutlined spin /> : <CameraOutlined />}
                            loading={uploading}
                            disabled={disabled}
                            className="bg-blue-600 hover:bg-blue-500 font-medium rounded-lg shadow-sm"
                        >
                            {value ? 'Đổi ảnh' : 'Tải ảnh lên'}
                        </Button>
                    </Upload>

                    {value && (
                        <Popconfirm
                            title="Xóa ảnh đại diện"
                            description="Bạn có chắc muốn xóa ảnh đại diện và quay về chữ cái mặc định?"
                            onConfirm={handleRemoveAvatar}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                        >
                            <Tooltip title="Gỡ ảnh">
                                <Button
                                    danger
                                    size="middle"
                                    icon={<DeleteOutlined />}
                                    disabled={disabled || uploading}
                                    className="rounded-lg"
                                />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </div>

                <span className="text-[11px] text-slate-400 text-center sm:text-right">
                    JPG, PNG, WEBP &le; 5MB
                </span>
            </div>
        </div>
    );
}

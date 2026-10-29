'use client';

import React, { useState, useEffect } from 'react';
import { Avatar, Button, Upload, message, Tooltip, Popconfirm } from 'antd';
import { CameraOutlined, DeleteOutlined, LoadingOutlined, UserOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { formatAvatarUrl } from '@/utils/avatar';

interface AvatarUploaderProps {
    value?: string | null;
    onChange: (url: string | null) => void;
    fallbackText?: string;
    disabled?: boolean;
}

export default function AvatarUploader({
    value,
    onChange,
    fallbackText = 'U',
    disabled = false,
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

    const initials = getInitials(fallbackText);

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 mb-6 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 rounded-2xl border border-blue-100/80 shadow-sm">
            {/* Vùng hiển thị Avatar */}
            <div className="relative group">
                <div className="w-24 h-24 rounded-full p-1 bg-white shadow-md ring-2 ring-blue-400/30 flex items-center justify-center overflow-hidden">
                    {uploading ? (
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-blue-600 text-2xl">
                            <LoadingOutlined spin />
                        </div>
                    ) : (value && !imgError) ? (
                        <img
                            src={formatAvatarUrl(value)}
                            alt="Avatar"
                            className="w-full h-full object-cover rounded-full"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <Avatar
                            size={88}
                            className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-3xl font-bold flex items-center justify-center shadow-inner"
                        >
                            {initials || <UserOutlined className="text-3xl text-white" />}
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
                    <button
                        type="button"
                        disabled={disabled || uploading}
                        aria-label="Đổi ảnh đại diện"
                        className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md border-2 border-white transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        <CameraOutlined className="text-sm" />
                    </button>
                </Upload>
            </div>

            {/* Thông tin & Hành động */}
            <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <Upload
                        customRequest={handleCustomUpload}
                        showUploadList={false}
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        disabled={disabled || uploading}
                    >
                        <Button
                            type="primary"
                            icon={uploading ? <LoadingOutlined spin /> : <CameraOutlined />}
                            loading={uploading}
                            disabled={disabled}
                            className="bg-blue-600 hover:bg-blue-500 font-medium rounded-lg shadow-sm"
                        >
                            {value ? 'Đổi ảnh đại diện' : 'Tải ảnh lên'}
                        </Button>
                    </Upload>

                    {value && (
                        <Popconfirm
                            title="Xóa ảnh đại diện"
                            description="Bạn có chắc chắn muốn xóa ảnh đại diện và quay về chữ cái mặc định?"
                            onConfirm={handleRemoveAvatar}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                        >
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                disabled={disabled || uploading}
                                className="rounded-lg"
                            >
                                Gỡ ảnh
                            </Button>
                        </Popconfirm>
                    )}
                </div>

                <div className="text-xs text-slate-500 leading-relaxed">
                    Hỗ trợ định dạng: <span className="font-semibold text-slate-600">JPG, PNG, WEBP</span> (Tối đa <span className="font-semibold text-slate-600">5MB</span>). Ảnh vuông hoặc tròn sẽ hiển thị đẹp nhất.
                </div>
            </div>
        </div>
    );
}

import React, { useState, useRef } from 'react';
import { Input, Image as AntImage, Button, Tooltip, message, Spin } from 'antd';
import { PictureOutlined, CloseCircleFilled, LoadingOutlined, PaperClipOutlined } from '@ant-design/icons';
import { getBasePath } from '@/utils/config';

interface PasteImageTextAreaProps {
    value?: string;
    onChange?: (val: string) => void;
    images: string[];
    onImagesChange: (images: string[]) => void;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
}

export const PasteImageTextArea: React.FC<PasteImageTextAreaProps> = ({
    value = '',
    onChange,
    images = [],
    onImagesChange,
    placeholder = 'Nhập nội dung phản hồi, chẩn đoán lỗi... (Có thể bấm Ctrl + V dán ảnh trực tiếp vào đây)',
    rows = 4,
    disabled = false
}) => {
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadFile = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file, file.name || 'clipboard.jpg');

            const res = await fetch(`${getBasePath()}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok && data.url) {
                onImagesChange([...images, data.url]);
                message.success('Đã dán ảnh thành công!');
            } else {
                message.error(data.error || 'Lỗi tải ảnh lên máy chủ');
            }
        } catch (error) {
            console.error('Error uploading pasted image:', error);
            message.error('Lỗi khi tải ảnh lên');
        } finally {
            setUploading(false);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardItems = e.clipboardData?.items;
        if (!clipboardItems) return;

        let hasImage = false;
        for (let i = 0; i < clipboardItems.length; i++) {
            const item = clipboardItems[i];
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    hasImage = true;
                    uploadFile(file);
                }
            }
        }
        // Nếu dán ảnh thì không chặn gõ text nếu clipboard vừa có text vừa có ảnh
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            files.forEach(file => uploadFile(file));
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        onImagesChange(images.filter((_, idx) => idx !== indexToRemove));
    };

    return (
        <div className="space-y-2">
            <div className="relative">
                <Input.TextArea
                    value={value}
                    onChange={(e) => onChange?.(e.target.value)}
                    onPaste={handlePaste}
                    placeholder={placeholder}
                    rows={rows}
                    disabled={disabled}
                    className="!rounded-xl text-[13px] leading-relaxed pr-8"
                />
                {uploading && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-white/90 px-2 py-0.5 rounded-md border border-blue-200 text-blue-600 text-xs shadow-sm">
                        <LoadingOutlined spin /> Đang tải ảnh...
                    </div>
                )}
            </div>

            {/* Thanh công cụ và hình ảnh xem trước */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileInputChange}
                    />
                    <Button
                        size="small"
                        icon={<PaperClipOutlined />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || uploading}
                        className="text-xs text-slate-600 hover:text-blue-600 rounded-lg flex items-center"
                    >
                        Chọn / Chụp ảnh
                    </Button>
                    <span className="text-[11px] text-slate-400 italic">
                        💡 Mẹo: Chụp màn hình rồi bấm <b>Ctrl + V</b> để dán ảnh trực tiếp
                    </span>
                </div>

                {images.length > 0 && (
                    <span className="text-xs font-semibold text-slate-500">
                        Đã đính kèm: {images.length} ảnh
                    </span>
                )}
            </div>

            {/* Danh sách ảnh đã đính kèm */}
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <AntImage.PreviewGroup>
                        {images.map((url, idx) => (
                            <div key={idx} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-2xs bg-white shrink-0">
                                <AntImage
                                    src={url.startsWith('/') ? `${getBasePath()}${url}` : url}
                                    alt={`Ảnh đính kèm ${idx + 1}`}
                                    width={64}
                                    height={64}
                                    className="object-cover w-full h-full"
                                />
                                {!disabled && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveImage(idx);
                                        }}
                                        className="absolute top-0.5 right-0.5 text-red-500 hover:text-red-700 bg-white/90 rounded-full shadow-sm text-sm leading-none opacity-80 hover:opacity-100 transition-opacity z-10"
                                        title="Xóa ảnh này"
                                    >
                                        <CloseCircleFilled />
                                    </button>
                                )}
                            </div>
                        ))}
                    </AntImage.PreviewGroup>
                </div>
            )}
        </div>
    );
};

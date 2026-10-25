import React, { useRef } from 'react';
import { Input, Image as AntImage, Button, message } from 'antd';
import { CloseCircleFilled, PaperClipOutlined } from '@ant-design/icons';
import { getBasePath } from '@/utils/config';
import { DetectedLinkBar } from '@/components/common/LinkifiedText';

export interface AttachmentItem {
    id: string;
    url: string; // URL server hoặc blob url preview
    name: string;
    file?: File;
    isPending?: boolean;
}

interface PasteImageTextAreaProps {
    value?: string;
    onChange?: (val: string) => void;
    images: (string | AttachmentItem)[];
    onImagesChange: (images: AttachmentItem[]) => void;
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Chuẩn hóa images sang AttachmentItem[]
    const normalizedImages: AttachmentItem[] = images.map((item, idx) => {
        if (typeof item === 'string') {
            return {
                id: `existing-${idx}-${item}`,
                url: item,
                name: item.split('/').pop() || `Tệp ${idx + 1}`,
                isPending: false
            };
        }
        return item;
    });

    const addFiles = (files: File[]) => {
        const newItems: AttachmentItem[] = [];
        for (const file of files) {
            const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
            const previewUrl = isImage ? URL.createObjectURL(file) : '';
            newItems.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                file,
                name: file.name || (isImage ? 'anh_dan.jpg' : 'tep_dinh_kem'),
                url: previewUrl,
                isPending: true
            });
        }
        if (newItems.length > 0) {
            onImagesChange([...normalizedImages, ...newItems]);
            message.success(`Đã chọn: ${newItems.map(i => i.name).join(', ')}`);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardItems = e.clipboardData?.items;
        if (!clipboardItems) return;

        const filesToAdd: File[] = [];
        for (let i = 0; i < clipboardItems.length; i++) {
            const item = clipboardItems[i];
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    filesToAdd.push(file);
                }
            }
        }
        if (filesToAdd.length > 0) {
            addFiles(filesToAdd);
        }
    };

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            addFiles(files);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveItem = (idToRemove: string) => {
        const target = normalizedImages.find(i => i.id === idToRemove);
        if (target && target.url && target.url.startsWith('blob:')) {
            try {
                URL.revokeObjectURL(target.url);
            } catch (e) {
                console.error('Error revoking object URL:', e);
            }
        }
        onImagesChange(normalizedImages.filter(i => i.id !== idToRemove));
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
            </div>

            {/* Hiển thị các liên kết phát hiện được trong nội dung để click mở ngay */}
            <DetectedLinkBar text={value} />

            {/* Thanh công cụ và đính kèm tệp */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="*"
                        multiple
                        className="hidden"
                        onChange={handleFileInputChange}
                    />
                    <Button
                        size="small"
                        icon={<PaperClipOutlined />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled}
                        className="text-xs text-slate-600 hover:text-blue-600 rounded-lg flex items-center"
                    >
                        Chọn ảnh / Đính kèm tệp
                    </Button>
                    <span className="text-[11px] text-slate-400 italic">
                        💡 Hỗ trợ đính kèm ảnh (Ctrl + V dán trực tiếp), Word, Excel, PDF, Zip...
                    </span>
                </div>

                {normalizedImages.length > 0 && (
                    <span className="text-xs font-semibold text-slate-500">
                        Đã đính kèm: {normalizedImages.length} tệp
                    </span>
                )}
            </div>

            {/* Danh sách tệp/ảnh đã đính kèm */}
            {normalizedImages.length > 0 && (
                <div className="flex flex-wrap gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <AntImage.PreviewGroup>
                        {normalizedImages.map((item) => {
                            const isImg = (item.file && item.file.type.startsWith('image/')) || 
                                          /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name || item.url) || 
                                          item.url.startsWith('blob:');
                            const isPdf = /\.pdf$/i.test(item.name || item.url);
                            const isWord = /\.(doc|docx)$/i.test(item.name || item.url);
                            const isExcel = /\.(xls|xlsx)$/i.test(item.name || item.url);
                            const isZip = /\.(zip|rar|7z)$/i.test(item.name || item.url);

                            if (isImg && item.url) {
                                return (
                                    <div key={item.id} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-slate-200 shadow-2xs bg-white shrink-0">
                                        <AntImage
                                            src={item.url.startsWith('/') ? `${getBasePath()}${item.url}` : item.url}
                                            alt={item.name}
                                            width={64}
                                            height={64}
                                            className="object-cover w-full h-full"
                                        />
                                        {!disabled && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveItem(item.id);
                                                }}
                                                className="absolute top-0.5 right-0.5 text-red-500 hover:text-red-700 bg-white/90 rounded-full shadow-sm text-sm leading-none opacity-80 hover:opacity-100 transition-opacity z-10 cursor-pointer"
                                                title="Xóa ảnh này"
                                            >
                                                <CloseCircleFilled />
                                            </button>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div key={item.id} className="relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white shadow-2xs text-xs max-w-[240px]">
                                    <span className="text-base shrink-0">
                                        {isPdf ? '📕' : isWord ? '📘' : isExcel ? '📗' : isZip ? '📦' : '📄'}
                                    </span>
                                    {item.isPending ? (
                                        <span 
                                            className="truncate text-slate-700 font-medium flex-1 cursor-help"
                                            title={`Tệp: ${item.name} (Sẽ tải lên khi bạn nhấn Lưu cập nhật)`}
                                        >
                                            {item.name}
                                        </span>
                                    ) : (
                                        <a 
                                            href={item.url.startsWith('/') ? `${getBasePath()}${item.url}` : item.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="truncate text-blue-600 hover:underline flex-1"
                                            title={item.name}
                                        >
                                            {item.name}
                                        </a>
                                    )}
                                    {!disabled && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveItem(item.id);
                                            }}
                                            className="text-red-400 hover:text-red-600 ml-1 shrink-0 text-sm cursor-pointer"
                                            title="Xóa tệp này"
                                        >
                                            <CloseCircleFilled />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </AntImage.PreviewGroup>
                </div>
            )}
        </div>
    );
};

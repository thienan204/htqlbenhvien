'use client';

import React, { useState } from 'react';
import { Image as AntImage, Tooltip } from 'antd';
import { 
    FilePdfOutlined, 
    FileWordOutlined, 
    FileExcelOutlined, 
    FileZipOutlined, 
    FileTextOutlined,
    DownloadOutlined 
} from '@ant-design/icons';
import { getBasePath } from '@/utils/config';

interface TicketImageProps {
    url: string;
}

export const TicketImage: React.FC<TicketImageProps> = ({ url }) => {
    const [hasError, setHasError] = useState(false);

    if (!url) return null;

    const fullUrl = url.startsWith('http') ? url : `${getBasePath()}${url}`;
    const cleanFileName = url.split('/').pop()?.replace(/^\d+-/, '') || url.split('/').pop() || 'Tệp đính kèm';
    const ext = (cleanFileName.split('.').pop() || '').toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);

    if (isImage) {
        if (hasError) {
            return (
                <div className="w-[40px] h-[40px] flex items-center justify-center bg-slate-50 border border-dashed border-red-300 rounded overflow-hidden p-0.5" title="Ảnh không tồn tại hoặc đã bị xóa">
                    <span className="text-[8px] text-red-500 font-medium text-center leading-[1.1]">Ảnh đã<br/>xoá</span>
                </div>
            );
        }

        return (
            <AntImage 
                src={fullUrl} 
                width={40} 
                height={40} 
                className="object-cover rounded border border-slate-200 cursor-pointer shadow-2xs hover:opacity-90 transition-opacity"
                onError={() => setHasError(true)}
            />
        );
    }

    // Hiển thị cho các tệp tài liệu (PDF, Word, Excel, Zip...)
    const renderIcon = () => {
        if (ext === 'pdf') return <FilePdfOutlined className="text-base text-red-500 shrink-0" />;
        if (['doc', 'docx'].includes(ext)) return <FileWordOutlined className="text-base text-blue-500 shrink-0" />;
        if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileExcelOutlined className="text-base text-emerald-600 shrink-0" />;
        if (['zip', 'rar', '7z'].includes(ext)) return <FileZipOutlined className="text-base text-amber-500 shrink-0" />;
        return <FileTextOutlined className="text-base text-slate-400 shrink-0" />;
    };

    return (
        <Tooltip title={`Bấm để mở / tải về: ${cleanFileName}`}>
            <a 
                href={fullUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center gap-1.5 px-2 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-md text-xs text-blue-700 font-medium shadow-2xs transition-colors shrink-0 max-w-[190px] h-[34px]"
            >
                {renderIcon()}
                <span className="truncate flex-1 text-[11px] text-slate-700 leading-tight">
                    {cleanFileName}
                </span>
                <DownloadOutlined className="text-[11px] text-slate-400 shrink-0 hover:text-blue-600" />
            </a>
        </Tooltip>
    );
};


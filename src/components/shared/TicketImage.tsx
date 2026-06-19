'use client';

import React, { useState } from 'react';
import { Image as AntImage } from 'antd';
import { getBasePath } from '@/utils/config';

interface TicketImageProps {
    url: string;
}

export const TicketImage: React.FC<TicketImageProps> = ({ url }) => {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        return (
            <div className="w-[40px] h-[40px] flex items-center justify-center bg-slate-50 border border-dashed border-red-300 rounded overflow-hidden p-0.5">
                <span className="text-[8px] text-red-500 font-medium text-center leading-[1.1]">Ảnh đã<br/>xoá</span>
            </div>
        );
    }

    const fullUrl = url.startsWith('http') ? url : `${getBasePath()}${url}`;

    return (
        <AntImage 
            src={fullUrl} 
            width={40} 
            height={40} 
            className="object-cover rounded border border-slate-200 cursor-pointer"
            onError={() => setHasError(true)}
        />
    );
};

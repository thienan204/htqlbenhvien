'use client';

import React, { useState, useEffect } from 'react';
import { Tooltip, message } from 'antd';
import { PhoneOutlined } from '@ant-design/icons';

interface PhoneCallActionsProps {
    phone?: string | null;
    className?: string;
    showZalo?: boolean;
    showCall?: boolean;
    size?: 'small' | 'middle';
}

export const PhoneCallActions: React.FC<PhoneCallActionsProps> = ({
    phone,
    className = '',
    showZalo = true,
    showCall = true,
    size = 'small'
}) => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof navigator !== 'undefined') {
            setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        }
    }, []);

    if (!phone) return null;

    // Làm sạch số điện thoại (chỉ giữ lại số)
    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) return null;

    const isSmall = size === 'small';

    const handleZaloClick = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (isMobile) {
            // Trên điện thoại di động: Điều hướng trực tiếp để iOS/Android nhận Universal Link và bật ngay App Zalo lập tức
            window.location.href = `https://zalo.me/${cleanPhone}`;
            return;
        }

        // Trên máy tính: Tự động sao chép SĐT vào Clipboard để người dùng dán (Ctrl+V) nhanh vào ô tìm kiếm Zalo PC nếu muốn
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(cleanPhone).then(() => {
                message.success({
                    content: `Đã sao chép SĐT: ${cleanPhone} (có thể dán Ctrl+V vào tìm kiếm Zalo PC)`,
                    duration: 3
                });
            }).catch(() => {});
        }
    };

    return (
        <span
            className={`inline-flex items-center gap-1 shrink-0 ${className}`}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Nút Gọi & Nhắn tin Zalo */}
            {showZalo && (
                <Tooltip title={isMobile ? `Mở App Zalo: ${cleanPhone}` : `Mở Zalo: ${cleanPhone} (Tự động copy SĐT để dán vào Zalo PC)`} placement="top">
                    <a
                        href={`https://zalo.me/${cleanPhone}`}
                        target={isMobile ? '_self' : '_blank'}
                        rel={isMobile ? undefined : 'noopener noreferrer'}
                        onClick={handleZaloClick}
                        className={`inline-flex items-center justify-center font-bold text-white bg-[#0068FF] hover:bg-[#0052cc] rounded shadow-2xs transition-all hover:scale-105 active:scale-95 select-none ${
                            isSmall ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2 py-1 text-xs'
                        }`}
                        title="Mở Zalo"
                    >
                        <span className="tracking-tight">Zalo</span>
                    </a>
                </Tooltip>
            )}

            {/* Nút Gọi điện thoại trực tiếp (tel:) qua Tổng đài / Phone Link / Ứng dụng cuộc gọi */}
            {showCall && (
                <Tooltip title={`Gọi thoại trực tiếp (Tổng đài / Phone Link / Di động): ${cleanPhone}`} placement="top">
                    <a
                        href={`tel:${cleanPhone}`}
                        className={`inline-flex items-center justify-center gap-0.5 font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-2xs transition-all hover:scale-105 active:scale-95 select-none ${
                            isSmall ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2 py-1 text-xs'
                        }`}
                        title="Gọi điện thoại"
                    >
                        <PhoneOutlined className="text-[10px]" />
                        <span>Gọi</span>
                    </a>
                </Tooltip>
            )}
        </span>
    );
};


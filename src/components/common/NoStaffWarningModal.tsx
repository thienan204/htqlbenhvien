'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Tooltip, message } from 'antd';
import { 
    PhoneOutlined, 
    CopyOutlined, 
    CheckOutlined, 
    ExclamationCircleFilled 
} from '@ant-design/icons';
import { extractPhoneNumbers, cleanPhoneNumber } from '@/lib/phoneUtils';

export interface NoStaffWarningContentProps {
    warningMessage?: string | null;
    hotline?: string | null;
}

export const NoStaffWarningContent: React.FC<NoStaffWarningContentProps> = ({
    warningMessage,
    hotline
}) => {
    const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof navigator !== 'undefined') {
            setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
        }
    }, []);

    // Thu thập tất cả số điện thoại (từ hotline truyền riêng hoặc tự bóc tách từ warningMessage)
    const phoneList: { display: string; clean: string }[] = [];
    const seen = new Set<string>();

    if (hotline) {
        const clean = cleanPhoneNumber(hotline);
        if (clean && !seen.has(clean)) {
            seen.add(clean);
            phoneList.push({ display: hotline.trim(), clean });
        }
    }

    const extracted = extractPhoneNumbers(warningMessage);
    for (const raw of extracted) {
        const clean = cleanPhoneNumber(raw);
        if (clean && !seen.has(clean)) {
            seen.add(clean);
            phoneList.push({ display: raw, clean });
        }
    }

    const handleCopy = (display: string, clean: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(clean).then(() => {
                setCopiedPhone(clean);
                message.success(`Đã sao chép SĐT: ${display}`);
                setTimeout(() => setCopiedPhone(null), 2500);
            }).catch(() => {
                message.error('Không thể sao chép');
            });
        }
    };

    const handleZaloClick = (clean: string) => {
        if (!isMobile) {
            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(clean).then(() => {
                    message.success({
                        content: `Đã sao chép SĐT: ${clean} để dán vào Zalo PC`,
                        duration: 3
                    });
                }).catch(() => {});
            }
        }
    };

    return (
        <div className="py-1 space-y-3">
            {/* Nội dung thông điệp cảnh báo */}
            {warningMessage && (
                <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200/80 text-amber-900 leading-relaxed font-normal whitespace-pre-line text-sm">
                    {warningMessage}
                </div>
            )}

            {/* Khung số điện thoại trực ban & Nút gọi */}
            {phoneList.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 p-3 rounded-lg border border-amber-300 shadow-2xs">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-2 uppercase tracking-wide">
                        <PhoneOutlined className="text-red-500 animate-pulse" />
                        <span>Liên hệ trực ban / Hỗ trợ khẩn cấp:</span>
                    </div>

                    <div className="space-y-2">
                        {phoneList.map(({ display, clean }) => {
                            const isCopied = copiedPhone === clean;
                            return (
                                <div 
                                    key={clean}
                                    className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-md border border-amber-200 shadow-2xs"
                                >
                                    {/* Hiển thị số điện thoại */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                        <span className="text-base font-bold text-red-600 font-mono tracking-wider">
                                            {display}
                                        </span>
                                    </div>

                                    {/* Cụm nút thao tác */}
                                    <div className="flex items-center gap-1.5">
                                        {/* Nút Gọi ngay */}
                                        <Tooltip title="Gọi điện thoại trực tiếp (Di động / Phone Link / Tổng đài)">
                                            <a
                                                href={`tel:${clean}`}
                                                className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded shadow-2xs transition-all no-underline"
                                            >
                                                <PhoneOutlined />
                                                <span>Gọi ngay</span>
                                            </a>
                                        </Tooltip>

                                        {/* Nút Zalo */}
                                        <Tooltip title={isMobile ? "Mở ứng dụng Zalo" : "Mở Zalo (tự sao chép SĐT để dán vào Zalo PC)"}>
                                            <a
                                                href={`https://zalo.me/${clean}`}
                                                target={isMobile ? '_self' : '_blank'}
                                                rel={isMobile ? undefined : 'noopener noreferrer'}
                                                onClick={() => handleZaloClick(clean)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0068FF] hover:bg-[#0052cc] active:scale-95 text-white text-xs font-semibold rounded shadow-2xs transition-all no-underline"
                                            >
                                                <span className="font-bold">Zalo</span>
                                            </a>
                                        </Tooltip>

                                        {/* Nút Sao chép số */}
                                        <Tooltip title="Sao chép số để bấm máy bàn">
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(display, clean)}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border transition-all active:scale-95 cursor-pointer ${
                                                    isCopied 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                                                }`}
                                            >
                                                {isCopied ? <CheckOutlined className="text-emerald-600" /> : <CopyOutlined />}
                                                <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
                                            </button>
                                        </Tooltip>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export interface ShowNoStaffWarningModalOptions {
    title?: string;
    warningMessage?: string | null;
    hotline?: string | null;
    warningPhone?: string | null;
    okText?: string;
    onOk?: () => void;
}

export function showNoStaffWarningModal({
    title = 'Đã gửi yêu cầu - Lưu ý tiếp nhận',
    warningMessage,
    hotline,
    warningPhone,
    okText = 'Đã hiểu và hoàn tất',
    onOk
}: ShowNoStaffWarningModalOptions) {
    const resolvedPhone = hotline || warningPhone;
    return Modal.warning({
        title: (
            <div className="text-base font-bold text-amber-800 flex items-center gap-2">
                <span>{title}</span>
            </div>
        ),
        width: 520,
        icon: <ExclamationCircleFilled className="text-amber-500 text-2xl" />,
        content: (
            <NoStaffWarningContent 
                warningMessage={warningMessage} 
                hotline={resolvedPhone} 
            />
        ),
        okText,
        okButtonProps: {
            className: 'bg-amber-600 hover:bg-amber-500 text-white font-medium px-4'
        },
        onOk: () => {
            if (onOk) onOk();
        }
    });
}

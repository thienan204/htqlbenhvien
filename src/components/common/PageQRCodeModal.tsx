'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Modal, QRCode, Button, Input, Radio, message, Tooltip, Typography, Space } from 'antd';
import { 
    QrcodeOutlined, CopyOutlined, DownloadOutlined, 
    LinkOutlined, HomeOutlined, CheckOutlined, MobileOutlined, SafetyCertificateOutlined 
} from '@ant-design/icons';
import { getBasePath } from '@/utils/config';
import { SYSTEM_CONFIG } from '@/config/systemVersion';

const { Text, Paragraph } = Typography;

interface PageQRCodeModalProps {
    open: boolean;
    onClose: () => void;
    currentTitle?: string;
}

export default function PageQRCodeModal({ open, onClose, currentTitle }: PageQRCodeModalProps) {
    const [currentUrl, setCurrentUrl] = useState('');
    const [homeUrl, setHomeUrl] = useState('');
    const [targetType, setTargetType] = useState<'current' | 'home'>('current');
    const [customUrl, setCustomUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const origin = window.location.origin;
            const fullHref = window.location.href;
            const home = `${origin}${getBasePath()}`;
            setCurrentUrl(fullHref);
            setHomeUrl(home);
            setCustomUrl(fullHref);
            setTargetType('current');
        }
    }, [open]);

    const activeUrl = targetType === 'current' ? currentUrl : (targetType === 'home' ? homeUrl : customUrl);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(activeUrl);
            setCopied(true);
            message.success('Đã sao chép đường dẫn vào bộ nhớ tạm!');
            setTimeout(() => setCopied(false), 2500);
        } catch (e) {
            message.error('Không thể tự động sao chép, vui lòng sao chép thủ công');
        }
    };

    const handleDownload = () => {
        if (!qrRef.current) return;
        const canvas = qrRef.current.querySelector<HTMLCanvasElement>('canvas');
        if (!canvas) {
            message.warning('Đang tạo mã QR, vui lòng thử lại sau giây lát');
            return;
        }

        try {
            // Create a styled card image to download
            const padding = 32;
            const cardWidth = canvas.width + padding * 2;
            const cardHeight = canvas.height + 140;

            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = cardWidth;
            exportCanvas.height = cardHeight;
            const ctx = exportCanvas.getContext('2d');

            if (ctx) {
                // Background
                ctx.fillStyle = '#ffffff';
                ctx.roundRect ? ctx.roundRect(0, 0, cardWidth, cardHeight, 16) : ctx.rect(0, 0, cardWidth, cardHeight);
                ctx.fill();

                // Title
                ctx.fillStyle = '#1e293b';
                ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.textAlign = 'center';
                const pageName = targetType === 'current' ? (currentTitle || 'Truy Cập Nhanh Trang') : 'Trang Chủ Hệ Thống';
                ctx.fillText(pageName, cardWidth / 2, 28);

                ctx.fillStyle = '#0284c7';
                ctx.font = '600 12px sans-serif';
                ctx.fillText(SYSTEM_CONFIG.hospitalName, cardWidth / 2, 46);

                // Draw QR
                ctx.drawImage(canvas, padding, 56);

                // Footer
                ctx.fillStyle = '#64748b';
                ctx.font = '11px sans-serif';
                ctx.fillText('Quét bằng Camera điện thoại hoặc Zalo', cardWidth / 2, cardHeight - 20);

                const dataUrl = exportCanvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.download = `QR_${targetType === 'current' ? 'Trang_Hien_Tai' : 'Trang_Chu'}_BVDKLS.png`;
                downloadLink.href = dataUrl;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                message.success('Đã tải ảnh mã QR thành công!');
            }
        } catch (e) {
            console.error('Lỗi khi tải mã QR:', e);
            // Fallback: direct canvas download
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.download = 'Mã_QR_BVDKLS.png';
            a.href = url;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            message.success('Đã tải ảnh mã QR!');
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            centered
            width={460}
            destroyOnHidden
            title={
                <div className="flex items-center gap-2.5 text-slate-800 text-base font-bold">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                        <QrcodeOutlined />
                    </div>
                    <div>
                        <div>Mã QR Truy Cập Nhanh</div>
                        <div className="text-xs font-normal text-slate-500">{SYSTEM_CONFIG.hospitalName}</div>
                    </div>
                </div>
            }
        >
            <div className="py-2">
                {/* Selector Target */}
                <div className="mb-4 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <Radio.Group 
                        value={targetType} 
                        onChange={(e) => setTargetType(e.target.value)}
                        className="w-full grid grid-cols-2 text-center"
                        buttonStyle="solid"
                    >
                        <Radio.Button value="current" className="text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 py-1">
                            <LinkOutlined /> Trang hiện tại
                        </Radio.Button>
                        <Radio.Button value="home" className="text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 py-1">
                            <HomeOutlined /> Trang chủ
                        </Radio.Button>
                    </Radio.Group>
                </div>

                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center py-4 bg-gradient-to-b from-blue-50/50 to-indigo-50/30 rounded-2xl border border-blue-100/80 mb-4">
                    <div ref={qrRef} className="p-3.5 bg-white rounded-2xl shadow-md border border-slate-100 flex items-center justify-center">
                        <QRCode
                            value={activeUrl || 'http://localhost:3000'}
                            size={210}
                            icon={`${getBasePath()}/logo.png`}
                            iconSize={42}
                            bordered={false}
                            errorLevel="M"
                        />
                    </div>
                    <div className="mt-3 text-center">
                        <div className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5">
                            <MobileOutlined className="text-blue-500" />
                            Quét bằng Camera điện thoại hoặc Zalo
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                            {targetType === 'current' 
                                ? (currentTitle ? `Trang: ${currentTitle}` : 'Tự động mở trang bạn đang xem') 
                                : 'Mở cổng thông tin Trang chủ Bệnh viện'}
                        </div>
                    </div>
                </div>

                {/* URL Display and Copy */}
                <div className="mb-4">
                    <div className="text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
                        <span>Liên kết truy cập:</span>
                        <span className="text-[11px] text-slate-400">Click sao chép để gửi</span>
                    </div>
                    <Input.Search
                        value={activeUrl}
                        readOnly
                        enterButton={
                            <Button type="primary" icon={copied ? <CheckOutlined /> : <CopyOutlined />}>
                                {copied ? 'Đã chép' : 'Sao chép'}
                            </Button>
                        }
                        onSearch={handleCopy}
                        className="rounded-lg text-xs"
                    />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <Button 
                        icon={<DownloadOutlined />} 
                        onClick={handleDownload}
                        className="h-10 font-medium text-slate-700 border-slate-300 hover:border-blue-500 hover:text-blue-600 rounded-xl flex items-center justify-center gap-1.5"
                    >
                        Tải ảnh mã QR
                    </Button>
                    <Button 
                        type="primary"
                        onClick={onClose}
                        className="h-10 font-bold bg-blue-600 hover:bg-blue-700 rounded-xl"
                    >
                        Đóng
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

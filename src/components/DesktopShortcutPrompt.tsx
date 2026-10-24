'use client';

import React, { useState, useEffect } from 'react';
import { Button, message, Tooltip, Modal } from 'antd';
import { DesktopOutlined, CloseOutlined, CheckCircleOutlined, ThunderboltOutlined, InfoCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import { getBasePath } from '@/utils/config';

export default function DesktopShortcutPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [visible, setVisible] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [guideModalOpen, setGuideModalOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Đăng ký Service Worker để Chrome/Edge kích hoạt quyền PWA Desktop
        if ('serviceWorker' in navigator) {
            const basePath = getBasePath();
            navigator.serviceWorker.register(`${basePath}/sw.js`).catch((err) => {
                console.warn('Lỗi đăng ký Service Worker:', err);
            });
        }

        // 2. Nếu đang mở ở chế độ standalone (đã cài đặt App ngoài Desktop) -> không hiện prompt
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        if (isStandalone) {
            return;
        }

        // 3. Kiểm tra nếu người dùng đã đánh dấu "Đã cài đặt"
        const isInstalled = localStorage.getItem('bvdk_shortcut_installed') === 'true';
        if (isInstalled) {
            return;
        }

        // 4. Kiểm tra nếu người dùng chọn ẩn tạm thời (trong vòng 3 ngày)
        const dismissedUntil = localStorage.getItem('bvdk_shortcut_dismissed_until');
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
            return;
        }

        // 5. Lắng nghe sự kiện beforeinstallprompt từ Chrome / Edge / Cốc Cốc
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Hiển thị sau 2 giây khi vào trang nếu chưa có shortcut
        const timer = setTimeout(() => {
            setVisible(true);
        }, 2000);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            clearTimeout(timer);
        };
    }, []);

    // Tạo file kịch bản Windows (.bat) tự động ghi Icon ra đúng màn hình Desktop (Không lỗi font tiếng Việt)
    const downloadBatShortcut = () => {
        if (typeof window === 'undefined') return;
        try {
            const basePath = getBasePath();
            const targetUrl = `${window.location.origin}${basePath}/error-management/it-requests`;
            const iconUrl = `${window.location.origin}${basePath}/logo.png`;
            
            // Script chuẩn cú pháp Windows CMD: dùng tên ASCII không dấu tránh lỗi bảng mã tiếng Việt
            const batContent = 
`@echo off
setlocal
title Cai Dat Loi Tat - BVDK Loc Son

set "TARGET=%USERPROFILE%\\Desktop\\Bao_Loi_CNTT_BVDK_Loc_Son.url"

(
echo [InternetShortcut]
echo URL=${targetUrl}
echo IconIndex=0
echo IconFile=${iconUrl}
) > "%TARGET%"

if exist "%USERPROFILE%\\OneDrive\\Desktop" (
    copy /Y "%TARGET%" "%USERPROFILE%\\OneDrive\\Desktop\\Bao_Loi_CNTT_BVDK_Loc_Son.url" >nul 2>&1
)

if exist "C:\\Users\\Public\\Desktop" (
    copy /Y "%TARGET%" "C:\\Users\\Public\\Desktop\\Bao_Loi_CNTT_BVDK_Loc_Son.url" >nul 2>&1
)

cls
echo ========================================================
echo    DA TAO XONG LOI TAT RA MAN HINH DESKTOP!
echo ========================================================
echo.
echo Icon "Bao_Loi_CNTT_BVDK_Loc_Son" da xuat hien ngoai Desktop.
echo Ban co the dong cua so nay.
echo.
pause
`;

            const blob = new Blob([batContent], { type: 'application/x-bat;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Cai_Dat_Icon_Desktop.bat';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            message.success('Đã tải file cài đặt! Bấm "Open file" trên trình duyệt, màn hình đen hiện lên sẽ báo tạo thành công.');
        } catch (e) {
            message.error('Không thể tạo file cài đặt');
        }
    };

    // Tải file .url trực tiếp (Dành cho ai muốn kéo thả thẳng ra Desktop)
    const downloadDirectUrlFile = () => {
        if (typeof window === 'undefined') return;
        try {
            const basePath = getBasePath();
            const targetUrl = `${window.location.origin}${basePath}/error-management/it-requests`;
            const iconUrl = `${window.location.origin}${basePath}/logo.png`;
            
            const urlContent = `[InternetShortcut]\r\nURL=${targetUrl}\r\nIconIndex=0\r\nIconFile=${iconUrl}\r\nHotKey=0\r\n`;
            const blob = new Blob([urlContent], { type: 'application/internet-shortcut' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Bao_Loi_CNTT_BVDK_Loc_Son.url';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            message.success('Đã tải file lối tắt! Bạn có thể kéo file này ra màn hình Desktop.');
        } catch (e) {
            message.error('Lỗi khi tải file lối tắt');
        }
    };

    // Kích hoạt tính năng cài đặt PWA Desktop từ trình duyệt
    const handleInstallPWA = async () => {
        if (deferredPrompt) {
            setInstalling(true);
            try {
                deferredPrompt.prompt();
                const choiceResult = await deferredPrompt.userChoice;
                if (choiceResult.outcome === 'accepted') {
                    message.success('🎉 Đã tạo thành công lối tắt ứng dụng ra màn hình Desktop!');
                    localStorage.setItem('bvdk_shortcut_installed', 'true');
                    setVisible(false);
                } else {
                    downloadBatShortcut();
                }
            } catch (err) {
                downloadBatShortcut();
            } finally {
                setInstalling(false);
                setDeferredPrompt(null);
            }
        } else {
            downloadBatShortcut();
        }
    };

    const handleDismiss = () => {
        setVisible(false);
        localStorage.setItem('bvdk_shortcut_dismissed_until', (Date.now() + 3 * 24 * 60 * 60 * 1000).toString());
    };

    const handleMarkInstalled = () => {
        setVisible(false);
        localStorage.setItem('bvdk_shortcut_installed', 'true');
        message.info('Đã ghi nhận máy tính khoa phòng đã có lối tắt.');
    };

    if (!visible) return null;

    return (
        <>
            <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-[calc(100%-2rem)] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-blue-200 p-4 transition-all animate-in fade-in slide-in-from-bottom-5 duration-300">
                {/* Nút đóng góc trên */}
                <button 
                    type="button"
                    onClick={handleDismiss}
                    className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                    title="Để sau"
                >
                    <CloseOutlined className="text-xs" />
                </button>

                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0 border border-blue-100">
                        <DesktopOutlined />
                    </div>
                    <div className="pr-4">
                        <div className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                            <span>Đưa Lối Tắt Ra Desktop</span>
                            <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.2 rounded-full">Tiện ích</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            Tạo icon ngoài màn hình Desktop để mở báo lỗi CNTT nhanh chỉ với 1 click, không cần gõ link hay nhờ CNTT xuống cài đặt.
                        </p>
                    </div>
                </div>

                {/* Các nút hành động */}
                <div className="space-y-2 mt-3 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                        <Button 
                            type="primary" 
                            size="middle"
                            icon={<ThunderboltOutlined />}
                            loading={installing}
                            onClick={handleInstallPWA}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium text-xs shadow-sm"
                        >
                            Tạo Icon ra Desktop
                        </Button>

                        <Tooltip title="Đánh dấu máy này đã có icon rồi, không nhắc lại nữa">
                            <Button 
                                size="middle" 
                                type="default" 
                                icon={<CheckCircleOutlined />}
                                onClick={handleMarkInstalled}
                                className="rounded-xl text-slate-600 text-xs px-2.5"
                            >
                                Đã có
                            </Button>
                        </Tooltip>
                    </div>

                    {/* Hướng dẫn tạo trực tiếp từ trình duyệt Edge / Chrome (Không cần chạy file) */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <button
                            type="button"
                            onClick={() => setGuideModalOpen(true)}
                            className="text-blue-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                            <InfoCircleOutlined /> Xem cách tạo trực tiếp trên trình duyệt (3s)
                        </button>
                        <button
                            type="button"
                            onClick={downloadDirectUrlFile}
                            className="text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                            title="Tải file .url để tự kéo thả"
                        >
                            <DownloadOutlined /> Tải file .url
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal Hướng dẫn 2 click trên Chrome & Microsoft Edge */}
            <Modal
                open={guideModalOpen}
                onCancel={() => setGuideModalOpen(false)}
                footer={[
                    <Button key="ok" type="primary" onClick={() => setGuideModalOpen(false)} className="rounded-xl bg-blue-600">
                        Tôi đã hiểu
                    </Button>
                ]}
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <DesktopOutlined className="text-blue-600 text-lg" />
                        <span>Cách tạo Icon ra Desktop trực tiếp từ Trình duyệt</span>
                    </div>
                }
                centered
                width={560}
            >
                <div className="py-2 space-y-4 text-xs sm:text-sm text-slate-700">
                    <p className="m-0 text-slate-600">
                        Bạn có thể dùng tính năng có sẵn của trình duyệt để ghim icon ra màn hình Desktop ngay lập tức mà <strong>không cần tải hay chạy bất kỳ file nào</strong>:
                    </p>

                    {/* Hướng dẫn Microsoft Edge */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                        <div className="font-bold text-blue-900 text-sm flex items-center gap-1.5">
                            <span>🌐 Dành cho Microsoft Edge:</span>
                        </div>
                        <ol className="list-decimal pl-5 space-y-1 text-xs text-blue-950 m-0">
                            <li>Bấm vào biểu tượng <strong>Menu 3 chấm (...)</strong> ở góc trên bên phải trình duyệt.</li>
                            <li>Chọn mục <strong>Ứng dụng (Apps)</strong>.</li>
                            <li>Bấm vào <strong>"Cài đặt trang web này dưới dạng ứng dụng"</strong> (Install this site as an app).</li>
                            <li>Bấm <strong>Cài đặt (Install)</strong> &rarr; Icon ứng dụng có Logo bệnh viện sẽ xuất hiện ngay trên Desktop!</li>
                        </ol>
                    </div>

                    {/* Hướng dẫn Google Chrome / Cốc Cốc */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                        <div className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                            <span>🌐 Dành cho Google Chrome / Cốc Cốc:</span>
                        </div>
                        <ol className="list-decimal pl-5 space-y-1 text-xs text-amber-950 m-0">
                            <li>Bấm vào biểu tượng <strong>Menu 3 chấm (...)</strong> ở góc trên bên phải trình duyệt.</li>
                            <li>Chọn <strong>Lưu và chia sẻ (Save and share)</strong> hoặc <strong>Công cụ khác</strong>.</li>
                            <li>Chọn <strong>Tạo lối tắt... (Create shortcut...)</strong>.</li>
                            <li>Tích vào ô <strong>"Mở dưới dạng cửa sổ"</strong> và bấm <strong>Tạo (Create)</strong> &rarr; Hoàn tất!</li>
                        </ol>
                    </div>
                </div>
            </Modal>
        </>
    );
}

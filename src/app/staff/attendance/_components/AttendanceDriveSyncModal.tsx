'use client';

import React, { useState } from 'react';
import { Modal, Button, Progress, Alert, Spin, Tag, List } from 'antd';
import {
    CloudSyncOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    FolderOpenOutlined,
    FileExcelOutlined,
    SettingOutlined
} from '@ant-design/icons';
const getBasePath = () => {
    if (typeof window !== 'undefined') {
        const parts = window.location.pathname.split('/staff');
        return parts.length > 1 ? parts[0] : '';
    }
    return '';
};

interface AttendanceDriveSyncModalProps {
    open: boolean;
    onClose: () => void;
    onOpenConfig: () => void;
    monthYear: string;
    ma_khoa: string;
    deptName?: string;
}

export function AttendanceDriveSyncModal({
    open,
    onClose,
    onOpenConfig,
    monthYear,
    ma_khoa,
    deptName = 'Khoa / Phòng'
}: AttendanceDriveSyncModalProps) {
    const [status, setStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [currentStepText, setCurrentStepText] = useState<string>('');
    const [resultData, setResultData] = useState<any>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Bắt đầu quá trình đồng bộ
    const handleStartSync = async () => {
        try {
            setStatus('SYNCING');
            setProgressPercent(20);
            setCurrentStepText('Đang khởi tạo dữ liệu và sinh 5 file Excel chuẩn mẫu...');
            setErrorMessage('');

            const basePath = getBasePath();
            const res = await fetch(`${basePath}/api/staff/attendance/drive-sync/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ monthYear, ma_khoa })
            });

            setProgressPercent(70);
            setCurrentStepText('Đang tải các file Excel lên Google Drive...');

            const data = await res.json();

            if (!res.ok || !data.success) {
                setStatus('ERROR');
                setErrorMessage(data.error || 'Có lỗi xảy ra khi đồng bộ Google Drive');
                return;
            }

            setProgressPercent(100);
            setCurrentStepText('Đã đồng bộ thành công toàn bộ 5 file Excel!');
            setStatus('SUCCESS');
            setResultData(data);
        } catch (err: any) {
            setStatus('ERROR');
            setErrorMessage(err.message || 'Lỗi không xác định khi kết nối server');
        }
    };

    const handleReset = () => {
        setStatus('IDLE');
        setProgressPercent(0);
        setCurrentStepText('');
        setResultData(null);
        setErrorMessage('');
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800 text-base font-bold pb-2 border-b">
                    <CloudSyncOutlined className="text-emerald-600 text-xl" />
                    <span>Đồng bộ 5 Bảng Excel Chấm Công lên Google Drive</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={640}
            footer={null}
            destroyOnClose
            afterOpenChange={(visible) => {
                if (visible) handleReset();
            }}
        >
            <div className="py-2 space-y-3">
                {/* Thông tin phạm vi */}
                <div className="p-2.5 bg-slate-50 border rounded text-xs flex items-center justify-between">
                    <div>
                        <span className="text-slate-500">Khoa / Phòng: </span>
                        <strong className="text-slate-800">{deptName}</strong>
                    </div>
                    <div>
                        <span className="text-slate-500">Kỳ chấm công: </span>
                        <strong className="text-blue-600">Tháng {monthYear.split('-').reverse().join('/')}</strong>
                    </div>
                </div>

                {/* Trạng thái IDLE */}
                {status === 'IDLE' && (
                    <div className="space-y-3">
                        <Alert
                            type="info"
                            showIcon
                            message="Tự động sao lưu trọn bộ 5 file Excel chuẩn mẫu của Khoa"
                            description={
                                <div className="space-y-1 text-xs mt-1">
                                    <div>1. 📄 Bảng Chấm Công (Chuẩn Bộ Y tế)</div>
                                    <div>2. 📄 Bảng Chấm Trực (Kèm & Thường Trú)</div>
                                    <div>3. 📄 Sổ Theo Dõi & Đối Soát Nghỉ Bù</div>
                                    <div>4. 📄 Bảng Chấm Thêm Giờ</div>
                                    <div>5. 📄 Bảng Chấm Độc Hại & Bồi Dưỡng Hiện Vật</div>
                                </div>
                            }
                        />

                        <div className="pt-2 flex items-center justify-between border-t">
                            <Button icon={<SettingOutlined />} onClick={onOpenConfig} className="text-xs">
                                Cài đặt Google Drive
                            </Button>
                            <Button
                                type="primary"
                                icon={<CloudSyncOutlined />}
                                onClick={handleStartSync}
                                className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs"
                            >
                                Bắt đầu Đồng Bộ Ngay
                            </Button>
                        </div>
                    </div>
                )}

                {/* Trạng thái ĐANG ĐỒNG BỘ */}
                {status === 'SYNCING' && (
                    <div className="py-6 text-center space-y-4">
                        <Spin size="large" />
                        <div>
                            <div className="font-bold text-sm text-slate-800">{currentStepText}</div>
                            <div className="text-xs text-slate-400 mt-1">Quá trình này thường mất khoảng 3 - 6 giây...</div>
                        </div>
                        <Progress percent={progressPercent} status="active" strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} />
                    </div>
                )}

                {/* Trạng thái THÀNH CÔNG */}
                {status === 'SUCCESS' && (
                    <div className="space-y-3 pt-1">
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-center space-y-1">
                            <CheckCircleOutlined className="text-3xl text-emerald-600" />
                            <div className="font-bold text-emerald-900 text-sm">Đã đồng bộ 5 file Excel thành công!</div>
                            <div className="text-xs text-emerald-700">
                                Toàn bộ bản sao lưu đã được tải lên Google Drive tại thư mục: <br />
                                <code className="bg-white px-1.5 py-0.5 rounded border border-emerald-300 font-mono text-[11px] text-emerald-800">
                                    {resultData?.folderPath}
                                </code>
                            </div>
                        </div>

                        {/* Danh sách 5 file đã upload */}
                        <div className="bg-slate-50 p-2 rounded border max-h-40 overflow-y-auto">
                            <div className="font-bold text-slate-700 text-[11px] mb-1">Danh sách file đã lưu trên Drive:</div>
                            <div className="space-y-1">
                                {resultData?.files?.map((f: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-600">
                                        <FileExcelOutlined className="text-emerald-600" />
                                        <span>{f.fileName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Nút hành động */}
                        <div className="pt-2 flex items-center justify-between border-t">
                            <Button onClick={onClose} className="text-xs">
                                Đóng
                            </Button>
                            {resultData?.folderUrl ? (
                                <Button
                                    type="primary"
                                    icon={<FolderOpenOutlined />}
                                    href={resultData.folderUrl}
                                    target="_blank"
                                    className="bg-blue-600 font-bold text-xs"
                                >
                                    Mở Thư Mục Trên Google Drive
                                </Button>
                            ) : (
                                <Button type="primary" onClick={onClose} className="bg-emerald-600 font-bold text-xs">
                                    Hoàn Tất
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                {/* Trạng thái LỖI */}
                {status === 'ERROR' && (
                    <div className="space-y-3 pt-1">
                        <Alert
                            type="error"
                            showIcon
                            icon={<CloseCircleOutlined />}
                            message="Đồng bộ Google Drive không thành công"
                            description={
                                <div className="space-y-2 text-xs mt-1">
                                    <div>{errorMessage}</div>
                                    {errorMessage.includes('chưa thiết lập') && (
                                        <Button
                                            type="primary"
                                            size="small"
                                            icon={<SettingOutlined />}
                                            onClick={onOpenConfig}
                                            className="bg-rose-600 text-xs mt-1"
                                        >
                                            Cài đặt Google Drive Ngay
                                        </Button>
                                    )}
                                </div>
                            }
                        />

                        <div className="pt-2 flex items-center justify-between border-t">
                            <Button onClick={onClose} className="text-xs">
                                Đóng
                            </Button>
                            <Button type="primary" onClick={handleStartSync} className="bg-blue-600 text-xs">
                                Thử Lại
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
}

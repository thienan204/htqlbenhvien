import React from 'react';
import { Alert, Tag, Spin } from 'antd';
import { LoadingOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { BaRecord } from '../hooks/useCheckBa';

interface BaPaymentStatusAlertProps {
    baCode: string | null;
    baInfo: BaRecord | null;
    hasPaymentRequest: boolean;
    isChecking: boolean;
    isFound: boolean;
    className?: string;
}

export function BaPaymentStatusAlert({
    baCode,
    baInfo,
    hasPaymentRequest,
    isChecking,
    isFound,
    className = 'mb-3'
}: BaPaymentStatusAlertProps) {
    if (!baCode && !baInfo && !isChecking) {
        return null;
    }

    if (isChecking) {
        return (
            <div className={`${className} px-3 py-1.5 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-center gap-2 text-xs text-blue-700 animate-pulse`}>
                <LoadingOutlined className="text-blue-600 text-sm" />
                <span>Đang kiểm tra trạng thái thanh toán Cổng BHYT cho mã <b>{baCode}</b>...</span>
            </div>
        );
    }

    if (isFound && baInfo) {
        const displayCode = baInfo.maBN || baInfo.maLienKet || baCode;

        if (hasPaymentRequest) {
            return (
                <div className={className}>
                    <Alert
                        type="warning"
                        showIcon
                        icon={<ExclamationCircleOutlined className="text-amber-600 text-lg" />}
                        className="rounded-xl border border-amber-300 bg-amber-50/95 shadow-xs"
                        title={
                            <div className="font-bold text-amber-900 text-[13px] sm:text-[14px] flex items-center gap-1.5">
                                <span>⚠️ Bệnh án ({displayCode}) ĐÃ ĐƯỢC ĐỀ NGHỊ THANH TOÁN BHXH!</span>
                            </div>
                        }
                        description={
                            <div className="mt-1 text-[12px] sm:text-[13px] text-slate-700 space-y-1">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                                    {baInfo.hoTen && (
                                        <span><b>Bệnh nhân:</b> <b className="text-blue-700 font-semibold">{baInfo.hoTen}</b></span>
                                    )}
                                    {baInfo.maBN && <span><b>Mã BN:</b> <span className="font-mono text-slate-800">{baInfo.maBN}</span></span>}
                                    {baInfo.maLienKet && <span><b>Mã LK:</b> <span className="font-mono text-slate-800">{baInfo.maLienKet}</span></span>}
                                </div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                                    {baInfo.ngayRa && <span>• Ngày ra viện: <b>{baInfo.ngayRa}</b></span>}
                                    {baInfo.ngayDeNghiTT && (
                                        <span>• Ngày đề nghị TT: <b className="text-amber-800 font-semibold">{baInfo.ngayDeNghiTT}</b></span>
                                    )}
                                    {baInfo.trangThaiTT && (
                                        <Tag color="orange" className="mr-0 font-medium py-0 px-1 text-[11px] sm:text-[12px]">
                                            {baInfo.trangThaiTT}
                                        </Tag>
                                    )}
                                </div>
                                <div className="text-[11px] text-amber-700/90 italic pt-0.5">
                                    * Lưu ý: Hồ sơ đã được lập đề nghị thanh toán lên Cổng BHYT, việc can thiệp dữ liệu có thể cần huỷ đề nghị thanh toán trước.
                                </div>
                            </div>
                        }
                    />
                </div>
            );
        }

        // Tìm thấy trong HoSoDaGui nhưng CHƯA đề nghị thanh toán
        return (
            <div className={className}>
                <Alert
                    type="success"
                    showIcon
                    icon={<CheckCircleOutlined className="text-emerald-600 text-lg" />}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/90 shadow-2xs"
                    title={
                        <div className="font-semibold text-emerald-900 text-[13px] sm:text-[14px]">
                            ✅ Bệnh án ({displayCode}) - Chưa đề nghị thanh toán BHXH
                        </div>
                    }
                    description={
                        <div className="mt-0.5 text-[12px] sm:text-[13px] text-slate-700 flex flex-wrap gap-x-4 gap-y-1 items-center">
                            {baInfo.hoTen && <span><b>BN:</b> <b className="text-blue-700">{baInfo.hoTen}</b></span>}
                            {baInfo.ngayRa && <span>• Ra viện: {baInfo.ngayRa}</span>}
                            <Tag color="green" className="mr-0 font-medium py-0 px-1 text-[11px]">
                                {baInfo.trangThaiTT || 'Chưa đề nghị thanh toán'}
                            </Tag>
                            <span className="text-[11px] text-emerald-700 italic">
                                (Có thể gửi yêu cầu hỗ trợ sửa dữ liệu bình thường)
                            </span>
                        </div>
                    }
                />
            </div>
        );
    }

    return null;
}

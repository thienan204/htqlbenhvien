'use client';

import React from 'react';
import { Card, Tag, Tooltip } from 'antd';
import { CalendarOutlined, InfoCircleOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

interface LeaveBalanceCardProps {
    balance: {
        year: number;
        standardDays: number;
        seniorityDays: number;
        totalAvailable: number;
        usedDays: number;
        remainingDays: number;
        expiredDays?: number;
        compensatedCashDays?: number;
    } | null;
    staffName?: string;
    cutoffDateStr?: string;
}

export const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({
    balance,
    staffName,
    cutoffDateStr = '30/03'
}) => {
    if (!balance) return null;

    const currentYear = balance.year || new Date().getFullYear();
    const nextYear = currentYear + 1;

    return (
        <Card
            size="small"
            className="border-blue-200 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/60 shadow-xs mb-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center text-lg shadow-xs">
                        <CalendarOutlined />
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 font-medium">
                            Quỹ ngày nghỉ phép năm <strong>{currentYear}</strong> {staffName ? `- ${staffName}` : ''}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xl font-bold text-blue-700">
                                {balance.remainingDays} <span className="text-xs font-normal text-slate-500">ngày còn lại</span>
                            </span>
                            <span className="text-xs text-slate-400">/ Tổng {balance.totalAvailable} ngày</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Tag color="cyan" className="px-2 py-0.5 font-medium text-xs">
                        Tiêu chuẩn: {balance.standardDays}d
                    </Tag>
                    {balance.seniorityDays > 0 && (
                        <Tag color="purple" className="px-2 py-0.5 font-medium text-xs">
                            Thâm niên: +{balance.seniorityDays}d
                        </Tag>
                    )}
                    <Tag color="orange" className="px-2 py-0.5 font-medium text-xs">
                        Đã nghỉ: {balance.usedDays}d
                    </Tag>
                    {Boolean(balance.compensatedCashDays && balance.compensatedCashDays > 0) && (
                        <Tag color="volcano" className="px-2 py-0.5 font-medium text-xs">
                            Chi trả tiền (thiếu nhân lực): {balance.compensatedCashDays}d
                        </Tag>
                    )}
                </div>

                <div className="text-right text-[11px] text-slate-500 flex items-center gap-1.5 bg-amber-50/80 border border-amber-200 text-amber-900 px-2.5 py-1 rounded">
                    <InfoCircleOutlined className="text-amber-600" />
                    <span>
                        Hạn dùng đến hết ngày <strong>{cutoffDateStr}/{nextYear}</strong>. Sau ngày này số phép chưa nghỉ sẽ tính cống hiến cho bệnh viện.
                    </span>
                </div>
            </div>
        </Card>
    );
};


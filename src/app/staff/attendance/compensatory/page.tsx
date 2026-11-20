'use client';

import React from 'react';
import { Table, Tag, Button, Tooltip, Popover } from 'antd';
import { CalendarOutlined, InfoCircleOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAttendance, StaffMatrixData } from '../AttendanceContext';

export default function CompensatoryLedgerPage() {
    const router = useRouter();
    const { filteredStaffData, loading, matrixData, searchText } = useAttendance();

    const columns = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 50,
            align: 'center' as const
        },
        {
            title: 'Họ và Tên Cán Bộ',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 200,
            render: (name: string, record: StaffMatrixData) => {
                const hasPosition = Boolean(record.chuc_vu && record.chuc_vu.trim() !== '' && record.chuc_vu.trim().toLowerCase() !== 'cán bộ');
                return (
                    <div className="py-0.5">
                        <span className="font-semibold text-slate-800 block leading-tight">{name}</span>
                        {hasPosition && <div className="text-[11px] text-blue-700 font-semibold mt-0.5 leading-none">{record.chuc_vu}</div>}
                    </div>
                );
            }
        },
        {
            title: 'Tổng Phiên Trực Trong Tháng',
            dataIndex: ['dutySummary', 'tongSo'],
            key: 'tongSo',
            width: 140,
            align: 'center' as const,
            render: (val: number, record: StaffMatrixData) => (
                <div>
                    <Tag color="blue" className="font-bold text-sm">{val} ca</Tag>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                        (Thường: {record.dutySummary.ngayThuong}, T7/CN: {record.dutySummary.t7cn}, Lễ: {record.dutySummary.leTet}, Kèm: {record.dutySummary.trucKem || 0})
                    </div>
                </div>
            )
        },
        {
            title: 'Hạn Mức Được Nghỉ Bù',
            dataIndex: ['dutySummary', 'totalAllowanceDays'],
            key: 'totalAllowanceDays',
            width: 140,
            align: 'center' as const,
            render: (val: number, record: StaffMatrixData) => (
                <div>
                    <span className="font-bold text-slate-700">{val} ngày</span>
                    {record.dutySummary.leTet > 0 && (
                        <div className="text-[10px] text-purple-600 font-medium">(Đã gồm ca Lễ bù 2 ngày)</div>
                    )}
                </div>
            )
        },
        {
            title: 'Đã Nghỉ Bù (Thực tế)',
            key: 'totalCompensatedDays',
            width: 150,
            align: 'center' as const,
            render: (_: any, record: StaffMatrixData) => {
                const totalComp = record.dutySummary?.actualCompensatedDays ?? record.dutySummary?.totalCompensatedDays ?? 0;
                const compRecords = record.dutySummary?.actualCompensatedRecords || [];

                if (totalComp <= 0 || compRecords.length === 0) {
                    return <Tag color="default" className="text-slate-400 font-medium m-0">Chưa nghỉ bù</Tag>;
                }

                const tooltipContent = (
                    <div className="w-72 p-1 text-xs">
                        <div className="font-bold text-amber-300 border-b border-slate-600/70 pb-1.5 mb-1.5 flex items-center justify-between">
                            <span>Chi tiết các ngày đã nghỉ bù</span>
                            <span className="text-emerald-300 font-black">Tổng: {totalComp} ngày</span>
                        </div>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            {compRecords.map((item, idx) => {
                                const workDateFormatted = item.date.split('-').reverse().join('/');
                                const sessionLabel = item.session === 'MORNING' ? 'Buổi Sáng (4h)' : item.session === 'AFTERNOON' ? 'Buổi Chiều (4h)' : 'Cả ngày (8h)';
                                const dutyInfo = item.dutyDate
                                    ? `Bù ca ${item.dutyDate.split('-').reverse().join('/')} (${item.dutyCode || 'Trực'})`
                                    : 'Chưa rõ ca';

                                return (
                                    <div
                                        key={idx}
                                        className="p-1.5 bg-slate-800/90 border border-slate-700 rounded flex items-center justify-between gap-2"
                                    >
                                        <div>
                                            <div className="font-semibold text-white flex items-center gap-1.5">
                                                <Tag color="success" className="text-[10px] px-1 py-0 m-0 font-bold">
                                                    {item.code}{item.session === 'MORNING' ? ' (S)' : item.session === 'AFTERNOON' ? ' (C)' : ''}
                                                </Tag>
                                                <span>Ngày {workDateFormatted}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-300 mt-0.5">
                                                {sessionLabel} • {dutyInfo}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-bold text-emerald-300 text-xs">+{item.value}d</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );

                return (
                    <Tooltip title={tooltipContent} placement="top">
                        <Tag
                            color="green"
                            className="font-bold text-xs cursor-pointer hover:opacity-85 shadow-2xs transition-all m-0"
                        >
                            Đã bù {totalComp} ngày <InfoCircleOutlined className="text-[10px] ml-0.5 text-emerald-600" />
                        </Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: 'Quỹ Ngày Trực Còn Dư Có Thể Bù',
            dataIndex: ['dutySummary', 'remainingCompensatoryDays'],
            key: 'remainingCompensatoryDays',
            width: 170,
            align: 'center' as const,
            render: (val: number, record: StaffMatrixData) => {
                const uncompList = record.dutySummary?.uncompensatedDuties || [];

                if (val <= 0 || uncompList.length === 0) {
                    return (
                        <Tag color="default" className="font-medium text-slate-500 m-0">
                            <CheckCircleOutlined className="mr-1 text-emerald-500" /> Đã bù hết
                        </Tag>
                    );
                }

                const tooltipContent = (
                    <div className="w-80 p-1 text-xs">
                        <div className="font-bold text-amber-300 border-b border-slate-600/70 pb-1.5 mb-1.5 flex items-center justify-between">
                            <span>Chi tiết các ca trực chưa nghỉ bù</span>
                            <span className="text-rose-300 font-black">Còn {val} ngày</span>
                        </div>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                            {uncompList.map((item, idx) => {
                                const codeUpper = (item.dutyCode || '').toUpperCase();
                                const typeLabel =
                                    codeUpper === 'T' ? 'Trực ngày thường' :
                                    codeUpper === 'C' ? 'Trực T7 / Chủ Nhật' :
                                    codeUpper === 'L' || codeUpper === 'TE' ? 'Trực Ngày Lễ / Tết' :
                                    codeUpper === 'TK' ? 'Trực kèm' :
                                    codeUpper === 'TT' ? 'Trực thường trú' : 'Ca trực';

                                const tagColor =
                                    codeUpper === 'C' ? 'orange' :
                                    codeUpper === 'L' || codeUpper === 'TE' ? 'purple' :
                                    codeUpper === 'T' ? 'blue' :
                                    codeUpper === 'TK' ? 'cyan' : 'geekblue';

                                const formattedDate = item.dutyDate.split('-').reverse().join('/');

                                return (
                                    <div
                                        key={item.id || idx}
                                        className="p-1.5 bg-slate-800/90 border border-slate-700 rounded flex items-center justify-between gap-2"
                                    >
                                        <div>
                                            <div className="font-semibold text-white flex items-center gap-1.5">
                                                <Tag color={tagColor} className="text-[10px] px-1 py-0 m-0 font-bold">
                                                    {item.dutyCode}
                                                </Tag>
                                                <span>Ngày {formattedDate}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-300 mt-0.5">
                                                {typeLabel} (Hạn mức: {item.allowanceDays}d - Đã bù: {item.compensatedDays}d)
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-bold text-rose-300 text-xs">Còn {item.remainingDays}d</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-2 pt-1.5 border-t border-slate-700 text-right">
                            <span className="text-[11px] text-slate-400">Sang Tab 1 để bấm chấm nghỉ bù</span>
                        </div>
                    </div>
                );

                const badgeColor = val <= 1 ? 'warning' : 'error';

                return (
                    <Tooltip title={tooltipContent} placement="top">
                        <Tag
                            color={badgeColor}
                            className="font-bold text-xs cursor-pointer hover:opacity-85 shadow-2xs transition-all m-0"
                        >
                            Còn {val} ngày <InfoCircleOutlined className="text-[10px] ml-0.5 text-slate-400" />
                        </Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 130,
            align: 'center' as const,
            render: () => (
                <Button
                    type="link"
                    size="small"
                    icon={<CalendarOutlined />}
                    onClick={() => router.push('/staff/attendance')}
                    className="text-blue-600 font-medium"
                >
                    Chấm Nghỉ Bù
                </Button>
            )
        }
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-slate-500 mb-0">
                    Bảng đối soát quỹ ngày trực và số ngày đã nghỉ bù của từng cán bộ trong tháng. Bấm vào ô còn dư để xem chi tiết các ca trực cụ thể chưa nghỉ bù.
                </p>
                <span className="text-xs text-slate-500 shrink-0">
                    Quân số: <b className="text-slate-800">{filteredStaffData.length}</b>
                    {searchText.trim() && <span className="text-blue-600 font-semibold ml-1">(Lọc từ {matrixData?.staffData?.length || 0})</span>} cán bộ
                </span>
            </div>
            <Table
                columns={columns}
                dataSource={filteredStaffData}
                rowKey="staffId"
                loading={loading}
                pagination={false}
                bordered
                size="middle"
                className="attendance-matrix-table"
            />
        </div>
    );
}

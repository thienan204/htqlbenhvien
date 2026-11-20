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
            dataIndex: ['dutySummary', 'totalCompensatedDays'],
            key: 'totalCompensatedDays',
            width: 130,
            align: 'center' as const,
            render: (val: number) => <Tag color="green" className="font-bold">{val} ngày</Tag>
        },
        {
            title: 'Quỹ Ngày Trực Còn Dư Có Thể Bù',
            dataIndex: ['dutySummary', 'remainingCompensatoryDays'],
            key: 'remainingCompensatoryDays',
            width: 250,
            align: 'center' as const,
            render: (val: number, record: StaffMatrixData) => {
                const uncompList = record.dutySummary?.uncompensatedDuties || [];

                if (val <= 0 || uncompList.length === 0) {
                    return (
                        <div className="py-1">
                            <Tag color="default" className="font-medium text-slate-500">
                                <CheckCircleOutlined className="mr-1 text-emerald-500" /> Đã bù hết
                            </Tag>
                        </div>
                    );
                }

                // Chi tiết popover nội dung khi bấm vào
                const popoverContent = (
                    <div className="w-80 p-1 text-xs">
                        <div className="font-bold text-slate-800 border-b pb-1.5 mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <ClockCircleOutlined className="text-blue-600" />
                                <span>Chi tiết các ca trực chưa nghỉ bù</span>
                            </span>
                            <span className="text-rose-600 font-black">Còn {val} ngày</span>
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
                                        className="p-1.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between gap-2"
                                    >
                                        <div>
                                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                                                <Tag color={tagColor} className="text-[10px] px-1 py-0 m-0 font-bold">
                                                    {item.dutyCode}
                                                </Tag>
                                                <span>Ngày {formattedDate}</span>
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-0.5">
                                                {typeLabel} (Hạn mức: {item.allowanceDays}d - Đã bù: {item.compensatedDays}d)
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-bold text-rose-600 text-xs">Còn {item.remainingDays}d</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-2 pt-1.5 border-t text-right">
                            <Button
                                type="primary"
                                size="small"
                                icon={<CalendarOutlined />}
                                onClick={() => router.push('/staff/attendance')}
                                className="text-xs font-medium"
                            >
                                Đi đến Chấm Nghỉ Bù (NB)
                            </Button>
                        </div>
                    </div>
                );

                const badgeColor = val <= 1 ? 'warning' : 'error';

                return (
                    <div className="py-1 flex flex-col items-center gap-1">
                        <Popover
                            content={popoverContent}
                            title={null}
                            trigger="click"
                            placement="left"
                        >
                            <Tag
                                color={badgeColor}
                                className="font-bold text-xs cursor-pointer hover:opacity-85 shadow-2xs transition-all"
                                title="Bấm để xem chi tiết từng ca trực chưa nghỉ bù"
                            >
                                Còn {val} ngày <InfoCircleOutlined className="text-[10px] ml-0.5 text-slate-400" />
                            </Tag>
                        </Popover>

                        {/* Danh sách các ngày trực cụ thể ngay dưới Tag */}
                        <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5 max-w-[240px]">
                            {uncompList.slice(0, 3).map((item, idx) => {
                                const codeUpper = (item.dutyCode || '').toUpperCase();
                                const tagColor =
                                    codeUpper === 'C' ? 'orange' :
                                    codeUpper === 'L' || codeUpper === 'TE' ? 'purple' :
                                    codeUpper === 'T' ? 'blue' : 'default';

                                return (
                                    <Tooltip
                                        key={item.id || idx}
                                        title={`Ca ${item.dutyCode} ngày ${item.dutyDate.split('-').reverse().join('/')}: Định mức ${item.allowanceDays} ngày, đã bù ${item.compensatedDays} ngày, còn được bù ${item.remainingDays} ngày.`}
                                    >
                                        <Tag
                                            color={tagColor}
                                            className="text-[10px] px-1.5 py-0 m-0 font-medium cursor-help"
                                        >
                                            {item.shortDate} ({item.dutyCode}: {item.remainingDays}d)
                                        </Tag>
                                    </Tooltip>
                                );
                            })}
                            {uncompList.length > 3 && (
                                <Popover content={popoverContent} trigger="click" placement="left">
                                    <Tag className="text-[10px] px-1 py-0 m-0 cursor-pointer bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200">
                                        +{uncompList.length - 3} ngày
                                    </Tag>
                                </Popover>
                            )}
                        </div>
                    </div>
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

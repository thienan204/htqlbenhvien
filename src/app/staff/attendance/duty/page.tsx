'use client';

import React, { useState } from 'react';
import { Table, Tag, Dropdown, Tooltip, Button } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAttendance, StaffMatrixData } from '../AttendanceContext';
import { DutyPlanModal } from '../_components/DutyPlanModal';

export default function DutySheetPage() {
    const {
        selectedDate,
        setSelectedDate,
        filteredStaffData,
        loading,
        matrixData,
        canEditCurrentDept,
        handleUpdateDutyCell,
        searchText
    } = useAttendance();

    const [dutyPlanModalOpen, setDutyPlanModalOpen] = useState(false);

    const daysInfo = matrixData?.daysInfo || [];

    const renderDutyTag = (duty: any) => {
        if (!duty || !duty.dutyCode) {
            return <span className="text-slate-300 text-xs hover:text-blue-500 font-mono transition-colors">-</span>;
        }
        const c = duty.dutyCode.trim().toUpperCase();
        let color = 'default';
        let customClass = '';

        if (c === 'T') color = 'blue';
        else if (c === 'C') color = 'volcano';
        else if (c === 'L') color = 'magenta';
        else if (c === 'TE') color = 'red';
        else if (c === 'TK') {
            color = 'cyan';
            customClass = 'border-dashed border-cyan-500';
        } else if (c === 'TT') {
            color = 'geekblue';
            customClass = 'border-dashed border-indigo-500';
        }

        return (
            <Tag color={color} className={`m-0 font-extrabold text-xs px-1.5 py-0.5 shadow-xs ${customClass}`}>
                {duty.dutyCode}
                {duty.allowanceDays === 2 && <span className="text-[10px] ml-0.5 text-amber-300">⭐2d</span>}
            </Tag>
        );
    };

    const columns: any[] = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 45,
            fixed: 'left',
            align: 'center',
            className: 'bg-slate-50 font-medium'
        },
        {
            title: 'Họ và Tên',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 170,
            fixed: 'left',
            className: 'bg-slate-50',
            render: (name: string, record: StaffMatrixData) => {
                const hasPosition = Boolean(record.chuc_vu && record.chuc_vu.trim() !== '' && record.chuc_vu.trim().toLowerCase() !== 'cán bộ');
                return (
                    <div className="py-0.5">
                        <span className="font-semibold text-slate-800 leading-tight block">{name}</span>
                        {hasPosition && (
                            <div className="text-[11px] text-blue-700 font-semibold mt-0.5 leading-none">{record.chuc_vu}</div>
                        )}
                    </div>
                );
            }
        },
        ...daysInfo.map(d => {
            const isSelected = d.dateStr === selectedDate.format('YYYY-MM-DD');
            const isToday = d.dateStr === dayjs().format('YYYY-MM-DD');

            return {
                title: (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDate(dayjs(d.dateStr));
                        }}
                        className={`text-center py-1 px-0.5 cursor-pointer select-none transition-all duration-200 rounded ${
                            isSelected
                                ? 'bg-blue-600 text-white font-bold shadow-md ring-2 ring-blue-400'
                                : d.isHoliday
                                ? 'bg-purple-200 text-purple-950 font-black hover:bg-purple-300 border-b-2 border-purple-500'
                                : d.isWeekend
                                ? 'bg-amber-200 text-amber-950 font-black hover:bg-amber-300 border-b-2 border-amber-400'
                                : 'text-slate-700 hover:bg-blue-50'
                        }`}
                        title={d.isHoliday && d.holidayName ? `Ngày Lễ: ${d.holidayName}` : `Ngày ${d.day}`}
                    >
                        <div className={`text-[10px] leading-3 ${isSelected ? 'text-blue-100 font-semibold' : d.isHoliday ? 'text-purple-800 font-black' : d.isWeekend ? 'text-red-700 font-black' : ''}`}>
                            {d.isHoliday ? 'Lễ' : d.dayOfWeek === 0 ? 'CN' : `T${d.dayOfWeek + 1}`}
                        </div>
                        <div className="text-xs font-bold leading-4 flex items-center justify-center gap-0.5">
                            {d.day}
                            {isToday && (
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-red-500'}`} />
                            )}
                        </div>
                        {isSelected && (
                            <div className="text-[9px] leading-tight text-amber-200 font-normal whitespace-nowrap scale-90">
                                {isToday ? 'Hôm nay' : 'Đang chọn'}
                            </div>
                        )}
                    </div>
                ),
                dataIndex: ['dutyMap', d.day],
                key: `duty_day_${d.day}`,
                width: isSelected ? 48 : 42,
                align: 'center',
                className: isSelected
                    ? 'bg-blue-50/90 border-x-2 border-blue-400 font-semibold shadow-inner'
                    : d.isHoliday
                    ? 'bg-purple-100/70 font-medium'
                    : d.isWeekend
                    ? 'bg-amber-100/80 font-medium'
                    : '',
                render: (duty: any, record: StaffMatrixData) => {
                    const attOnThisDay = record.attendanceMap?.[d.day];
                    const dutyNode = (
                        <div className="relative flex items-center justify-center py-1">
                            {renderDutyTag(duty)}
                            {attOnThisDay && (
                                <Tooltip title={`Đã đồng bộ công đi làm: ${attOnThisDay.code}`}>
                                    <span className="absolute -top-1.5 -right-1 w-2 h-2 rounded-full bg-emerald-500 border border-white shadow-xs" />
                                </Tooltip>
                            )}
                        </div>
                    );

                    if (!canEditCurrentDept) return dutyNode;

                    const items = [
                        { key: 'T', label: <span className="font-bold text-blue-600">T - Trực ngày thường (Bù 1 ngày)</span> },
                        { key: 'C', label: <span className="font-bold text-orange-600">C - Trực T7, Chủ Nhật (Bù 1 ngày)</span> },
                        { key: 'L', label: <span className="font-extrabold text-purple-600">L - Trực Lễ (Nghỉ bù 2 ngày theo luật)</span> },
                        { key: 'Te', label: <span className="font-extrabold text-red-600">Te - Trực Tết (Nghỉ bù 2 ngày theo luật)</span> },
                        { type: 'divider' },
                        { key: 'TK', label: <span className="font-bold text-teal-600">Tk - Trực kèm (Trực phụ, học việc, hỗ trợ kíp - Bù 1 ngày)</span> },
                        { key: 'TT', label: <span className="font-bold text-indigo-600">TT - Trực thường trú (On-call tại nhà, trực ngoại viện)</span> },
                        { type: 'divider' },
                        { key: '', label: <span className="text-rose-500">Xóa ca trực</span> }
                    ];

                    return (
                        <Dropdown
                            menu={{
                                items: items as any,
                                onClick: ({ key }) => {
                                    setSelectedDate(dayjs(d.dateStr));
                                    handleUpdateDutyCell(record.staffId, d.day, key);
                                }
                            }}
                            trigger={['click']}
                        >
                            <div className="cursor-pointer hover:bg-amber-50/80 rounded transition-colors">
                                {dutyNode}
                            </div>
                        </Dropdown>
                    );
                }
            };
        }),
        {
            title: 'Thường (T)',
            dataIndex: ['dutySummary', 'ngayThuong'],
            key: 'ngayThuong',
            width: 65,
            align: 'center',
            fixed: 'right',
            className: 'bg-blue-50/60 font-semibold text-blue-700'
        },
        {
            title: 'T7, CN (C)',
            dataIndex: ['dutySummary', 't7cn'],
            key: 't7cn',
            width: 65,
            align: 'center',
            fixed: 'right',
            className: 'bg-orange-50/60 font-semibold text-orange-700'
        },
        {
            title: 'Lễ Tết',
            dataIndex: ['dutySummary', 'leTet'],
            key: 'leTet',
            width: 65,
            align: 'center',
            fixed: 'right',
            className: 'bg-purple-50/60 font-semibold text-purple-700'
        },
        {
            title: (
                <div className="text-center font-bold text-teal-800">
                    <span>Trực kèm</span>
                    <span className="block text-[10px] text-teal-500 font-normal">(Tk)</span>
                </div>
            ),
            dataIndex: ['dutySummary', 'trucKem'],
            key: 'trucKem',
            width: 70,
            align: 'center',
            fixed: 'right',
            className: 'bg-teal-50/70 font-bold text-teal-700'
        },
        {
            title: (
                <div className="text-center font-bold text-indigo-800">
                    <span>Thường trú</span>
                    <span className="block text-[10px] text-indigo-500 font-normal">(TT)</span>
                </div>
            ),
            dataIndex: ['dutySummary', 'thuongTru'],
            key: 'thuongTru',
            width: 75,
            align: 'center',
            fixed: 'right',
            className: 'bg-indigo-50/70 font-bold text-indigo-700'
        },
        {
            title: 'Tổng Trực',
            dataIndex: ['dutySummary', 'tongSo'],
            key: 'tongSo',
            width: 70,
            align: 'center',
            fixed: 'right',
            className: 'bg-slate-100 font-bold text-slate-800'
        }
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <div className="text-xs text-slate-500">
                    Tổng quân số: <b className="text-slate-800">{filteredStaffData.length} cán bộ</b>
                    {searchText.trim() && (
                        <span className="text-blue-600 font-semibold ml-1">
                            (Lọc từ {matrixData?.staffData?.length || 0} cán bộ)
                        </span>
                    )} | Tổng phiên trực toàn khoa: <b className="text-blue-700">{matrixData?.totalDeptDuty?.tongSo || 0} phiên</b>{' '}
                    (Thường: <b>{matrixData?.totalDeptDuty?.ngayThuong || 0}</b>, T7/CN: <b>{matrixData?.totalDeptDuty?.t7cn || 0}</b>, Lễ Tết: <b>{matrixData?.totalDeptDuty?.leTet || 0}</b>, Trực kèm: <b className="text-teal-700">{matrixData?.totalDeptDuty?.trucKem || 0}</b>, Thường trú: <b className="text-indigo-700">{matrixData?.totalDeptDuty?.thuongTru || 0}</b>)
                </div>
                {canEditCurrentDept && (
                    <Button
                        type="primary"
                        size="small"
                        icon={<ClockCircleOutlined />}
                        onClick={() => setDutyPlanModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 font-medium text-xs shadow-xs shrink-0 ml-2"
                    >
                        📋 Lập Kế Hoạch Phân Trực
                    </Button>
                )}
            </div>
            <Table
                columns={columns}
                dataSource={filteredStaffData}
                rowKey="staffId"
                loading={loading}
                pagination={false}
                bordered
                size="small"
                className="attendance-matrix-table"
                scroll={{ x: 1880 }}
            />

            {/* Modal Lập Kế Hoạch Phân Trực Hàng Loạt */}
            <DutyPlanModal
                open={dutyPlanModalOpen}
                onClose={() => setDutyPlanModalOpen(false)}
            />
        </div>
    );
}

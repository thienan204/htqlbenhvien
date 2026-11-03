'use client';

import React, { useState } from 'react';
import { Table, Tag, Dropdown, Tooltip, Button } from 'antd';
import { EditOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAttendance, StaffMatrixData } from './AttendanceContext';
import { AttendancePlanModal } from './_components/AttendancePlanModal';

export default function AttendanceSheetPage() {
    const {
        selectedDate,
        setSelectedDate,
        filteredStaffData,
        loading,
        matrixData,
        canEditCurrentDept,
        handleUpdateAttendanceCell,
        setEditingNoteStaff,
        setTempNoteText,
        searchText
    } = useAttendance();

    const [planModalOpen, setPlanModalOpen] = useState(false);

    const daysInfo = matrixData?.daysInfo || [];

    const renderAttendanceTag = (att: any) => {
        if (!att || !att.code) {
            return <span className="text-slate-300 text-xs hover:text-blue-500 font-mono transition-colors">-</span>;
        }
        const c = att.code.trim().toUpperCase();
        let color = 'default';
        let bgStyle = '';

        if (c === 'X' || c === '+') color = 'success';
        else if (c === 'NB' || c === 'NB/2' || c === 'NB/X' || c === 'X/NB') color = 'warning';
        else if (c === 'P' || c === 'P/2') color = 'processing';
        else if (c === 'L' || c === 'TE') color = 'purple';
        else if (['Ô', 'O', 'TS', 'KL'].includes(c)) color = 'error';
        else if (c === 'H' || c === 'CT') color = 'cyan';

        return (
            <Tag color={color} className={`m-0 font-bold text-xs px-1.5 py-0.5 shadow-xs ${bgStyle}`}>
                {att.code}
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
                dataIndex: ['attendanceMap', d.day],
                key: `day_${d.day}`,
                width: isSelected ? 48 : 42,
                align: 'center',
                className: isSelected
                    ? 'bg-blue-50/90 border-x-2 border-blue-400 font-semibold shadow-inner'
                    : d.isHoliday
                    ? 'bg-purple-100/70 font-medium'
                    : d.isWeekend
                    ? 'bg-amber-100/80 font-medium'
                    : '',
                render: (att: any, record: StaffMatrixData) => {
                    const dutyOnThisDay = record.dutyMap?.[d.day];
                    const cellNode = (
                        <div className="relative flex items-center justify-center py-1">
                            {renderAttendanceTag(att)}
                            {dutyOnThisDay && (
                                <Tooltip title={`Có lịch trực: ${dutyOnThisDay.dutyCode} (${dutyOnThisDay.dutyType || 'Trực'})`}>
                                    <span className="absolute -top-1.5 -right-1 w-2 h-2 rounded-full bg-blue-600 border border-white shadow-xs" />
                                </Tooltip>
                            )}
                        </div>
                    );

                    const remDays = record.dutySummary?.remainingCompensatoryDays ?? 0;
                    const canCompensate = remDays > 0;

                    const items = [
                        { key: 'x', label: <span className="font-semibold text-emerald-600">x - Đi làm đủ ngày (8h)</span> },
                        { key: 'x/2', label: <span className="text-emerald-500">x/2 - Đi làm nửa ngày (4h)</span> },
                        { key: 'P', label: <span className="text-blue-600">P - Nghỉ phép cả ngày</span> },
                        { key: 'P/2', label: <span className="text-blue-500">P/2 - Nghỉ phép 1/2 ngày</span> },
                        {
                            key: 'Nb',
                            label: canCompensate ? (
                                <span className="text-amber-600 font-bold">
                                    Nb - Nghỉ bù cả ngày <span className="text-[11px] font-normal text-slate-500">(quỹ còn {remDays}d)</span>
                                </span>
                            ) : (
                                <span className="text-slate-400">Nb - Nghỉ bù cả ngày (Không có ca trực để bù)</span>
                            ),
                            disabled: !canCompensate
                        },
                        {
                            key: 'Nb/2',
                            label: canCompensate ? (
                                <span className="text-amber-500">
                                    Nb/2 - Nghỉ bù 1/2 ngày <span className="text-[11px] font-normal text-slate-500">(quỹ còn {remDays}d)</span>
                                </span>
                            ) : (
                                <span className="text-slate-400">Nb/2 - Nghỉ bù 1/2 ngày (Không có ca trực để bù)</span>
                            ),
                            disabled: !canCompensate
                        },
                        { key: 'L', label: <span className="text-purple-600 font-bold">L - Nghỉ Lễ hưởng lương</span> },
                        { key: 'Ố', label: <span className="text-red-500">Ố - Nghỉ ốm (hưởng BHXH)</span> },
                        { key: 'TS', label: <span className="text-red-500">TS - Nghỉ thai sản (hưởng BHXH)</span> },
                        { key: 'H', label: <span className="text-cyan-600">H - Đi học, hội nghị</span> },
                        { key: 'KL', label: <span className="text-slate-500">KL - Nghỉ không lương</span> },
                        { type: 'divider' },
                        { key: '', label: <span className="text-rose-500">Xóa công ngày này</span> }
                    ];

                    return (
                        <Dropdown
                            menu={{
                                items: items as any,
                                onClick: ({ key }) => {
                                    if ((key === 'Nb' || key === 'Nb/2') && !canCompensate) {
                                        return;
                                    }
                                    setSelectedDate(dayjs(d.dateStr));
                                    handleUpdateAttendanceCell(record.staffId, d.day, key);
                                }
                            }}
                            trigger={['click']}
                        >
                            <div className="cursor-pointer hover:bg-blue-100/60 rounded transition-colors">
                                {cellNode}
                            </div>
                        </Dropdown>
                    );
                }
            };
        }),
        {
            title: 'Lương TG',
            dataIndex: ['attendanceSummary', 'luongThoiGian'],
            key: 'luongThoiGian',
            width: 70,
            align: 'center',
            fixed: 'right',
            className: 'bg-emerald-50 font-bold text-emerald-800'
        },
        {
            title: 'Không lương',
            dataIndex: ['attendanceSummary', 'nghiKhongLuong'],
            key: 'nghiKhongLuong',
            width: 70,
            align: 'center',
            fixed: 'right',
            className: 'bg-slate-50 text-slate-600 font-medium'
        },
        {
            title: 'Hưởng BHXH',
            dataIndex: ['attendanceSummary', 'huongBHXH'],
            key: 'huongBHXH',
            width: 70,
            align: 'center',
            fixed: 'right',
            className: 'bg-rose-50 text-rose-700 font-medium'
        },
        {
            title: (
                <div className="text-center font-bold text-slate-800">
                    <span>Ghi Chú</span>
                    <span className="block text-[10px] text-slate-400 font-normal">(Cột AK Excel)</span>
                </div>
            ),
            dataIndex: 'monthlyNote',
            key: 'monthlyNote',
            width: 140,
            fixed: 'right',
            className: 'bg-amber-50/40 hover:bg-amber-100/50 cursor-pointer transition-colors',
            render: (note: string, record: StaffMatrixData) => {
                const hasNote = Boolean(note && note.trim() !== '');
                return (
                    <div
                        onClick={() => {
                            if (canEditCurrentDept) {
                                setEditingNoteStaff(record);
                                setTempNoteText(note || '');
                            }
                        }}
                        className="py-1 px-1.5 flex items-center justify-between gap-1 group min-h-[30px]"
                        title={canEditCurrentDept ? "Nhấp chuột để sửa ghi chú tháng" : "Ghi chú"}
                    >
                        <span className={`text-xs leading-tight line-clamp-2 ${hasNote ? 'font-medium text-slate-800' : 'text-slate-300 italic'}`}>
                            {hasNote ? note : '-'}
                        </span>
                        {canEditCurrentDept && (
                            <EditOutlined className="text-slate-400 group-hover:text-blue-600 text-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                    </div>
                );
            }
        }
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
                <div className="text-xs text-slate-500">
                    Tổng quân số: <b className="text-slate-800">{filteredStaffData.length} cán bộ</b>
                    {searchText.trim() && (
                        <span className="text-blue-600 font-semibold ml-1">
                            (Lọc từ {matrixData?.staffData?.length || 0} cán bộ)
                        </span>
                    )} | Tổng công hưởng lương: <b className="text-emerald-700">{matrixData?.totalDeptAttendance?.luongThoiGian || 0} công</b>
                </div>
                {canEditCurrentDept && (
                    <Button
                        type="primary"
                        size="small"
                        icon={<CalendarOutlined />}
                        onClick={() => setPlanModalOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 font-medium text-xs shadow-xs"
                    >
                        📋 Lập Kế Hoạch Chấm Công
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
                scroll={{ x: 1840 }}
            />

            {/* Modal Lập Kế Hoạch Chấm Công Hàng Loạt */}
            <AttendancePlanModal
                open={planModalOpen}
                onClose={() => setPlanModalOpen(false)}
            />
        </div>
    );
}

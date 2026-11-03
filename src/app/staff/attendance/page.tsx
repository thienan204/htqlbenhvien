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

        const tagNode = (
            <Tag color={color} className={`m-0 font-bold text-xs px-1.5 py-0.5 shadow-xs ${bgStyle}`}>
                {att.code}
            </Tag>
        );

        if ((c === 'NB' || c === 'NB/2' || c === 'NB/X' || c === 'X/NB') && att.dutyRecord) {
            const parts = (att.dutyRecord.dutyDate || '').split('-');
            const formattedDutyDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : att.dutyRecord.dutyDate;
            return (
                <Tooltip
                    title={
                        <div className="text-xs py-0.5">
                            <div className="font-semibold text-amber-300">Nghỉ bù chế độ trực</div>
                            <div>📅 Từ ca trực: <strong>{formattedDutyDate}</strong> (Ca {att.dutyRecord.dutyCode})</div>
                        </div>
                    }
                >
                    {tagNode}
                </Tooltip>
            );
        }

        return tagNode;
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
                    const uncompList = record.dutySummary?.uncompensatedDuties || [];
                    const dutyDatesText = record.dutySummary?.dutyDatesText || '';

                    const nbTooltipContent = uncompList.length > 0 ? (
                        <div className="text-xs p-1">
                            <div className="font-bold text-amber-300 mb-1 border-b border-amber-400/30 pb-0.5">
                                Các ca trực còn ngày nghỉ bù ({remDays} ngày):
                            </div>
                            <div className="space-y-1">
                                {uncompList.map((u, idx) => {
                                    const parts = u.dutyDate.split('-');
                                    const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                    return (
                                        <div key={idx} className="flex justify-between items-center gap-3 text-slate-200">
                                            <span>📅 Ngày <strong>{formattedDate}</strong> (Ca {u.dutyCode})</span>
                                            <span className="font-semibold text-emerald-300 bg-emerald-950/60 px-1 rounded">Còn {u.remainingDays}d</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null;

                    const nbChildren = canCompensate && uncompList.length > 0 ? [
                        {
                            key: 'Nb_AUTO',
                            label: (
                                <div className="py-0.5">
                                    <span className="font-semibold text-emerald-600">⚡ Tự động bù ca gần nhất</span>
                                    <span className="block text-[11px] text-slate-400">Ưu tiên ca ngày {uncompList[0]?.shortDate}</span>
                                </div>
                            )
                        },
                        { type: 'divider' as const },
                        ...uncompList.map(u => ({
                            key: `Nb_DUTY_${u.id}`,
                            label: (
                                <div className="py-0.5">
                                    <span className="font-medium text-slate-700">
                                        📅 Ca ngày <strong>{u.shortDate}</strong> ({u.dutyCode})
                                    </span>
                                    <span className="block text-[11px] text-amber-600">
                                        Quỹ ca này còn: <strong>{u.remainingDays} ngày</strong>
                                    </span>
                                </div>
                            )
                        }))
                    ] : undefined;

                    const nbHalfChildren = canCompensate && uncompList.length > 0 ? [
                        {
                            key: 'Nb/2_AUTO',
                            label: (
                                <div className="py-0.5">
                                    <span className="font-semibold text-emerald-600">⚡ Tự động bù ca gần nhất (1/2 ngày)</span>
                                    <span className="block text-[11px] text-slate-400">Ưu tiên ca ngày {uncompList[0]?.shortDate}</span>
                                </div>
                            )
                        },
                        { type: 'divider' as const },
                        ...uncompList.map(u => ({
                            key: `Nb/2_DUTY_${u.id}`,
                            label: (
                                <div className="py-0.5">
                                    <span className="font-medium text-slate-700">
                                        📅 Ca ngày <strong>{u.shortDate}</strong> ({u.dutyCode})
                                    </span>
                                    <span className="block text-[11px] text-amber-600">
                                        Quỹ ca này còn: <strong>{u.remainingDays} ngày</strong> (trừ 0.5d)
                                    </span>
                                </div>
                            )
                        }))
                    ] : undefined;

                    const items = [
                        { key: 'x', label: <span className="font-semibold text-emerald-600">x - Đi làm đủ ngày (8h)</span> },
                        { key: 'x/2', label: <span className="text-emerald-500">x/2 - Đi làm nửa ngày (4h)</span> },
                        { key: 'P', label: <span className="text-blue-600">P - Nghỉ phép cả ngày</span> },
                        { key: 'P/2', label: <span className="text-blue-500">P/2 - Nghỉ phép 1/2 ngày</span> },
                        {
                            key: 'Nb',
                            label: canCompensate ? (
                                <Tooltip title={nbTooltipContent} placement="right" mouseEnterDelay={0.2}>
                                    <div className="py-0.5">
                                        <div className="text-amber-600 font-bold flex items-center justify-between gap-2">
                                            <span>Nb - Nghỉ bù cả ngày</span>
                                            <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">
                                                Quỹ còn {remDays}d
                                            </span>
                                        </div>
                                        {dutyDatesText && (
                                            <div className="text-[11px] text-slate-500 font-normal mt-0.5 flex items-center gap-1">
                                                <span className="text-amber-600 font-medium">↳ 📅 Trực ngày:</span>
                                                <span className="font-medium text-slate-700 truncate max-w-[200px]" title={dutyDatesText}>
                                                    {dutyDatesText}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </Tooltip>
                            ) : (
                                <span className="text-slate-400">Nb - Nghỉ bù cả ngày (Không có ca trực để bù)</span>
                            ),
                            children: nbChildren,
                            disabled: !canCompensate
                        },
                        {
                            key: 'Nb/2',
                            label: canCompensate ? (
                                <Tooltip title={nbTooltipContent} placement="right" mouseEnterDelay={0.2}>
                                    <div className="py-0.5">
                                        <div className="text-amber-500 font-semibold flex items-center justify-between gap-2">
                                            <span>Nb/2 - Nghỉ bù 1/2 ngày</span>
                                            <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">
                                                Quỹ còn {remDays}d
                                            </span>
                                        </div>
                                        {dutyDatesText && (
                                            <div className="text-[11px] text-slate-500 font-normal mt-0.5 flex items-center gap-1">
                                                <span className="text-amber-600 font-medium">↳ 📅 Trực ngày:</span>
                                                <span className="font-medium text-slate-700 truncate max-w-[200px]" title={dutyDatesText}>
                                                    {dutyDatesText}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </Tooltip>
                            ) : (
                                <span className="text-slate-400">Nb/2 - Nghỉ bù 1/2 ngày (Không có ca trực để bù)</span>
                            ),
                            children: nbHalfChildren,
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
                                    let finalCode = key;
                                    let targetDutyId: string | undefined = undefined;

                                    if (key.startsWith('Nb_DUTY_')) {
                                        finalCode = 'Nb';
                                        targetDutyId = key.replace('Nb_DUTY_', '');
                                    } else if (key === 'Nb_AUTO' || key === 'Nb') {
                                        finalCode = 'Nb';
                                        targetDutyId = uncompList[0]?.id;
                                    } else if (key.startsWith('Nb/2_DUTY_')) {
                                        finalCode = 'Nb/2';
                                        targetDutyId = key.replace('Nb/2_DUTY_', '');
                                    } else if (key === 'Nb/2_AUTO' || key === 'Nb/2') {
                                        finalCode = 'Nb/2';
                                        targetDutyId = uncompList[0]?.id;
                                    }

                                    if ((finalCode === 'Nb' || finalCode === 'Nb/2') && !canCompensate) {
                                        return;
                                    }
                                    setSelectedDate(dayjs(d.dateStr));
                                    handleUpdateAttendanceCell(record.staffId, d.day, finalCode, targetDutyId);
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

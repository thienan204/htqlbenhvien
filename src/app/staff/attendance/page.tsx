'use client';

import React, { useState } from 'react';
import { Table, Tag, Popover, Tooltip, Button } from 'antd';
import { EditOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAttendance, StaffMatrixData } from './AttendanceContext';
import { AttendancePlanModal } from './_components/AttendancePlanModal';

interface AttendanceOptionButtonProps {
    code: string;
    label: string;
    desc?: string;
    colorType?: 'emerald' | 'teal' | 'blue' | 'amber' | 'purple' | 'red' | 'cyan' | 'slate';
    disabled?: boolean;
    active?: boolean;
    onClick: () => void;
}

function AttendanceOptionButton({
    code,
    label,
    desc,
    colorType = 'emerald',
    disabled = false,
    active = false,
    onClick
}: AttendanceOptionButtonProps) {
    const badgeColors: Record<string, string> = {
        emerald: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        teal: 'bg-teal-100 text-teal-800 border-teal-300',
        blue: 'bg-blue-100 text-blue-800 border-blue-300',
        amber: 'bg-amber-100 text-amber-800 border-amber-300',
        purple: 'bg-purple-100 text-purple-800 border-purple-300',
        red: 'bg-red-100 text-red-800 border-red-300',
        cyan: 'bg-cyan-100 text-cyan-800 border-cyan-300',
        slate: 'bg-slate-100 text-slate-700 border-slate-300'
    };

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={`w-full text-left px-2 py-1 rounded transition-all flex items-start gap-1.5 text-xs select-none ${
                disabled
                    ? 'opacity-40 cursor-not-allowed bg-slate-50 text-slate-400'
                    : active
                    ? 'bg-blue-50/90 border border-blue-400 text-blue-900 shadow-xs'
                    : 'hover:bg-slate-100 hover:border-slate-300 border border-transparent cursor-pointer text-slate-700'
            }`}
        >
            <span
                className={`font-mono font-bold px-1.5 py-0.2 rounded text-[11px] shrink-0 border ${
                    badgeColors[colorType] || badgeColors.slate
                }`}
            >
                {code}
            </span>
            <div className="flex-1 min-w-0 leading-tight">
                <div className="font-medium truncate">{label}</div>
                {desc && <div className="text-[10px] text-slate-400 truncate">{desc}</div>}
            </div>
        </button>
    );
}

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
    const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);

    const daysInfo = matrixData?.daysInfo || [];

    const renderAttendanceTag = (att: any) => {
        if (!att || !att.code) {
            return <span className="text-slate-300 text-xs hover:text-blue-500 font-mono transition-colors">-</span>;
        }
        const c = att.code.trim().toUpperCase();
        let color = 'default';
        let bgStyle = '';

        if (['X', '+', 'X/2', '+/2'].includes(c)) color = 'success';
        else if (c === 'NB' || c === 'NB/2' || c === 'NB/X' || c === 'X/NB') color = 'warning';
        else if (c === 'P' || c === 'P/2') color = 'processing';
        else if (c === 'L' || c === 'TE') color = 'purple';
        else if (['Ô', 'Ố', 'O', 'TS', 'KL'].includes(c)) color = 'error';
        else if (c === 'H' || c === 'CT') color = 'cyan';

        let sessionSuffix = '';
        let sessionDesc = '';
        if (att.session === 'MORNING') {
            sessionSuffix = ' (S)';
            sessionDesc = 'Buổi Sáng (07:00 - 11:30)';
        } else if (att.session === 'AFTERNOON') {
            sessionSuffix = ' (C)';
            sessionDesc = 'Buổi Chiều (13:30 - 17:00)';
        }

        const tagNode = (
            <Tag color={color} className={`m-0 font-bold text-xs px-1.5 py-0.5 shadow-xs ${bgStyle}`}>
                {att.code}{sessionSuffix}
            </Tag>
        );

        if ((c === 'NB' || c === 'NB/2' || c === 'NB/X' || c === 'X/NB') && att.dutyRecord) {
            const parts = (att.dutyRecord.dutyDate || '').split('-');
            const formattedDutyDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : att.dutyRecord.dutyDate;
            return (
                <Tooltip
                    title={
                        <div className="text-xs py-0.5">
                            <div className="font-semibold text-amber-300">Nghỉ bù chế độ trực {sessionSuffix ? `(${sessionDesc})` : ''}</div>
                            <div>📅 Từ ca trực: <strong>{formattedDutyDate}</strong> (Ca {att.dutyRecord.dutyCode})</div>
                        </div>
                    }
                >
                    {tagNode}
                </Tooltip>
            );
        }

        if (sessionDesc) {
            return (
                <Tooltip title={<div className="text-xs font-medium">{att.code}: {sessionDesc}</div>}>
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

                    if (!canEditCurrentDept) {
                        return cellNode;
                    }

                    const cellKey = `${record.staffId}_${d.day}`;
                    const isOpen = activePopoverKey === cellKey;

                    const handleSelect = (code: string, dutyId?: string, session?: string) => {
                        setActivePopoverKey(null);
                        setSelectedDate(dayjs(d.dateStr));
                        handleUpdateAttendanceCell(record.staffId, d.day, code, dutyId, session);
                    };

                    const currentCode = (att?.code || '').trim().toUpperCase();
                    const currentSession = (att?.session || '').trim().toUpperCase();

                    const popoverContent = (
                        <div className="w-[660px] p-1 text-slate-800">
                            {/* Header Popup */}
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                                    <span className="text-blue-600 font-bold">{record.ho_ten}</span>
                                    <span className="text-slate-300">|</span>
                                    <span>Ngày {d.day}/{selectedDate.format('MM/YYYY')} ({d.dayOfWeek})</span>
                                </div>
                                {att?.code && (
                                    <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                                        Đang chấm: <strong className="text-blue-600 font-mono">{att.code}{att.session === 'MORNING' ? ' (S)' : att.session === 'AFTERNOON' ? ' (C)' : ''}</strong>
                                    </span>
                                )}
                            </div>

                            {/* Khối 3 Cột chức năng */}
                            <div className="grid grid-cols-3 gap-2.5">
                                {/* Cột 1: Đi Làm */}
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1 mb-1.5">
                                        🟢 1. Đi Làm
                                    </div>
                                    <AttendanceOptionButton
                                        code="+"
                                        label="Đi làm đủ ngày (8h)"
                                        desc="8h hành chính (Mặc định)"
                                        colorType="emerald"
                                        active={currentCode === '+' && currentSession === 'FULL_DAY'}
                                        onClick={() => handleSelect('+', undefined, 'FULL_DAY')}
                                    />
                                    <AttendanceOptionButton
                                        code="+/2"
                                        label="Làm buổi Sáng (4h)"
                                        desc="07:00 - 11:30 (Sáng)"
                                        colorType="emerald"
                                        active={currentCode === '+/2' && currentSession === 'MORNING'}
                                        onClick={() => handleSelect('+/2', undefined, 'MORNING')}
                                    />
                                    <AttendanceOptionButton
                                        code="+/2"
                                        label="Làm buổi Chiều (4h)"
                                        desc="13:30 - 17:00 (Chiều)"
                                        colorType="emerald"
                                        active={currentCode === '+/2' && currentSession === 'AFTERNOON'}
                                        onClick={() => handleSelect('+/2', undefined, 'AFTERNOON')}
                                    />
                                    <div className="my-1 border-t border-slate-100" />
                                    <AttendanceOptionButton
                                        code="x"
                                        label="Đi làm đủ ngày (8h)"
                                        desc="8h hành chính"
                                        colorType="teal"
                                        active={currentCode === 'X' && currentSession === 'FULL_DAY'}
                                        onClick={() => handleSelect('x', undefined, 'FULL_DAY')}
                                    />
                                    <AttendanceOptionButton
                                        code="x/2"
                                        label="Đi làm nửa ngày"
                                        desc="4h làm việc"
                                        colorType="teal"
                                        active={currentCode === 'X/2'}
                                        onClick={() => handleSelect('x/2', undefined, 'HALF_DAY')}
                                    />
                                </div>

                                {/* Cột 2: Phép & Nghỉ Bù */}
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200 flex items-center gap-1 mb-1.5">
                                        🔵 2. Phép & Nghỉ Bù
                                    </div>
                                    <AttendanceOptionButton
                                        code="P"
                                        label="Nghỉ phép cả ngày"
                                        desc="Hưởng nguyên lương"
                                        colorType="blue"
                                        active={currentCode === 'P' && currentSession === 'FULL_DAY'}
                                        onClick={() => handleSelect('P', undefined, 'FULL_DAY')}
                                    />
                                    <AttendanceOptionButton
                                        code="P/2"
                                        label="Phép buổi Sáng"
                                        desc="07:00 - 11:30 (Nghỉ sáng)"
                                        colorType="blue"
                                        active={currentCode === 'P/2' && currentSession === 'MORNING'}
                                        onClick={() => handleSelect('P/2', undefined, 'MORNING')}
                                    />
                                    <AttendanceOptionButton
                                        code="P/2"
                                        label="Phép buổi Chiều"
                                        desc="13:30 - 17:00 (Nghỉ chiều)"
                                        colorType="blue"
                                        active={currentCode === 'P/2' && currentSession === 'AFTERNOON'}
                                        onClick={() => handleSelect('P/2', undefined, 'AFTERNOON')}
                                    />
                                    <div className="my-1 border-t border-slate-100" />
                                    <AttendanceOptionButton
                                        code="Nb"
                                        label="Nghỉ bù cả ngày"
                                        desc={canCompensate ? `Ca ${uncompList[0]?.shortDate || ''} (Quỹ: ${remDays}d)` : 'Không có ca trực để bù'}
                                        disabled={!canCompensate}
                                        colorType="amber"
                                        active={currentCode === 'NB' && currentSession === 'FULL_DAY'}
                                        onClick={() => handleSelect('Nb', uncompList[0]?.id, 'FULL_DAY')}
                                    />
                                    <AttendanceOptionButton
                                        code="Nb/2"
                                        label="Bù buổi Sáng"
                                        desc={canCompensate ? `07:00 - 11:30 (Trừ 0.5d ca ${uncompList[0]?.shortDate || ''})` : 'Không có ca trực để bù'}
                                        disabled={!canCompensate}
                                        colorType="amber"
                                        active={currentCode === 'NB/2' && currentSession === 'MORNING'}
                                        onClick={() => handleSelect('Nb/2', uncompList[0]?.id, 'MORNING')}
                                    />
                                    <AttendanceOptionButton
                                        code="Nb/2"
                                        label="Bù buổi Chiều"
                                        desc={canCompensate ? `13:30 - 17:00 (Trừ 0.5d ca ${uncompList[0]?.shortDate || ''})` : 'Không có ca trực để bù'}
                                        disabled={!canCompensate}
                                        colorType="amber"
                                        active={currentCode === 'NB/2' && currentSession === 'AFTERNOON'}
                                        onClick={() => handleSelect('Nb/2', uncompList[0]?.id, 'AFTERNOON')}
                                    />

                                    {/* Danh sách các ca trực khác nếu có từ 2 ca trở lên */}
                                    {canCompensate && uncompList.length > 1 && (
                                        <div className="mt-1 pt-1 border-t border-dashed border-amber-200">
                                            <div className="text-[10px] text-amber-800 font-medium mb-1">
                                                Ca trực khác còn quỹ bù:
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {uncompList.slice(1).map(u => (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => handleSelect('Nb', u.id, 'FULL_DAY')}
                                                        className="px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-medium transition-colors cursor-pointer"
                                                        title={`Bù cả ngày từ ca ${u.dutyDate} (${u.dutyCode}) - Quỹ còn: ${u.remainingDays}d`}
                                                    >
                                                        {u.shortDate} ({u.remainingDays}d)
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Cột 3: Chế Độ Khác */}
                                <div className="space-y-1">
                                    <div className="text-xs font-bold text-purple-800 bg-purple-50 px-2 py-1 rounded border border-purple-200 flex items-center gap-1 mb-1.5">
                                        🟣 3. Chế Độ Khác
                                    </div>
                                    <AttendanceOptionButton
                                        code="L"
                                        label="Nghỉ Lễ hưởng lương"
                                        desc="Theo quy định nhà nước"
                                        colorType="purple"
                                        active={currentCode === 'L'}
                                        onClick={() => handleSelect('L', undefined, 'FULL_DAY')}
                                    />
                                    <AttendanceOptionButton
                                        code="Ố"
                                        label="Nghỉ ốm đau"
                                        desc="Hưởng chế độ BHXH"
                                        colorType="red"
                                        active={['Ô', 'Ố', 'O'].includes(currentCode)}
                                        onClick={() => handleSelect('Ố', undefined, 'FULL_DAY')}
                                    />
                                    <AttendanceOptionButton
                                        code="TS"
                                        label="Nghỉ thai sản"
                                        desc="Hưởng chế độ BHXH"
                                        colorType="red"
                                        active={currentCode === 'TS'}
                                        onClick={() => handleSelect('TS', undefined, 'FULL_DAY')}
                                    />
                                    <AttendanceOptionButton
                                        code="H"
                                        label="Đi học, hội nghị"
                                        desc="Cử đi học, công tác"
                                        colorType="cyan"
                                        active={currentCode === 'H'}
                                        onClick={() => handleSelect('H', undefined, 'FULL_DAY')}
                                    />
                                    <AttendanceOptionButton
                                        code="KL"
                                        label="Nghỉ không lương"
                                        desc="Trừ lương thời gian"
                                        colorType="slate"
                                        active={currentCode === 'KL'}
                                        onClick={() => handleSelect('KL', undefined, 'FULL_DAY')}
                                    />
                                </div>
                            </div>

                            {/* Footer Popup */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                                <div className="text-[11px] text-slate-400">
                                    💡 Nhấp chọn mã công để áp dụng ngay
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleSelect('', undefined)}
                                    className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded border border-rose-200 font-medium transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    🗑️ Xóa công ngày này
                                </button>
                            </div>
                        </div>
                    );

                    return (
                        <Popover
                            open={isOpen}
                            onOpenChange={(visible) => {
                                if (!visible) setActivePopoverKey(null);
                                else setActivePopoverKey(cellKey);
                            }}
                            trigger="click"
                            placement="bottom"
                            content={popoverContent}
                            destroyOnHidden
                        >
                            <div className="cursor-pointer hover:bg-blue-100/60 rounded transition-colors">
                                {cellNode}
                            </div>
                        </Popover>
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

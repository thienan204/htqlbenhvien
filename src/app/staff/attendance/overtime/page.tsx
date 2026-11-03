'use client';

import React, { useState } from 'react';
import { Table, Tag, Tooltip, Modal, InputNumber, Space, Button, Input } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAttendance, StaffMatrixData } from '../AttendanceContext';

export default function OvertimeSheetPage() {
    const {
        selectedDate,
        setSelectedDate,
        filteredStaffData,
        loading,
        matrixData,
        canEditCurrentDept,
        handleUpdateOvertimeCell,
        searchText
    } = useAttendance();

    const daysInfo = matrixData?.daysInfo || [];

    // State cho Modal nhập giờ làm thêm
    const [overtimeModalVisible, setOvertimeModalVisible] = useState(false);
    const [selectedOvertimeCell, setSelectedOvertimeCell] = useState<{
        staffId: string;
        staffName: string;
        dateStr: string;
        day: number;
        isWeekend: boolean;
        dayOfWeek: number;
        note?: string;
    } | null>(null);
    const [inputDayHours, setInputDayHours] = useState<number>(0);
    const [inputNightHours, setInputNightHours] = useState<number>(0);
    const [inputOtNote, setInputOtNote] = useState<string>('');
    const [savingOt, setSavingOt] = useState<boolean>(false);

    const handleOpenOvertimeModal = (staff: StaffMatrixData, d: any, ot: any) => {
        setSelectedDate(dayjs(d.dateStr));
        setSelectedOvertimeCell({
            staffId: staff.staffId,
            staffName: staff.ho_ten,
            dateStr: d.dateStr,
            day: d.day,
            isWeekend: d.isWeekend,
            dayOfWeek: d.dayOfWeek,
            note: ot?.note || ''
        });
        setInputDayHours(ot?.dayHours || 0);
        setInputNightHours(ot?.nightHours || 0);
        setInputOtNote(ot?.note || '');
        setOvertimeModalVisible(true);
    };

    const handleSaveOvertime = async () => {
        if (!selectedOvertimeCell) return;
        setSavingOt(true);
        try {
            await handleUpdateOvertimeCell(
                selectedOvertimeCell.staffId,
                selectedOvertimeCell.day,
                inputDayHours,
                inputNightHours,
                inputOtNote
            );
            setOvertimeModalVisible(false);
        } finally {
            setSavingOt(false);
        }
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
                        <span className="font-semibold text-slate-800 block leading-tight">{name}</span>
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
                                ? 'bg-amber-600 text-white font-bold shadow-md ring-2 ring-amber-400'
                                : d.isHoliday
                                ? 'bg-purple-200 text-purple-950 font-black hover:bg-purple-300 border-b-2 border-purple-500'
                                : d.isWeekend
                                ? 'bg-amber-200 text-amber-950 font-black hover:bg-amber-300 border-b-2 border-amber-400'
                                : 'text-slate-700 hover:bg-amber-50'
                        }`}
                        title={d.isHoliday && d.holidayName ? `Ngày Lễ: ${d.holidayName}` : `Ngày ${d.day}`}
                    >
                        <div className={`text-[10px] leading-3 ${isSelected ? 'text-amber-100 font-semibold' : d.isHoliday ? 'text-purple-800 font-black' : d.isWeekend ? 'text-red-700 font-black' : ''}`}>
                            {d.isHoliday ? 'Lễ' : d.dayOfWeek === 0 ? 'CN' : `T${d.dayOfWeek + 1}`}
                        </div>
                        <div className="text-xs font-bold leading-4 flex items-center justify-center gap-0.5">
                            {d.day}
                            {isToday && (
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'}`} />
                            )}
                        </div>
                        {isSelected && (
                            <div className="text-[9px] leading-tight text-amber-200 font-normal whitespace-nowrap scale-90">
                                {isToday ? 'Hôm nay' : 'Đang chọn'}
                            </div>
                        )}
                    </div>
                ),
                dataIndex: ['overtimeMap', d.day],
                key: `overtime_day_${d.day}`,
                width: isSelected ? 48 : 42,
                align: 'center',
                className: isSelected
                    ? 'bg-amber-50/90 border-x-2 border-amber-400 font-semibold shadow-inner'
                    : d.isHoliday
                    ? 'bg-purple-100/70 font-medium'
                    : d.isWeekend
                    ? 'bg-amber-100/80 font-medium'
                    : '',
                render: (ot: any, record: StaffMatrixData) => {
                    const dutyOnThisDay = record.dutyMap?.[d.day];

                    // Nếu ngày này cán bộ đã có ca trực (T, C, L, Te, Tk, TT) -> Không được chấm thêm giờ
                    if (dutyOnThisDay) {
                        return (
                            <Tooltip title={`Cán bộ đã có lịch trực (${dutyOnThisDay.dutyCode}). Theo quy định, không được chấm thêm giờ trùng ca trực!`}>
                                <div className="py-1 px-0.5 bg-slate-100/80 rounded border border-slate-200 text-slate-400 text-[10px] font-medium cursor-not-allowed select-none">
                                    Trực {dutyOnThisDay.dutyCode}
                                </div>
                            </Tooltip>
                        );
                    }

                    const hasOt = ot && ot.totalHours > 0;
                    const cellNode = (
                        <div className="py-1 flex items-center justify-center min-h-[26px]">
                            {hasOt ? (
                                <Tooltip title={`Làm thêm: ${ot.totalHours}h (Ngày: ${ot.dayHours || 0}h, Đêm: ${ot.nightHours || 0}h)${ot.note ? ` - ${ot.note}` : ''}`}>
                                    <Tag color={d.isWeekend ? 'volcano' : 'orange'} className="m-0 font-extrabold text-xs px-1.5 py-0.5 shadow-xs">
                                        {ot.totalHours}
                                    </Tag>
                                </Tooltip>
                            ) : (
                                <span className="text-slate-300 text-xs hover:text-amber-500 font-mono transition-colors">-</span>
                            )}
                        </div>
                    );

                    if (!canEditCurrentDept) return cellNode;

                    return (
                        <div
                            onClick={() => handleOpenOvertimeModal(record, d, ot)}
                            className="cursor-pointer hover:bg-amber-100/80 rounded transition-colors group"
                            title="Click để nhập số giờ làm thêm"
                        >
                            {cellNode}
                        </div>
                    );
                }
            };
        }),
        {
            title: 'Tổng ngày',
            dataIndex: ['overtimeSummary', 'totalDayHours'],
            key: 'totalDayHours',
            width: 75,
            align: 'center',
            fixed: 'right',
            className: 'bg-amber-50/70 font-bold text-amber-800'
        },
        {
            title: 'Tổng đêm',
            dataIndex: ['overtimeSummary', 'totalNightHours'],
            key: 'totalNightHours',
            width: 75,
            align: 'center',
            fixed: 'right',
            className: 'bg-indigo-50/70 font-bold text-indigo-800'
        },
        {
            title: 'Tổng cộng',
            dataIndex: ['overtimeSummary', 'totalOvertimeHours'],
            key: 'totalOvertimeHours',
            width: 80,
            align: 'center',
            fixed: 'right',
            className: 'bg-amber-200/60 font-black text-amber-950'
        }
    ];

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-2 p-2 bg-amber-50/70 rounded-lg border border-amber-200">
                <div className="text-xs text-slate-700">
                    Tổng quân số: <b className="text-slate-800">{filteredStaffData.length}</b>
                    {searchText.trim() && <span className="text-blue-600 font-semibold ml-1">(Lọc từ {matrixData?.staffData?.length || 0})</span>} cán bộ |{' '}
                    Tổng giờ làm thêm toàn phòng: <b className="text-amber-800 text-sm">{matrixData?.totalDeptOvertime?.totalOvertimeHours || 0} giờ</b>{' '}
                    (Giờ ngày: <b className="text-amber-700">{matrixData?.totalDeptOvertime?.totalDayHours || 0}h</b>, Giờ đêm: <b className="text-indigo-700">{matrixData?.totalDeptOvertime?.totalNightHours || 0}h</b>)
                </div>
                <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                        <span className="w-3 h-3 bg-amber-200 border border-amber-400 inline-block rounded-xs" /> Thứ 7 & Chủ Nhật
                    </span>
                    <span>• Ngày thường tối đa <b>4h</b></span>
                    <span>• Thứ 7/CN/Lễ tối đa <b>12h</b></span>
                    <span className="text-rose-600 font-semibold">• Có lịch trực: Không được chấm thêm giờ</span>
                </div>
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
                scroll={{ x: 1800 }}
            />

            {/* Modal Nhập Giờ Làm Thêm */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-amber-700 font-bold">
                        <ClockCircleOutlined /> Chấm Làm Thêm Giờ (Overtime) - Ngày {selectedOvertimeCell?.dateStr}
                    </div>
                }
                open={overtimeModalVisible}
                onOk={handleSaveOvertime}
                onCancel={() => setOvertimeModalVisible(false)}
                okText="Lưu Giờ Làm Thêm"
                cancelText="Đóng"
                confirmLoading={savingOt}
                width={520}
            >
                <div className="py-2">
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-3 text-xs">
                        <div className="flex justify-between items-center">
                            <div>Cán bộ: <b className="text-slate-800 text-sm">{selectedOvertimeCell?.staffName}</b></div>
                            <Tag color={selectedOvertimeCell?.isWeekend ? 'volcano' : 'blue'}>
                                {selectedOvertimeCell?.dayOfWeek === 0 ? 'Chủ Nhật' : `Thứ ${Number(selectedOvertimeCell?.dayOfWeek) + 1}`}
                            </Tag>
                        </div>
                        <div className="mt-1 text-slate-600">
                            Quy định: {selectedOvertimeCell?.isWeekend ? 'Ngày nghỉ cuối tuần tối đa 12h' : 'Ngày hành chính tối đa 4h'}, tối thiểu 1h.
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                ☀️ Giờ làm thêm Ban Ngày:
                            </label>
                            <Space.Compact className="w-full">
                                <InputNumber
                                    min={0}
                                    max={selectedOvertimeCell?.isWeekend ? 12 : 4}
                                    step={0.5}
                                    value={inputDayHours}
                                    onChange={(val) => setInputDayHours(Number(val) || 0)}
                                    className="w-full"
                                    placeholder="Số giờ ngày"
                                />
                                <span className="inline-flex items-center px-3 bg-slate-100 border border-l-0 border-slate-300 text-slate-500 rounded-r-md text-xs select-none">
                                    giờ
                                </span>
                            </Space.Compact>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                                🌙 Giờ làm thêm Ban Đêm:
                            </label>
                            <Space.Compact className="w-full">
                                <InputNumber
                                    min={0}
                                    max={selectedOvertimeCell?.isWeekend ? 12 : 4}
                                    step={0.5}
                                    value={inputNightHours}
                                    onChange={(val) => setInputNightHours(Number(val) || 0)}
                                    className="w-full"
                                    placeholder="Số giờ đêm"
                                />
                                <span className="inline-flex items-center px-3 bg-slate-100 border border-l-0 border-slate-300 text-slate-500 rounded-r-md text-xs select-none">
                                    giờ
                                </span>
                            </Space.Compact>
                        </div>
                    </div>

                    {/* Phím chọn nhanh */}
                    <div className="mb-3">
                        <span className="text-xs text-slate-500 mr-2">Chọn nhanh:</span>
                        <Space wrap size="small">
                            <Button size="small" onClick={() => { setInputDayHours(1); setInputNightHours(0); }}>1h</Button>
                            <Button size="small" onClick={() => { setInputDayHours(2); setInputNightHours(0); }}>2h</Button>
                            <Button size="small" onClick={() => { setInputDayHours(4); setInputNightHours(0); }}>4h</Button>
                            {selectedOvertimeCell?.isWeekend && (
                                <>
                                    <Button size="small" onClick={() => { setInputDayHours(8); setInputNightHours(0); }}>8h</Button>
                                    <Button size="small" onClick={() => { setInputDayHours(8); setInputNightHours(4); }}>12h (8d+4n)</Button>
                                </>
                            )}
                            <Button
                                size="small"
                                danger
                                onClick={() => { setInputDayHours(0); setInputNightHours(0); }}
                                title="Xóa giờ làm thêm về 0"
                            >
                                Xóa về 0h
                            </Button>
                        </Space>
                    </div>

                    <div className="p-2.5 bg-slate-50 rounded border border-slate-200 mb-3 text-xs flex justify-between items-center">
                        <span className="font-medium text-slate-700">Tổng cộng giờ làm thêm:</span>
                        <span className="text-base font-extrabold text-amber-700">
                            {Number(inputDayHours) + Number(inputNightHours)} giờ
                        </span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Lý do / Công việc phát sinh thêm giờ:
                        </label>
                        <Input.TextArea
                            rows={2}
                            value={inputOtNote}
                            onChange={(e) => setInputOtNote(e.target.value)}
                            placeholder="Ví dụ: Xử lý sự cố mạng, bảo trì máy chủ ngoài giờ..."
                            maxLength={200}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

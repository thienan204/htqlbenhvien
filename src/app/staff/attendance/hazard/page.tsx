'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Tag, Popover, Tooltip, Button, Modal, Radio, message, Spin, Card } from 'antd';
import {
    ReloadOutlined,
    ThunderboltOutlined,
    FileExcelOutlined,
    CheckCircleOutlined,
    InfoCircleOutlined,
    SafetyCertificateOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAttendance } from '../AttendanceContext';

interface HazardStaffItem {
    stt: number;
    staffId: string;
    ma_nv: string;
    ho_ten: string;
    chuc_vu: string;
    chuc_danh: string;
    hazardMap: Record<number, {
        id?: string;
        code: string;
        value: number;
        hazardLevel: number;
        allowanceRate: number;
        note?: string;
    }>;
    attendanceMap: Record<number, {
        code: string;
        session: string;
    }>;
    summary: {
        totalDays: number;
        m1Days: number;
        m2Days: number;
        m3Days: number;
        m4Days: number;
        totalAmount: number;
    };
}

export default function HazardSheetPage() {
    const {
        selectedDate,
        setSelectedDate,
        selectedDept,
        canEditCurrentDept,
        searchText
    } = useAttendance();

    const [loading, setLoading] = useState(false);
    const [hazardData, setHazardData] = useState<{
        daysInMonth: number;
        daysInfo: any[];
        staffData: HazardStaffItem[];
        grandSummary: {
            totalStaff: number;
            totalDays: number;
            m1Days: number;
            m2Days: number;
            m3Days: number;
            m4Days: number;
            totalAmount: number;
        };
        departmentName?: string;
        isLocked?: boolean;
    } | null>(null);

    const [activePopoverKey, setActivePopoverKey] = useState<string | null>(null);
    const [syncModalOpen, setSyncModalOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncLevel, setSyncLevel] = useState<number>(2);
    const [syncOverwrite, setSyncOverwrite] = useState<boolean>(false);

    const getBasePath = () => {
        if (typeof window !== 'undefined') {
            const parts = window.location.pathname.split('/staff');
            return parts.length > 1 ? parts[0] : '';
        }
        return '';
    };

    const fetchHazardData = useCallback(async () => {
        if (!selectedDept) return;
        setLoading(true);
        try {
            const basePath = getBasePath();
            const monthYear = selectedDate.format('YYYY-MM');
            const res = await fetch(`${basePath}/api/staff/attendance/hazard?monthYear=${monthYear}&ma_khoa=${selectedDept}`);
            if (!res.ok) {
                const text = await res.text();
                let errMsg = 'Lỗi tải dữ liệu bảng chấm độc hại';
                try {
                    const err = JSON.parse(text);
                    if (err.error) errMsg = err.error;
                } catch {}
                throw new Error(errMsg);
            }
            const text = await res.text();
            let data: any = null;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error('Máy chủ phản hồi không đúng định dạng JSON');
            }
            if (data) {
                setHazardData(data);
            }
        } catch (err: any) {
            console.error('Lỗi fetchHazardData:', err);
            message.error(err.message || 'Không thể tải dữ liệu bảng chấm độc hại');
        } finally {
            setLoading(false);
        }
    }, [selectedDate, selectedDept]);

    useEffect(() => {
        fetchHazardData();
    }, [fetchHazardData]);

    // Cập nhật từng ô
    const handleUpdateCell = async (staffId: string, day: number, code: string) => {
        try {
            const basePath = getBasePath();
            const dateStr = `${selectedDate.format('YYYY-MM')}-${String(day).padStart(2, '0')}`;
            const res = await fetch(`${basePath}/api/staff/attendance/hazard/update-cell`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staffId,
                    date: dateStr,
                    code,
                    ma_khoa: selectedDept,
                    hazardLevel: syncLevel,
                    allowanceRate: syncLevel === 1 ? 13000 : syncLevel === 3 ? 26000 : syncLevel === 4 ? 32000 : 20000
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Lỗi cập nhật ô');
            }

            // Tải lại dữ liệu
            fetchHazardData();
        } catch (err: any) {
            console.error('Lỗi update cell:', err);
            message.error(err.message || 'Lỗi khi cập nhật ô');
        }
    };

    // Đồng bộ từ bảng chấm công
    const handleSyncAttendance = async () => {
        setSyncing(true);
        try {
            const basePath = getBasePath();
            const monthYear = selectedDate.format('YYYY-MM');
            const res = await fetch(`${basePath}/api/staff/attendance/hazard/sync-attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monthYear,
                    ma_khoa: selectedDept,
                    hazardLevel: syncLevel,
                    allowanceRate: syncLevel === 1 ? 13000 : syncLevel === 3 ? 26000 : syncLevel === 4 ? 32000 : 20000,
                    overwrite: syncOverwrite
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Lỗi đồng bộ');
            }

            const resData = await res.json();
            message.success(resData.message || 'Đồng bộ thành công!');
            setSyncModalOpen(false);
            fetchHazardData();
        } catch (err: any) {
            console.error('Lỗi sync:', err);
            message.error(err.message || 'Không thể đồng bộ');
        } finally {
            setSyncing(false);
        }
    };

    const daysInfo = hazardData?.daysInfo || [];
    const staffList = hazardData?.staffData || [];

    // Lọc theo text tìm kiếm
    const filteredStaffList = useMemo(() => {
        if (!searchText || searchText.trim() === '') return staffList;
        const kw = searchText.trim().toLowerCase();
        return staffList.filter(s =>
            s.ho_ten.toLowerCase().includes(kw) ||
            s.ma_nv.toLowerCase().includes(kw) ||
            s.chuc_vu.toLowerCase().includes(kw)
        );
    }, [staffList, searchText]);

    // Định nghĩa cột Table
    const columns: any[] = useMemo(() => {
        const cols: any[] = [
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
                render: (name: string, record: HazardStaffItem) => (
                    <div className="py-0.5">
                        <span className="font-semibold text-slate-800 block leading-tight">{name}</span>
                        {record.chuc_vu && (
                            <span className="text-[11px] text-blue-700 font-medium leading-none block mt-0.5">
                                {record.chuc_vu}
                            </span>
                        )}
                    </div>
                )
            }
        ];

        // 31 cột ngày trong tháng
        daysInfo.forEach(d => {
            const isToday = dayjs().format('YYYY-MM-DD') === d.dateStr;
            const isSelected = selectedDate.format('YYYY-MM-DD') === d.dateStr;

            cols.push({
                title: (
                    <div
                        className={`text-center py-0.5 px-0.5 -mx-1 -my-2 select-none cursor-pointer transition-colors ${
                            isSelected
                                ? 'bg-blue-600 text-white font-bold'
                                : d.isHoliday
                                ? 'bg-purple-200 text-purple-950 font-black'
                                : d.isWeekend
                                ? 'bg-amber-200 text-amber-950 font-black'
                                : 'text-slate-700 hover:bg-blue-50'
                        }`}
                        title={d.isHoliday && d.holidayName ? `Ngày Lễ: ${d.holidayName}` : `Ngày ${d.day}`}
                    >
                        <div className={`text-[10px] leading-3 ${isSelected ? 'text-blue-100' : d.isWeekend ? 'text-red-700 font-bold' : ''}`}>
                            {d.isHoliday ? 'Lễ' : d.dayOfWeek === 0 ? 'CN' : `T${d.dayOfWeek + 1}`}
                        </div>
                        <div className="text-xs font-bold leading-4 flex items-center justify-center gap-0.5">
                            {d.day}
                            {isToday && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </div>
                    </div>
                ),
                key: `day_${d.day}`,
                width: 38,
                align: 'center',
                className: d.isHoliday
                    ? 'bg-purple-100/70'
                    : d.isWeekend
                    ? 'bg-amber-100/80'
                    : '',
                render: (_: any, record: HazardStaffItem) => {
                    const cell = record.hazardMap?.[d.day];
                    const att = record.attendanceMap?.[d.day];
                    const cellKey = `${record.staffId}_${d.day}`;
                    const isOpen = activePopoverKey === cellKey;

                    let tagNode = <span className="text-slate-300 text-xs hover:text-blue-500 font-mono transition-colors select-none">-</span>;
                    if (cell?.code === 'X') {
                        tagNode = (
                            <Tag color="success" className="m-0 font-bold text-xs px-1.5 py-0.2 shadow-xs border-emerald-400 bg-emerald-100 text-emerald-800">
                                X
                            </Tag>
                        );
                    } else if (cell?.code === 'I') {
                        tagNode = (
                            <Tag color="warning" className="m-0 font-bold text-xs px-1.5 py-0.2 shadow-xs border-amber-400 bg-amber-100 text-amber-900">
                                I
                            </Tag>
                        );
                    }

                    if (!canEditCurrentDept) {
                        return (
                            <div className="py-1 flex items-center justify-center">
                                {tagNode}
                            </div>
                        );
                    }

                    const popoverContent = (
                        <div className="w-64 p-2 text-slate-800">
                            <div className="text-xs font-semibold text-slate-800 pb-1.5 mb-2 border-b border-slate-100">
                                <span className="text-blue-600 font-bold">{record.ho_ten}</span>
                                <span className="text-slate-400 mx-1">|</span>
                                <span>Ngày {d.day}/{selectedDate.format('MM/YYYY')}</span>
                            </div>

                            {att?.code && (
                                <div className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded mb-2 border border-slate-200">
                                    💡 Công hành chính ngày này: <strong className="text-blue-700 font-mono">{att.code}</strong>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActivePopoverKey(null);
                                        handleUpdateCell(record.staffId, d.day, 'X');
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 border transition-all ${
                                        cell?.code === 'X'
                                            ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold'
                                            : 'bg-white border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800'
                                    }`}
                                >
                                    <span className="font-mono font-black px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 border border-emerald-400">X</span>
                                    <div>
                                        <div className="font-semibold leading-tight">Làm từ 4h trở lên/ngày</div>
                                        <div className="text-[10px] text-slate-500">Hưởng 1.0 ngày bồi dưỡng</div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setActivePopoverKey(null);
                                        handleUpdateCell(record.staffId, d.day, 'I');
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center gap-2 border transition-all ${
                                        cell?.code === 'I'
                                            ? 'bg-amber-100 border-amber-400 text-amber-900 font-bold'
                                            : 'bg-white border-slate-200 hover:bg-amber-50 hover:border-amber-300 text-slate-800'
                                    }`}
                                >
                                    <span className="font-mono font-black px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-400">I</span>
                                    <div>
                                        <div className="font-semibold leading-tight">Làm dưới 4h/ngày</div>
                                        <div className="text-[10px] text-slate-500">Hưởng 0.5 ngày bồi dưỡng</div>
                                    </div>
                                </button>

                                {cell?.code && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActivePopoverKey(null);
                                            handleUpdateCell(record.staffId, d.day, '');
                                        }}
                                        className="w-full text-center py-1 mt-1 rounded text-[11px] text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all font-medium"
                                    >
                                        ✕ Xóa chấm độc hại ngày này
                                    </button>
                                )}
                            </div>
                        </div>
                    );

                    return (
                        <Popover
                            content={popoverContent}
                            trigger="click"
                            open={isOpen}
                            onOpenChange={(open) => setActivePopoverKey(open ? cellKey : null)}
                            placement="bottom"
                        >
                            <div className="py-1 flex items-center justify-center cursor-pointer hover:bg-blue-100/60 rounded transition-colors">
                                {tagNode}
                            </div>
                        </Popover>
                    );
                }
            });
        });

        // Các cột tổng hợp bên phải
        cols.push(
            {
                title: (
                    <div className="text-center">
                        <div className="text-[11px] font-bold text-slate-700">Mức 1</div>
                        <div className="text-[9px] text-slate-400">(13.000đ)</div>
                    </div>
                ),
                key: 'm1Days',
                width: 65,
                align: 'center',
                className: 'bg-slate-50/80',
                render: (_: any, r: HazardStaffItem) => r.summary.m1Days > 0 ? (
                    <span className="font-semibold text-slate-700">{r.summary.m1Days.toFixed(1)}</span>
                ) : <span className="text-slate-300">-</span>
            },
            {
                title: (
                    <div className="text-center">
                        <div className="text-[11px] font-bold text-slate-700">Mức 2</div>
                        <div className="text-[9px] text-slate-400">(20.000đ)</div>
                    </div>
                ),
                key: 'm2Days',
                width: 65,
                align: 'center',
                className: 'bg-emerald-50/60',
                render: (_: any, r: HazardStaffItem) => r.summary.m2Days > 0 ? (
                    <span className="font-bold text-emerald-800">{r.summary.m2Days.toFixed(1)}</span>
                ) : <span className="text-slate-300">-</span>
            },
            {
                title: (
                    <div className="text-center">
                        <div className="text-[11px] font-bold text-slate-700">Mức 3</div>
                        <div className="text-[9px] text-slate-400">(26.000đ)</div>
                    </div>
                ),
                key: 'm3Days',
                width: 65,
                align: 'center',
                className: 'bg-slate-50/80',
                render: (_: any, r: HazardStaffItem) => r.summary.m3Days > 0 ? (
                    <span className="font-semibold text-slate-700">{r.summary.m3Days.toFixed(1)}</span>
                ) : <span className="text-slate-300">-</span>
            },
            {
                title: (
                    <div className="text-center">
                        <div className="text-[11px] font-bold text-slate-700">Mức 4</div>
                        <div className="text-[9px] text-slate-400">(32.000đ)</div>
                    </div>
                ),
                key: 'm4Days',
                width: 65,
                align: 'center',
                className: 'bg-slate-50/80',
                render: (_: any, r: HazardStaffItem) => r.summary.m4Days > 0 ? (
                    <span className="font-semibold text-slate-700">{r.summary.m4Days.toFixed(1)}</span>
                ) : <span className="text-slate-300">-</span>
            },
            {
                title: (
                    <div className="text-center font-bold text-blue-900">
                        Tổng ngày
                    </div>
                ),
                key: 'totalDays',
                width: 75,
                align: 'center',
                className: 'bg-blue-50/90 font-bold',
                render: (_: any, r: HazardStaffItem) => (
                    <span className="font-black text-blue-800 text-xs">
                        {r.summary.totalDays.toFixed(1)}
                    </span>
                )
            },
            {
                title: (
                    <div className="text-center font-bold text-rose-900">
                        Tổng tiền (VNĐ)
                    </div>
                ),
                key: 'totalAmount',
                width: 110,
                align: 'right',
                className: 'bg-rose-50/80 font-bold pr-2',
                render: (_: any, r: HazardStaffItem) => (
                    <span className="font-black text-rose-700 text-xs">
                        {r.summary.totalAmount > 0 ? r.summary.totalAmount.toLocaleString('vi-VN') : '0'}
                    </span>
                )
            }
        );

        return cols;
    }, [daysInfo, selectedDate, activePopoverKey, canEditCurrentDept, syncLevel]);

    const grand = hazardData?.grandSummary;

    return (
        <div className="space-y-2">
            {/* Thanh công cụ & Thống kê đầu trang */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                    <div className="flex items-center gap-1.5 font-medium">
                        <SafetyCertificateOutlined className="text-emerald-600 text-base" />
                        <span>Khoa: <strong className="text-slate-900">{hazardData?.departmentName || selectedDept}</strong></span>
                    </div>
                    <div className="h-4 w-px bg-slate-200" />
                    <div>
                        Tổng cán bộ: <strong className="text-blue-700">{grand?.totalStaff ?? 0}</strong>
                    </div>
                    <div className="h-4 w-px bg-slate-200" />
                    <div>
                        Tổng ngày hưởng: <strong className="text-emerald-700 text-sm">{(grand?.totalDays ?? 0).toFixed(1)}</strong> ngày
                    </div>
                    {grand && grand.m2Days > 0 && (
                        <>
                            <div className="h-4 w-px bg-slate-200" />
                            <div>
                                Mức 2 (20k): <strong className="text-amber-800 font-bold">{grand.m2Days.toFixed(1)}</strong> ngày
                            </div>
                        </>
                    )}
                    <div className="h-4 w-px bg-slate-200" />
                    <div className="bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        Tổng tiền: <strong className="text-rose-700 text-sm">{(grand?.totalAmount ?? 0).toLocaleString('vi-VN')} đ</strong>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {canEditCurrentDept && (
                        <Button
                            type="primary"
                            icon={<ThunderboltOutlined />}
                            onClick={() => setSyncModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 font-medium text-xs"
                        >
                            Điền nhanh từ Bảng Chấm Công
                        </Button>
                    )}
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchHazardData}
                        loading={loading}
                        className="text-xs"
                    >
                        Tải lại
                    </Button>
                </div>
            </div>

            {/* Bảng chấm độc hại ma trận */}
            <Spin spinning={loading}>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
                    <Table
                        columns={columns}
                        dataSource={filteredStaffList}
                        rowKey="staffId"
                        pagination={false}
                        size="small"
                        bordered
                        scroll={{ x: 'max-content', y: 560 }}
                        className="attendance-matrix-table"
                        summary={() => {
                            if (!grand || staffList.length === 0) return null;
                            return (
                                <Table.Summary fixed>
                                    <Table.Summary.Row className="bg-slate-100 font-bold text-xs">
                                        <Table.Summary.Cell index={0} colSpan={2} className="text-center font-black">
                                            Tổng cộng toàn khoa:
                                        </Table.Summary.Cell>
                                        {daysInfo.map((d, idx) => (
                                            <Table.Summary.Cell key={d.day} index={idx + 2} className="text-center text-[10px] text-slate-400">
                                                -
                                            </Table.Summary.Cell>
                                        ))}
                                        <Table.Summary.Cell index={daysInfo.length + 2} className="text-center font-bold text-slate-700">
                                            {grand.m1Days > 0 ? grand.m1Days.toFixed(1) : '-'}
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={daysInfo.length + 3} className="text-center font-bold text-emerald-800">
                                            {grand.m2Days > 0 ? grand.m2Days.toFixed(1) : '-'}
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={daysInfo.length + 4} className="text-center font-bold text-slate-700">
                                            {grand.m3Days > 0 ? grand.m3Days.toFixed(1) : '-'}
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={daysInfo.length + 5} className="text-center font-bold text-slate-700">
                                            {grand.m4Days > 0 ? grand.m4Days.toFixed(1) : '-'}
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={daysInfo.length + 6} className="text-center font-black text-blue-900 bg-blue-100/70">
                                            {grand.totalDays.toFixed(1)}
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={daysInfo.length + 7} className="text-right font-black text-rose-800 bg-rose-100/70 pr-2">
                                            {grand.totalAmount.toLocaleString('vi-VN')}
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </Table.Summary>
                            );
                        }}
                    />
                </div>
            </Spin>

            {/* Chú giải ký hiệu */}
            <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                    <span className="font-semibold text-slate-800">Quy tắc ký hiệu chấm độc hại (Thông tư 24/2022/TT-BLĐTBXH):</span>
                    <span className="flex items-center gap-1">
                        <Tag color="success" className="m-0 font-bold text-xs px-1.5 py-0.2 shadow-xs border-emerald-400 bg-emerald-100 text-emerald-800">X</Tag>
                        <span>Làm việc từ 4h trở lên/ngày: <strong>1.0 ngày</strong></span>
                    </span>
                    <span className="flex items-center gap-1">
                        <Tag color="warning" className="m-0 font-bold text-xs px-1.5 py-0.2 shadow-xs border-amber-400 bg-amber-100 text-amber-900">I</Tag>
                        <span>Làm việc dưới 4h/ngày: <strong>0.5 ngày</strong></span>
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500">Ô trống (-): Không làm việc độc hại</span>
                </div>
                <div className="text-slate-500 italic text-[11px]">
                    * Mức bồi dưỡng mặc định khoa: 20.000 VNĐ/ngày (Mức 2)
                </div>
            </div>

            {/* Modal Điền nhanh từ Bảng Chấm Công */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-emerald-700">
                        <ThunderboltOutlined />
                        <span>Điền nhanh từ Bảng Chấm Công Hành Chính</span>
                    </div>
                }
                open={syncModalOpen}
                onCancel={() => setSyncModalOpen(false)}
                onOk={handleSyncAttendance}
                confirmLoading={syncing}
                okText="Bắt đầu đồng bộ"
                cancelText="Hủy"
                width={520}
            >
                <div className="py-2 space-y-4 text-xs text-slate-700">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 leading-relaxed">
                        Hệ thống sẽ rà soát Bảng Chấm Công tháng <strong>{selectedDate.format('MM/YYYY')}</strong> của khoa:
                        <ul className="list-disc ml-5 mt-1 space-y-0.5">
                            <li>Các ngày đi làm đủ cả ngày (ký hiệu <code>+</code>, <code>x</code>, <code>Nb</code>): Tự động điền <strong>X</strong> (1.0 ngày bồi dưỡng).</li>
                            <li>Các ngày làm việc nửa ngày (ký hiệu <code>+/2</code>, <code>x/2</code>, <code>P/2</code>): Tự động điền <strong>I</strong> (0.5 ngày bồi dưỡng).</li>
                        </ul>
                    </div>

                    <div>
                        <div className="font-semibold text-slate-800 mb-1.5">Chọn mức bồi dưỡng bằng hiện vật áp dụng:</div>
                        <Radio.Group value={syncLevel} onChange={(e) => setSyncLevel(e.target.value)} className="w-full">
                            <div className="flex flex-col gap-2 w-full mt-1">
                                <Radio value={1}>Mức 1: 13.000 VNĐ / ngày</Radio>
                                <Radio value={2}>Mức 2: 20.000 VNĐ / ngày (Phổ biến ngành Y tế - Khuyến nghị)</Radio>
                                <Radio value={3}>Mức 3: 26.000 VNĐ / ngày</Radio>
                                <Radio value={4}>Mức 4: 32.000 VNĐ / ngày (Môi trường đặc biệt nặng nhọc, nguy hiểm)</Radio>
                            </div>
                        </Radio.Group>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={syncOverwrite}
                                onChange={(e) => setSyncOverwrite(e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>Ghi đè lên các ngày đã chấm độc hại trước đó</span>
                        </label>
                    </div>
                </div>
            </Modal>
        </div>
    );
}


'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    DatePicker,
    Button,
    Tag,
    Badge,
    Spin,
    Alert,
    Tooltip,
    Table,
    Statistic,
    Row,
    Col,
    message,
    Popconfirm,
    Space
} from 'antd';
import {
    CalendarOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    ScheduleOutlined,
    ReloadOutlined,
    ArrowLeftOutlined,
    SwapOutlined,
    SafetyCertificateOutlined,
    ThunderboltOutlined,
    LoginOutlined,
    LogoutOutlined,
    ApartmentOutlined,
    SmileOutlined,
    WarningOutlined,
    EnvironmentOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function MyAttendancePage() {
    const { user } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());
    const [loading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<any>(null);

    // Trạng thái tự chấm công hôm nay
    const [checkInLoading, setCheckInLoading] = useState<boolean>(true);
    const [punching, setPunching] = useState<boolean>(false);
    const [checkInData, setCheckInData] = useState<any>(null);
    const [liveTime, setLiveTime] = useState<string>('');

    // Đồng hồ thời gian thực
    useEffect(() => {
        const updateClock = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
            setLiveTime(timeStr);
        };
        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    const monthYearStr = selectedMonth.format('YYYY-MM');

    const getBasePath = () => {
        if (typeof window !== 'undefined') {
            const parts = window.location.pathname.split('/staff');
            return parts.length > 1 ? parts[0] : '';
        }
        return '';
    };

    // Tải dữ liệu tổng kết tháng
    const fetchMyAttendance = useCallback(async () => {
        setLoading(true);
        try {
            const basePath = getBasePath();
            const res = await fetch(`${basePath}/api/staff/attendance/my-summary?monthYear=${monthYearStr}`);
            if (res.ok) {
                const resData = await res.json();
                setData(resData);
            } else {
                setData(null);
            }
        } catch (error) {
            console.error('Fetch my attendance error:', error);
        } finally {
            setLoading(false);
        }
    }, [monthYearStr]);

    // Tải trạng thái tự chấm công hôm nay
    const fetchCheckInStatus = useCallback(async () => {
        setCheckInLoading(true);
        try {
            const basePath = getBasePath();
            const res = await fetch(`${basePath}/api/staff/attendance/check-in`);
            if (res.ok) {
                const resData = await res.json();
                setCheckInData(resData);
            }
        } catch (err) {
            console.error('Lỗi tải trạng thái check-in:', err);
        } finally {
            setCheckInLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMyAttendance();
        fetchCheckInStatus();
    }, [fetchMyAttendance, fetchCheckInStatus]);

    // Thực hiện Vào ca hoặc Tan ca
    const handlePunch = async (action: 'CHECK_IN' | 'CHECK_OUT') => {
        try {
            setPunching(true);
            const basePath = getBasePath();
            const res = await fetch(`${basePath}/api/staff/attendance/check-in`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            const resData = await res.json();
            if (!res.ok) {
                message.error(resData.error || 'Thao tác chấm công thất bại');
                return;
            }

            if (resData.success) {
                message.success(resData.message || 'Chấm công thành công!');
                // Cập nhật lại cả trạng thái hôm nay và bảng tháng
                await Promise.all([fetchCheckInStatus(), fetchMyAttendance()]);
            } else {
                message.error(resData.error || 'Thao tác không thành công');
            }
        } catch (e) {
            console.error('Lỗi khi chấm công:', e);
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setPunching(false);
        }
    };

    const renderTag = (att: any) => {
        if (!att) return <span className="text-slate-300">-</span>;
        const code = (att.code || '').trim().toUpperCase();
        const sec = (att.secondaryCode || '').trim();

        if (code === 'X') return <Tag color="success" className="font-semibold">x (Đi làm 8h)</Tag>;
        if (code === 'NB') {
            if (sec) return <Tag color="warning" className="font-bold">Nb/{sec} (Nghỉ bù nửa ngày)</Tag>;
            return <Tag color="orange" className="font-bold">Nb (Nghỉ bù cả ngày)</Tag>;
        }
        if (code === 'P') return <Tag color="processing">P (Phép năm)</Tag>;
        if (code === 'L') return <Tag color="purple" className="font-bold">L (Nghỉ lễ)</Tag>;
        if (code === 'H') return <Tag color="cyan">H (Đi học)</Tag>;
        if (code === 'KL') return <Tag color="default">KL (Không lương)</Tag>;
        if (['Ô', 'O', 'TS'].includes(code)) return <Tag color="error">{code} (Nghỉ BHXH)</Tag>;
        return <Tag>{att.code}</Tag>;
    };

    const renderDutyTag = (duty: any) => {
        if (!duty) return <span className="text-slate-300">-</span>;
        const code = (duty.dutyCode || '').trim().toUpperCase();
        if (code === 'T') return <Tag color="blue" className="font-bold">Ca T (Trực ngày thường)</Tag>;
        if (code === 'C') return <Tag color="volcano" className="font-bold">Ca C (Trực T7/CN)</Tag>;
        if (code === 'L') return <Tag color="magenta" className="font-extrabold">Ca L (Trực Lễ - Bù 2 ngày)</Tag>;
        if (code === 'TE') return <Tag color="red" className="font-extrabold">Ca Te (Trực Tết - Bù 2 ngày)</Tag>;
        return <Tag>{code}</Tag>;
    };

    // Columns cho bảng quỹ ca trực chưa nghỉ bù
    const quotaColumns = [
        {
            title: 'Ngày trực',
            dataIndex: 'dutyDate',
            key: 'dutyDate',
            width: 120,
            render: (d: string) => <b className="text-slate-800">{d}</b>
        },
        {
            title: 'Loại phiên trực',
            dataIndex: 'dutyCode',
            key: 'dutyCode',
            width: 150,
            render: (code: string) => {
                if (code === 'T') return <Tag color="blue">Trực thường (T)</Tag>;
                if (code === 'C') return <Tag color="volcano">Trực T7/CN (C)</Tag>;
                if (code === 'L') return <Tag color="magenta" className="font-bold">Trực Lễ (L - Hạn mức 2 ngày)</Tag>;
                if (code === 'TE') return <Tag color="red" className="font-bold">Trực Tết (Te - Hạn mức 2 ngày)</Tag>;
                return <Tag>{code}</Tag>;
            }
        },
        {
            title: 'Hạn mức nghỉ bù',
            dataIndex: 'allowanceDays',
            key: 'allowanceDays',
            width: 120,
            align: 'center' as const,
            render: (val: number) => <span>{val} ngày</span>
        },
        {
            title: 'Đã nghỉ bù',
            dataIndex: 'usedDays',
            key: 'usedDays',
            width: 120,
            align: 'center' as const,
            render: (val: number) => <span className="text-amber-600 font-semibold">{val} ngày</span>
        },
        {
            title: 'Còn lại',
            dataIndex: 'remainingDays',
            key: 'remainingDays',
            width: 120,
            align: 'center' as const,
            render: (val: number) => (
                <Tag color={val > 0 ? 'green' : 'default'} className="font-bold">
                    {val} ngày
                </Tag>
            )
        }
    ];

    const dailyList = data?.daysInfo?.map((dayInfo: any) => {
        const att = data.attendanceRecords?.find((a: any) => a.workDate === dayInfo.dateStr);
        const duty = data.dutyRecords?.find((d: any) => d.dutyDate === dayInfo.dateStr);
        return {
            key: dayInfo.dateStr,
            day: dayInfo.day,
            dateStr: dayInfo.dateStr,
            dayOfWeek: dayInfo.dayOfWeek,
            isWeekend: dayInfo.isWeekend,
            attendance: att,
            duty: duty
        };
    }) || [];

    const dailyColumns = [
        {
            title: 'Ngày',
            dataIndex: 'day',
            key: 'day',
            width: 70,
            align: 'center' as const,
            render: (day: number, record: any) => {
                const isWeekend = record.dayOfWeek === 0 || record.dayOfWeek === 6;
                const dow = record.dayOfWeek === 0 ? 'CN' : `T${record.dayOfWeek + 1}`;
                return (
                    <div className={isWeekend ? 'text-red-500 font-bold' : ''}>
                        <div className="text-xs text-slate-500">{dow}</div>
                        <div className="font-semibold text-sm">{day}</div>
                    </div>
                );
            }
        },
        {
            title: 'Chấm Công Hàng Ngày',
            dataIndex: 'attendance',
            key: 'attendance',
            render: (att: any) => (
                <div className="flex items-center gap-2">
                    {renderTag(att)}
                    {att?.dutyRecord && (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Nghỉ bù cho ca trực: {att.dutyRecord.dutyDate}
                        </span>
                    )}
                </div>
            )
        },
        {
            title: 'Phân Công Trực Chuyên Môn',
            dataIndex: 'duty',
            key: 'duty',
            render: (duty: any) => renderDutyTag(duty)
        }
    ];

    // Xác định trạng thái nút bấm tự chấm công
    const todayLog = checkInData?.todayLog;
    const deptMode = checkInData?.departmentMode || 'HYBRID';
    const isBiometricOnly = deptMode === 'BIOMETRIC_ONLY';
    const isManualOnly = deptMode === 'MANUAL';
    const hasCheckedIn = Boolean(todayLog?.checkInTime);
    const hasCheckedOut = Boolean(todayLog?.checkOutTime);

    const checkInTimeDisplay = todayLog?.checkInTime 
        ? dayjs(todayLog.checkInTime).format('HH:mm:ss') 
        : null;
    const checkOutTimeDisplay = todayLog?.checkOutTime 
        ? dayjs(todayLog.checkOutTime).format('HH:mm:ss') 
        : null;

    return (
        <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Link href="/staff/attendance">
                            <Button icon={<ArrowLeftOutlined />} size="small">Quản Lý</Button>
                        </Link>
                        <ScheduleOutlined className="text-blue-600 text-2xl" />
                        <h1 className="text-xl md:text-2xl font-bold text-slate-800 m-0">
                            Lịch Công & Tự Chấm Công Của Tôi
                        </h1>
                    </div>
                    <div className="text-slate-500 text-xs md:text-sm mt-1 flex items-center gap-2">
                        <span>Cán bộ: <b className="text-slate-800">{data?.staff?.ho_ten || user?.name || user?.username}</b></span>
                        <span>•</span>
                        <span>{data?.staff?.chuc_vu || 'Cán bộ Y Tế'}</span>
                        <span>•</span>
                        <span>Khoa/Phòng: <b className="text-blue-700">{checkInData?.staff?.ten_khoa || 'Bệnh viện'}</b></span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <DatePicker
                        picker="month"
                        value={selectedMonth}
                        onChange={(val) => val && setSelectedMonth(val)}
                        format="MM/YYYY"
                        allowClear={false}
                        className="w-36 font-semibold"
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => { fetchMyAttendance(); fetchCheckInStatus(); }} loading={loading} />
                </div>
            </div>

            {/* THẺ TỰ CHẤM CÔNG HÔM NAY (WIDGET NỔI BẬT) */}
            <Card className="mb-4 border-indigo-200 shadow-sm bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl overflow-hidden">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-6 py-2">
                    {/* Cột trái: Đồng hồ thời gian thực & Thông tin khoa */}
                    <div className="space-y-2 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-medium">
                            <CalendarOutlined />
                            <span>Hôm nay: {dayjs().format('dddd, [ngày] DD/MM/YYYY')}</span>
                        </div>

                        <div className="flex items-baseline justify-center lg:justify-start gap-2">
                            <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white drop-shadow">
                                {liveTime || '--:--:--'}
                            </span>
                            <span className="text-xs text-indigo-300 font-semibold">Giờ Việt Nam</span>
                        </div>

                        <div className="flex items-center justify-center lg:justify-start gap-2 flex-wrap text-xs text-indigo-200/90">
                            <span className="flex items-center gap-1">
                                <ApartmentOutlined /> {checkInData?.staff?.ten_khoa || 'Khoa phòng'}
                            </span>
                            <span>•</span>
                            <span>Hình thức:</span>
                            {deptMode === 'HYBRID' && (
                                <Tag color="success" className="font-semibold m-0">⚡ Cả Web & Vân tay ZK</Tag>
                            )}
                            {deptMode === 'WEB_ONLY' && (
                                <Tag color="processing" className="font-semibold m-0">🌐 Tự chấm qua Web</Tag>
                            )}
                            {deptMode === 'BIOMETRIC_ONLY' && (
                                <Tag color="purple" className="font-semibold m-0">👆 Chỉ Máy vân tay ZK</Tag>
                            )}
                            {deptMode === 'MANUAL' && (
                                <Tag color="default" className="m-0">📝 Chấm tay quản lý</Tag>
                            )}
                        </div>
                    </div>

                    {/* Cột phải: Khu vực Nút bấm hoặc Thông báo trạng thái */}
                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15 w-full lg:w-auto min-w-[340px]">
                        {checkInLoading ? (
                            <div className="flex justify-center py-4">
                                <Spin />
                            </div>
                        ) : isBiometricOnly ? (
                            /* Khoa chỉ dùng ZKTeco */
                            <div className="text-center space-y-2">
                                <div className="text-purple-300 text-sm font-semibold flex items-center justify-center gap-1.5">
                                    <ApartmentOutlined /> Máy Chấm Công Vân Tay ZKTeco
                                </div>
                                <p className="text-xs text-slate-300 max-w-xs mx-auto">
                                    Khoa/Phòng của bạn quy định chấm công trực tiếp tại <b>Máy ZKTeco</b> đặt tại khoa {checkInData?.zkDeviceId ? `(Mã máy: ${checkInData.zkDeviceId})` : ''}.
                                </p>
                                <Tag color="purple" className="text-xs py-0.5 px-3">
                                    Vui lòng dập vân tay tại máy
                                </Tag>
                            </div>
                        ) : isManualOnly ? (
                            /* Khoa chỉ chấm tay */
                            <div className="text-center space-y-1">
                                <div className="text-slate-300 font-semibold text-sm">Chấm Công Thủ Công</div>
                                <p className="text-xs text-slate-400">
                                    Điều dưỡng trưởng hoặc Trưởng khoa sẽ chấm công trực tiếp trên Bảng Chấm Công toàn khoa.
                                </p>
                            </div>
                        ) : (
                            /* Khoa dùng Web hoặc Cả hai: Hiện nút Vào ca / Tan ca */
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-4 text-xs">
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Giờ Vào Ca:</span>
                                        {checkInTimeDisplay ? (
                                            <span className="font-bold text-emerald-400 font-mono text-sm">
                                                🟢 {checkInTimeDisplay}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 italic">Chưa vào ca</span>
                                        )}
                                    </div>

                                    <div className="text-right">
                                        <span className="text-slate-400 block text-[11px]">Giờ Tan Ca:</span>
                                        {checkOutTimeDisplay ? (
                                            <span className="font-bold text-rose-400 font-mono text-sm">
                                                🔴 {checkOutTimeDisplay}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 italic">Chưa bấm tan</span>
                                        )}
                                    </div>
                                </div>

                                {/* Trạng thái chi tiết (Đúng giờ / Đi muộn / Tổng giờ) */}
                                {todayLog && (
                                    <div className="bg-black/25 px-2.5 py-1.5 rounded-lg flex items-center justify-between text-[11px]">
                                        <span className="text-slate-300">Tình trạng:</span>
                                        {todayLog.status === 'ON_TIME' && (
                                            <Tag color="success" className="font-bold m-0 text-[10px]">Đúng giờ</Tag>
                                        )}
                                        {todayLog.status === 'LATE' && (
                                            <Tag color="error" className="font-bold m-0 text-[10px]">
                                                Đi muộn {todayLog.lateMinutes}p
                                            </Tag>
                                        )}
                                        {todayLog.status === 'EARLY_LEAVE' && (
                                            <Tag color="warning" className="font-bold m-0 text-[10px]">
                                                Về sớm {todayLog.earlyMinutes}p
                                            </Tag>
                                        )}
                                        {todayLog.workHours > 0 && (
                                            <span className="text-indigo-200 font-semibold">
                                                {todayLog.workHours} giờ làm
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Nút bấm Vào ca hoặc Tan ca */}
                                <div className="flex gap-2">
                                    {!hasCheckedIn ? (
                                        <Popconfirm
                                            title="Xác nhận Bấm Vào Ca"
                                            description={`Ghi nhận bắt đầu làm việc vào lúc ${liveTime}?`}
                                            okText="Vào ca ngay"
                                            cancelText="Hủy"
                                            onConfirm={() => handlePunch('CHECK_IN')}
                                        >
                                            <Button
                                                type="primary"
                                                size="large"
                                                icon={<LoginOutlined />}
                                                loading={punching}
                                                className="w-full bg-emerald-500 hover:bg-emerald-400 border-none font-bold shadow-lg shadow-emerald-500/30 h-11"
                                            >
                                                🟢 Bấm Vào Ca (Check-in)
                                            </Button>
                                        </Popconfirm>
                                    ) : !hasCheckedOut ? (
                                        <Popconfirm
                                            title="Xác nhận Bấm Tan Ca"
                                            description={`Ghi nhận kết thúc ca làm việc vào lúc ${liveTime}?`}
                                            okText="Tan ca ngay"
                                            cancelText="Hủy"
                                            onConfirm={() => handlePunch('CHECK_OUT')}
                                        >
                                            <Button
                                                type="primary"
                                                size="large"
                                                danger
                                                icon={<LogoutOutlined />}
                                                loading={punching}
                                                className="w-full bg-rose-600 hover:bg-rose-500 border-none font-bold shadow-lg shadow-rose-600/30 h-11"
                                            >
                                                🔴 Bấm Tan Ca (Check-out)
                                            </Button>
                                        </Popconfirm>
                                    ) : (
                                        <div className="w-full text-center py-1.5 px-3 bg-emerald-500/20 rounded-lg border border-emerald-400/30 text-emerald-300 font-semibold text-xs flex items-center justify-center gap-1.5">
                                            <CheckCircleOutlined /> Đã hoàn thành chấm công ngày hôm nay!
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>

            {loading ? (
                <div className="flex justify-center items-center py-24">
                    <Spin size="large" />
                </div>
            ) : !data ? (
                <Alert
                    type="warning"
                    title="Không tìm thấy dữ liệu cá nhân"
                    description="Tài khoản này chưa được liên kết với mã nhân viên trong hệ thống (staffId). Vui lòng liên hệ Trưởng phòng hoặc Quản trị viên."
                    showIcon
                />
            ) : (
                <>
                    {/* Thẻ Thống kê KPI Cá nhân */}
                    <Row gutter={[16, 16]} className="mb-4">
                        <Col xs={12} sm={6}>
                            <Card className="shadow-sm border-slate-200 bg-emerald-50/50">
                                <Statistic
                                    title={<span className="text-xs text-slate-600 font-medium">Công Hưởng Lương</span>}
                                    value={data.kpiSummary?.luongThoiGian || 0}
                                    suffix="ngày"
                                    valueStyle={{ color: '#047857', fontWeight: 'bold' }}
                                    prefix={<CheckCircleOutlined />}
                                />
                                <div className="text-[11px] text-slate-500 mt-1">Đã tính ngày làm + nghỉ bù</div>
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card className="shadow-sm border-slate-200 bg-blue-50/50">
                                <Statistic
                                    title={<span className="text-xs text-slate-600 font-medium">Số Phiên Trực Tháng</span>}
                                    value={data.kpiSummary?.tongCaTruc || 0}
                                    suffix="phiên"
                                    valueStyle={{ color: '#1d4ed8', fontWeight: 'bold' }}
                                    prefix={<ClockCircleOutlined />}
                                />
                                <div className="text-[11px] text-slate-500 mt-1">
                                    Thường: {data.kpiSummary?.dutyNgayThuong || 0} | T7/CN: {data.kpiSummary?.dutyT7CN || 0} | Lễ: {data.kpiSummary?.dutyLeTet || 0}
                                </div>
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card className="shadow-sm border-slate-200 bg-amber-50/50">
                                <Statistic
                                    title={<span className="text-xs text-slate-600 font-medium">Đã Nghỉ Bù</span>}
                                    value={data.kpiSummary?.soNgayNghiBu || 0}
                                    suffix="ngày"
                                    valueStyle={{ color: '#b45309', fontWeight: 'bold' }}
                                    prefix={<SwapOutlined />}
                                />
                                <div className="text-[11px] text-slate-500 mt-1">Số ngày đã thực tế nghỉ bù</div>
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card className="shadow-sm border-slate-200 bg-rose-50/50">
                                <Statistic
                                    title={<span className="text-xs text-slate-600 font-medium">Quỹ Nghỉ Bù Còn Dư</span>}
                                    value={data.kpiSummary?.tongQuayNghiBuConLai || 0}
                                    suffix="ngày"
                                    valueStyle={{ color: '#be123c', fontWeight: 'bold' }}
                                    prefix={<SafetyCertificateOutlined />}
                                />
                                <div className="text-[11px] text-slate-500 mt-1">Có thể xin nghỉ bù vào các ngày tới</div>
                            </Card>
                        </Col>
                    </Row>

                    {/* Quỹ ngày trực còn dư có thể xin nghỉ bù */}
                    {data.activeDutiesQuota && data.activeDutiesQuota.length > 0 && (
                        <Card
                            title={
                                <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                                    <SafetyCertificateOutlined /> Danh Sách Các Ca Trực Chưa Nghỉ Bù Của Bạn
                                </div>
                            }
                            className="shadow-sm border-slate-200 mb-4"
                        >
                            <Table
                                columns={quotaColumns}
                                dataSource={data.activeDutiesQuota}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                bordered
                            />
                        </Card>
                    )}

                    {/* Bảng Chi Tiết Ngày Trong Tháng */}
                    <Card
                        title={
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-sm">
                                    Chi Tiết Lịch Công & Trực Từng Ngày - Tháng {selectedMonth.format('MM/YYYY')}
                                </span>
                                <div className="flex items-center gap-2 text-xs font-normal">
                                    <span className="text-slate-500">Trạng thái nhận việc hôm nay:</span>
                                    {data.staff?.isAvailable ? (
                                        <Tag color="success" className="font-semibold">
                                            <ThunderboltOutlined /> Sẵn sàng nhận việc
                                        </Tag>
                                    ) : (
                                        <Tag color="default">Tắt nhận việc</Tag>
                                    )}
                                </div>
                            </div>
                        }
                        className="shadow-sm border-slate-200"
                    >
                        <Table
                            columns={dailyColumns}
                            dataSource={dailyList}
                            rowKey="key"
                            pagination={false}
                            size="middle"
                            bordered
                        />
                    </Card>
                </>
            )}
        </div>
    );
}

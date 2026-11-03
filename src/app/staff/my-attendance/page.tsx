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
    Col
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
    ThunderboltOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function MyAttendancePage() {
    const { user } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState<dayjs.Dayjs>(dayjs());
    const [loading, setLoading] = useState<boolean>(true);
    const [data, setData] = useState<any>(null);

    const monthYearStr = selectedMonth.format('YYYY-MM');

    const fetchMyAttendance = useCallback(async () => {
        setLoading(true);
        try {
            const basePath = window.location.pathname.split('/staff')[0];
            const res = await fetch(`${basePath}/api/staff/attendance/my-summary?monthYear=${monthYearStr}`);
            if (res.ok) {
                const resData = await res.json();
                setData(resData);
            } else {
                const err = await res.json().catch(() => ({}));
                setData(null);
            }
        } catch (error) {
            console.error('Fetch my attendance error:', error);
        } finally {
            setLoading(false);
        }
    }, [monthYearStr]);

    useEffect(() => {
        fetchMyAttendance();
    }, [fetchMyAttendance]);

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
            dataIndex: 'compensatedDays',
            key: 'compensatedDays',
            width: 120,
            align: 'center' as const,
            render: (val: number) => <Tag color="green">{val} ngày</Tag>
        },
        {
            title: 'Quỹ ngày còn lại có thể nghỉ',
            dataIndex: 'remainingDays',
            key: 'remainingDays',
            width: 160,
            align: 'center' as const,
            render: (val: number) => <Tag color="error" className="font-bold text-sm">Còn {val} ngày</Tag>
        }
    ];

    // Chuyển dailyMap thành danh sách
    const dailyList = data?.dailyMap
        ? Object.values(data.dailyMap).map((d: any) => ({
            ...d,
            key: d.day
        }))
        : [];

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
                            Lịch Công & Trực Của Tôi
                        </h1>
                    </div>
                    <div className="text-slate-500 text-xs md:text-sm mt-1 flex items-center gap-2">
                        <span>Cán bộ: <b className="text-slate-800">{data?.staff?.ho_ten || user?.name || user?.username}</b></span>
                        <span>•</span>
                        <span>{data?.staff?.chuc_vu || 'Phòng Công nghệ thông tin'}</span>
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
                    <Button icon={<ReloadOutlined />} onClick={fetchMyAttendance} loading={loading} />
                </div>
            </div>

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

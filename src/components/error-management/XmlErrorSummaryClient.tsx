'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Table, Button, message, Card, Select, DatePicker, 
    Segmented, Modal, Input, Tooltip, Tag, Space, Typography, Row, Col, Statistic 
} from 'antd';
const { RangePicker } = DatePicker;
import { useAuth } from '@/contexts/AuthContext';
import { getBasePath } from '@/utils/config';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { 
    FileExcelOutlined, ArrowLeftOutlined, ShareAltOutlined, 
    LinkOutlined, CopyOutlined, MessageOutlined, 
    ExportOutlined, ReloadOutlined, FilterOutlined 
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function XmlErrorSummaryClient() {
    const { user } = useAuth();
    const router = useRouter();

    const [errors, setErrors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState<Record<string, string>>({});

    // BỘ LỌC (FILTERS)
    const [statusFilter, setStatusFilter] = useState<string>('PENDING'); // PENDING, EXPLAINED, SENT_IT, ALL
    const [dateFilter, setDateFilter] = useState<string>('ALL'); // TODAY, YESTERDAY, 7DAYS, ALL, CUSTOM
    const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [deptFilter, setDeptFilter] = useState<string>('ALL');
    const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('ALL'); // ALL, XML, CHUYEN_DE

    // MODAL SHARE ZALO TỔNG HỢP
    const [isZaloModalVisible, setIsZaloModalVisible] = useState(false);
    const [customZaloMessage, setCustomZaloMessage] = useState<string>('');
    const [isCustomEdited, setIsCustomEdited] = useState(false);

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const res = await fetch(`${getBasePath()}/api/departments`);
                if (res.ok) {
                    const data = await res.json();
                    const map: Record<string, string> = {};
                    data.forEach((d: any) => map[d.ma_khoa] = d.ten_khoa);
                    setDepartments(map);
                }
            } catch (e) {
                console.error("Error fetching departments", e);
            }
        };
        fetchDepts();
    }, []);

    const fetchErrors = async () => {
        setLoading(true);
        try {
            // Lấy toàn bộ XML và CHUYEN_DE
            const res = await fetch(`${getBasePath()}/api/error-management/xml-errors`);
            if (res.ok) {
                let data = await res.json();
                setErrors(data);

                // Nếu có lỗi trong hôm nay, tự động chuyển bộ lọc ngày sang TODAY
                const hasToday = data.some((e: any) => dayjs(e.createdAt).isSame(dayjs(), 'day'));
                if (hasToday) {
                    setDateFilter('TODAY');
                }
            } else {
                message.error('Lỗi khi tải dữ liệu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchErrors();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Kiểm tra bản ghi đã gửi CNTT chưa
    const isRecordSentToIT = (record: any) => {
        return Boolean(record.itRequestId) || Boolean(record.departmentNote?.includes('[Đã gửi Yêu cầu IT]'));
    };

    // 1. Lọc danh sách lỗi theo toàn bộ các tiêu chí
    const filteredErrors = useMemo(() => {
        return errors.filter(e => {
            // Lọc Trạng thái
            if (statusFilter === 'PENDING') {
                if (e.status !== 'PENDING') return false;
            } else if (statusFilter === 'EXPLAINED') {
                if (e.status === 'PENDING') return false;
            } else if (statusFilter === 'SENT_IT') {
                if (!isRecordSentToIT(e)) return false;
            }

            // Lọc Ngày
            if (dateFilter === 'TODAY') {
                if (!dayjs(e.createdAt).isSame(dayjs(), 'day')) return false;
            } else if (dateFilter === 'YESTERDAY') {
                if (!dayjs(e.createdAt).isSame(dayjs().subtract(1, 'day'), 'day')) return false;
            } else if (dateFilter === '7DAYS') {
                if (dayjs(e.createdAt).isBefore(dayjs().subtract(7, 'day').startOf('day'))) return false;
            } else if (dateFilter === 'CUSTOM' && customDateRange && customDateRange[0] && customDateRange[1]) {
                const start = customDateRange[0].startOf('day');
                const end = customDateRange[1].endOf('day');
                const d = dayjs(e.createdAt);
                if (d.isBefore(start) || d.isAfter(end)) return false;
            }

            // Lọc Khoa phòng
            if (deptFilter !== 'ALL' && e.ma_khoa !== deptFilter) return false;

            // Lọc Nguồn lỗi
            if (sourceTypeFilter !== 'ALL' && e.sourceType !== sourceTypeFilter) return false;

            return true;
        });
    }, [errors, statusFilter, dateFilter, customDateRange, deptFilter, sourceTypeFilter]);

    // Thống kê nhanh theo trạng thái trên toàn bộ dữ liệu (trước khi lọc status)
    const overallStats = useMemo(() => {
        let total = 0;
        let pending = 0;
        let explained = 0;
        let sentIT = 0;

        errors.forEach(e => {
            total++;
            if (e.status === 'PENDING') pending++;
            else explained++;
            if (isRecordSentToIT(e)) sentIT++;
        });

        return { total, pending, explained, sentIT };
    }, [errors]);

    // 2. Gom nhóm dữ liệu đã lọc theo Khoa & Loại lỗi
    const summaryData = useMemo(() => {
        const groups: Record<string, any> = {};

        filteredErrors.forEach(e => {
            let danhSach = 'Lỗi hồ sơ XML';
            let detailParam = '';
            
            if (e.sourceType === 'CHUYEN_DE') {
                const match = e.chi_tiet_loi?.match(/\[.*?\]\s*(.*?)\s*-/);
                if (match) {
                    detailParam = match[1].trim();
                    danhSach = `Lỗi chuyên đề ${detailParam.toLowerCase()}`;
                } else {
                    detailParam = 'CHUYEN_DE';
                    danhSach = 'Lỗi chuyên đề khác';
                }
            }

            const khoa = e.ma_khoa || 'KHONG_XAC_DINH';
            const key = `${khoa}_${danhSach}`;

            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    danhSach: danhSach,
                    detailParam: detailParam,
                    sourceType: e.sourceType || 'XML',
                    ma_khoa: khoa,
                    ten_khoa: e.ten_khoa || departments[khoa] || '',
                    count: 0,
                    latestDate: e.createdAt
                };
            }

            groups[key].count += 1;
            if (dayjs(e.createdAt).isAfter(dayjs(groups[key].latestDate))) {
                groups[key].latestDate = e.createdAt;
            }
        });

        return Object.values(groups).sort((a, b) => {
            if (a.ma_khoa !== b.ma_khoa) return a.ma_khoa.localeCompare(b.ma_khoa);
            return b.count - a.count;
        }).map((item, idx) => ({ ...item, stt: idx + 1 }));
    }, [filteredErrors, departments]);

    // Đường dẫn nội bộ cho Next.js <Link> (Next.js tự động gắn basePath)
    const getInternalErrorPath = (record: { ma_khoa: string; sourceType?: string; detailParam?: string }) => {
        const query = new URLSearchParams();
        
        if (record.ma_khoa && record.ma_khoa !== 'KHONG_XAC_DINH') {
            query.set('ma_khoa', record.ma_khoa);
        }
        if (record.sourceType) {
            query.set('sourceType', record.sourceType);
        }
        if (record.detailParam) {
            query.set('detail', record.detailParam);
        }
        if (statusFilter !== 'ALL') {
            query.set('status', statusFilter);
        }

        return `/error-management/xml-errors?${query.toString()}`;
    };

    // Tạo link trực tiếp đầy đủ tới danh sách lỗi cho từng khoa phòng (để sao chép gửi ra ngoài Zalo)
    const getDepartmentErrorUrl = (record: { ma_khoa: string; sourceType?: string; detailParam?: string }) => {
        if (typeof window === 'undefined') return '';
        const origin = window.location.origin;
        return `${origin}${getBasePath()}${getInternalErrorPath(record)}`;
    };

    // Sao chép Link cho từng dòng
    const handleCopySingleLink = (record: any) => {
        const url = getDepartmentErrorUrl(record);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url)
                .then(() => message.success(`Đã sao chép liên kết lỗi cho ${record.ten_khoa || record.ma_khoa}!`))
                .catch(() => message.error('Không thể sao chép liên kết'));
        }
    };

    // Sao chép tin Zalo cho riêng từng dòng / từng khoa phòng (Mẫu B)
    const handleCopySingleZalo = (record: any) => {
        const url = getDepartmentErrorUrl(record);
        let statusText = '🔴 Đang chờ xử lý';
        if (statusFilter === 'EXPLAINED') statusText = '✅ Đã khắc phục / Đã xử lý';
        else if (statusFilter === 'SENT_IT') statusText = '📩 Đã gửi CNTT';
        else if (statusFilter === 'ALL') statusText = '📋 Tất cả trạng thái';

        let dateText = 'Hôm nay';
        if (dateFilter === 'YESTERDAY') dateText = 'Hôm qua';
        else if (dateFilter === '7DAYS') dateText = '7 ngày qua';
        else if (dateFilter === 'CUSTOM' && customDateRange) {
            dateText = `${customDateRange[0].format('DD/MM/YYYY')} - ${customDateRange[1].format('DD/MM/YYYY')}`;
        } else if (dateFilter === 'ALL') dateText = 'Toàn bộ';

        const lines = [
            `🏥 [BVĐK TỈNH LẠNG SƠN] - THÔNG BÁO LỖI HỒ SƠ`,
            `🏥 Đơn vị: ${record.ten_khoa || record.ma_khoa} (Mã: ${record.ma_khoa})`,
            `📌 Nhóm lỗi: ${record.danhSach}`,
            `🚦 Trạng thái: ${statusText}`,
            `📊 Số lượng: ${record.count} hồ sơ`,
            `🕒 Thời gian cập nhật: ${dayjs(record.latestDate).format('DD/MM/YYYY HH:mm')} (${dateText})`,
            `----------------------------------------`,
            `👉 Bấm vào liên kết sau để mở danh sách chi tiết các bệnh nhân bị lỗi:`,
            `🔗 ${url}`,
            `----------------------------------------`,
            `⚠️ Đề nghị khoa khẩn trương kiểm tra và điều chỉnh kịp thời.`
        ];

        if (navigator.clipboard) {
            navigator.clipboard.writeText(lines.join('\n'))
                .then(() => message.success(`Đã sao chép tin nhắn Zalo cho ${record.ten_khoa || record.ma_khoa}!`))
                .catch(() => message.error('Không thể sao chép tin nhắn'));
        }
    };

    // Tạo nội dung tin nhắn Zalo tổng hợp toàn viện (Mẫu A)
    const generateZaloSummaryText = () => {
        if (typeof window === 'undefined') return '';
        const origin = window.location.origin;

        let dateDesc = `Hôm nay (${dayjs().format('DD/MM/YYYY')})`;
        if (dateFilter === 'YESTERDAY') {
            dateDesc = `Hôm qua (${dayjs().subtract(1, 'day').format('DD/MM/YYYY')})`;
        } else if (dateFilter === '7DAYS') {
            dateDesc = `7 ngày qua (${dayjs().subtract(7, 'day').format('DD/MM')} - ${dayjs().format('DD/MM/YYYY')})`;
        } else if (dateFilter === 'CUSTOM' && customDateRange) {
            dateDesc = `Từ ${customDateRange[0].format('DD/MM/YYYY')} đến ${customDateRange[1].format('DD/MM/YYYY')}`;
        } else if (dateFilter === 'ALL') {
            dateDesc = `Toàn bộ thời gian (Tất cả)`;
        }

        let statusDesc = '🔴 Đang chờ xử lý';
        if (statusFilter === 'EXPLAINED') statusDesc = '✅ Đã khắc phục / Đã xử lý';
        else if (statusFilter === 'SENT_IT') statusDesc = '📩 Đã gửi CNTT';
        else if (statusFilter === 'ALL') statusDesc = '📋 Tất cả trạng thái';

        // Gom nhóm theo khoa
        const deptMap: Record<string, { ma_khoa: string; ten_khoa: string; total: number; breakdown: Record<string, number> }> = {};

        summaryData.forEach(item => {
            const k = item.ma_khoa || 'KHONG_XAC_DINH';
            if (!deptMap[k]) {
                deptMap[k] = {
                    ma_khoa: k,
                    ten_khoa: item.ten_khoa || departments[k] || k,
                    total: 0,
                    breakdown: {}
                };
            }
            deptMap[k].total += item.count;
            deptMap[k].breakdown[item.danhSach] = (deptMap[k].breakdown[item.danhSach] || 0) + item.count;
        });

        const sortedDepts = Object.values(deptMap).sort((a, b) => b.total - a.total);
        const totalErrors = sortedDepts.reduce((sum, d) => sum + d.total, 0);

        const lines: string[] = [
            `🏥 [BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN]`,
            `📢 THÔNG BÁO TỔNG HỢP LỖI HỒ SƠ BỆNH ÁN & DỮ LIỆU XML`,
            `🗓️ Thời gian: ${dateDesc}`,
            `🚦 Trạng thái: ${statusDesc}`,
            `📊 Tổng cộng: ${totalErrors} hồ sơ / ${sortedDepts.length} khoa phòng`,
            `--------------------------------------------------`
        ];

        if (sortedDepts.length === 0) {
            lines.push(
                ``,
                `🎉 Tuyệt vời! Hiện tại không có hồ sơ nào bị lỗi theo điều kiện lọc đã chọn.`,
                ``
            );
        } else {
            lines.push(``);
            sortedDepts.forEach((dept, idx) => {
                const breakdownParts = Object.entries(dept.breakdown).map(([name, c]) => `${c} ${name}`);
                const breakdownStr = breakdownParts.length > 0 ? ` (${breakdownParts.join(', ')})` : '';

                const linkParams = new URLSearchParams();
                if (dept.ma_khoa && dept.ma_khoa !== 'KHONG_XAC_DINH') {
                    linkParams.set('ma_khoa', dept.ma_khoa);
                }
                if (sourceTypeFilter !== 'ALL') {
                    linkParams.set('sourceType', sourceTypeFilter);
                }
                if (statusFilter !== 'ALL') {
                    linkParams.set('status', statusFilter);
                }
                const deptUrl = `${origin}${getBasePath()}/error-management/xml-errors?${linkParams.toString()}`;

                lines.push(
                    `${idx + 1}. 🏥 ${dept.ten_khoa} (Mã: ${dept.ma_khoa})`,
                    `   ⚠️ ${dept.total} hồ sơ${breakdownStr}`,
                    `   👉 Link xử lý: ${deptUrl}`,
                    ``
                );
            });
        }

        lines.push(
            `--------------------------------------------------`,
            `🔗 Link bảng tổng hợp toàn viện:`,
            `${origin}${getBasePath()}/error-management/xml-summary`,
            ``,
            `📌 Đề nghị các đồng chí Trưởng khoa, Điều dưỡng trưởng và Bác sĩ các khoa phòng khẩn trương nhấp vào link của khoa mình để rà soát và hoàn thiện hồ sơ trên hệ thống trước 16h30 hôm nay. Trân trọng cảm ơn!`
        );

        return lines.join('\n');
    };

    // Khi mở Modal Zalo, cập nhật nội dung tin nhắn tự động
    const handleOpenZaloModal = () => {
        setCustomZaloMessage(generateZaloSummaryText());
        setIsCustomEdited(false);
        setIsZaloModalVisible(true);
    };

    // Cập nhật lại tin nhắn khi người dùng đổi filter trong Modal mà chưa tự gõ tay
    useEffect(() => {
        if (isZaloModalVisible && !isCustomEdited) {
            setCustomZaloMessage(generateZaloSummaryText());
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, dateFilter, customDateRange, deptFilter, sourceTypeFilter, summaryData, isZaloModalVisible]);

    // Sao chép nội dung tin Zalo tổng hợp
    const handleCopyZaloSummary = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(customZaloMessage)
                .then(() => message.success('Đã sao chép tin nhắn Zalo tổng hợp vào bộ nhớ tạm!'))
                .catch(() => message.error('Không thể sao chép tin nhắn'));
        }
    };

    // Xuất Excel
    const handleExportExcel = async () => {
        if (summaryData.length === 0) {
            message.warning("Không có dữ liệu để xuất");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Tổng hợp Lỗi');
        
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 5 },
            { header: 'Danh sách', key: 'danhSach', width: 40 },
            { header: 'Mã khoa', key: 'ma_khoa', width: 15 },
            { header: 'Khoa phòng', key: 'ten_khoa', width: 30 },
            { header: 'Số lượng', key: 'count', width: 10 },
            { header: 'Ngày Lưu Gần Nhất', key: 'latestDate', width: 22 }
        ];
        
        worksheet.getRow(1).font = { bold: true };

        summaryData.forEach((row) => {
            worksheet.addRow({
                stt: row.stt,
                danhSach: row.danhSach,
                ma_khoa: row.ma_khoa,
                ten_khoa: row.ten_khoa,
                count: row.count,
                latestDate: dayjs(row.latestDate).format('DD/MM/YYYY HH:mm')
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Bao_Cao_Tong_Hop_Loi_${statusFilter}_${dayjs().format('YYYYMMDD')}.xlsx`);
    };

    const columns = [
        {
            title: 'STT',
            dataIndex: 'stt',
            width: 55,
            align: 'center' as const
        },
        {
            title: 'Danh sách lỗi',
            dataIndex: 'danhSach',
            width: 260,
            render: (text: string, record: any) => (
                <div className="space-y-1">
                    <span className="font-semibold text-slate-800">{text}</span>
                    {record.sourceType === 'CHUYEN_DE' ? (
                        <div><Tag color="purple" className="text-[11px] m-0">⏱️ Chuyên đề</Tag></div>
                    ) : (
                        <div><Tag color="blue" className="text-[11px] m-0">📄 XML</Tag></div>
                    )}
                </div>
            )
        },
        {
            title: 'Mã khoa',
            dataIndex: 'ma_khoa',
            width: 95,
            render: (text: string) => <span className="text-slate-600 font-mono font-medium">{text}</span>
        },
        {
            title: 'Khoa phòng',
            dataIndex: 'ten_khoa',
            width: 220,
            render: (text: string, record: any) => (
                <span className="font-medium text-slate-800">
                    🏥 {text || record.ma_khoa}
                </span>
            )
        },
        {
            title: 'Số lượng',
            dataIndex: 'count',
            width: 100,
            align: 'center' as const,
            render: (count: number, record: any) => {
                const internalPath = getInternalErrorPath(record);
                return (
                    <Tooltip title="Bấm để mở danh sách chi tiết các hồ sơ lỗi">
                        <Link 
                            href={internalPath} 
                            className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white font-bold text-sm transition-all border border-blue-200"
                        >
                            {count}
                        </Link>
                    </Tooltip>
                );
            }
        },
        {
            title: 'Ngày lưu gần nhất',
            dataIndex: 'latestDate',
            width: 160,
            render: (date: string) => (
                <span className="text-xs text-slate-600">
                    {dayjs(date).format('DD/MM/YYYY HH:mm')}
                </span>
            )
        },
        {
            title: 'Thao tác chia sẻ',
            key: 'actions',
            width: 160,
            align: 'center' as const,
            render: (_: any, record: any) => (
                <div className="flex items-center justify-center gap-1.5">
                    <Tooltip title="Sao chép liên kết trực tiếp tới danh sách lỗi của khoa này">
                        <Button
                            size="small"
                            icon={<LinkOutlined className="text-xs text-blue-600" />}
                            onClick={() => handleCopySingleLink(record)}
                            className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 text-xs font-medium rounded-lg h-7 px-2"
                        >
                            Link
                        </Button>
                    </Tooltip>

                    <Tooltip title="Sao chép tin nhắn Zalo riêng cho khoa này">
                        <Button
                            size="small"
                            icon={<ShareAltOutlined className="text-xs text-emerald-600" />}
                            onClick={() => handleCopySingleZalo(record)}
                            className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 text-xs font-medium rounded-lg h-7 px-2"
                        >
                            Zalo
                        </Button>
                    </Tooltip>
                </div>
            )
        }
    ];

    return (
        <div className="w-full px-4 sm:px-6 py-4 sm:py-6 space-y-4 bg-slate-50/50 min-h-screen">
            {/* Header & Tiêu đề */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
                <div className="flex items-center gap-3">
                    <Button 
                        icon={<ArrowLeftOutlined />} 
                        onClick={() => router.push('/error-management/xml-errors')}
                        className="border-slate-200 rounded-xl"
                    >
                        Quay lại
                    </Button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-0.5 leading-tight flex items-center gap-2">
                            <span>Báo cáo Tổng hợp Lỗi XML</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-500 m-0">Thống kê số lượng lỗi theo từng khoa phòng, tạo liên kết và chia sẻ nhanh lên nhóm Zalo</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 w-full xl:w-auto justify-end flex-wrap">
                    <Button 
                        type="primary" 
                        icon={<ShareAltOutlined />} 
                        onClick={handleOpenZaloModal}
                        className="bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl shadow-sm shadow-blue-200 h-9"
                    >
                        💬 Gửi Zalo Tổng Hợp
                    </Button>
                    
                    <Button 
                        icon={<FileExcelOutlined />} 
                        onClick={handleExportExcel}
                        className="bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl border-green-600 h-9"
                    >
                        Xuất Excel
                    </Button>
                </div>
            </div>

            {/* Thống kê thẻ KPI tóm tắt */}
            <Row gutter={[12, 12]}>
                <Col xs={12} sm={6}>
                    <Card className="rounded-2xl border-slate-200 shadow-2xs" styles={{ body: { padding: '12px 16px' } }}>
                        <Statistic 
                            title={<span className="text-xs text-slate-500 font-medium">Tổng lỗi theo bộ lọc</span>}
                            value={filteredErrors.length}
                            styles={{ content: { color: '#1e293b', fontWeight: 700, fontSize: '1.4rem' } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card className="rounded-2xl border-amber-200 bg-amber-50/30 shadow-2xs" styles={{ body: { padding: '12px 16px' } }}>
                        <Statistic 
                            title={<span className="text-xs text-amber-700 font-medium">🔴 Chờ xử lý</span>}
                            value={overallStats.pending}
                            styles={{ content: { color: '#d97706', fontWeight: 700, fontSize: '1.4rem' } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card className="rounded-2xl border-emerald-200 bg-emerald-50/30 shadow-2xs" styles={{ body: { padding: '12px 16px' } }}>
                        <Statistic 
                            title={<span className="text-xs text-emerald-700 font-medium">✅ Đã xử lý / Khắc phục</span>}
                            value={overallStats.explained}
                            styles={{ content: { color: '#059669', fontWeight: 700, fontSize: '1.4rem' } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={6}>
                    <Card className="rounded-2xl border-blue-200 bg-blue-50/30 shadow-2xs" styles={{ body: { padding: '12px 16px' } }}>
                        <Statistic 
                            title={<span className="text-xs text-blue-700 font-medium">📩 Đã gửi CNTT</span>}
                            value={overallStats.sentIT}
                            styles={{ content: { color: '#2563eb', fontWeight: 700, fontSize: '1.4rem' } }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Thanh Bộ Lọc Toàn Diện (Filter Toolbar) */}
            <Card className="rounded-2xl shadow-sm border-slate-200" styles={{ body: { padding: '14px 18px' } }}>
                <div className="space-y-3">
                    {/* Hàng 1: Lọc trạng thái & Lọc ngày nhanh */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {/* Lọc Trạng Thái */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                <FilterOutlined className="text-blue-600" /> Trạng thái:
                            </span>
                            <Segmented
                                value={statusFilter}
                                onChange={(val: any) => setStatusFilter(val)}
                                options={[
                                    { value: 'PENDING', label: '🔴 Chờ xử lý' },
                                    { value: 'EXPLAINED', label: '✅ Đã xử lý' },
                                    { value: 'SENT_IT', label: '📩 Đã gửi CNTT' },
                                    { value: 'ALL', label: 'Tất cả' }
                                ]}
                                className="bg-slate-100 p-0.5 font-medium text-xs rounded-xl"
                            />
                        </div>

                        {/* Lọc Ngày Nhanh */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-slate-600">Thời gian:</span>
                            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 gap-0.5 text-xs font-medium">
                                <button
                                    type="button"
                                    onClick={() => setDateFilter('TODAY')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${dateFilter === 'TODAY' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Hôm nay
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDateFilter('YESTERDAY')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${dateFilter === 'YESTERDAY' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Hôm qua
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDateFilter('7DAYS')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${dateFilter === '7DAYS' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    7 ngày qua
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDateFilter('ALL')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${dateFilter === 'ALL' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Tất cả
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDateFilter('CUSTOM')}
                                    className={`px-2.5 py-1 rounded-lg transition-all ${dateFilter === 'CUSTOM' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    Tùy chọn...
                                </button>
                            </div>

                            {dateFilter === 'CUSTOM' && (
                                <RangePicker 
                                    format="DD/MM/YYYY" 
                                    onChange={(dates: any) => setCustomDateRange(dates)}
                                    className="rounded-xl text-xs"
                                    size="small"
                                />
                            )}
                        </div>
                    </div>

                    {/* Hàng 2: Lọc Khoa phòng & Lọc Loại lỗi */}
                    <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Khoa phòng:</span>
                            <Select
                                value={deptFilter}
                                onChange={setDeptFilter}
                                showSearch
                                placeholder="Chọn khoa"
                                style={{ minWidth: 200, maxWidth: 280 }}
                                optionFilterProp="label"
                                size="small"
                                className="rounded-lg text-xs"
                                options={[
                                    { value: 'ALL', label: 'Tất cả các khoa phòng' },
                                    ...Object.entries(departments).map(([code, name]) => ({
                                        value: code,
                                        label: `${code} - ${name}`
                                    }))
                                ]}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">Nguồn lỗi:</span>
                            <Select
                                value={sourceTypeFilter}
                                onChange={setSourceTypeFilter}
                                size="small"
                                style={{ minWidth: 160 }}
                                className="rounded-lg text-xs"
                                options={[
                                    { value: 'ALL', label: 'Tất cả loại lỗi' },
                                    { value: 'XML', label: '📄 Chỉ Lỗi hồ sơ XML' },
                                    { value: 'CHUYEN_DE', label: '⏱️ Chỉ Lỗi Chuyên đề' }
                                ]}
                            />
                        </div>

                        {(deptFilter !== 'ALL' || sourceTypeFilter !== 'ALL' || dateFilter !== 'ALL' || statusFilter !== 'PENDING') && (
                            <Button
                                size="small"
                                type="text"
                                icon={<ReloadOutlined className="text-xs" />}
                                onClick={() => {
                                    setStatusFilter('PENDING');
                                    setDateFilter('ALL');
                                    setDeptFilter('ALL');
                                    setSourceTypeFilter('ALL');
                                    setCustomDateRange(null);
                                }}
                                className="text-xs text-slate-500 hover:text-blue-600"
                            >
                                Đặt lại bộ lọc
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {/* Bảng dữ liệu tổng hợp */}
            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-200" styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={summaryData}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        defaultPageSize: 20,
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50', '100'],
                        showTotal: (total) => `Tổng cộng: ${total} nhóm lỗi`
                    }}
                    scroll={{ x: 950 }}
                    size="middle"
                />
            </Card>

            {/* MODAL XEM TRƯỚC VÀ CHIA SẺ BÁO CÁO ZALO TỔNG HỢP */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 text-base font-bold pb-2 border-b border-slate-100">
                        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <MessageOutlined />
                        </span>
                        <div>
                            <div>Báo Cáo Zalo Tổng Hợp Lỗi Toàn Viện</div>
                            <div className="text-xs text-slate-500 font-normal">
                                Kiểm tra và chỉnh sửa nội dung trước khi gửi vào nhóm Zalo chung bệnh viện
                            </div>
                        </div>
                    </div>
                }
                open={isZaloModalVisible}
                onCancel={() => setIsZaloModalVisible(false)}
                width={700}
                footer={[
                    <Button key="close" onClick={() => setIsZaloModalVisible(false)} className="rounded-xl">
                        Đóng
                    </Button>,
                    <Button 
                        key="reset" 
                        icon={<ReloadOutlined />} 
                        onClick={() => {
                            setCustomZaloMessage(generateZaloSummaryText());
                            setIsCustomEdited(false);
                            message.info('Đã khôi phục nội dung tự động theo bộ lọc');
                        }}
                        className="rounded-xl"
                    >
                        Khôi phục gốc
                    </Button>,
                    <Button
                        key="zalo_web"
                        href="https://chat.zalo.me/"
                        target="_blank"
                        rel="noopener noreferrer"
                        icon={<ExportOutlined />}
                        className="rounded-xl border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                        Mở Zalo Web
                    </Button>,
                    <Button
                        key="copy"
                        type="primary"
                        icon={<CopyOutlined />}
                        onClick={handleCopyZaloSummary}
                        className="bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl shadow-sm shadow-blue-200"
                    >
                        Sao chép tin nhắn Zalo
                    </Button>
                ]}
            >
                <div className="py-3 space-y-3">
                    {/* Thống kê nhanh trong Modal */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900">
                        <div className="flex items-center gap-2">
                            <span>📊 <b>{summaryData.length}</b> nhóm lỗi</span>
                            <span>•</span>
                            <span>🏢 <b>{new Set(summaryData.map(s => s.ma_khoa)).size}</b> khoa phòng</span>
                            <span>•</span>
                            <span>🚦 Trạng thái: <b>{statusFilter === 'PENDING' ? 'Chờ xử lý' : statusFilter === 'EXPLAINED' ? 'Đã xử lý' : statusFilter === 'SENT_IT' ? 'Đã gửi CNTT' : 'Tất cả'}</b></span>
                        </div>
                        <span className="text-[11px] text-blue-700 italic">
                            💡 Click vào khung dưới để chỉnh sửa trước khi copy
                        </span>
                    </div>

                    {/* Khung Textarea nội dung tin nhắn Zalo */}
                    <div>
                        <Input.TextArea
                            rows={14}
                            value={customZaloMessage}
                            onChange={(e) => {
                                setCustomZaloMessage(e.target.value);
                                setIsCustomEdited(true);
                            }}
                            className="font-mono text-xs p-3 leading-relaxed rounded-xl border-slate-300"
                            placeholder="Nội dung tin nhắn Zalo..."
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

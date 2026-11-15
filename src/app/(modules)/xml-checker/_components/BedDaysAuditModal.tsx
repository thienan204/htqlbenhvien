'use client';

import React, { useState, useMemo } from 'react';
import {
    Modal, Tabs, Table, Tag, Card, Row, Col, Statistic, Select, Input,
    Button, Space, Tooltip, Badge, Alert, Typography
} from 'antd';
import {
    FileExcelOutlined, SearchOutlined, CheckCircleOutlined,
    CloseCircleOutlined, WarningOutlined, FilterOutlined,
    EyeOutlined, MedicineBoxOutlined, BookOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

import { HosoRecord } from '@/lib/xml';
import {
    BedDaysRecordAudit,
    DepartmentBedSummary,
    calculateBedDaysForRecord,
    aggregateDepartmentBedAudit,
    parseAllowedMaNhom,
    parseExcludedMaBenh,
    MA_LOAI_KCB_MAP,
    formatXmlDateDisplay
} from './bedDaysCalculator';
import BedDaysRulesGuide from './BedDaysRulesGuide';

const { Text } = Typography;

interface BedDaysAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: any[];
    allowedMaNhom?: string; // Lấy động từ conditionValue của rule trong /rules
    excludedMaBenh?: string; // Lấy động từ excludeConditionValue của rule trong /rules (Z38.0)
    departments?: Record<string, string>;
    onSelectRecord?: (record: any) => void;
}

export default function BedDaysAuditModal({
    isOpen,
    onClose,
    records,
    allowedMaNhom = '14,15',
    excludedMaBenh = 'Z38.0,Z38,Z38.1,Z38.2,Z38.3,Z38.4,Z38.5,Z38.6,Z38.7,Z38.8',
    departments = {},
    onSelectRecord
}: BedDaysAuditModalProps) {
    const [activeTab, setActiveTab] = useState<string>('dept');
    const [filterKcb, setFilterKcb] = useState<string>('ALL');
    const [filterDept, setFilterDept] = useState<string>('ALL');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [filterGroup, setFilterGroup] = useState<string>('ALL');
    const [searchText, setSearchText] = useState<string>('');

    // 1. Phân tích mã nhóm giường động và mã bệnh loại trừ từ cấu hình
    const targetMaNhomList = useMemo(() => parseAllowedMaNhom(allowedMaNhom), [allowedMaNhom]);
    const targetExcludedMaBenhList = useMemo(() => parseExcludedMaBenh(excludedMaBenh), [excludedMaBenh]);

    // 2. Chạy đối soát cho toàn bộ hồ sơ (kèm danh mục khoa phòng và danh sách loại trừ Z38)
    const allAudits = useMemo(() => {
        return records.map(r => calculateBedDaysForRecord(r, targetMaNhomList, departments, targetExcludedMaBenhList));
    }, [records, targetMaNhomList, departments, targetExcludedMaBenhList]);

    // 3. Danh sách các khoa xuất hiện trong dữ liệu (kèm tên khoa)
    const departmentOptions = useMemo(() => {
        const set = new Set<string>();
        const map = new Map<string, string>();
        allAudits.forEach(a => {
            if (a.maKhoaRv) {
                set.add(a.maKhoaRv);
                map.set(a.maKhoaRv, a.tenKhoaRv || a.maKhoaRv);
            }
            if (a.maKhoaChiDinhList && a.maKhoaChiDinhList.length > 0) {
                a.maKhoaChiDinhList.forEach(k => {
                    set.add(k);
                    map.set(k, departments?.[k] || k);
                });
            }
        });
        return Array.from(set).map(k => ({
            value: k,
            label: `${k} - ${departments?.[k] || map.get(k) || k}`
        }));
    }, [allAudits, departments]);

    // 4. Lọc dữ liệu kiểm toán
    const filteredAudits = useMemo(() => {
        return allAudits.filter(item => {
            // Lọc Loại hình KCB
            if (filterKcb !== 'ALL' && item.maLoaiKcb !== filterKcb) {
                return false;
            }

            // Lọc Khoa/Phòng (thỏa mãn nếu là Khoa ra viện HOẶC nằm trong danh sách Khoa chỉ định)
            if (filterDept !== 'ALL') {
                const matchRv = item.maKhoaRv === filterDept;
                const matchChiDinh = item.maKhoaChiDinhList?.includes(filterDept);
                const matchKhoa = item.maKhoa === filterDept;
                if (!matchRv && !matchChiDinh && !matchKhoa) return false;
            }

            // Lọc Nhóm ca
            if (filterGroup !== 'ALL' && String(item.caseGroup) !== filterGroup) {
                return false;
            }

            // Lọc Trạng thái
            if (filterStatus === 'CORRECT' && item.status !== 'CORRECT') return false;
            if (filterStatus === 'OVER_BED' && item.status !== 'OVER_BED' && item.status !== 'INVALID_KCB') return false;
            if (filterStatus === 'UNDER_BED' && item.status !== 'UNDER_BED') return false;
            if (filterStatus === 'EXEMPT_NEWBORN' && !item.isExemptNewborn) return false;
            if (filterStatus === 'WARN_09' && !item.warn09) return false;
            if (filterStatus === 'ERROR_ONLY' && item.status === 'CORRECT') return false;

            // Tìm kiếm Text (Mã LK, Mã BN, Họ tên)
            if (searchText.trim()) {
                const q = searchText.trim().toLowerCase();
                const matchLk = item.maLk.toLowerCase().includes(q);
                const matchBn = item.maBn.toLowerCase().includes(q);
                const matchTen = item.hoTen.toLowerCase().includes(q);
                if (!matchLk && !matchBn && !matchTen) return false;
            }

            return true;
        });
    }, [allAudits, filterKcb, filterDept, filterStatus, filterGroup, searchText]);

    // 5. Thống kê theo Khoa/Phòng
    const departmentSummaries = useMemo(() => {
        return aggregateDepartmentBedAudit(filteredAudits);
    }, [filteredAudits]);

    // 6. Tính toán các chỉ số KPI tổng
    const totalCount = allAudits.length;
    const correctCount = allAudits.filter(a => a.status === 'CORRECT').length;
    const overCount = allAudits.filter(a => a.status === 'OVER_BED' || a.status === 'INVALID_KCB').length;
    const underCount = allAudits.filter(a => a.status === 'UNDER_BED').length;
    const warn09Count = allAudits.filter(a => a.warn09).length;
    const totalEstimatedOverCost = allAudits.reduce((acc, a) => acc + (a.estimatedOverCost || 0), 0);

    // 6.1 Xử lý click nhanh vào KPI Cards để lọc danh sách bên dưới
    const handleCardClick = (targetStatus: string) => {
        if (filterStatus === targetStatus) {
            setFilterStatus('ALL');
        } else {
            setFilterStatus(targetStatus);
        }
        setActiveTab('records');
    };

    // 7. Xuất file Excel báo cáo
    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'HTQLBV - XML Checker';
        workbook.created = new Date();

        // Sheet 1: Tổng hợp Khoa Phòng
        const wsDept = workbook.addWorksheet('Tổng hợp Khoa Phòng');
        wsDept.columns = [
            { header: 'STT', key: 'stt', width: 8 },
            { header: 'Mã Khoa', key: 'maKhoa', width: 14 },
            { header: 'Tên Khoa Phòng', key: 'tenKhoa', width: 28 },
            { header: 'Tổng ca', key: 'totalRecords', width: 12 },
            { header: 'Ca Đúng', key: 'correctCount', width: 12 },
            { header: 'Thừa giường (Xuất toán)', key: 'overCount', width: 22 },
            { header: 'Thiếu giường', key: 'underCount', width: 14 },
            { header: 'Tổng ngày thừa (+)', key: 'totalOverBedDays', width: 18 },
            { header: 'Tổng ngày thiếu (-)', key: 'totalUnderBedDays', width: 18 },
            { header: 'Tỷ lệ Đúng (%)', key: 'complianceRate', width: 16 },
            { header: 'Ước tính Tiền xuất toán (VNĐ)', key: 'estimatedOverCost', width: 26 }
        ];

        // Header style
        wsDept.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        wsDept.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };

        departmentSummaries.forEach((dept, idx) => {
            wsDept.addRow({
                stt: idx + 1,
                maKhoa: dept.maKhoa,
                tenKhoa: dept.tenKhoa,
                totalRecords: dept.totalRecords,
                correctCount: dept.correctCount,
                overCount: dept.overCount,
                underCount: dept.underCount,
                totalOverBedDays: dept.totalOverBedDays,
                totalUnderBedDays: dept.totalUnderBedDays,
                complianceRate: `${dept.complianceRate}%`,
                estimatedOverCost: dept.estimatedOverCost.toLocaleString('vi-VN')
            });
        });

        // Sheet 2: Chi tiết hồ sơ bệnh nhân
        const wsRecords = workbook.addWorksheet('Chi tiết Hồ sơ Bệnh nhân');
        wsRecords.columns = [
            { header: 'STT', key: 'stt', width: 8 },
            { header: 'Mã LK', key: 'maLk', width: 16 },
            { header: 'Mã BN', key: 'maBn', width: 14 },
            { header: 'Họ và tên', key: 'hoTen', width: 24 },
            { header: 'Khoa Ra Viện (XML7/XML1)', key: 'khoaRv', width: 28 },
            { header: 'Khoa Chỉ Định Giường (XML3)', key: 'khoaChiDinh', width: 35 },
            { header: 'Mã bệnh chính', key: 'maBenhChinh', width: 20 },
            { header: 'Trẻ sơ sinh ghép mẹ', key: 'isExemptNewborn', width: 20 },
            { header: 'Loại KCB', key: 'tenLoaiKcb', width: 22 },
            { header: 'Ngày vào', key: 'ngayVao', width: 18 },
            { header: 'Ngày ra', key: 'ngayRa', width: 18 },
            { header: 'Số giờ nằm', key: 'durationHours', width: 14 },
            { header: 'Nhóm ca', key: 'caseGroupDesc', width: 35 },
            { header: 'Giường chuẩn (S_chuẩn)', key: 'sChuan', width: 22 },
            { header: 'Giường XML3 (S_thực tế)', key: 'sThucTe', width: 22 },
            { header: 'Chênh lệch (Δ)', key: 'diffDays', width: 16 },
            { header: 'Trạng thái', key: 'statusDesc', width: 35 },
            { header: 'Lý do & Căn cứ chi tiết', key: 'detailedReason', width: 50 },
            { header: 'Cảnh báo mã 09', key: 'warn09', width: 18 },
            { header: 'Ước tính Xuất toán (VNĐ)', key: 'estimatedOverCost', width: 24 }
        ];

        wsRecords.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        wsRecords.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };

        filteredAudits.forEach((audit, idx) => {
            wsRecords.addRow({
                stt: idx + 1,
                maLk: audit.maLk,
                maBn: audit.maBn,
                hoTen: audit.hoTen,
                khoaRv: audit.maKhoaRv ? `${audit.maKhoaRv} - ${audit.tenKhoaRv}` : '',
                khoaChiDinh: audit.tenKhoaChiDinhStr || (audit.maKhoa ? `${audit.maKhoa} - ${audit.tenKhoa}` : ''),
                maBenhChinh: audit.maBenhChinh ? `${audit.maBenhChinh} - ${audit.tenBenhChinh}` : '',
                isExemptNewborn: audit.isExemptNewborn ? 'Có (Miễn ngày giường)' : 'Không',
                tenLoaiKcb: `${audit.maLoaiKcb} - ${audit.tenLoaiKcb}`,
                ngayVao: formatXmlDateDisplay(audit.ngayVaoStr),
                ngayRa: formatXmlDateDisplay(audit.ngayRaStr),
                durationHours: audit.durationHours,
                caseGroupDesc: audit.caseGroupDesc,
                sChuan: audit.sChuan,
                sThucTe: audit.sThucTe,
                diffDays: audit.diffDays,
                statusDesc: audit.statusDesc,
                detailedReason: audit.detailedReason || '',
                warn09: audit.warn09 ? 'Cần dùng mã 09' : '',
                estimatedOverCost: audit.estimatedOverCost ? audit.estimatedOverCost.toLocaleString('vi-VN') : 0
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Doi_chieu_Tien_Ngay_Giuong_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
    };

    // Columns cho Tab 1: Tổng hợp Khoa Phòng
    const deptColumns: ColumnsType<DepartmentBedSummary> = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center',
            render: (_, __, idx) => idx + 1
        },
        {
            title: 'Mã Khoa',
            dataIndex: 'maKhoa',
            key: 'maKhoa',
            width: 100,
            render: (val) => <Tag color="blue" className="font-mono">{val}</Tag>
        },
        {
            title: 'Tên Khoa Phòng',
            dataIndex: 'tenKhoa',
            key: 'tenKhoa',
            render: (val) => <span className="font-semibold text-slate-800">{val}</span>
        },
        {
            title: 'Tổng ca',
            dataIndex: 'totalRecords',
            key: 'totalRecords',
            width: 90,
            align: 'center',
            sorter: (a, b) => a.totalRecords - b.totalRecords
        },
        {
            title: 'Đúng chuẩn',
            dataIndex: 'correctCount',
            key: 'correctCount',
            width: 110,
            align: 'center',
            render: (val) => <Tag color="success" className="font-bold">{val} ca</Tag>
        },
        {
            title: 'Thừa giường (Xuất toán)',
            dataIndex: 'overCount',
            key: 'overCount',
            width: 170,
            align: 'center',
            sorter: (a, b) => a.overCount - b.overCount,
            render: (val, r) => val > 0 ? (
                <Tag color="error" className="font-bold">
                    {val} ca (+{r.totalOverBedDays} ngày)
                </Tag>
            ) : <span className="text-slate-400">0</span>
        },
        {
            title: 'Thiếu giường',
            dataIndex: 'underCount',
            key: 'underCount',
            width: 140,
            align: 'center',
            sorter: (a, b) => a.underCount - b.underCount,
            render: (val, r) => val > 0 ? (
                <Tag color="warning" className="font-bold">
                    {val} ca (-{r.totalUnderBedDays} ngày)
                </Tag>
            ) : <span className="text-slate-400">0</span>
        },
        {
            title: 'Tỷ lệ Đúng',
            dataIndex: 'complianceRate',
            key: 'complianceRate',
            width: 120,
            align: 'center',
            sorter: (a, b) => a.complianceRate - b.complianceRate,
            render: (rate) => {
                const color = rate >= 90 ? 'green' : rate >= 70 ? 'orange' : 'red';
                return <Tag color={color} className="font-bold">{rate}%</Tag>;
            }
        },
        {
            title: 'Ước tính Xuất toán',
            dataIndex: 'estimatedOverCost',
            key: 'estimatedOverCost',
            width: 160,
            align: 'right',
            sorter: (a, b) => a.estimatedOverCost - b.estimatedOverCost,
            render: (cost) => cost > 0 ? (
                <span className="font-bold text-red-600 font-mono">
                    {cost.toLocaleString('vi-VN')} đ
                </span>
            ) : <span className="text-slate-400">0 đ</span>
        }
    ];

    // Columns cho Tab 2: Chi tiết từng hồ sơ bệnh nhân
    const recordColumns: ColumnsType<BedDaysRecordAudit> = [
        {
            title: 'STT',
            key: 'stt',
            width: 55,
            align: 'center',
            render: (_, __, idx) => idx + 1
        },
        {
            title: 'Mã LK / Bệnh nhân',
            key: 'patient',
            width: 180,
            render: (_, r) => (
                <div>
                    <div className="font-bold text-slate-800">{r.hoTen || 'Chưa có tên'}</div>
                    <div className="text-xs font-mono text-blue-600">{r.maLk}</div>
                    {r.maBn && <div className="text-[11px] font-mono text-slate-400">BN: {r.maBn}</div>}
                    {r.maBenhChinh && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-full" title={`${r.maBenhChinh} - ${r.tenBenhChinh}`}>
                            ICD: <span className="font-bold text-slate-700">{r.maBenhChinh}</span>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Khoa / Loại KCB',
            key: 'deptKcb',
            width: 250,
            render: (_, r) => (
                <div className="space-y-1.5 text-xs">
                    <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Khoa ra viện (XML7/XML1):</span>
                        <div className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mt-0.5 inline-block max-w-full truncate" title={`${r.maKhoaRv} - ${r.tenKhoaRv}`}>
                            {r.maKhoaRv ? `${r.maKhoaRv} - ${r.tenKhoaRv}` : 'Chưa xác định'}
                        </div>
                    </div>
                    {r.tenKhoaChiDinhStr && (
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Khoa chỉ định giường (XML3):</span>
                            <div className="text-slate-700 font-medium text-[11px] mt-0.5 leading-snug break-words">
                                {r.tenKhoaChiDinhStr}
                            </div>
                        </div>
                    )}
                    <div>
                        <Tag color="cyan" className="text-[11px] font-mono m-0">
                            {r.maLoaiKcb} - {r.tenLoaiKcb}
                        </Tag>
                    </div>
                </div>
            )
        },
        {
            title: 'Thời gian nằm viện',
            key: 'time',
            width: 190,
            render: (_, r) => (
                <div className="text-xs space-y-0.5">
                    <div>Vào: <span className="font-mono">{formatXmlDateDisplay(r.ngayVaoStr)}</span></div>
                    <div>Ra: <span className="font-mono">{formatXmlDateDisplay(r.ngayRaStr)}</span></div>
                    <div className="text-slate-500 font-semibold">
                        Thời gian: <span className="text-blue-600">{r.durationHours}h</span> ({r.durationMinutes} phút)
                    </div>
                </div>
            )
        },
        {
            title: 'Phân loại nhóm ca',
            key: 'caseGroup',
            width: 180,
            render: (_, r) => {
                let badgeColor = 'blue';
                if (r.caseGroup === 1) badgeColor = 'orange';
                if (r.caseGroup === 4) badgeColor = 'purple';
                return (
                    <div>
                        <Tag color={badgeColor} className="font-bold">
                            {r.caseGroup === 0 ? 'Chưa rõ' : `Nhóm ${r.caseGroup}`}
                        </Tag>
                        <div className="text-[11px] text-slate-500 mt-1 leading-tight">
                            {r.caseGroupDesc}
                        </div>
                        {r.warn09 && (
                            <Tag color="volcano" className="mt-1 text-[10px]">
                                ⚠️ Nằm &le; 4h (Nên dùng mã 09)
                            </Tag>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Giường Chuẩn vs XML3',
            key: 'compare',
            width: 150,
            align: 'center',
            render: (_, r) => (
                <div className="space-y-1">
                    <div className="text-xs">
                        Chuẩn: <span className="font-bold text-green-600 font-mono">{r.sChuan}</span> ngày
                    </div>
                    <div className="text-xs">
                        XML3 kê: <span className="font-bold text-blue-600 font-mono">{r.sThucTe}</span> ngày
                    </div>
                    <div className="text-xs pt-1 border-t border-slate-100">
                        {r.diffDays === 0 ? (
                            <Tag color="success" className="m-0 font-bold">Khớp</Tag>
                        ) : r.diffDays > 0 ? (
                            <Tag color="error" className="m-0 font-bold">Thừa +{r.diffDays}</Tag>
                        ) : (
                            <Tag color="warning" className="m-0 font-bold">Thiếu {r.diffDays}</Tag>
                        )}
                    </div>
                </div>
            )
        },
        {
            title: 'Đánh giá & Căn cứ / Lý do',
            key: 'status',
            width: 310,
            render: (_, r) => {
                const isCorrect = r.status === 'CORRECT';
                const isOver = r.status === 'OVER_BED' || r.status === 'INVALID_KCB';
                return (
                    <div className="space-y-1.5 py-0.5">
                        {r.isExemptNewborn ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-blue-700 bg-blue-50 border border-blue-200 font-bold text-xs">
                                👶 TRẺ SƠ SINH NẰM GHÉP MẸ
                            </div>
                        ) : isCorrect ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-green-700 bg-green-50 border border-green-200 font-bold text-xs">
                                <CheckCircleOutlined /> ĐÚNG CHUẨN
                            </div>
                        ) : isOver ? (
                            <div>
                                <div className="flex items-center justify-between gap-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-red-700 bg-red-50 border border-red-200 font-bold text-xs">
                                        <CloseCircleOutlined /> XUẤT TOÁN BHYT
                                    </span>
                                    {r.estimatedOverCost > 0 && (
                                        <span className="text-xs font-bold text-red-600 font-mono">
                                            {r.estimatedOverCost.toLocaleString('vi-VN')} đ
                                        </span>
                                    )}
                                </div>
                                <div className="text-[11px] text-red-600 font-medium mt-1">{r.statusDesc}</div>
                            </div>
                        ) : (
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-amber-700 bg-amber-50 border border-amber-200 font-bold text-xs">
                                    <WarningOutlined /> THẤT THU VIỆN PHÍ
                                </div>
                                <div className="text-[11px] text-amber-600 font-medium mt-1">{r.statusDesc}</div>
                            </div>
                        )}

                        {/* Hộp lý do và căn cứ chi tiết */}
                        {r.detailedReason && (
                            <div
                                className={`text-[11px] p-2 rounded-lg border leading-relaxed ${r.isExemptNewborn
                                        ? 'bg-blue-50/70 border-blue-200 text-slate-800'
                                        : isCorrect
                                            ? 'bg-slate-50 border-slate-200 text-slate-600'
                                            : isOver
                                                ? 'bg-rose-50/70 border-rose-200 text-slate-800'
                                                : 'bg-amber-50/70 border-amber-200 text-slate-800'
                                    }`}
                            >
                                <span className="font-bold text-[10px] uppercase text-slate-500 block mb-0.5">
                                    Lý do & Căn cứ tính:
                                </span>
                                <div className="whitespace-normal break-words">{r.detailedReason}</div>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 90,
            align: 'center',
            render: (_, r) => (
                <Button
                    size="small"
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => {
                        if (onSelectRecord) {
                            onSelectRecord(r.rawRecord);
                            onClose();
                        }
                    }}
                >
                    Chi tiết
                </Button>
            )
        }
    ];

    const tabItems = [
        {
            key: 'dept',
            label: (
                <span className="font-bold flex items-center gap-1.5 px-2">
                    <MedicineBoxOutlined />
                    Tổng hợp theo Khoa/Phòng ({departmentSummaries.length})
                </span>
            ),
            children: (
                <div className="p-4 bg-white rounded-2xl border border-slate-100">
                    <Table
                        columns={deptColumns}
                        dataSource={departmentSummaries}
                        rowKey="maKhoa"
                        pagination={{ pageSize: 10, showSizeChanger: true }}
                        size="middle"
                        bordered
                    />
                </div>
            )
        },
        {
            key: 'records',
            label: (
                <span className="font-bold flex items-center gap-1.5 px-2">
                    <EyeOutlined />
                    Chi tiết Hồ sơ Bệnh nhân ({filteredAudits.length})
                </span>
            ),
            children: (
                <div className="p-4 bg-white rounded-2xl border border-slate-100">
                    <Table
                        columns={recordColumns}
                        dataSource={filteredAudits}
                        rowKey="maLk"
                        pagination={{ pageSize: 10, showSizeChanger: true }}
                        size="small"
                        bordered
                    />
                </div>
            )
        },
        {
            key: 'rules',
            label: (
                <span className="font-bold flex items-center gap-1.5 px-2 text-blue-700">
                    <BookOutlined />
                    Quy luật & Công thức tính (4 nhóm ca)
                </span>
            ),
            children: (
                <div className="p-4 bg-white rounded-2xl border border-slate-100 max-h-[68vh] overflow-y-auto">
                    <BedDaysRulesGuide />
                </div>
            )
        }
    ];

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            width={1380}
            style={{ top: 20 }}
            title={
                <div className="flex items-center justify-between pr-8 py-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                            <MedicineBoxOutlined style={{ fontSize: 22 }} />
                        </div>
                        <div>
                            <div className="text-xl font-black text-slate-800">
                                Bảng Đối chiếu Kiểm soát Tiền ngày giường & Đánh giá Khoa/Phòng
                            </div>
                            <div className="text-xs text-slate-500 font-normal">
                                Đối chiếu giữa công thức chuẩn 4 nhóm ca (XML1) và kê khai dịch vụ XML3
                            </div>
                        </div>
                    </div>
                    <Space>
                        <Tag color="purple" className="px-3 py-1 font-mono font-semibold rounded-full">
                            MA_NHOM: [{targetMaNhomList.join(', ')}]
                        </Tag>
                        {targetExcludedMaBenhList.length > 0 && (
                            <Tag color="cyan" className="px-3 py-1 font-mono font-semibold rounded-full">
                                Miễn trẻ sơ sinh: [{targetExcludedMaBenhList.slice(0, 2).join(', ')}...]
                            </Tag>
                        )}
                        <Button
                            type="primary"
                            icon={<FileExcelOutlined />}
                            onClick={handleExportExcel}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Xuất Excel
                        </Button>
                    </Space>
                </div>
            }
            footer={null}
        >
            <div className="space-y-4 pt-2">
                {/* 1. Hàng KPI Cards (Hỗ trợ click nhanh để lọc danh sách) */}
                <Row gutter={[16, 16]}>
                    <Col span={4}>
                        <Tooltip title="Nhấp để hiển thị toàn bộ danh sách hồ sơ">
                            <Card
                                onClick={() => {
                                    setFilterStatus('ALL');
                                    setActiveTab('records');
                                }}
                                className={`rounded-2xl border-slate-200 shadow-sm bg-gradient-to-br from-slate-50 to-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md select-none ${filterStatus === 'ALL' && activeTab === 'records' ? 'ring-2 ring-slate-400 bg-slate-100/60' : ''
                                    }`}
                            >
                                <Statistic
                                    title={<span className="text-xs font-semibold text-slate-500">Tổng hồ sơ kiểm tra</span>}
                                    value={totalCount}
                                    suffix="ca"
                                    styles={{ content: { fontWeight: 800, color: '#1e293b' } }}
                                />
                            </Card>
                        </Tooltip>
                    </Col>
                    <Col span={5}>
                        <Tooltip title="Nhấp để xem danh sách ca đúng chuẩn ngày giường">
                            <Card
                                onClick={() => handleCardClick('CORRECT')}
                                className={`rounded-2xl border-emerald-200 shadow-sm bg-gradient-to-br from-emerald-50/50 to-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md select-none ${filterStatus === 'CORRECT' ? 'ring-2 ring-emerald-500 shadow-emerald-100 bg-emerald-50' : ''
                                    }`}
                            >
                                <Statistic
                                    title={<span className="text-xs font-semibold text-emerald-700">Đúng chuẩn số giường</span>}
                                    value={correctCount}
                                    suffix={`ca (${totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 100}%)`}
                                    styles={{ content: { fontWeight: 800, color: '#059669' } }}
                                />
                            </Card>
                        </Tooltip>
                    </Col>
                    <Col span={5}>
                        <Tooltip title="Nhấp để lọc danh sách 13 ca THỪA giường (Xuất toán BHYT)">
                            <Card
                                onClick={() => handleCardClick('OVER_BED')}
                                className={`rounded-2xl border-rose-200 shadow-sm bg-gradient-to-br from-rose-50/50 to-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md select-none ${filterStatus === 'OVER_BED' ? 'ring-2 ring-rose-500 shadow-rose-100 bg-rose-50' : ''
                                    }`}
                            >
                                <Statistic
                                    title={<span className="text-xs font-semibold text-rose-700">Sai: Thừa giường (Xuất toán)</span>}
                                    value={overCount}
                                    suffix="ca"
                                    styles={{ content: { fontWeight: 800, color: '#e11d48' } }}
                                />
                            </Card>
                        </Tooltip>
                    </Col>
                    <Col span={5}>
                        <Tooltip title="Nhấp để lọc danh sách 92 ca THIẾU ngày giường (Thất thu)">
                            <Card
                                onClick={() => handleCardClick('UNDER_BED')}
                                className={`rounded-2xl border-amber-200 shadow-sm bg-gradient-to-br from-amber-50/50 to-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md select-none ${filterStatus === 'UNDER_BED' ? 'ring-2 ring-amber-500 shadow-amber-100 bg-amber-50' : ''
                                    }`}
                            >
                                <Statistic
                                    title={<span className="text-xs font-semibold text-amber-700">Sai: Thiếu ngày giường</span>}
                                    value={underCount}
                                    suffix="ca"
                                    styles={{ content: { fontWeight: 800, color: '#d97706' } }}
                                />
                            </Card>
                        </Tooltip>
                    </Col>
                    <Col span={5}>
                        <Tooltip title="Nhấp để lọc danh sách các ca gây xuất toán viện phí">
                            <Card
                                onClick={() => handleCardClick('OVER_BED')}
                                className={`rounded-2xl border-purple-200 shadow-sm bg-gradient-to-br from-purple-50/50 to-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md select-none ${filterStatus === 'OVER_BED' ? 'ring-2 ring-purple-500 shadow-purple-100' : ''
                                    }`}
                            >
                                <Statistic
                                    title={<span className="text-xs font-semibold text-purple-700">Ước tính Xuất toán BHYT</span>}
                                    value={totalEstimatedOverCost}
                                    suffix="đ"
                                    formatter={(val) => Number(val).toLocaleString('vi-VN')}
                                    styles={{ content: { fontWeight: 800, color: '#7c3aed', fontSize: '1.25rem' } }}
                                />
                            </Card>
                        </Tooltip>
                    </Col>
                </Row>

                {/* 2. Thanh Bộ Lọc Đa Tiêu Chí */}
                <Card className="rounded-2xl border-slate-200 shadow-sm p-0 bg-slate-50/50">
                    <Row gutter={[12, 12]} align="middle">
                        <Col span={5}>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Loại hình KCB (MA_LOAI_KCB):</div>
                            <Select
                                value={filterKcb}
                                onChange={setFilterKcb}
                                style={{ width: '100%' }}
                                options={[
                                    { value: 'ALL', label: 'Tất cả loại hình KCB' },
                                    { value: '03', label: '03 - Điều trị nội trú' },
                                    { value: '09', label: '09 - Điều trị nội trú < 4 giờ' },
                                    { value: '04', label: '04 - Điều trị ban ngày' },
                                    { value: '01', label: '01 - Khám bệnh' },
                                    { value: '02', label: '02 - Điều trị ngoại trú' }
                                ]}
                            />
                        </Col>
                        <Col span={5}>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Khoa / Phòng:</div>
                            <Select
                                value={filterDept}
                                onChange={setFilterDept}
                                style={{ width: '100%' }}
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                options={[
                                    { value: 'ALL', label: 'Tất cả Khoa / Phòng' },
                                    ...departmentOptions
                                ]}
                            />
                        </Col>
                        <Col span={4}>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Nhóm ca:</div>
                            <Select
                                value={filterGroup}
                                onChange={setFilterGroup}
                                style={{ width: '100%' }}
                                options={[
                                    { value: 'ALL', label: 'Tất cả 4 nhóm ca' },
                                    { value: '1', label: 'Nhóm 1: Nằm ≤ 4 giờ' },
                                    { value: '2', label: 'Nhóm 2: Cùng ngày > 4h' },
                                    { value: '3', label: 'Nhóm 3: Khác ngày - RV thường' },
                                    { value: '4', label: 'Nhóm 4: Khác ngày - Tử vong/CT' }
                                ]}
                            />
                        </Col>
                        <Col span={5}>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Trạng thái đối soát:</div>
                            <Select
                                value={filterStatus}
                                onChange={setFilterStatus}
                                style={{ width: '100%' }}
                                options={[
                                    { value: 'ALL', label: 'Tất cả trạng thái' },
                                    { value: 'ERROR_ONLY', label: 'Chỉ các ca LỆCH GIƯỜNG (Sai)' },
                                    { value: 'OVER_BED', label: 'Chỉ ca Thừa giường (Xuất toán)' },
                                    { value: 'UNDER_BED', label: 'Chỉ ca Thiếu giường' },
                                    { value: 'EXEMPT_NEWBORN', label: '👶 Trẻ sơ sinh nằm cùng mẹ (Z38)' },
                                    { value: 'WARN_09', label: 'Cảnh báo mã 09 (≤ 4 giờ)' },
                                    { value: 'CORRECT', label: 'Chỉ ca Đúng chuẩn' }
                                ]}
                            />
                        </Col>
                        <Col span={5}>
                            <div className="text-xs font-semibold text-slate-500 mb-1">Tìm kiếm Mã LK / BN:</div>
                            <Input
                                placeholder="Nhập Mã LK hoặc tên..."
                                prefix={<SearchOutlined className="text-slate-400" />}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                            />
                        </Col>
                    </Row>
                </Card>

                {/* 3. Tabs Card (Chuẩn rule: type="card") */}
                <Tabs
                    type="card"
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    className="custom-tabs"
                />
            </div>
        </Modal>
    );
}


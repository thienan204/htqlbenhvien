'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
    Modal, Table, Tag, Card, Row, Col, Statistic, Select, Input,
    Button, Space, Tooltip, Badge, Alert, Typography, Spin, message
} from 'antd';
import {
    FileExcelOutlined, SearchOutlined, CheckCircleOutlined,
    CloseCircleOutlined, WarningOutlined, FilterOutlined,
    ReloadOutlined, DesktopOutlined, ToolOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

import {
    MachineAuditItem,
    MachineAuditSummary,
    auditMachineRecords
} from './machineAuditCalculator';
import { MachineCatalogItem } from '@/app/api/xml-checker/machine-audit-data/route';

const { Text } = Typography;

interface MachineAuditModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: any[];
    departments?: Record<string, string>;
    onSelectRecord?: (record: any) => void;
}

export default function MachineAuditModal({
    isOpen,
    onClose,
    records,
    departments = {},
    onSelectRecord
}: MachineAuditModalProps) {
    const [loading, setLoading] = useState<boolean>(false);
    const [mau06List, setMau06List] = useState<MachineCatalogItem[]>([]);
    const [requiredServiceCodes, setRequiredServiceCodes] = useState<Set<string>>(new Set());

    // Filters
    const [filterErrorType, setFilterErrorType] = useState<string>('ALL');
    const [filterDept, setFilterDept] = useState<string>('ALL');
    const [filterNgayRa, setFilterNgayRa] = useState<string>('ALL');
    const [searchText, setSearchText] = useState<string>('');

    // 1. Tải danh mục Mẫu 06 và dịch vụ Mẫu 05 bắt buộc mã máy
    const fetchCatalogData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/xml-checker/machine-audit-data');
            const data = await res.json();
            if (data.success) {
                setMau06List(data.mau06List || []);
                setRequiredServiceCodes(new Set(data.requiredServiceCodes || []));
            } else {
                message.error('Không thể tải danh mục Mẫu 06 & Mẫu 05.');
            }
        } catch (error) {
            console.error('Lỗi tải danh mục Mẫu 06:', error);
            message.error('Có lỗi xảy ra khi nạp danh mục máy Mẫu 06.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && mau06List.length === 0) {
            fetchCatalogData();
        }
    }, [isOpen]);

    // 2. Chạy đối soát toàn bộ hồ sơ (kết quả đã được sắp xếp MA_LK -> MA_BN -> NGAY_YL -> MA_DICH_VU)
    const auditResult = useMemo(() => {
        if (!isOpen || records.length === 0) {
            return {
                items: [] as MachineAuditItem[],
                summary: {
                    totalXml3Scanned: 0,
                    totalErrors: 0,
                    totalNotInMau06: 0,
                    totalMissingRequired: 0,
                    totalWithSuggestions: 0,
                    totalHosoAffected: 0
                } as MachineAuditSummary
            };
        }
        return auditMachineRecords(records, mau06List, requiredServiceCodes, departments);
    }, [records, mau06List, requiredServiceCodes, departments, isOpen]);

    const { items: allAuditItems, summary } = auditResult;

    // 3. Danh sách các khoa xuất hiện trong dữ liệu lỗi
    const departmentOptions = useMemo(() => {
        const set = new Set<string>();
        allAuditItems.forEach(item => {
            if (item.maKhoa) set.add(item.maKhoa);
        });
        return Array.from(set).map(k => ({
            value: k,
            label: `${k} - ${departments[k] || k}`
        }));
    }, [allAuditItems, departments]);

    // Danh sách các Ngày ra viện xuất hiện trong dữ liệu lỗi
    const ngayRaOptions = useMemo(() => {
        const map = new Map<string, number>();
        allAuditItems.forEach(item => {
            const d = item.ngayRaDateOnly || 'Khong_Xac_Dinh';
            map.set(d, (map.get(d) || 0) + 1);
        });
        return Array.from(map.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([date, count]) => ({
                value: date,
                label: `Ra viện ${date} (${count} lỗi)`
            }));
    }, [allAuditItems]);

    // 4. Lọc dữ liệu hiển thị trên bảng
    const filteredItems = useMemo(() => {
        return allAuditItems.filter(item => {
            // Lọc theo loại vi phạm
            if (filterErrorType === 'NOT_IN_MAU06' && item.errorType !== 'NOT_IN_MAU06') return false;
            if (filterErrorType === 'MISSING_REQUIRED' && item.errorType !== 'MISSING_REQUIRED') return false;
            if (filterErrorType === 'HAS_SUGGESTION' && !item.suggestedMaMay) return false;
            if (filterErrorType === 'NO_SUGGESTION' && item.suggestedMaMay) return false;

            // Lọc theo Khoa
            if (filterDept !== 'ALL' && item.maKhoa !== filterDept) return false;

            // Lọc theo Ngày ra viện
            if (filterNgayRa !== 'ALL' && item.ngayRaDateOnly !== filterNgayRa) return false;

            // Tìm kiếm tự do
            if (searchText.trim()) {
                const s = searchText.toLowerCase().trim();
                const matchLk = item.maLk.toLowerCase().includes(s);
                const matchBn = item.maBn.toLowerCase().includes(s);
                const matchHoTen = item.hoTen.toLowerCase().includes(s);
                const matchDv = item.maDichVu.toLowerCase().includes(s) || item.tenDichVu.toLowerCase().includes(s);
                const matchMayXml = item.maMayXml.toLowerCase().includes(s);
                const matchMayDeXuat = item.suggestedMaMay.toLowerCase().includes(s) || item.suggestedTenTb.toLowerCase().includes(s) || item.suggestedKyHieu.toLowerCase().includes(s);
                if (!matchLk && !matchBn && !matchHoTen && !matchDv && !matchMayXml && !matchMayDeXuat) {
                    return false;
                }
            }

            return true;
        });
    }, [allAuditItems, filterErrorType, filterDept, filterNgayRa, searchText]);

    // 5. Thống kê theo Khoa để xuất sheet tổng hợp
    const departmentSummaries = useMemo(() => {
        const map = new Map<string, {
            maKhoa: string;
            tenKhoa: string;
            totalErrors: number;
            notInMau06Count: number;
            missingCount: number;
            suggestedCount: number;
            affectedLks: Set<string>;
        }>();

        allAuditItems.forEach(item => {
            const k = item.maKhoa || 'KHONG_XAC_DINH';
            let dept = map.get(k);
            if (!dept) {
                dept = {
                    maKhoa: k,
                    tenKhoa: departments[k] || item.tenKhoa || k,
                    totalErrors: 0,
                    notInMau06Count: 0,
                    missingCount: 0,
                    suggestedCount: 0,
                    affectedLks: new Set()
                };
                map.set(k, dept);
            }
            dept.totalErrors++;
            if (item.errorType === 'NOT_IN_MAU06') dept.notInMau06Count++;
            if (item.errorType === 'MISSING_REQUIRED') dept.missingCount++;
            if (item.suggestedMaMay) dept.suggestedCount++;
            dept.affectedLks.add(item.maLk);
        });

        return Array.from(map.values()).sort((a, b) => b.totalErrors - a.totalErrors);
    }, [allAuditItems, departments]);

    // 6. XUẤT EXCEL CHUYÊN NGHIỆP BẰNG EXCELJS (ĐÃ SẮP XẾP CHUẨN MA_LK -> MA_BN -> NGAY_YL -> MA_DICH_VU)
    const handleExportExcel = async () => {
        if (allAuditItems.length === 0) {
            message.warning('Không có dòng lỗi mã máy nào để xuất Excel.');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'HTQLBV - XML Checker';
        workbook.created = new Date();

        // Helper tạo Sheet chi tiết các dòng lỗi mã máy với đầy đủ thông tin ngày vào, ngày ra
        const buildDetailWorksheet = (
            wb: ExcelJS.Workbook,
            sheetTitle: string,
            items: MachineAuditItem[],
            headerColorHex: string = 'FF1E3A8A'
        ) => {
            // Excel giới hạn tên sheet tối đa 31 ký tự và cấm các ký tự đặc biệt: \ / ? * [ ] :
            const cleanSheetName = sheetTitle.replace(/[\\/?*\[\]:]/g, '_').substring(0, 31);
            const ws = wb.addWorksheet(cleanSheetName);

            ws.columns = [
                { header: 'STT', key: 'stt', width: 8 },
                { header: 'Mã LK', key: 'maLk', width: 14 },
                { header: 'Mã BN', key: 'maBn', width: 14 },
                { header: 'Họ và tên', key: 'hoTen', width: 22 },
                { header: 'Ngày vào (XML1)', key: 'ngayVao', width: 18 },
                { header: 'Ngày ra (XML1)', key: 'ngayRa', width: 18 },
                { header: 'Ngày Y lệnh', key: 'ngayYl', width: 18 },
                { header: 'Mã dịch vụ', key: 'maDichVu', width: 14 },
                { header: 'Tên dịch vụ kỹ thuật', key: 'tenDichVu', width: 36 },
                { header: 'Mã khoa', key: 'maKhoa', width: 12 },
                { header: 'Tên khoa phòng', key: 'tenKhoa', width: 24 },
                { header: 'Mã máy ở XML', key: 'maMayXml', width: 18 },
                { header: 'Trạng thái vi phạm', key: 'errorLabel', width: 26 },
                { header: 'Mã máy đề xuất (Mẫu 06)', key: 'suggestedMaMay', width: 26 },
                { header: 'Tên thiết bị đề xuất', key: 'suggestedTenTb', width: 32 },
                { header: 'Ký hiệu / Serial (Mẫu 06)', key: 'suggestedKyHieu', width: 24 },
                { header: 'Căn cứ đề xuất', key: 'suggestedReason', width: 32 },
                { header: 'Số lượng', key: 'soLuong', width: 10 },
                { header: 'Đơn giá', key: 'donGia', width: 14 },
                { header: 'Thành tiền', key: 'thanhTien', width: 16 }
            ];

            // Header styling
            const headerRow = ws.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: headerColorHex }
            };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            headerRow.height = 32;

            // Thêm từng dòng dữ liệu (Dữ liệu đã được sắp xếp MA_LK -> MA_BN -> NGAY_YL -> MA_DICH_VU)
            items.forEach((item, idx) => {
                const row = ws.addRow({
                    stt: idx + 1,
                    maLk: item.maLk,
                    maBn: item.maBn,
                    hoTen: item.hoTen,
                    ngayVao: item.ngayVaoFormatted || item.ngayVao,
                    ngayRa: item.ngayRaFormatted || item.ngayRa,
                    ngayYl: item.ngayYlFormatted || item.ngayYl,
                    maDichVu: item.maDichVu,
                    tenDichVu: item.tenDichVu,
                    maKhoa: item.maKhoa,
                    tenKhoa: item.tenKhoa,
                    maMayXml: item.maMayXml || '(Để trống)',
                    errorLabel: item.errorLabel,
                    suggestedMaMay: item.suggestedMaMay || '(Chưa có)',
                    suggestedTenTb: item.suggestedTenTb || '',
                    suggestedKyHieu: item.suggestedKyHieu || '',
                    suggestedReason: item.suggestedReason || '',
                    soLuong: item.soLuong,
                    donGia: item.donGia,
                    thanhTien: item.thanhTien
                });

                // Định dạng alignment
                row.getCell('stt').alignment = { horizontal: 'center' };
                row.getCell('maLk').alignment = { horizontal: 'center' };
                row.getCell('maBn').alignment = { horizontal: 'center' };
                row.getCell('ngayVao').alignment = { horizontal: 'center' };
                row.getCell('ngayRa').alignment = { horizontal: 'center' };
                row.getCell('ngayYl').alignment = { horizontal: 'center' };
                row.getCell('maDichVu').alignment = { horizontal: 'center' };
                row.getCell('maKhoa').alignment = { horizontal: 'center' };
                row.getCell('maMayXml').alignment = { horizontal: 'center' };
                row.getCell('suggestedMaMay').alignment = { horizontal: 'center' };
                row.getCell('soLuong').numFmt = '#,##0.00';
                row.getCell('donGia').numFmt = '#,##0';
                row.getCell('thanhTien').numFmt = '#,##0';

                // Tô màu cảnh báo vi phạm
                if (item.errorType === 'NOT_IN_MAU06') {
                    row.getCell('maMayXml').font = { color: { argb: 'FFDC2626' }, bold: true };
                    row.getCell('errorLabel').fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFEE2E2' } // Light red
                    };
                } else {
                    row.getCell('maMayXml').font = { color: { argb: 'FFD97706' }, italic: true };
                    row.getCell('errorLabel').fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFEF3C7' } // Light yellow
                    };
                }

                // Tô màu xanh cho các dòng có đề xuất mã máy thành công
                if (item.suggestedMaMay) {
                    row.getCell('suggestedMaMay').font = { color: { argb: 'FF047857' }, bold: true };
                    row.getCell('suggestedMaMay').fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFD1FAE5' } // Light green
                    };
                }

                // Border mỏng
                row.eachCell({ includeEmpty: true }, cell => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };
                });
            });
        };

        // -------------------------------------------------------------
        // Sheet 1: Tất cả lỗi mã máy XML3 (kèm thông tin Ngày vào, Ngày ra)
        // -------------------------------------------------------------
        buildDetailWorksheet(workbook, 'Tất cả lỗi mã máy', allAuditItems, 'FF1E3A8A');

        // -------------------------------------------------------------
        // Sheet 2: Tổng hợp lỗi theo Khoa phòng
        // -------------------------------------------------------------
        const wsDept = workbook.addWorksheet('Tổng hợp lỗi theo Khoa');
        wsDept.columns = [
            { header: 'STT', key: 'stt', width: 8 },
            { header: 'Mã Khoa', key: 'maKhoa', width: 14 },
            { header: 'Tên Khoa Phòng', key: 'tenKhoa', width: 28 },
            { header: 'Số hồ sơ lỗi', key: 'hosoCount', width: 16 },
            { header: 'Tổng dòng lỗi XML3', key: 'totalErrors', width: 20 },
            { header: 'Mã máy ngoài Mẫu 06', key: 'notInMau06Count', width: 22 },
            { header: 'Thiếu mã máy bắt buộc', key: 'missingCount', width: 22 },
            { header: 'Số dòng đã đề xuất', key: 'suggestedCount', width: 20 },
            { header: 'Tỷ lệ đề xuất (%)', key: 'rate', width: 18 }
        ];

        const deptHeader = wsDept.getRow(1);
        deptHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        deptHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0284C7' }
        };
        deptHeader.height = 28;

        departmentSummaries.forEach((d, idx) => {
            const rate = d.totalErrors > 0 ? Math.round((d.suggestedCount / d.totalErrors) * 100) : 0;
            const r = wsDept.addRow({
                stt: idx + 1,
                maKhoa: d.maKhoa,
                tenKhoa: d.tenKhoa,
                hosoCount: d.affectedLks.size,
                totalErrors: d.totalErrors,
                notInMau06Count: d.notInMau06Count,
                missingCount: d.missingCount,
                suggestedCount: d.suggestedCount,
                rate: `${rate}%`
            });
            r.alignment = { vertical: 'middle' };
            r.getCell('stt').alignment = { horizontal: 'center' };
            r.getCell('maKhoa').alignment = { horizontal: 'center' };
            r.getCell('hosoCount').alignment = { horizontal: 'right' };
            r.getCell('totalErrors').alignment = { horizontal: 'right' };
            r.getCell('notInMau06Count').alignment = { horizontal: 'right' };
            r.getCell('missingCount').alignment = { horizontal: 'right' };
            r.getCell('suggestedCount').alignment = { horizontal: 'right' };
            r.getCell('rate').alignment = { horizontal: 'center' };

            r.eachCell({ includeEmpty: true }, cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            });
        });

        // -------------------------------------------------------------
        // Sheet 3+: Từng Sheet chi tiết lọc theo NGAY_RA (ngày ra viện BN)
        // -------------------------------------------------------------
        const itemsByNgayRa = new Map<string, MachineAuditItem[]>();
        allAuditItems.forEach(item => {
            const d = item.ngayRaDateOnly || 'Khong_Xac_Dinh';
            if (!itemsByNgayRa.has(d)) {
                itemsByNgayRa.set(d, []);
            }
            itemsByNgayRa.get(d)!.push(item);
        });

        // Sắp xếp ngày ra tăng dần theo trình tự thời gian
        const sortedNgayRaList = Array.from(itemsByNgayRa.keys()).sort((a, b) => {
            const partsA = a.split('-');
            const partsB = b.split('-');
            if (partsA.length === 3 && partsB.length === 3) {
                const da = `${partsA[2]}${partsA[1]}${partsA[0]}`;
                const db = `${partsB[2]}${partsB[1]}${partsB[0]}`;
                return da.localeCompare(db);
            }
            return a.localeCompare(b);
        });

        sortedNgayRaList.forEach(dateStr => {
            const items = itemsByNgayRa.get(dateStr) || [];
            const sheetName = `Ra ${dateStr}`;
            // Header màu xanh Teal trang nhã cho các sheet theo ngày ra viện
            buildDetailWorksheet(workbook, sheetName, items, 'FF0D9488');
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `DoiSoat_MaMay_XML_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
        message.success('Đã xuất file Excel đối soát mã máy thành công!');
    };

    // Columns cho Table
    const columns: ColumnsType<MachineAuditItem> = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 60,
            align: 'center',
            render: (val: number) => <span className="text-slate-500 font-medium">{val}</span>
        },
        {
            title: 'Mã LK / Bệnh nhân',
            key: 'maLk',
            width: 170,
            render: (_: any, r: MachineAuditItem) => (
                <div>
                    <div className="font-semibold text-blue-600 flex items-center gap-1">
                        <span>{r.maLk}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                        Mã BN: <span className="font-medium text-slate-700">{r.maBn}</span>
                    </div>
                    <div className="text-xs text-slate-800 font-medium truncate" title={r.hoTen}>
                        {r.hoTen}
                    </div>
                </div>
            )
        },
        {
            title: 'Thời gian Vào - Ra (XML1)',
            key: 'thoiGianVaoRa',
            width: 160,
            render: (_: any, r: MachineAuditItem) => (
                <div className="text-xs">
                    <div>
                        <span className="text-slate-400">Vào: </span>
                        <span className="text-slate-700 font-mono">{r.ngayVaoFormatted || '--'}</span>
                    </div>
                    <div className="mt-0.5">
                        <span className="text-slate-400">Ra: </span>
                        <span className="text-emerald-700 font-mono font-medium">{r.ngayRaFormatted || '--'}</span>
                    </div>
                </div>
            )
        },
        {
            title: 'Ngày Y lệnh',
            dataIndex: 'ngayYlFormatted',
            key: 'ngayYlFormatted',
            width: 140,
            align: 'center',
            render: (val: string, r: MachineAuditItem) => (
                <span className="text-slate-700 text-xs font-mono">
                    {val || r.ngayYl}
                </span>
            )
        },
        {
            title: 'Dịch vụ kỹ thuật (XML3)',
            key: 'dichVu',
            width: 240,
            render: (_: any, r: MachineAuditItem) => (
                <div>
                    <div className="text-xs font-semibold text-slate-800">{r.tenDichVu}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                        Mã DV: <span className="text-blue-700 font-medium">{r.maDichVu}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                        Khoa: <span className="text-slate-700">{r.tenKhoa || r.maKhoa}</span>
                    </div>
                </div>
            )
        },
        {
            title: 'Mã máy ở XML',
            dataIndex: 'maMayXml',
            key: 'maMayXml',
            width: 150,
            align: 'center',
            render: (val: string, r: MachineAuditItem) => {
                if (!val) {
                    return <Tag color="warning" icon={<WarningOutlined />}>Để trống</Tag>;
                }
                return (
                    <div>
                        <Tag color="error" className="font-mono font-semibold">
                            {val}
                        </Tag>
                        <div className="text-[11px] text-red-500 mt-0.5">Ngoài Mẫu 06</div>
                    </div>
                );
            }
        },
        {
            title: 'Lỗi vi phạm',
            dataIndex: 'errorLabel',
            key: 'errorLabel',
            width: 170,
            render: (val: string, r: MachineAuditItem) => (
                <Tag
                    color={r.errorType === 'NOT_IN_MAU06' ? 'red' : 'orange'}
                    className="font-medium"
                >
                    {val}
                </Tag>
            )
        },
        {
            title: 'Mã máy đề xuất (Mẫu 06)',
            key: 'suggestedMaMay',
            width: 220,
            render: (_: any, r: MachineAuditItem) => {
                if (!r.suggestedMaMay) {
                    return (
                        <span className="text-slate-400 italic text-xs">
                            Chưa tìm thấy máy phù hợp
                        </span>
                    );
                }
                return (
                    <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                        <div className="flex items-center gap-1">
                            <Tag color="success" className="font-mono font-bold text-sm m-0">
                                {r.suggestedMaMay}
                            </Tag>
                        </div>
                        <div className="text-xs text-emerald-800 font-medium mt-1 truncate" title={r.suggestedTenTb}>
                            {r.suggestedTenTb}
                        </div>
                        {r.suggestedKyHieu && (
                            <div className="text-[11px] text-slate-600 mt-0.5">
                                Serial/Model: <span className="font-semibold text-slate-800 font-mono">{r.suggestedKyHieu}</span>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Căn cứ đề xuất',
            dataIndex: 'suggestedReason',
            key: 'suggestedReason',
            width: 200,
            render: (val: string, r: MachineAuditItem) => {
                if (!r.suggestedMaMay) {
                    return <span className="text-slate-400 text-xs">--</span>;
                }
                const isExact = val.includes('chính xác');
                return (
                    <div className="text-xs">
                        <Tag color={isExact ? 'green' : 'cyan'} className="whitespace-normal h-auto py-0.5 mb-1">
                            {val}
                        </Tag>
                    </div>
                );
            }
        }
    ];

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            width={1300}
            style={{ top: 20 }}
            title={
                <div className="flex items-center justify-between pr-8 border-b pb-3">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-600 text-white p-2 rounded-lg flex items-center justify-center">
                            <DesktopOutlined className="text-lg" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-slate-800">
                                Đối soát và Đề xuất Mã máy sai XML3
                            </div>
                            <div className="text-xs text-slate-500 font-normal">
                                Tự động quét và khớp Serial/Model thiết bị với Danh mục Mẫu 06 của bệnh viện
                            </div>
                        </div>
                    </div>
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={fetchCatalogData}
                            loading={loading}
                        >
                            Tải lại Mẫu 06
                        </Button>
                        <Button
                            type="primary"
                            icon={<FileExcelOutlined />}
                            style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                            onClick={handleExportExcel}
                            disabled={allAuditItems.length === 0}
                        >
                            Xuất Excel ({allAuditItems.length} lỗi)
                        </Button>
                    </Space>
                </div>
            }
            footer={
                <div className="flex items-center justify-between py-2 border-t">
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                        <InfoCircleOutlined className="text-blue-500" />
                        <span>
                            Thứ tự sắp xếp file Excel & danh sách: <b className="text-slate-700">Mã LK &rarr; Mã BN &rarr; Ngày Y lệnh &rarr; Mã Dịch vụ</b>
                        </span>
                    </div>
                    <Button onClick={onClose}>Đóng</Button>
                </div>
            }
        >
            <Spin spinning={loading} tip="Đang tải danh mục Mẫu 06 và phân tích dữ liệu...">
                {/* 1. Thống kê KPI Cards */}
                <Row gutter={[16, 16]} className="my-4">
                    <Col xs={24} sm={12} md={6}>
                        <Card size="small" className="border-slate-200 bg-slate-50 shadow-sm">
                            <Statistic
                                title={<span className="text-xs font-semibold text-slate-600">Tổng dòng XML3 đã quét</span>}
                                value={summary.totalXml3Scanned}
                                valueStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                prefix={<ToolOutlined className="text-slate-400 mr-1" />}
                            />
                            <div className="text-[11px] text-slate-500 mt-1">
                                Từ {records.length} hồ sơ tải lên
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Card size="small" className="border-red-200 bg-red-50 shadow-sm">
                            <Statistic
                                title={<span className="text-xs font-semibold text-red-700">Tổng dòng sai mã máy</span>}
                                value={summary.totalErrors}
                                valueStyle={{ color: '#dc2626', fontWeight: 'bold' }}
                                prefix={<CloseCircleOutlined className="text-red-500 mr-1" />}
                            />
                            <div className="text-[11px] text-red-600 mt-1">
                                Ảnh hưởng {summary.totalHosoAffected} hồ sơ ({summary.totalNotInMau06} ngoài Mẫu 06, {summary.totalMissingRequired} thiếu)
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Card size="small" className="border-emerald-200 bg-emerald-50 shadow-sm">
                            <Statistic
                                title={<span className="text-xs font-semibold text-emerald-700">Đã đề xuất mã máy</span>}
                                value={summary.totalWithSuggestions}
                                valueStyle={{ color: '#059669', fontWeight: 'bold' }}
                                prefix={<CheckCircleOutlined className="text-emerald-500 mr-1" />}
                            />
                            <div className="text-[11px] text-emerald-600 mt-1">
                                Tỷ lệ khớp: {summary.totalErrors > 0 ? Math.round((summary.totalWithSuggestions / summary.totalErrors) * 100) : 0}% dòng lỗi
                            </div>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Card size="small" className="border-blue-200 bg-blue-50 shadow-sm">
                            <Statistic
                                title={<span className="text-xs font-semibold text-blue-700">Thiết bị trong Mẫu 06</span>}
                                value={mau06List.length}
                                valueStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                                prefix={<DesktopOutlined className="text-blue-500 mr-1" />}
                            />
                            <div className="text-[11px] text-blue-600 mt-1">
                                {requiredServiceCodes.size} dịch vụ Mẫu 05 yêu cầu mã máy
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* 2. Thanh lọc và tìm kiếm */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 flex flex-wrap items-center justify-between gap-3">
                    <Space wrap>
                        <Select
                            value={filterErrorType}
                            onChange={setFilterErrorType}
                            style={{ width: 230 }}
                            options={[
                                { value: 'ALL', label: `Tất cả lỗi vi phạm (${allAuditItems.length})` },
                                { value: 'NOT_IN_MAU06', label: `Mã máy ngoài Mẫu 06 (${summary.totalNotInMau06})` },
                                { value: 'MISSING_REQUIRED', label: `Thiếu mã máy bắt buộc (${summary.totalMissingRequired})` },
                                { value: 'HAS_SUGGESTION', label: `Đã có đề xuất (${summary.totalWithSuggestions})` },
                                { value: 'NO_SUGGESTION', label: `Chưa có đề xuất (${summary.totalErrors - summary.totalWithSuggestions})` }
                            ]}
                        />

                        <Select
                            value={filterDept}
                            onChange={setFilterDept}
                            placeholder="Lọc theo Khoa"
                            style={{ width: 220 }}
                            showSearch
                            optionFilterProp="label"
                            options={[
                                { value: 'ALL', label: 'Tất cả các Khoa' },
                                ...departmentOptions
                            ]}
                        />

                        <Select
                            value={filterNgayRa}
                            onChange={setFilterNgayRa}
                            placeholder="Lọc theo Ngày ra viện"
                            style={{ width: 220 }}
                            showSearch
                            optionFilterProp="label"
                            options={[
                                { value: 'ALL', label: 'Tất cả Ngày ra viện' },
                                ...ngayRaOptions
                            ]}
                        />

                        <Input
                            placeholder="Tìm Mã LK, BN, Tên DV, Mã máy..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            style={{ width: 280 }}
                            allowClear
                        />
                    </Space>

                    <div className="text-xs text-slate-500 font-medium">
                        Hiển thị <b className="text-blue-600">{filteredItems.length}</b> / <b>{allAuditItems.length}</b> dòng lỗi
                    </div>
                </div>

                {/* 3. Bảng dữ liệu đối soát */}
                <Table
                    columns={columns}
                    dataSource={filteredItems}
                    rowKey={(r) => `${r.maLk}_${r.ngayYl}_${r.maDichVu}_${r.stt}`}
                    size="small"
                    bordered
                    pagination={{
                        pageSize: 15,
                        showSizeChanger: true,
                        pageSizeOptions: ['15', '30', '50', '100'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} dòng vi phạm`
                    }}
                    scroll={{ x: 1360, y: 460 }}
                    locale={{
                        emptyText: allAuditItems.length === 0 ? (
                            <div className="py-8 text-center text-slate-400">
                                <CheckCircleOutlined className="text-3xl text-emerald-500 mb-2" />
                                <div>Tuyệt vời! Không phát hiện dòng dịch vụ XML3 nào bị sai mã máy.</div>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-slate-400">
                                Không tìm thấy dòng lỗi nào phù hợp với bộ lọc hiện tại.
                            </div>
                        )
                    }}
                />
            </Spin>
        </Modal>
    );
}


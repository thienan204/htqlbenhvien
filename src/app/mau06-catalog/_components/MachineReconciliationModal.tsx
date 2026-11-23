'use client';

import React, { useState, useMemo } from 'react';
import {
    Modal, Steps, Card, Row, Col, Upload, Button, Select, Space,
    Table, Tag, Statistic, Input, Alert, Tooltip, message, Typography, Badge, Divider
} from 'antd';
import {
    InboxOutlined, UploadOutlined, FileExcelOutlined, CheckCircleOutlined,
    CloseCircleOutlined, WarningOutlined, SyncOutlined, ArrowLeftOutlined,
    ArrowRightOutlined, InfoCircleOutlined, ExclamationCircleOutlined, SearchOutlined,
    DesktopOutlined, CloudServerOutlined, AppstoreOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

import {
    ColumnMappingConfig,
    MappedMachineItem,
    ReconciliationItem,
    ReconciliationSummary,
    autoDetectColumns,
    extractMappedRows,
    reconcileMachines
} from './machineReconciliationEngine';

const { Text, Title } = Typography;
const { Dragger } = Upload;

interface MachineReconciliationModalProps {
    isOpen: boolean;
    onClose: () => void;
    dbMachines: any[]; // Danh sách Mẫu 06 hiện có trong Database
}

interface ParsedFileData {
    fileName: string;
    sheetNames: string[];
    currentSheet: string;
    headers: string[];
    rawRows: any[];
}

export default function MachineReconciliationModal({
    isOpen,
    onClose,
    dbMachines
}: MachineReconciliationModalProps) {
    const [currentStep, setCurrentStep] = useState<number>(0);

    // Dữ liệu File 1: Cổng
    const [portalFile, setPortalFile] = useState<ParsedFileData | null>(null);
    const [portalMapping, setPortalMapping] = useState<ColumnMappingConfig>({
        maMayCol: '',
        tenTbCol: '',
        kyHieuCol: '',
        khoaCol: ''
    });

    // Dữ liệu File 2: HIS
    const [hisFile, setHisFile] = useState<ParsedFileData | null>(null);
    const [hisMapping, setHisMapping] = useState<ColumnMappingConfig>({
        maMayCol: '',
        tenTbCol: '',
        kyHieuCol: '',
        khoaCol: ''
    });

    // Kết quả đối soát
    const [reconciliationResult, setReconciliationResult] = useState<{
        items: ReconciliationItem[];
        summary: ReconciliationSummary;
    } | null>(null);

    // Bộ lọc trên bảng kết quả
    const [filterStatus, setFilterStatus] = useState<string>('ALL');
    const [searchText, setSearchText] = useState<string>('');

    // Đọc file Excel client-side bằng SheetJS
    const handleParseExcelFile = (file: File, type: 'PORTAL' | 'HIS') => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

                if (rawRows.length === 0) {
                    message.error(`File ${file.name} không có dữ liệu!`);
                    return;
                }

                const headers = Object.keys(rawRows[0] || {});
                const autoMap = autoDetectColumns(headers);

                const parsedData: ParsedFileData = {
                    fileName: file.name,
                    sheetNames: workbook.SheetNames,
                    currentSheet: firstSheetName,
                    headers,
                    rawRows
                };

                if (type === 'PORTAL') {
                    setPortalFile(parsedData);
                    setPortalMapping(autoMap);
                    message.success(`Đã nạp file Cổng: ${file.name} (${rawRows.length} dòng)`);
                } else {
                    setHisFile(parsedData);
                    setHisMapping(autoMap);
                    message.success(`Đã nạp file HIS: ${file.name} (${rawRows.length} dòng)`);
                }
            } catch (error) {
                console.error('Lỗi đọc file Excel:', error);
                message.error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng .xlsx / .xls');
            }
        };
        reader.readAsArrayBuffer(file);
        return false; // Ngăn upload lên server
    };

    // Tiến hành đối soát
    const handleRunReconciliation = () => {
        if (!portalFile || !hisFile) {
            message.warning('Vui lòng tải lên cả 2 file Excel (File Cổng và File HIS)!');
            return;
        }

        if (!portalMapping.maMayCol) {
            message.error('Vui lòng chọn cột "Mã máy" cho File Cổng!');
            return;
        }

        if (!hisMapping.maMayCol) {
            message.error('Vui lòng chọn cột "Mã máy" cho File HIS!');
            return;
        }

        // Trích xuất dữ liệu sau khi map
        const portalItems = extractMappedRows(portalFile.rawRows, portalMapping, 'PORTAL');
        const hisItems = extractMappedRows(hisFile.rawRows, hisMapping, 'HIS');

        const result = reconcileMachines(dbMachines, portalItems, hisItems);
        setReconciliationResult(result);
        setCurrentStep(2); // Chuyển sang bước kết quả
        message.success(`Đối soát thành công! Tổng cộng ${result.items.length} thiết bị được phân tích.`);
    };

    // Reset lại từ đầu
    const handleResetAll = () => {
        setCurrentStep(0);
        setPortalFile(null);
        setHisFile(null);
        setReconciliationResult(null);
        setFilterStatus('ALL');
        setSearchText('');
    };

    // Lọc dữ liệu kết quả hiển thị
    const filteredItems = useMemo(() => {
        if (!reconciliationResult) return [];
        return reconciliationResult.items.filter(item => {
            // Lọc theo trạng thái
            if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;

            // Tìm kiếm
            if (searchText.trim()) {
                const s = searchText.toLowerCase().trim();
                const matchCode = item.id.toLowerCase().includes(s);
                const matchPortal = item.portalItem && (
                    item.portalItem.maMay.toLowerCase().includes(s) ||
                    item.portalItem.tenTb.toLowerCase().includes(s) ||
                    item.portalItem.kyHieu.toLowerCase().includes(s)
                );
                const matchHis = item.hisItem && (
                    item.hisItem.maMay.toLowerCase().includes(s) ||
                    item.hisItem.tenTb.toLowerCase().includes(s) ||
                    item.hisItem.kyHieu.toLowerCase().includes(s)
                );
                const matchDb = item.dbItem && (
                    item.dbItem.maMay.toLowerCase().includes(s) ||
                    item.dbItem.tenTb.toLowerCase().includes(s) ||
                    item.dbItem.kyHieu.toLowerCase().includes(s)
                );
                if (!matchCode && !matchPortal && !matchHis && !matchDb) return false;
            }

            return true;
        });
    }, [reconciliationResult, filterStatus, searchText]);

    // XUẤT EXCEL BÁO CÁO ĐỐI SOÁT 3 NGUỒN CHUYÊN NGHIỆP
    const handleExportExcelReport = async () => {
        if (!reconciliationResult || reconciliationResult.items.length === 0) {
            message.warning('Không có dữ liệu đối soát để xuất Excel!');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'BVĐK Lạng Sơn - Đối soát Mẫu 06';
        workbook.created = new Date();

        // ---------------------------------------------------------------------
        // Sheet 1: Tổng hợp kết quả đối soát
        // ---------------------------------------------------------------------
        const wsSummary = workbook.addWorksheet('Tổng hợp Đối soát');
        wsSummary.columns = [
            { header: 'STT', key: 'stt', width: 8 },
            { header: 'Phân loại kết quả đối soát', key: 'label', width: 38 },
            { header: 'Số lượng máy', key: 'count', width: 16 },
            { header: 'Tỷ lệ (%)', key: 'rate', width: 14 },
            { header: 'Mức độ cảnh báo', key: 'level', width: 22 },
            { header: 'Hướng dẫn xử lý nghiệp vụ', key: 'action', width: 55 }
        ];

        wsSummary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        wsSummary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        wsSummary.getRow(1).height = 28;

        const summaryRows = [
            { label: 'Khớp hoàn toàn cả 3 nguồn (DB, Cổng, HIS)', count: reconciliationResult.summary.matchAllCount, level: 'Hợp lệ (Khớp)', action: 'Dữ liệu chuẩn hóa, sẵn sàng gửi giám định BHYT.' },
            { label: 'Cùng Serial nhưng KHÁC MÃ MÁY trên HIS', count: reconciliationResult.summary.sameSerialDiffCodeCount, level: 'SAI MÃ MÁY (Nguy hiểm)', action: 'Cần sửa lại Mã máy trên phần mềm HIS theo Mã chuẩn trên Cổng.' },
            { label: 'Chỉ có trên HIS (THIẾU TRÊN CỔNG)', count: reconciliationResult.summary.onlyHisCount, level: 'XUẤT TOÁN 100% (Khẩn cấp)', action: 'Máy chưa được duyệt trên Cổng. Cần dừng chỉ định hoặc khai báo bổ sung Cổng ngay!' },
            { label: 'Có trên Cổng & DB (THIẾU TRÊN HIS)', count: reconciliationResult.summary.dbAndPortalNoHisCount, level: 'Thiếu cấu hình HIS', action: 'Bổ sung mã máy đã duyệt trên Cổng vào danh mục HIS để bác sĩ kê đơn/chỉ định.' },
            { label: 'Có trên HIS & DB (THIẾU TRÊN CỔNG)', count: reconciliationResult.summary.dbAndHisNoPortalCount, level: 'XUẤT TOÁN 100% (Khẩn cấp)', action: 'Cần lập hồ sơ đề nghị cấp mã máy Mẫu 06 lên Cổng BYT/BHXH.' },
            { label: 'Khớp mã nhưng LỆCH THÔNG TIN chi tiết', count: reconciliationResult.summary.diffInfoCount, level: 'Cần chuẩn hóa', action: 'Thống nhất lại Tên thiết bị, Khoa phòng hoặc Model theo đúng Cổng.' },
            { label: 'Chỉ có trên Cổng (Chưa có trong HIS & DB)', count: reconciliationResult.summary.onlyPortalCount, level: 'Chưa dùng ở viện', action: 'Xem xét bổ sung vào HIS nếu bệnh viện đưa máy vào hoạt động.' },
            { label: 'Chỉ có trong Database (Không có Cổng & HIS)', count: reconciliationResult.summary.onlyDbCount, level: 'Lịch sử / Đã hủy', action: 'Thiết bị cũ hoặc đã thanh lý ngừng sử dụng.' }
        ];

        const totalUnique = reconciliationResult.summary.totalUniqueRecords || 1;
        summaryRows.forEach((r, idx) => {
            const row = wsSummary.addRow({
                stt: idx + 1,
                label: r.label,
                count: r.count,
                rate: `${Math.round((r.count / totalUnique) * 100)}%`,
                level: r.level,
                action: r.action
            });
            row.alignment = { vertical: 'middle' };
            row.getCell('stt').alignment = { horizontal: 'center' };
            row.getCell('count').alignment = { horizontal: 'right' };
            row.getCell('rate').alignment = { horizontal: 'center' };
        });

        // ---------------------------------------------------------------------
        // Sheet 2: Chi tiết đối soát 3 nguồn (DB - Cổng - HIS)
        // ---------------------------------------------------------------------
        const wsDetail = workbook.addWorksheet('Chi tiết Đối soát 3 Nguồn');
        wsDetail.columns = [
            { header: 'STT', key: 'stt', width: 8 },
            { header: 'Trạng thái đối soát', key: 'statusLabel', width: 28 },
            { header: 'Gợi ý xử lý nghiệp vụ', key: 'actionSuggestion', width: 45 },
            // Cổng
            { header: '[CỔNG] Mã máy', key: 'portalMaMay', width: 20 },
            { header: '[CỔNG] Tên thiết bị', key: 'portalTenTb', width: 32 },
            { header: '[CỔNG] Model / Serial', key: 'portalKyHieu', width: 22 },
            { header: '[CỔNG] Khoa phòng', key: 'portalKhoa', width: 20 },
            // HIS
            { header: '[HIS] Mã máy', key: 'hisMaMay', width: 20 },
            { header: '[HIS] Tên thiết bị', key: 'hisTenTb', width: 32 },
            { header: '[HIS] Model / Serial', key: 'hisKyHieu', width: 22 },
            { header: '[HIS] Khoa phòng', key: 'hisKhoa', width: 20 },
            // DB
            { header: '[DB] Mã máy', key: 'dbMaMay', width: 20 },
            { header: '[DB] Tên thiết bị', key: 'dbTenTb', width: 32 },
            { header: '[DB] Model / Serial', key: 'dbKyHieu', width: 22 },
            { header: '[DB] Khoa phòng', key: 'dbKhoa', width: 20 }
        ];

        const headerRow2 = wsDetail.getRow(1);
        headerRow2.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        headerRow2.height = 30;

        reconciliationResult.items.forEach((item, idx) => {
            const row = wsDetail.addRow({
                stt: idx + 1,
                statusLabel: item.statusLabel,
                actionSuggestion: item.actionSuggestion,
                portalMaMay: item.portalItem?.maMay || '(Không có)',
                portalTenTb: item.portalItem?.tenTb || '',
                portalKyHieu: item.portalItem?.kyHieu || '',
                portalKhoa: item.portalItem?.khoa || '',
                hisMaMay: item.hisItem?.maMay || '(Không có)',
                hisTenTb: item.hisItem?.tenTb || '',
                hisKyHieu: item.hisItem?.kyHieu || '',
                hisKhoa: item.hisItem?.khoa || '',
                dbMaMay: item.dbItem?.maMay || '(Không có)',
                dbTenTb: item.dbItem?.tenTb || '',
                dbKyHieu: item.dbItem?.kyHieu || '',
                dbKhoa: item.dbItem?.khoa || ''
            });

            // Tô màu theo mức độ cảnh báo
            if (item.severity === 'error') {
                row.getCell('statusLabel').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                row.getCell('statusLabel').font = { color: { argb: 'FFDC2626' }, bold: true };
            } else if (item.severity === 'warning') {
                row.getCell('statusLabel').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                row.getCell('statusLabel').font = { color: { argb: 'FFD97706' }, bold: true };
            } else if (item.severity === 'success') {
                row.getCell('statusLabel').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                row.getCell('statusLabel').font = { color: { argb: 'FF059669' }, bold: true };
            }

            row.eachCell({ includeEmpty: true }, cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        });

        // ---------------------------------------------------------------------
        // Sheet 3: Danh sách máy CẦN XỬ LÝ GẤP (Thiếu Cổng hoặc Sai mã máy)
        // ---------------------------------------------------------------------
        const urgentItems = reconciliationResult.items.filter(i =>
            i.status === 'ONLY_HIS' || i.status === 'DB_AND_HIS_NO_PORTAL' || i.status === 'SAME_SERIAL_DIFF_CODE'
        );

        if (urgentItems.length > 0) {
            const wsUrgent = workbook.addWorksheet('CẦN XỬ LÝ GẤP (Nguy cơ xuất toán)');
            wsUrgent.columns = [
                { header: 'STT', key: 'stt', width: 8 },
                { header: 'Mức độ cảnh báo', key: 'statusLabel', width: 30 },
                { header: '[HIS] Mã máy kê khai', key: 'hisMaMay', width: 22 },
                { header: '[HIS] Tên thiết bị', key: 'hisTenTb', width: 35 },
                { header: '[HIS] Model/Serial', key: 'hisKyHieu', width: 24 },
                { header: '[HIS] Khoa phòng', key: 'hisKhoa', width: 20 },
                { header: '[CỔNG] Mã máy chuẩn (nếu có)', key: 'portalMaMay', width: 25 },
                { header: 'Hành động cần làm ngay', key: 'actionSuggestion', width: 50 }
            ];

            const headerRow3 = wsUrgent.getRow(1);
            headerRow3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
            headerRow3.height = 30;

            urgentItems.forEach((item, idx) => {
                const r = wsUrgent.addRow({
                    stt: idx + 1,
                    statusLabel: item.statusLabel,
                    hisMaMay: item.hisItem?.maMay || '',
                    hisTenTb: item.hisItem?.tenTb || '',
                    hisKyHieu: item.hisItem?.kyHieu || '',
                    hisKhoa: item.hisItem?.khoa || '',
                    portalMaMay: item.portalItem?.maMay || '(Chưa có trên Cổng)',
                    actionSuggestion: item.actionSuggestion
                });
                r.getCell('hisMaMay').font = { color: { argb: 'FFDC2626' }, bold: true };
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `DoiSoat_Mau06_Cong_HIS_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`);
        message.success('Đã xuất file Excel báo cáo đối soát thành công!');
    };

    // Columns cho Table kết quả ở Bước 3
    const columns: ColumnsType<ReconciliationItem> = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 55,
            align: 'center',
            render: (val: number) => <span className="text-slate-500 font-medium">{val}</span>
        },
        {
            title: 'Trạng thái đối soát',
            key: 'status',
            width: 190,
            render: (_: any, r: ReconciliationItem) => (
                <div>
                    <Tag
                        color={
                            r.severity === 'success' ? 'green' :
                            r.severity === 'error' ? 'red' :
                            r.severity === 'warning' ? 'gold' : 'blue'
                        }
                        className="font-medium whitespace-normal mb-1"
                    >
                        {r.statusLabel}
                    </Tag>
                    <div className="text-[11px] text-slate-500 italic">
                        {r.actionSuggestion}
                    </div>
                </div>
            )
        },
        {
            title: 'File Cổng (BHXH/BYT)',
            key: 'portal',
            width: 250,
            render: (_: any, r: ReconciliationItem) => {
                if (!r.portalItem) {
                    return <Tag color="default" className="text-slate-400">Không có trên Cổng</Tag>;
                }
                return (
                    <div className="bg-blue-50/50 p-2 rounded border border-blue-100 text-xs">
                        <div className="font-mono font-bold text-blue-700">
                            {r.portalItem.maMay}
                        </div>
                        <div className="text-slate-800 font-medium truncate mt-0.5" title={r.portalItem.tenTb}>
                            {r.portalItem.tenTb}
                        </div>
                        {r.portalItem.kyHieu && (
                            <div className="text-[11px] text-slate-600">
                                Serial: <b className="font-mono">{r.portalItem.kyHieu}</b>
                            </div>
                        )}
                        {r.portalItem.khoa && (
                            <div className="text-[11px] text-slate-500 truncate">
                                Khoa: {r.portalItem.khoa}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'File HIS (Bệnh viện)',
            key: 'his',
            width: 250,
            render: (_: any, r: ReconciliationItem) => {
                if (!r.hisItem) {
                    return <Tag color="default" className="text-slate-400">Không có trên HIS</Tag>;
                }
                const isDiffCode = r.status === 'SAME_SERIAL_DIFF_CODE';
                return (
                    <div className={`p-2 rounded border text-xs ${isDiffCode ? 'bg-red-50 border-red-200' : 'bg-emerald-50/50 border-emerald-100'}`}>
                        <div className={`font-mono font-bold ${isDiffCode ? 'text-red-600' : 'text-emerald-700'}`}>
                            {r.hisItem.maMay}
                        </div>
                        <div className="text-slate-800 font-medium truncate mt-0.5" title={r.hisItem.tenTb}>
                            {r.hisItem.tenTb}
                        </div>
                        {r.hisItem.kyHieu && (
                            <div className="text-[11px] text-slate-600">
                                Serial: <b className="font-mono">{r.hisItem.kyHieu}</b>
                            </div>
                        )}
                        {r.hisItem.khoa && (
                            <div className="text-[11px] text-slate-500 truncate">
                                Khoa: {r.hisItem.khoa}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Database Nội bộ',
            key: 'db',
            width: 240,
            render: (_: any, r: ReconciliationItem) => {
                if (!r.dbItem) {
                    return <Tag color="default" className="text-slate-400">Chưa có trong DB</Tag>;
                }
                return (
                    <div className="bg-slate-50 p-2 rounded border border-slate-200 text-xs">
                        <div className="font-mono font-bold text-slate-800">
                            {r.dbItem.maMay}
                        </div>
                        <div className="text-slate-700 truncate mt-0.5" title={r.dbItem.tenTb}>
                            {r.dbItem.tenTb}
                        </div>
                        {r.dbItem.kyHieu && (
                            <div className="text-[11px] text-slate-500">
                                Serial: <b className="font-mono">{r.dbItem.kyHieu}</b>
                            </div>
                        )}
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
            style={{ top: 15 }}
            title={
                <div className="flex items-center justify-between pr-8 border-b pb-3">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 text-white p-2 rounded-lg flex items-center justify-center">
                            <CloudServerOutlined className="text-lg" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-slate-800">
                                Đối soát Danh mục Mẫu 06 (Cổng BHXH vs Phần mềm HIS vs Database)
                            </div>
                            <div className="text-xs text-slate-500 font-normal">
                                Tự động so khớp 3 chiều, phát hiện mã máy thiếu trên Cổng hoặc sai lệch giữa các hệ thống
                            </div>
                        </div>
                    </div>
                    {currentStep === 2 && (
                        <Space>
                            <Button icon={<ArrowLeftOutlined />} onClick={() => setCurrentStep(1)}>
                                Cấu hình lại cột
                            </Button>
                            <Button
                                type="primary"
                                icon={<FileExcelOutlined />}
                                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                                onClick={handleExportExcelReport}
                            >
                                Xuất Excel Đối soát
                            </Button>
                        </Space>
                    )}
                </div>
            }
            footer={null}
        >
            <div className="py-2">
                {/* Steps Navigation */}
                <Steps
                    current={currentStep}
                    onChange={step => {
                        if (step === 2 && !reconciliationResult) {
                            message.info('Vui lòng hoàn tất bước ánh xạ cột và bấm "Bắt đầu đối soát"!');
                            return;
                        }
                        setCurrentStep(step);
                    }}
                    items={[
                        { title: 'Tải 2 file Excel', description: 'Cổng & HIS' },
                        { title: 'Chọn cột để Map', description: 'Mã máy, Tên, Serial' },
                        { title: 'Kết quả Đối soát', description: 'So khớp 3 chiều' }
                    ]}
                    className="mb-6 max-w-3xl mx-auto"
                />

                {/* ========================================================================= */}
                {/* BƯỚC 1: TẢI LÊN 2 FILE EXCEL                                              */}
                {/* ========================================================================= */}
                {currentStep === 0 && (
                    <div className="space-y-6 max-w-5xl mx-auto py-4">
                        <Alert
                            type="info"
                            showIcon
                            icon={<InfoCircleOutlined />}
                            message="Hướng dẫn chuẩn bị dữ liệu đối soát"
                            description="Vui lòng tải lên đồng thời 2 file Excel: (1) File Danh mục thiết bị Mẫu 06 kết xuất từ Cổng Giám định BHYT / Cổng BYT, và (2) File Danh mục thiết bị xuất từ phần mềm HIS của bệnh viện. Hệ thống sẽ đối chiếu chéo 2 file này với Danh mục Mẫu 06 đang có trong Database."
                        />

                        <Row gutter={24}>
                            {/* File 1: Cổng */}
                            <Col span={12}>
                                <Card
                                    title={
                                        <div className="flex items-center gap-2 text-blue-700">
                                            <CloudServerOutlined />
                                            <span className="font-bold">1. File Excel Mẫu 06 từ CỔNG (BHXH / BYT)</span>
                                        </div>
                                    }
                                    className={`border-2 ${portalFile ? 'border-blue-400 bg-blue-50/20' : 'border-dashed border-slate-300'}`}
                                >
                                    <Dragger
                                        accept=".xlsx, .xls"
                                        beforeUpload={(file) => handleParseExcelFile(file, 'PORTAL')}
                                        showUploadList={false}
                                        className="py-4"
                                    >
                                        <p className="ant-upload-drag-icon text-blue-500">
                                            <FileExcelOutlined style={{ fontSize: 42 }} />
                                        </p>
                                        <p className="ant-upload-text font-semibold text-slate-700">
                                            {portalFile ? portalFile.fileName : 'Kéo thả hoặc click để chọn File Cổng'}
                                        </p>
                                        <p className="ant-upload-hint text-xs text-slate-500">
                                            Hỗ trợ định dạng .xlsx, .xls
                                        </p>
                                    </Dragger>

                                    {portalFile && (
                                        <div className="mt-4 p-3 bg-white rounded border border-blue-100 flex items-center justify-between text-xs">
                                            <div>
                                                <span className="text-slate-500">Đã nạp: </span>
                                                <b className="text-blue-700">{portalFile.rawRows.length} dòng</b> |{' '}
                                                <span className="text-slate-500">Sheet: </span>
                                                <b>{portalFile.currentSheet}</b>
                                            </div>
                                            <Tag color="success" icon={<CheckCircleOutlined />}>Sẵn sàng</Tag>
                                        </div>
                                    )}
                                </Card>
                            </Col>

                            {/* File 2: HIS */}
                            <Col span={12}>
                                <Card
                                    title={
                                        <div className="flex items-center gap-2 text-emerald-700">
                                            <AppstoreOutlined />
                                            <span className="font-bold">2. File Excel Danh mục máy từ phần mềm HIS</span>
                                        </div>
                                    }
                                    className={`border-2 ${hisFile ? 'border-emerald-400 bg-emerald-50/20' : 'border-dashed border-slate-300'}`}
                                >
                                    <Dragger
                                        accept=".xlsx, .xls"
                                        beforeUpload={(file) => handleParseExcelFile(file, 'HIS')}
                                        showUploadList={false}
                                        className="py-4"
                                    >
                                        <p className="ant-upload-drag-icon text-emerald-500">
                                            <FileExcelOutlined style={{ fontSize: 42 }} />
                                        </p>
                                        <p className="ant-upload-text font-semibold text-slate-700">
                                            {hisFile ? hisFile.fileName : 'Kéo thả hoặc click để chọn File HIS'}
                                        </p>
                                        <p className="ant-upload-hint text-xs text-slate-500">
                                            Hỗ trợ định dạng .xlsx, .xls
                                        </p>
                                    </Dragger>

                                    {hisFile && (
                                        <div className="mt-4 p-3 bg-white rounded border border-emerald-100 flex items-center justify-between text-xs">
                                            <div>
                                                <span className="text-slate-500">Đã nạp: </span>
                                                <b className="text-emerald-700">{hisFile.rawRows.length} dòng</b> |{' '}
                                                <span className="text-slate-500">Sheet: </span>
                                                <b>{hisFile.currentSheet}</b>
                                            </div>
                                            <Tag color="success" icon={<CheckCircleOutlined />}>Sẵn sàng</Tag>
                                        </div>
                                    )}
                                </Card>
                            </Col>
                        </Row>

                        <div className="flex justify-end pt-4 border-t">
                            <Button
                                type="primary"
                                size="large"
                                icon={<ArrowRightOutlined />}
                                disabled={!portalFile || !hisFile}
                                onClick={() => setCurrentStep(1)}
                            >
                                Tiếp tục: Cấu hình Map Cột
                            </Button>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* BƯỚC 2: CẤU HÌNH ÁNH XẠ CỘT (COLUMN MAPPING)                              */}
                {/* ========================================================================= */}
                {currentStep === 1 && (
                    <div className="space-y-6 max-w-5xl mx-auto py-2">
                        <Alert
                            type="info"
                            showIcon
                            message="Tự động nhận diện cột thông minh"
                            description="Hệ thống đã tự động phân tích và chọn trước các cột phù hợp từ file Excel. Bạn có thể thay đổi lại nếu tên cột trong file khác với dự đoán."
                        />

                        <Row gutter={24}>
                            {/* Mapping File Cổng */}
                            <Col span={12}>
                                <Card
                                    size="small"
                                    title={<span className="font-bold text-blue-700">Ánh xạ cột File CỔNG ({portalFile?.fileName})</span>}
                                    className="border-blue-200"
                                >
                                    <div className="space-y-3 py-2 text-xs">
                                        <div>
                                            <div className="font-semibold text-slate-700 mb-1">
                                                Cột Mã máy (MA_MAY) <span className="text-red-500">* Bắt buộc</span>:
                                            </div>
                                            <Select
                                                value={portalMapping.maMayCol || undefined}
                                                onChange={v => setPortalMapping(prev => ({ ...prev, maMayCol: v }))}
                                                placeholder="-- Chọn cột Mã máy --"
                                                className="w-full"
                                                showSearch
                                                options={portalFile?.headers.map(h => ({ value: h, label: h }))}
                                            />
                                        </div>

                                        <div>
                                            <div className="font-semibold text-slate-700 mb-1">
                                                Cột Tên thiết bị (TEN_TB):
                                            </div>
                                            <Select
                                                value={portalMapping.tenTbCol || undefined}
                                                onChange={v => setPortalMapping(prev => ({ ...prev, tenTbCol: v }))}
                                                placeholder="-- Chọn cột Tên thiết bị --"
                                                className="w-full"
                                                allowClear
                                                showSearch
                                                options={portalFile?.headers.map(h => ({ value: h, label: h }))}
                                            />
                                        </div>

                                        <div>
                                            <div className="font-semibold text-slate-700 mb-1">
                                                Cột Model / Ký hiệu / Serial (KY_HIEU):
                                            </div>
                                            <Select
                                                value={portalMapping.kyHieuCol || undefined}
                                                onChange={v => setPortalMapping(prev => ({ ...prev, kyHieuCol: v }))}
                                                placeholder="-- Chọn cột Model / Ký hiệu / Serial --"
                                                className="w-full"
                                                allowClear
                                                showSearch
                                                options={portalFile?.headers.map(h => ({ value: h, label: h }))}
                                            />
                                        </div>

                                        <div>
                                            <div className="font-semibold text-slate-700 mb-1">
                                                Cột Khoa phòng sử dụng:
                                            </div>
                                            <Select
                                                value={portalMapping.khoaCol || undefined}
                                                onChange={v => setPortalMapping(prev => ({ ...prev, khoaCol: v }))}
                                                placeholder="-- Chọn cột Khoa phòng (nếu có) --"
                                                className="w-full"
                                                allowClear
                                                showSearch
                                                options={portalFile?.headers.map(h => ({ value: h, label: h }))}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            </Col>

                            {/* Mapping File HIS */}
                            <Col span={12}>
                                <Card
                                    size="small"
                                    title={<span className="font-bold text-emerald-700">Ánh xạ cột File HIS ({hisFile?.fileName})</span>}
                                    className="border-emerald-200"
                                >
                                    <div className="space-y-3 py-2 text-xs">
                                        <div>
                                            <div className="font-semibold text-slate-700 mb-1">
                                                Cột Mã máy (MA_MAY) <span className="text-red-500">* Bắt buộc</span>:
                                            </div>
                                            <Select
                                                value={hisMapping.maMayCol || undefined}
                                                onChange={v => setHisMapping(prev => ({ ...prev, maMayCol: v }))}
                                                placeholder="-- Chọn cột Mã máy HIS --"
                                                className="w-full"
                                                showSearch
                                                options={hisFile?.headers.map(h => ({ value: h, label: h }))}
                                            />
                                        </div>

                                        <div>
                                            <div className="font-semibold text-slate-700 mb-1">
                                                Cột Tên thiết bị (TEN_TB):
                                            </div>
                                            <Select
                                                value={hisMapping.tenTbCol || undefined}
                                                onChange={v => setHisMapping(prev => ({ ...prev, tenTbCol: v }))}
                                                placeholder="-- Chọn cột Tên thiết bị HIS --"
                                                className="w-full"
                                                allowClear
                                                showSearch
                                                options={hisFile?.headers.map(h => ({ value: h, label: h }))}
                                            />
                                        </div>

                                        <div>
                                            <div className="font-semibold text-slate-700 mb-1">
                                                Cột Model / Ký hiệu / Serial (KY_HIEU):
                                            </div>
                                            <Select
                                                value={hisMapping.kyHieuCol || undefined}
                                                onChange={v => setHisMapping(prev => ({ ...prev, kyHieuCol: v }))}
                                                placeholder="-- Chọn cột Model / Ký hiệu / Serial --"
                                                className="w-full"
                                                allowClear
                                                showSearch
                                                options={hisFile?.headers.map(h => ({ value: h, label: h }))}
                                            />
                                        </div>

                                        <div>
                                            <div className="font-semibold text-slate-700 mb-1">
                                                Cột Khoa phòng sử dụng:
                                            </div>
                                            <Select
                                                value={hisMapping.khoaCol || undefined}
                                                onChange={v => setHisMapping(prev => ({ ...prev, khoaCol: v }))}
                                                placeholder="-- Chọn cột Khoa phòng HIS --"
                                                className="w-full"
                                                allowClear
                                                showSearch
                                                options={hisFile?.headers.map(h => ({ value: h, label: h }))}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        </Row>

                        <div className="flex justify-between items-center pt-4 border-t">
                            <Button icon={<ArrowLeftOutlined />} onClick={() => setCurrentStep(0)}>
                                Quay lại Bước 1
                            </Button>
                            <Button
                                type="primary"
                                size="large"
                                icon={<SyncOutlined />}
                                style={{ backgroundColor: '#4f46e5', borderColor: '#4f46e5' }}
                                disabled={!portalMapping.maMayCol || !hisMapping.maMayCol}
                                onClick={handleRunReconciliation}
                            >
                                Bắt đầu Đối soát 3 Nguồn
                            </Button>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* BƯỚC 3: KẾT QUẢ ĐỐI SOÁT & XUẤT EXCEL                                     */}
                {/* ========================================================================= */}
                {currentStep === 2 && reconciliationResult && (
                    <div className="space-y-4">
                        {/* Thống kê KPI */}
                        <Row gutter={[12, 12]}>
                            <Col span={4}>
                                <Card size="small" className="bg-slate-50 border-slate-200">
                                    <Statistic
                                        title={<span className="text-xs text-slate-600">Tổng máy Cổng</span>}
                                        value={reconciliationResult.summary.totalPortal}
                                        valueStyle={{ color: '#1e40af', fontWeight: 'bold' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={4}>
                                <Card size="small" className="bg-slate-50 border-slate-200">
                                    <Statistic
                                        title={<span className="text-xs text-slate-600">Tổng máy HIS</span>}
                                        value={reconciliationResult.summary.totalHis}
                                        valueStyle={{ color: '#047857', fontWeight: 'bold' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={4}>
                                <Card size="small" className="bg-emerald-50 border-emerald-200">
                                    <Statistic
                                        title={<span className="text-xs text-emerald-700">Khớp 3/3 nguồn</span>}
                                        value={reconciliationResult.summary.matchAllCount}
                                        valueStyle={{ color: '#059669', fontWeight: 'bold' }}
                                        prefix={<CheckCircleOutlined className="text-emerald-500 mr-1" />}
                                    />
                                </Card>
                            </Col>
                            <Col span={4}>
                                <Card size="small" className="bg-red-50 border-red-200">
                                    <Statistic
                                        title={<span className="text-xs text-red-700">Thiếu trên Cổng</span>}
                                        value={reconciliationResult.summary.onlyHisCount + reconciliationResult.summary.dbAndHisNoPortalCount}
                                        valueStyle={{ color: '#dc2626', fontWeight: 'bold' }}
                                        prefix={<CloseCircleOutlined className="text-red-500 mr-1" />}
                                    />
                                </Card>
                            </Col>
                            <Col span={4}>
                                <Card size="small" className="bg-amber-50 border-amber-200">
                                    <Statistic
                                        title={<span className="text-xs text-amber-700">Thiếu trên HIS</span>}
                                        value={reconciliationResult.summary.onlyPortalCount + reconciliationResult.summary.dbAndPortalNoHisCount}
                                        valueStyle={{ color: '#d97706', fontWeight: 'bold' }}
                                        prefix={<WarningOutlined className="text-amber-500 mr-1" />}
                                    />
                                </Card>
                            </Col>
                            <Col span={4}>
                                <Card size="small" className="bg-purple-50 border-purple-200">
                                    <Statistic
                                        title={<span className="text-xs text-purple-700">Cùng Serial khác Mã</span>}
                                        value={reconciliationResult.summary.sameSerialDiffCodeCount}
                                        valueStyle={{ color: '#7c3aed', fontWeight: 'bold' }}
                                        prefix={<ExclamationCircleOutlined className="text-purple-500 mr-1" />}
                                    />
                                </Card>
                            </Col>
                        </Row>

                        {/* Thanh lọc & Tìm kiếm */}
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                            <Space wrap>
                                <Select
                                    value={filterStatus}
                                    onChange={setFilterStatus}
                                    style={{ width: 280 }}
                                    options={[
                                        { value: 'ALL', label: `Tất cả kết quả (${reconciliationResult.items.length})` },
                                        { value: 'MATCH_ALL', label: `Khớp hoàn toàn 3 nguồn (${reconciliationResult.summary.matchAllCount})` },
                                        { value: 'SAME_SERIAL_DIFF_CODE', label: `Cùng Serial khác Mã máy (${reconciliationResult.summary.sameSerialDiffCodeCount})` },
                                        { value: 'ONLY_HIS', label: `Chỉ có trên HIS (Thiếu Cổng) (${reconciliationResult.summary.onlyHisCount})` },
                                        { value: 'DB_AND_HIS_NO_PORTAL', label: `Có DB & HIS (Thiếu Cổng) (${reconciliationResult.summary.dbAndHisNoPortalCount})` },
                                        { value: 'DB_AND_PORTAL_NO_HIS', label: `Có Cổng & DB (Thiếu HIS) (${reconciliationResult.summary.dbAndPortalNoHisCount})` },
                                        { value: 'DIFF_INFO', label: `Lệch thông tin chi tiết (${reconciliationResult.summary.diffInfoCount})` },
                                        { value: 'ONLY_PORTAL', label: `Chỉ có trên Cổng (${reconciliationResult.summary.onlyPortalCount})` },
                                        { value: 'ONLY_DB', label: `Chỉ có trong DB (${reconciliationResult.summary.onlyDbCount})` }
                                    ]}
                                />

                                <Input
                                    placeholder="Tìm Mã máy, Tên thiết bị, Serial..."
                                    prefix={<SearchOutlined className="text-slate-400" />}
                                    value={searchText}
                                    onChange={e => setSearchText(e.target.value)}
                                    style={{ width: 300 }}
                                    allowClear
                                />
                            </Space>

                            <div className="text-xs text-slate-500 font-medium">
                                Hiển thị <b className="text-indigo-600">{filteredItems.length}</b> / <b>{reconciliationResult.items.length}</b> thiết bị
                            </div>
                        </div>

                        {/* Bảng so sánh 3 nguồn */}
                        <Table
                            columns={columns}
                            dataSource={filteredItems}
                            rowKey="id"
                            size="small"
                            bordered
                            pagination={{
                                pageSize: 15,
                                showSizeChanger: true,
                                pageSizeOptions: ['15', '30', '50', '100'],
                                showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} thiết bị`
                            }}
                            scroll={{ x: 1100, y: 460 }}
                        />
                    </div>
                )}
            </div>
        </Modal>
    );
}


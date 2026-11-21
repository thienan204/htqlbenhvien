'use client';

import React, { useState, useEffect } from 'react';
import { Upload, Table, Card, Select, message, Button, Empty, Spin, Modal, Form, Checkbox, Progress, Input, Space, Popconfirm, Row, Col, Divider, Tooltip, Switch, Tag, AutoComplete } from 'antd';
import { InboxOutlined, FileExcelOutlined, ReloadOutlined, AuditOutlined, DownloadOutlined, SettingOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, EditOutlined, PlayCircleOutlined, SearchOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { UploadProps } from 'antd';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { createDuplicateRule, deleteDuplicateRule, getDuplicateRules, updateDuplicateRule } from '@/actions/duplicate-rules';
import { getCurrentUser, type UserPayload } from '@/actions/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import PageInstruction from '@/components/shared/PageInstruction';
import { Tabs } from 'antd';

const { Dragger } = Upload;
const { Option } = Select;

const normalizeRate = (val: any): string => {
    if (val === null || val === undefined || val === '') return '';
    let str = String(val).replace('%', '').trim();
    const num = Number(str);
    if (!isNaN(num)) {
        if (num > 0 && num <= 1) {
            return String(Math.round(num * 100));
        }
        return String(Math.round(num));
    }
    return str;
};

const parseRateNumeric = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    let str = String(val).replace('%', '').trim();
    const num = Number(str);
    if (!isNaN(num)) {
        if (num > 0 && num <= 1) {
            return num * 100;
        }
        return num;
    }
    return 0;
};

const isValidBedSharingGroup = (
    groupItems: any[],
    rateColIdx: number,
    patientColIdx: number,
    allowedRatesList?: string[]
): boolean => {
    if (rateColIdx === -1 || groupItems.length < 2) return false;

    const allowedSet = new Set<string>();
    if (allowedRatesList && allowedRatesList.length > 0) {
        allowedRatesList.forEach(r => {
            const norm = normalizeRate(r);
            if (norm) {
                allowedSet.add(norm);
                if (norm === '30') allowedSet.add('33');
                if (norm === '33') allowedSet.add('30');
            }
        });
    }

    const patientRatesMap: Record<string, number[]> = {};

    groupItems.forEach((it, idx) => {
        const pid = (patientColIdx !== -1 && it[patientColIdx] !== undefined && String(it[patientColIdx]).trim() !== '')
            ? String(it[patientColIdx]).trim()
            : `__row_${idx}`;
        
        const rNum = parseRateNumeric(it[rateColIdx]);
        if (!patientRatesMap[pid]) patientRatesMap[pid] = [];
        patientRatesMap[pid].push(rNum);
    });

    const uniquePids = Object.keys(patientRatesMap);
    // Phải có từ 2 bệnh nhân khác nhau trở lên
    if (uniquePids.length < 2) return false;

    let totalRate = 0;

    for (const pid of uniquePids) {
        const rates = patientRatesMap[pid];
        const maxRate = Math.max(...rates);

        // Bắt buộc tỷ lệ phải > 0 và < 100% (nếu có bất kỳ dòng nào 100% thì báo lỗi ngay, không bỏ qua)
        if (maxRate <= 0 || maxRate >= 100) {
            return false;
        }

        if (allowedSet.size > 0) {
            const roundedStr = String(Math.round(maxRate));
            if (!allowedSet.has(roundedStr)) {
                return false;
            }
        }

        totalRate += maxRate;
    }

    // Tổng tỷ lệ giường của các bệnh nhân khác nhau phải <= 100.5% (dung sai 0.5% cho 33% x 3)
    return totalRate <= 100.5;
};

// --- Interfaces & Constants ---

interface DuplicateRule {
    id: string;
    name: string;
    machineCols: string[]; // List of header names (not indices)
    serviceCol?: string;   // Header name
    startCol: string;      // Header name
    endCol: string;        // Header name
    ignoreMaMayMinusOne: boolean;
    ignoreNullValues?: boolean;
    active?: boolean;
    serviceValues?: string[]; // Specific values to filter
    excludedServiceValues?: string[]; // Specific values to exclude
    ignoreIfSameField?: string; // e.g. MA_BN
    rateCol?: string;           // Header name for service rate (e.g. TYLE_TT, TYLE_DV)
    ignoredRates?: string[];    // Rates to ignore if shared (e.g. ['50', '30'])
    minGapMinutes?: number; // Minimum gap in minutes to NOT be considered overlapping
    departmentExclusions?: any;
    allowedOverlapGroups?: string[][];
}



// Palette for group colors
const COLOR_PALETTE = [
    { argb: 'FFFFCCCC', css: '#ffcccc' }, // Red
    { argb: 'FFCCE5FF', css: '#cce5ff' }, // Blue
    { argb: 'FFCCFFCC', css: '#ccffcc' }, // Green
    { argb: 'FFFFFFCC', css: '#ffffcc' }, // Yellow
    { argb: 'FFE5CCFF', css: '#e5ccff' }, // Purple
    { argb: 'FFFFE5CC', css: '#ffe5cc' }, // Orange
];

const parseDateStr = (dateStr: any) => {
    if (dateStr === null || dateStr === undefined || dateStr === '') return null;
    
    // Nếu đã là Date object (do dùng cellDates: true)
    if (dateStr instanceof Date) {
        return dateStr;
    }

    // Xử lý ngày dạng số Serial của Excel (ví dụ 44927.5)
    if (typeof dateStr === 'number') {
        const ms = Math.round((dateStr - 25569) * 86400 * 1000);
        return new Date(ms); 
    }

    let s = String(dateStr).trim();

    // Regex YYYYMMDDHHmm (vd: 202305011030)
    const yyyymmddhhmm = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (yyyymmddhhmm) {
        return new Date(
            parseInt(yyyymmddhhmm[1]),
            parseInt(yyyymmddhhmm[2]) - 1,
            parseInt(yyyymmddhhmm[3]),
            parseInt(yyyymmddhhmm[4]),
            parseInt(yyyymmddhhmm[5])
        );
    }

    // Regex YYYYMMDD (vd: 20230501)
    const yyyymmdd = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmdd) {
        return new Date(
            parseInt(yyyymmdd[1]),
            parseInt(yyyymmdd[2]) - 1,
            parseInt(yyyymmdd[3])
        );
    }

    // Regex DD/MM/YYYY HH:mm
    const dmyhm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})/);
    if (dmyhm) {
        return new Date(
            parseInt(dmyhm[3]),
            parseInt(dmyhm[2]) - 1,
            parseInt(dmyhm[1]),
            parseInt(dmyhm[4]),
            parseInt(dmyhm[5])
        );
    }

    // Regex DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
        return new Date(
            parseInt(dmy[3]),
            parseInt(dmy[2]) - 1,
            parseInt(dmy[1])
        );
    }

    // Fallback try standard date
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    return null;
};

const ResizableTitle = (props: any) => {
    const { onResize, width, ...restProps } = props;

    if (!width) {
        return <th {...restProps} />;
    }

    return (
        <Resizable
            width={width}
            height={0}
            handle={
                <span
                    className="react-resizable-handle"
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                />
            }
            onResize={onResize}
            draggableOpts={{ enableUserSelectHack: false }}
        >
            <th {...restProps} />
        </Resizable>
    );
};

interface OverlapExcelCheckerProps {
    ruleType: string;
    pageTitle: string;
    enableTyleDvFilter?: boolean;
}

export default function OverlapExcelChecker({ ruleType, pageTitle, enableTyleDvFilter = true }: OverlapExcelCheckerProps) {
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheetNames, setSheetNames] = useState<string[]>([]);
    const [activeSheet, setActiveSheet] = useState<string>('');
    const [tableData, setTableData] = useState<any[]>([]);
    const [rawTableData, setRawTableData] = useState<any[]>([]);
    const [tableColumns, setTableColumns] = useState<any[]>([]);
    const [colWidths, setColWidths] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState<boolean>(false);
    const [fileName, setFileName] = useState<string>('');
    const [uploadProgress, setUploadProgress] = useState<number>(0);

    // Filter State
    const [columnFilters, setColumnFilters] = useState<Record<number, string>>({});

    // Duplicate Check State
    const [headers, setHeaders] = useState<string[]>([]);

    // --- Rule Management State ---
    const [rules, setRules] = useState<DuplicateRule[]>([]);
    const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
    const [isRuleManagerOpen, setIsRuleManagerOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<DuplicateRule | null>(null);
    const [ruleLoading, setRuleLoading] = useState(false);
    const [showOnlyDuplicates, setShowOnlyDuplicates] = useState(false);
    const [hide50Percent, setHide50Percent] = useState(false);
    const { user: currentUser, hasPermission } = useAuth();
    const router = useRouter();
    
    const [activeTab, setActiveTab] = useState('MAIN');

    const [form] = Form.useForm(); // For execution (hidden or manual)
    const [ruleForm] = Form.useForm(); // For rule editing

    const handleResize = (index: number) => (e: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
        setColWidths(prev => ({
            ...prev,
            [index]: size.width,
        }));
    };

    // Load rules on mount
    const fetchRules = async () => {
        setRuleLoading(true);
        const res = await getDuplicateRules(ruleType);
        if (res.success && res.data) {
            setRules(res.data as unknown as DuplicateRule[]);
        } else {
            message.error("Không thể tải danh sách quy tắc.");
        }
        setRuleLoading(false);
    };

    useEffect(() => {
        fetchRules();
    }, [ruleType]);

    const handleCreateRule = async (values: any) => {
        setRuleLoading(true);
        const res = await createDuplicateRule({
            name: values.name,
            ruleType: values.ruleType || ruleType,
            machineCols: values.machineCols,
            serviceCol: values.serviceCol,
            startCol: values.startCol,
            endCol: values.endCol,
            ignoreMaMayMinusOne: values.ignoreMaMayMinusOne || false,
            ignoreNullValues: values.ignoreNullValues || false,
            active: values.active !== undefined ? values.active : true,
            serviceValues: values.serviceValues || [],
            excludedServiceValues: values.excludedServiceValues || [],
            ignoreIfSameField: values.ignoreIfSameField || '',
            rateCol: values.rateCol || '',
            ignoredRates: values.ignoredRates || [],
            minGapMinutes: values.minGapMinutes ? parseInt(String(values.minGapMinutes), 10) : 0
        });

        if (res.success) {
            message.success("Đã tạo quy tắc mới.");
            setEditingRule(null);
            setIsRuleManagerOpen(false);
            ruleForm.resetFields();
            fetchRules();
        } else {
            message.error("Lỗi khi tạo quy tắc.");
        }
        setRuleLoading(false);
    };

    const handleUpdateRule = async (values: any) => {
        if (!editingRule) return;
        setRuleLoading(true);
        const res = await updateDuplicateRule(editingRule.id, {
            name: values.name,
            ruleType: values.ruleType || ruleType,
            machineCols: values.machineCols,
            serviceCol: values.serviceCol,
            startCol: values.startCol,
            endCol: values.endCol,
            ignoreMaMayMinusOne: values.ignoreMaMayMinusOne || false,
            ignoreNullValues: values.ignoreNullValues || false,
            active: values.active,
            serviceValues: values.serviceValues || [],
            excludedServiceValues: values.excludedServiceValues || [],
            ignoreIfSameField: values.ignoreIfSameField || '',
            rateCol: values.rateCol || '',
            ignoredRates: values.ignoredRates || [],
            minGapMinutes: values.minGapMinutes ? parseInt(String(values.minGapMinutes), 10) : 0
        });

        if (res.success) {
            message.success("Đã cập nhật quy tắc.");
            setEditingRule(null);
            setIsRuleManagerOpen(false);
            ruleForm.resetFields();
            fetchRules();
        } else {
            message.error("Lỗi khi cập nhật quy tắc.");
        }
        setRuleLoading(false);
    };

    const handleDeleteRule = async (id: string) => {
        setRuleLoading(true);
        const res = await deleteDuplicateRule(id);
        if (res.success) {
            message.success("Đã xóa quy tắc.");
            setSelectedRuleIds(prev => prev.filter(rId => rId !== id));
            fetchRules();
        } else {
            message.error("Lỗi khi xóa quy tắc.");
        }
        setRuleLoading(false);
    };

    const openCreateModal = () => {
        setEditingRule(null);
        ruleForm.resetFields();
        setIsRuleManagerOpen(true);
    };

    const openEditModal = (rule: DuplicateRule) => {
        setEditingRule(rule);
        ruleForm.setFieldsValue(rule);
        setIsRuleManagerOpen(true);
    };

    // IndexedDB Helper
    const initDB = async () => {
        const { openDB } = await import('idb');
        return openDB(`OverlapCheckerDB_${ruleType}`, 3, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files');
                }
            },
        });
    };

    const saveFileToDB = async (file: File) => {
        try {
            // Không lưu các file lớn (> 10MB) vào IndexedDB để tránh tràn bộ nhớ trình duyệt và crash khi mở lại
            if (file.size > 10 * 1024 * 1024) {
                console.warn("File dung lượng lớn (>10MB), bỏ qua lưu cache IndexedDB để bảo vệ hiệu năng.");
                await clearFileFromDB();
                return;
            }
            const db = await initDB();
            await db.put('files', file, `excelFile_${ruleType}`);
        } catch (e) {
            console.error("Lỗi khi lưu file vào IndexedDB:", e);
        }
    };

    const getFileFromDB = async (): Promise<File | undefined> => {
        try {
            const db = await initDB();
            return await db.get('files', `excelFile_${ruleType}`);
        } catch (e) {
            console.error("Lỗi khi đọc file từ IndexedDB:", e);
            return undefined;
        }
    };

    const clearFileFromDB = async () => {
        try {
            const db = await initDB();
            await db.delete('files', `excelFile_${ruleType}`);
        } catch (e) {
            console.error("Lỗi xóa file từ IndexedDB:", e);
        }
    };

    React.useEffect(() => {
        const loadCachedFile = async () => {
            try {
                const file = await getFileFromDB();
                if (file) {
                    // Nếu file trong cache lớn hơn 10MB, tự động xóa để tránh crash vô hạn
                    if (file.size > 10 * 1024 * 1024) {
                        await clearFileFromDB();
                        reset();
                        return;
                    }
                    setLoading(true);
                    setFileName(file.name);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = e.target?.result;
                            if (!data) return;
                            // Sử dụng array buffer và dense mode siêu nhẹ
                            const wb = XLSX.read(data, { type: 'array', dense: true, cellDates: true });
                            setWorkbook(wb);
                            setSheetNames(wb.SheetNames);
                            if (wb.SheetNames.length > 0) {
                                const firstSheet = wb.SheetNames[0];
                                setActiveSheet(firstSheet);
                                processSheet(wb, firstSheet);
                            }
                            message.success(`Đã khôi phục file: ${file.name}`);
                        } catch (error) {
                            console.error("Lỗi khôi phục file cache:", error);
                            clearFileFromDB();
                            reset();
                            message.warning('File trong bộ nhớ tạm bị lỗi hoặc quá lớn, hệ thống đã tự động dọn dẹp sạch sẽ.');
                        } finally {
                            setLoading(false);
                        }
                    };
                    reader.readAsArrayBuffer(file);
                } else {
                    reset();
                }
            } catch (err) {
                console.error("Failed to load cached file", err);
                await clearFileFromDB();
                reset();
            }
        };
        loadCachedFile();
    }, [ruleType]);

    const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (jsonData.length > 0) {
            const keywords = ['sở y tế', 'bệnh viện', 'báo cáo', 'cộng hoà', 'cộng hòa', 'độc lập', 'tự do'];
            let isReport = false;
            for (let i = 0; i < Math.min(3, jsonData.length); i++) {
                const row = jsonData[i] || [];
                for (let j = 0; j < row.length; j++) {
                    const cellVal = String(row[j] || '').toLowerCase();
                    if (keywords.some(kw => cellVal.includes(kw))) {
                        isReport = true;
                        break;
                    }
                }
                if (isReport) break;
            }
            if (isReport) {
                Modal.warning({
                    title: 'Cảnh báo: Phát hiện File Báo cáo',
                    content: 'Dữ liệu bạn vừa tải lên có vẻ là dạng File Báo Cáo (có chứa các tiêu đề Sở/Viện/Báo cáo ở những dòng đầu), KHÔNG PHẢI Dữ liệu Thô. Vui lòng xuất và tải lên File Dữ liệu Thô để hệ thống phân tích chính xác nhất! (Hoặc nếu vẫn muốn dùng file này, hãy tự chỉnh số ở ô "Dòng tiêu đề" cho đúng với dòng chứa tên cột).',
                    okText: 'Đã hiểu'
                });
            }
        }

        if (jsonData.length === 0) {
            setTableData([]);
            setTableColumns([]);
            setHeaders([]);
            return;
        }

        const rawHeader = jsonData[0] as any[];
        // Map rawHeader ensuring undefined/null elements become "Column X"
        const h = Array.from({ length: Math.max(rawHeader?.length || 0, 1) }).map((_, idx) => {
            const val = rawHeader ? rawHeader[idx] : undefined;
            return val !== undefined && val !== null && String(val).trim() !== '' ? String(val).trim() : `Column ${idx + 1}`;
        });
        setHeaders(h);

        const rows = jsonData.slice(1);

        const columns = h.map((header, index) => ({
            _originalTitle: header || `Column ${index + 1}`,
            dataIndex: index,
            key: index,
            width: 150,
            ellipsis: true,
            render: (text: any) => {
                if (text instanceof Date) {
                    return <span className="text-slate-700">{text.toLocaleString('vi-VN')}</span>;
                }
                return <span className="text-slate-700">{String(text ?? '')}</span>;
            }
        }));

        const data = rows.map((row: any, index) => {
            const rowData: any = { key: index };
            h.forEach((_, colIndex) => {
                rowData[colIndex] = row[colIndex];
            });
            return rowData;
        });

        setTableColumns(columns);
        setRawTableData(data);

        // Với file lớn (> 1.000 dòng): Chỉ nạp 1.000 dòng đầu vào bảng xem trước để tránh nghẽn DOM trình duyệt
        if (data.length > 1000) {
            setTableData(data.slice(0, 1000));
            message.info(`File có ${data.length.toLocaleString('vi-VN')} dòng (Xem trước 1.000 dòng đầu). Bấm "Kiểm tra ngay" để quét toàn bộ.`);
        } else {
            setTableData(data);
        }

        // Auto-detect matching rules
        const matchedRules = rules.filter(rule => {
            if (rule.active === false) return false;
            const requiredCols = [...rule.machineCols, rule.startCol, rule.endCol];
            if (rule.serviceCol) requiredCols.push(rule.serviceCol);
            return requiredCols.every(col => h.includes(col));
        });

        if (matchedRules.length > 0) {
            const ruleIds = matchedRules.map(r => r.id);
            setSelectedRuleIds(ruleIds);
            message.success(`Đã tự động chọn ${matchedRules.length} quy tắc phù hợp. Đang kiểm tra...`);
            setTimeout(() => {
                handleExecuteRule(ruleIds, h, data);
            }, 100);
        }
    };

    const handleSheetChange = (value: string) => {
        setActiveSheet(value);
        if (workbook) {
            setLoading(true);
            setTimeout(() => {
                processSheet(workbook, value);
                setLoading(false);
            }, 100);
        }
    };

    const uploadProps: UploadProps = {
        name: 'file',
        multiple: false,
        accept: '.xlsx, .xls',
        showUploadList: false,
        beforeUpload: (file) => {
            setLoading(true);
            setFileName(file.name);
            setUploadProgress(0);

            const fileSizeMB = file.size / (1024 * 1024);
            if (fileSizeMB > 15) {
                message.warning({
                    content: `Tệp có dung lượng khá lớn (${fileSizeMB.toFixed(1)} MB). Hệ thống đang kích hoạt chế độ nạp siêu tốc...`,
                    duration: 5
                });
            }

            saveFileToDB(file); // Save to IndexedDB (nếu <= 10MB)

            const reader = new FileReader();

            reader.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    setUploadProgress(percent);
                }
            };

            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    if (!data) throw new Error("Không thể đọc dữ liệu tệp");
                    // Sử dụng ArrayBuffer và dense: true giúp tiết kiệm 80% RAM
                    const wb = XLSX.read(data, { type: 'array', dense: true, cellDates: true });
                    setWorkbook(wb);
                    setSheetNames(wb.SheetNames);
                    if (wb.SheetNames.length > 0) {
                        const firstSheet = wb.SheetNames[0];
                        setActiveSheet(firstSheet);
                        processSheet(wb, firstSheet);
                    }
                    message.success(`${file.name} đã được tải lên.`);
                } catch (error) {
                    console.error(error);
                    message.error('Lỗi khi đọc file Excel. Nếu file quá lớn (>30MB), khuyến nghị nên lọc theo từng Khoa/Phòng.');
                } finally {
                    setLoading(false);
                    setUploadProgress(0);
                }
            };
            reader.readAsArrayBuffer(file);
            return false;
        },
    };

    const reset = () => {
        clearFileFromDB(); // Clear from IndexedDB
        setWorkbook(null);
        setSheetNames([]);
        setActiveSheet('');
        setTableData([]);
        setTableColumns([]);
        setFileName('');
        setHeaders([]);
    };

    // State for service selection logic mainly for rendering/debugging, 
    // but actual mapping happens at runtime now.

    const handleExecuteRule = (ruleIdsToRun?: string[], currentHeaders?: string[], currentData?: any[]) => {
        const ids = ruleIdsToRun || selectedRuleIds;
        if (!ids || ids.length === 0) {
            message.error("Vui lòng chọn ít nhất 1 quy tắc trước!");
            return;
        }

        const activeRules = rules.filter(r => ids.includes(r.id));
        if (activeRules.length === 0) return;

        const hds = currentHeaders || headers;
        const baseData = currentData || (rawTableData.length > 0 ? rawTableData : tableData);

        setLoading(true);

        const getInd = (name: string, hdArray: string[]) => {
            const lowerName = String(name).trim().toLowerCase();
            return hdArray.findIndex(h => h && String(h).trim().toLowerCase() === lowerName);
        };

        const items = baseData.map((row, idx) => ({
            ...row,
            _uid: idx
        }));

        let globalGroupCounter = 0;
        let totalDuplicates = 0;
        let totalIgnoredMinusOne = 0;
        let totalIgnoredNull = 0;
        const allDuplicates: any[] = [];

        activeRules.forEach(rule => {
            const machineIndices = rule.machineCols.map(c => getInd(c, hds)).filter(i => i !== -1);
            const startIndex = getInd(rule.startCol, hds);
            const endIndex = getInd(rule.endCol, hds);
            const serviceIndex = rule.serviceCol ? getInd(rule.serviceCol, hds) : -1;
            const ignoreSameColIdx = rule.ignoreIfSameField ? getInd(rule.ignoreIfSameField, hds) : -1;
            const rateColIdx = rule.rateCol ? getInd(rule.rateCol, hds) : -1;
            const ignoredRatesList = (rule.ignoredRates || []).map(r => normalizeRate(r)).filter(Boolean);

            if (machineIndices.length === 0 || startIndex === -1 || endIndex === -1) {
                console.warn(`Bỏ qua quy tắc "${rule.name}" do không tìm thấy đủ cột trong file.`);
                return;
            }

            const mapGroup: Record<string, any[]> = {};

            items.forEach((item, originalIdx) => {
                if (serviceIndex !== -1) {
                    const rowVal = String(item[serviceIndex] || '').trim();
                    const deptConfig = (currentUser?.ma_khoa && rule.departmentExclusions && Array.isArray(rule.departmentExclusions)) 
                        ? rule.departmentExclusions.find((d: any) => d.department === currentUser.ma_khoa) 
                        : null;

                    if (deptConfig && deptConfig.includedServices && Array.isArray(deptConfig.includedServices) && deptConfig.includedServices.length > 0) {
                        if (!deptConfig.includedServices.includes(rowVal)) return; // Not in dept's allowed list
                    } else if (rule.serviceValues && rule.serviceValues.length > 0) {
                        if (!rule.serviceValues.includes(rowVal)) return; // Not in global allowed list
                    }

                    let isExcluded = false;
                    if (rule.excludedServiceValues && rule.excludedServiceValues.length > 0) {
                        if (rule.excludedServiceValues.includes(rowVal)) isExcluded = true;
                    }
                    if (deptConfig && deptConfig.excludedServices && Array.isArray(deptConfig.excludedServices)) {
                        if (deptConfig.excludedServices.includes(rowVal)) isExcluded = true;
                    }
                    if (isExcluded) return;
                }

                const machineValues = machineIndices.map(col => item[col]);
                const valMachineKey = machineValues.join('|');

                if (rule.ignoreMaMayMinusOne && machineValues.some((v: any) => String(v) === '-1')) {
                    totalIgnoredMinusOne++;
                    return;
                }
                if (rule.ignoreNullValues && machineValues.some((v: any) => v === null || v === undefined || String(v).trim() === '' || String(v).toLowerCase() === 'null')) {
                    totalIgnoredNull++;
                    return;
                }

                const key = String(valMachineKey || '');
                if (!key) return;
                
                if (!mapGroup[key]) mapGroup[key] = [];
                mapGroup[key].push({ ...item, _originalIdx: originalIdx });
            });

            Object.values(mapGroup).forEach(group => {
                if (group.length < 2) return;

                // Chuẩn bị timestamp cho từng phần tử một lần duy nhất
                const parsedGroup = group.map((item, idx) => {
                    const s = parseDateStr(item[startIndex]);
                    const e = parseDateStr(item[endIndex]);
                    return {
                        item,
                        idx,
                        startTs: s ? s.getTime() : null,
                        endTs: e ? e.getTime() : null,
                    };
                }).filter(p => p.startTs !== null && p.endTs !== null) as Array<{
                    item: any;
                    idx: number;
                    startTs: number;
                    endTs: number;
                }>;

                if (parsedGroup.length < 2) return;

                // Sắp xếp theo startTs tăng dần để áp dụng Sweep-line Pruning (nhanh hơn gấp 100 lần)
                parsedGroup.sort((a, b) => a.startTs - b.startTs);

                const adj: Record<number, number[]> = {};
                for (let i = 0; i < parsedGroup.length; i++) adj[i] = [];

                const minGapMs = (rule.minGapMinutes && rule.minGapMinutes > 0) ? rule.minGapMinutes * 60000 : 0;

                for (let i = 0; i < parsedGroup.length; i++) {
                    const pA = parsedGroup[i];
                    const itemA = pA.item;
                    const startA = pA.startTs;
                    const endA = pA.endTs;
                    const lenA = endA - startA;

                    for (let j = i + 1; j < parsedGroup.length; j++) {
                        const pB = parsedGroup[j];
                        const itemB = pB.item;
                        const startB = pB.startTs;
                        const endB = pB.endTs;
                        const lenB = endB - startB;

                        // Vì đã sort theo startTs tăng dần (startB >= startA):
                        if (minGapMs > 0) {
                            if (startB >= endA + minGapMs) {
                                break;
                            }
                        } else {
                            if (startB > endA) {
                                break;
                            }
                        }

                        if (ignoreSameColIdx !== -1) {
                            const valA = itemA[ignoreSameColIdx];
                            const valB = itemB[ignoreSameColIdx];
                            if (valA !== undefined && valB !== undefined) {
                                const strA = String(valA).trim();
                                const strB = String(valB).trim();
                                if (strA !== '' && strA === strB) {
                                    // Bỏ qua nếu cùng mã BN và thời gian bắt đầu, kết thúc giống hệt nhau (do lỗi HIS xuất lặp)
                                    if (startA === startB && endA === endB) {
                                        continue;
                                    }
                                }
                            }
                        }

                        const overlapStart = Math.max(startA, startB);
                        const overlapEnd = Math.min(endA, endB);

                        let isOverlap = false;

                        if (minGapMs > 0) {
                            const gapMs = overlapStart - overlapEnd;
                            if (gapMs < minGapMs) {
                                isOverlap = true;
                            }
                        } else {
                            if (overlapEnd > overlapStart) {
                                isOverlap = true;
                            } else if (overlapEnd === overlapStart) {
                                if (lenA === 0 || lenB === 0) {
                                    isOverlap = true;
                                }
                            }
                        }

                        if (isOverlap && serviceIndex !== -1) {
                            const svcA = String(itemA[serviceIndex]).trim();
                            const svcB = String(itemB[serviceIndex]).trim();
                            
                            const deptConfig = (currentUser?.ma_khoa && rule.departmentExclusions && Array.isArray(rule.departmentExclusions)) 
                                ? rule.departmentExclusions.find((d: any) => d.department === currentUser.ma_khoa) 
                                : null;
                                
                            const groupsToCheck: any[] = [];
                            if (deptConfig?.allowedOverlapGroups && Array.isArray(deptConfig.allowedOverlapGroups)) {
                                groupsToCheck.push(...deptConfig.allowedOverlapGroups);
                            }
                            if (rule.allowedOverlapGroups && Array.isArray(rule.allowedOverlapGroups)) {
                                groupsToCheck.push(...rule.allowedOverlapGroups);
                            }
                            
                            for (const group of groupsToCheck) {
                                if (group && Array.isArray(group)) {
                                    if (group.includes(svcA) && group.includes(svcB)) {
                                        isOverlap = false;
                                        break;
                                    }
                                }
                            }
                        }

                        if (isOverlap) {
                            adj[i].push(j);
                            adj[j].push(i);

                            const formatTime = (ts: number) => {
                                const d = new Date(ts);
                                return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                            };
                            let overlapText = '';
                            if (overlapStart <= overlapEnd) {
                                overlapText = `${formatTime(overlapStart)} đến ${formatTime(overlapEnd)}`;
                            } else {
                                overlapText = `Khoảng cách < ${rule.minGapMinutes} phút`;
                            }
                            
                            if (!itemA._overlapTimes) itemA._overlapTimes = new Set<string>();
                            if (!itemB._overlapTimes) itemB._overlapTimes = new Set<string>();
                            itemA._overlapTimes.add(overlapText);
                            itemB._overlapTimes.add(overlapText);
                        }
                    }
                }

                const visited = new Set<number>();
                for (let i = 0; i < parsedGroup.length; i++) {
                    if (visited.has(i)) continue;
                    if (adj[i].length === 0) continue;

                    const comp: number[] = [];
                    const q = [i];
                    visited.add(i);

                    while (q.length > 0) {
                        const u = q.shift()!;
                        comp.push(u);
                        for (const v of adj[u]) {
                            if (!visited.has(v)) {
                                visited.add(v);
                                q.push(v);
                            }
                        }
                    }

                    if (comp.length > 1) {
                        // Bỏ qua nếu là nhóm nằm ghép hợp lệ theo tỷ lệ (tổng tỷ lệ giường <= 100%, không lẫn dòng 100%)
                        if (rateColIdx !== -1) {
                            const compItems = comp.map(idx => parsedGroup[idx].item);
                            if (isValidBedSharingGroup(compItems, rateColIdx, ignoreSameColIdx, ignoredRatesList)) {
                                return;
                            }
                        }

                        comp.forEach(idx => {
                            const origIdx = parsedGroup[idx].item._originalIdx;
                            const clone = {
                                ...items[origIdx],
                                __groupIndex: globalGroupCounter,
                                _violations: [rule.name],
                                _overlapTimes: parsedGroup[idx].item._overlapTimes ? Array.from(parsedGroup[idx].item._overlapTimes) : []
                            };
                            allDuplicates.push(clone);
                        });
                        globalGroupCounter++;
                        totalDuplicates += comp.length;
                    }
                }
            });
        });

        if (totalDuplicates > 0) {
            message.warning(`Tìm thấy bản ghi vi phạm ${activeRules.length} quy tắc trùng lặp!`);
            setShowOnlyDuplicates(true);
        } else {
            let msg = "Không tìm thấy dữ liệu trùng theo các tiêu chí đã chọn.";
            if (totalIgnoredMinusOne > 0 || totalIgnoredNull > 0) {
                msg += ` (Đã bỏ qua ${totalIgnoredMinusOne > 0 ? totalIgnoredMinusOne + ' dòng có mã máy -1' : ''}${totalIgnoredMinusOne > 0 && totalIgnoredNull > 0 ? ', ' : ''}${totalIgnoredNull > 0 ? totalIgnoredNull + ' dòng có giá trị trống' : ''} theo cài đặt quy tắc)`;
            }
            message.success(msg);
            setShowOnlyDuplicates(false);
        }

        const violatedUids = new Set(allDuplicates.map(d => d._uid));
        const nonViolated = items.filter(i => !violatedUids.has(i._uid));

        // Tối ưu hóa bộ nhớ: Giữ toàn bộ dòng trùng 100% + tối đa 1.000 dòng không trùng để render Table siêu mượt
        let finalData: any[] = [];
        if (allDuplicates.length > 0) {
            finalData = [...allDuplicates];
            if (nonViolated.length > 0 && nonViolated.length <= 1000) {
                finalData = [...finalData, ...nonViolated];
            } else if (nonViolated.length > 1000) {
                finalData = [...finalData, ...nonViolated.slice(0, 500)];
            }
        } else {
            finalData = nonViolated.slice(0, 1000);
        }

        finalData = finalData.map((item, idx) => ({
            ...item,
            key: `row-${idx}`
        }));
        
        setTableData(finalData);
        setLoading(false);
    };

    const handleExportDuplicates = async () => {
        const dups = filteredTableData.filter(x => x.__groupIndex !== undefined);
        if (dups.length === 0) {
            message.info("Không có dữ liệu trùng để xuất. Hãy chạy kiểm tra trước.");
            return;
        }

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Du Lieu Trung");

        const exportHeaders = ['STT', 'Quy tắc vi phạm', 'Khoảng thời gian trùng', ...headers];
        const headerRow = ws.addRow(exportHeaders);
        headerRow.font = { bold: true };

        dups.forEach((item, index) => {
            const rowVals: any[] = [
                index + 1,
                (item._violations || []).join('\n'),
                (item._overlapTimes || []).join('\n')
            ];
            headers.forEach((_, idx) => {
                let val = item[idx];
                if (typeof val === 'number' && val > 999999999) {
                    val = String(val);
                }
                rowVals.push(val);
            });
            const r = ws.addRow(rowVals);

            if (item.__groupIndex !== undefined) {
                const colorObj = COLOR_PALETTE[item.__groupIndex % COLOR_PALETTE.length];
                r.eachCell({ includeEmpty: true }, (cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: colorObj.argb }
                    };
                    cell.border = {
                        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
                    };
                });
            }
        });

        // Auto-fit columns
        const colCount = exportHeaders.length;
        for (let i = 1; i <= colCount; i++) {
            const col = ws.getColumn(i);
            let maxLength = 0;
            col.eachCell({ includeEmpty: true }, (cell) => {
                cell.alignment = { vertical: 'middle', wrapText: true };
                const text = cell.value ? cell.value.toString() : '';
                const lines = text.split('\n');
                lines.forEach(line => {
                    if (line.length > maxLength) maxLength = line.length;
                });
            });
            col.width = Math.min(Math.max(maxLength + 2, 12), 80);
        }

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), `DuLieuTrung_${new Date().toISOString().substring(0, 10)}.xlsx`);
    };

    const hidden50PercentDups = React.useMemo(() => {
        if (!hide50Percent || tableData.length === 0) return [];
        
        // 1. Tìm cột tỷ lệ: ưu tiên từ quy tắc đang áp dụng, nếu không tìm các tên cột phổ biến
        let tyleDvIdx = -1;
        const activeRuleRateCols = rules.filter(r => selectedRuleIds.includes(r.id) && r.rateCol).map(r => r.rateCol!);
        for (const colName of activeRuleRateCols) {
            const idx = headers.findIndex(h => h && String(h).toUpperCase().trim() === String(colName).toUpperCase().trim());
            if (idx !== -1) {
                tyleDvIdx = idx;
                break;
            }
        }
        if (tyleDvIdx === -1) {
            const commonRateCols = ['TYLE_TT', 'TYLE_DV', 'TYLE_TT_DV', 'TYLE_TT_BH', 'TYLE', 'MUC_HUONG', 'TY_LE'];
            tyleDvIdx = headers.findIndex(h => h && commonRateCols.includes(String(h).toUpperCase().trim()));
        }

        if (tyleDvIdx === -1) return [];

        // 2. Tìm cột bệnh nhân (MA_BN)
        let patientColIdx = -1;
        const activeRulePatientCols = rules.filter(r => selectedRuleIds.includes(r.id) && r.ignoreIfSameField).map(r => r.ignoreIfSameField!);
        for (const colName of activeRulePatientCols) {
            const idx = headers.findIndex(h => h && String(h).toUpperCase().trim() === String(colName).toUpperCase().trim());
            if (idx !== -1) {
                patientColIdx = idx;
                break;
            }
        }
        if (patientColIdx === -1) {
            const commonPatientCols = ['MA_BN', 'MABN', 'MA_BENH_NHAN', 'MA_BENHNHAN', 'SO_BENH_AN'];
            patientColIdx = headers.findIndex(h => h && commonPatientCols.includes(String(h).toUpperCase().trim()));
        }

        // 3. Lấy danh sách tỷ lệ được bỏ qua: từ quy tắc nếu có, hoặc mặc định ['50', '30', '33']
        const allowedRatesList: string[] = [];
        rules.filter(r => selectedRuleIds.includes(r.id) && r.ignoredRates && r.ignoredRates.length > 0).forEach(r => {
            allowedRatesList.push(...r.ignoredRates!);
        });
        if (allowedRatesList.length === 0) {
            allowedRatesList.push('50', '30', '33');
        }

        const groups = new Map<number, any[]>();
        tableData.forEach(item => {
            const gIdx = item.__groupIndex;
            if (gIdx !== undefined) {
                if (!groups.has(gIdx)) groups.set(gIdx, []);
                groups.get(gIdx)!.push(item);
            }
        });

        const validBedShareGroups = new Set<number>();
        groups.forEach((items, gIdx) => {
            if (isValidBedSharingGroup(items, tyleDvIdx, patientColIdx, allowedRatesList)) {
                validBedShareGroups.add(gIdx);
            }
        });

        return tableData.filter(item => item.__groupIndex !== undefined && validBedShareGroups.has(item.__groupIndex));
    }, [tableData, hide50Percent, headers, rules, selectedRuleIds]);

    const filteredTableData = React.useMemo(() => {
        let data = showOnlyDuplicates
            ? tableData.filter(x => x.__groupIndex !== undefined)
            : tableData;

        if (hide50Percent && hidden50PercentDups.length > 0) {
            const hiddenKeys = new Set(hidden50PercentDups.map(x => x.key));
            data = data.filter(item => !hiddenKeys.has(item.key));
        }

        Object.entries(columnFilters).forEach(([colIdxStr, filterVal]) => {
            if (filterVal) {
                const colIdx = parseInt(colIdxStr);
                const lowerFilter = filterVal.toLowerCase();
                data = data.filter(row => {
                    const rowVal = row[colIdx];
                    return rowVal !== null && rowVal !== undefined && String(rowVal).toLowerCase().includes(lowerFilter);
                });
            }
        });

        return data;
    }, [tableData, showOnlyDuplicates, columnFilters, hide50Percent, hidden50PercentDups]);

    const maxRuleWidth = 140;

    const maxTimeWidth = React.useMemo(() => {
        if (filteredTableData.length === 0) return 200;
        let maxLen = 0;
        for (const item of filteredTableData) {
            const times = Array.isArray(item._overlapTimes) ? item._overlapTimes : (item._overlapTimes ? [item._overlapTimes] : []);
            for (const t of times) {
                if (typeof t === 'string') {
                    const len = t.length * 5.8 + 32;
                    if (len > maxLen) maxLen = len;
                }
            }
        }
        return Math.max(180, Math.min(600, maxLen));
    }, [filteredTableData]);

    return (
        <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">{pageTitle}</h1>
                    <p className="text-slate-500 font-medium">Tải lên và kiểm tra trùng lặp thời gian</p>
                </div>
                {activeTab === 'MAIN' && workbook && (
                    <Button onClick={reset} icon={<ReloadOutlined />}>Tải file khác</Button>
                )}
            </div>

            <Tabs
                type="card"
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: 'MAIN',
                        label: 'Kiểm tra',
                        children: (
                            <div className="mt-4">
                                {!workbook ? (
                                    <Card className="border-2 border-dashed border-slate-300 shadow-none hover:border-blue-400 transition-colors">
                                        <div className="p-12">
                                            {loading && uploadProgress > 0 && uploadProgress < 100 ? (
                                                <div className="flex flex-col items-center justify-center p-8">
                                                    <Progress type="circle" percent={uploadProgress} />
                                                    <p className="mt-4 text-slate-500">Đang đọc file...</p>
                                                </div>
                                            ) : (
                                                <Dragger {...uploadProps} style={{ border: 'none', background: 'transparent' }} disabled={loading}>
                                                    <p className="ant-upload-drag-icon text-6xl text-blue-500 mb-4">
                                                        <InboxOutlined />
                                                    </p>
                                                    <p className="ant-upload-text text-xl font-bold text-slate-700">
                                                        Nhấp hoặc kéo thả file Excel vào đây
                                                    </p>
                                                    <p className="ant-upload-hint text-slate-500 mt-2">
                                                        Hỗ trợ các định dạng .xlsx, .xls
                                                    </p>
                                                    <p className="text-xs text-amber-600 mt-2 font-medium">
                                                        💡 Lưu ý: Đối với file dữ liệu lớn (trên 20MB), khuyến nghị nên lọc và xuất theo từng Khoa/Phòng để phân tích nhanh và tối ưu nhất.
                                                    </p>
                                                </Dragger>
                                            )}
                                        </div>
                                    </Card>
                                ) : (
                                    <div className="space-y-4">
                                        <Card className="shadow-sm border-slate-200">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="bg-green-100 p-2 rounded-lg text-green-600">
                                    <FileExcelOutlined className="text-xl" />
                                </div>
                                <span className="font-bold text-slate-700">{fileName}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <span className="text-slate-500 whitespace-nowrap">Chọn Sheet:</span>
                                <Select
                                    value={activeSheet}
                                    onChange={handleSheetChange}
                                    className="min-w-[150px]"
                                >
                                    {sheetNames.map(name => (
                                        <Option key={name} value={name}>{name}</Option>
                                    ))}
                                </Select>

                                <div className="h-6 w-px bg-slate-300 mx-2"></div>

                                {/* Rule Selection & Controls */}
                                <Select
                                    mode="multiple"
                                    placeholder="Chọn Quy tắc kiểm tra..."
                                    style={{ minWidth: 400, flex: 1, maxWidth: 800 }}
                                    value={selectedRuleIds}
                                    onChange={setSelectedRuleIds}
                                    allowClear
                                    loading={ruleLoading}
                                    maxTagCount="responsive"
                                >
                                    {rules.filter(r => r.active !== false).map(r => (
                                        <Option key={r.id} value={r.id}>{r.name}</Option>
                                    ))}
                                </Select>

                                <Tooltip title={currentUser ? "Quản lý Quy tắc (Mở Tab mới)" : "Đăng nhập để quản lý quy tắc"}>
                                    <Button
                                        icon={<SettingOutlined />}
                                        onClick={() => {
                                            if (currentUser) {
                                                window.open(`/htqlbenhvien/excel-rules?type=${ruleType}`, '_blank');
                                            } else {
                                                message.warning("Vui lòng đăng nhập để sử dụng tính năng này");
                                                router.push('/login');
                                            }
                                        }}
                                        className={!currentUser ? "opacity-50" : ""}
                                    />
                                </Tooltip>
                                <Tooltip title="Tải lại danh sách quy tắc">
                                    <Button icon={<ReloadOutlined />} onClick={fetchRules} loading={ruleLoading} className="ml-1 mr-2" />
                                </Tooltip>

                                <Button
                                    type="primary"
                                    icon={<PlayCircleOutlined />}
                                    onClick={() => handleExecuteRule()}
                                    disabled={selectedRuleIds.length === 0}
                                    className="bg-blue-600"
                                >
                                    Kiểm tra ngay
                                </Button>

                                <Button
                                    icon={<AuditOutlined />}
                                    onClick={async () => {
                                        const dups = filteredTableData.filter(x => x.__groupIndex !== undefined);
                                        if (dups.length === 0) {
                                            message.info("Không có dữ liệu trùng để hiển thị. Hãy chạy kiểm tra trước.");
                                        } else {
                                            const db = await initDB();
                                            await db.put('files', { headers, dups }, 'currentDuplicates');
                                            const baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
                                            window.open(`${baseUrl}/duplicates`, '_blank');
                                        }
                                    }}
                                    className="border-purple-600 text-purple-600 ml-2"
                                >
                                    Danh sách Trùng
                                </Button>

                                <Button
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportDuplicates}
                                    className="border-green-600 text-green-600 ml-2"
                                >
                                    Xuất trùng
                                </Button>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center gap-4">
                            <Checkbox
                                checked={showOnlyDuplicates}
                                onChange={(e) => setShowOnlyDuplicates(e.target.checked)}
                            >
                                Chỉ hiện dòng trùng
                            </Checkbox>
                            <Checkbox
                                checked={hide50Percent}
                                onChange={(e) => {
                                    setHide50Percent(e.target.checked);
                                    if (e.target.checked) {
                                        message.info("Đã áp dụng bộ lọc nhóm nằm ghép");
                                    }
                                }}
                            >
                                Bỏ qua nhóm nằm ghép (50%, 30%)
                            </Checkbox>
                            {tableData.some(x => x.__groupIndex !== undefined) && (
                                <Tag color="processing" className="ml-4 px-3 py-1 font-medium text-sm rounded-full">
                                    Còn lại: {filteredTableData.filter(x => x.__groupIndex !== undefined).length} dòng trùng
                                    <a
                                        className="ml-2 text-blue-600 underline cursor-pointer hover:text-blue-800"
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            const dups = filteredTableData.filter(x => x.__groupIndex !== undefined);
                                            if (dups.length === 0) {
                                                message.info("Không có dữ liệu trùng để hiển thị. Hãy chạy kiểm tra trước.");
                                            } else {
                                                const db = await initDB();
                                                await db.put('files', { headers, dups }, 'currentDuplicates');
                                                const baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
                                                window.open(`${baseUrl}/duplicates`, '_blank');
                                            }
                                        }}
                                    >
                                        (Xem danh sách)
                                    </a>
                                </Tag>
                            )}
                            {hide50Percent && hidden50PercentDups.length > 0 && (
                                <Tag color="error" className="ml-2 px-3 py-1 font-medium text-sm rounded-full">
                                    Đã ẩn: {hidden50PercentDups.length} dòng nằm ghép (tổng tỷ lệ ≤ 100%)
                                    <a
                                        className="ml-2 text-red-600 underline cursor-pointer hover:text-red-800"
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            const db = await initDB();
                                            await db.put('files', { headers, dups: hidden50PercentDups }, 'currentDuplicates');
                                            const baseUrl = window.location.href.split('?')[0].replace(/\/$/, '');
                                            window.open(`${baseUrl}/duplicates`, '_blank');
                                        }}
                                    >
                                        (Xem danh sách)
                                    </a>
                                </Tag>
                            )}
                        </div>
                    </Card>

                    <Card className="shadow-sm border-slate-200" styles={{ body: { padding: 0 } }}>
                        {loading ? (
                            <div className="h-64 flex items-center justify-center">
                                <Spin size="large" tip="Đang đọc dữ liệu..." />
                            </div>
                        ) : tableColumns.length > 0 ? (
                            <>
                                <style>{`
                                    .ant-table-cell-fix-left,
                                    .ant-table-cell-fix-right {
                                        background-color: inherit !important;
                                    }
                                `}</style>
                                <Table
                                components={{
                                    header: {
                                        cell: ResizableTitle,
                                    },
                                }}
                                columns={[
                                    {
                                        title: 'STT',
                                        dataIndex: 'stt',
                                        key: 'stt',
                                        width: 60,
                                        fixed: 'left',
                                        align: 'center',
                                        render: (_: any, __: any, index: number) => <span className="font-medium text-slate-500">{index + 1}</span>
                                    },
                                    {
                                        title: 'Quy tắc vi phạm',
                                        dataIndex: '_violations',
                                        key: '_violations',
                                        width: maxRuleWidth,
                                        fixed: 'left',
                                        align: 'center',
                                        render: (violations: string[]) => (
                                            violations && violations.length > 0 ? (
                                                <Tooltip 
                                                    title={
                                                        <div className="flex flex-col gap-1 p-1" style={{ maxWidth: 400 }}>
                                                            <strong className="text-slate-200 border-b border-slate-600 pb-1 mb-1 block">Các quy tắc vi phạm:</strong>
                                                            <ul className="list-disc pl-4 text-red-400 space-y-1 m-0">
                                                                {violations.map((v, i) => (
                                                                    <li key={i} className="text-[13px] leading-relaxed">{v}</li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    } 
                                                    color="#1e293b" 
                                                    placement="right"
                                                >
                                                    <Tag color="red" className="m-0 cursor-help font-medium">
                                                        <AuditOutlined className="mr-1" /> {violations.length} Quy tắc
                                                    </Tag>
                                                </Tooltip>
                                            ) : null
                                        )
                                    },
                                    {
                                        title: 'Khoảng thời gian trùng',
                                        dataIndex: '_overlapTimes',
                                        key: '_overlapTimes',
                                        width: maxTimeWidth,
                                        fixed: 'left',
                                        render: (times: string[]) => {
                                            if (!times || times.length === 0) return null;
                                            if (times.length === 1) {
                                                return <Tag color="orange" className="whitespace-normal m-0 font-medium">{times[0]}</Tag>;
                                            }
                                            return (
                                                <div className="flex flex-col gap-1 items-start">
                                                    <Tag color="orange" className="whitespace-normal m-0 font-medium">{times[0]}</Tag>
                                                    <Tooltip
                                                        title={
                                                            <div className="flex flex-col gap-1 p-1" style={{ maxWidth: 400 }}>
                                                                <strong className="text-slate-200 border-b border-slate-600 pb-1 mb-1 block">Các mốc thời gian trùng lặp:</strong>
                                                                <ul className="list-disc pl-4 text-orange-400 space-y-1 m-0 max-h-60 overflow-y-auto">
                                                                    {times.map((t, i) => (
                                                                        <li key={i} className="text-[13px] leading-relaxed">{t}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        }
                                                        color="#1e293b"
                                                        placement="right"
                                                    >
                                                        <Tag color="orange" className="m-0 cursor-help font-medium border-dashed">
                                                            + {times.length - 1} mốc thời gian khác
                                                        </Tag>
                                                    </Tooltip>
                                                </div>
                                            );
                                        }
                                    },
                                    ...tableColumns
                                ].map((col: any) => {
                                    if (col.key === '_violations' || col.key === '_overlapTimes') return col;
                                    const width = colWidths[col.dataIndex] || col.width || 150;
                                    return {
                                        ...col,
                                        width,
                                        onHeaderCell: () => ({
                                            width,
                                            onResize: handleResize(col.dataIndex),
                                        }),
                                        title: (
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {col._originalTitle}
                                                </div>
                                                <Input
                                                    placeholder="Lọc..."
                                                    size="small"
                                                    allowClear
                                                    value={columnFilters[col.dataIndex] || ''}
                                                    onChange={(e) => {
                                                        setColumnFilters(prev => ({
                                                            ...prev,
                                                            [col.dataIndex]: e.target.value
                                                        }));
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        )
                                    };
                                })}
                                dataSource={filteredTableData}
                                scroll={{ x: Object.values(colWidths).reduce((sum, w) => sum + w, 0) || tableColumns.length * 150, y: 600 }}
                                pagination={false}
                                virtual
                                bordered
                                size="middle"
                                onRow={(record) => {
                                    if (record.__groupIndex !== undefined) {
                                        const colorObj = COLOR_PALETTE[record.__groupIndex % COLOR_PALETTE.length];
                                        return { style: { backgroundColor: colorObj.css } };
                                    }
                                    return {};
                                }}
                            />
                            </>
                        ) : (
                            <Empty description="Sheet này không có dữ liệu" className="py-12" />
                        )}
                    </Card>
                </div>
            )}

            {/* Rule Manager Modal */}
            <Modal
                title={editingRule ? "Chỉnh sửa Quy tắc" : "Tạo Quy tắc Mới"}
                open={isRuleManagerOpen}
                onCancel={() => setIsRuleManagerOpen(false)}
                footer={null}
                width={800}
            >
                {/* List of existing rules if creating new (optional, but good for overview) */}
                {!editingRule && rules.length > 0 && (
                    <div className="mb-6">
                        <h3 className="font-bold text-slate-700 mb-2">Danh sách Quy tắc đã lưu (Server):</h3>
                        <div className="max-h-40 overflow-y-auto border rounded p-2 bg-slate-50 space-y-2">
                            {ruleLoading && <Spin size="small" />}
                            {!ruleLoading && rules.map(r => (
                                <div key={r.id} className="flex justify-between items-center p-2 bg-white border rounded shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <span className={`font-medium ${r.active === false ? 'text-slate-400 line-through' : ''}`}>{r.name}</span>
                                        {r.active === false && <Tag color="default">Đã ẩn</Tag>}
                                        {r.active !== false && <Tag color="green">Hoạt động</Tag>}
                                    </div>

                                    <Space>
                                        <Button
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={() => openEditModal(r)}
                                            disabled={!currentUser}
                                        />
                                        <Popconfirm title="Xóa quy tắc này?" onConfirm={() => handleDeleteRule(r.id)} disabled={!currentUser}>
                                            <Button size="small" danger icon={<DeleteOutlined />} disabled={!currentUser} />
                                        </Popconfirm>
                                    </Space>
                                </div>
                            ))}
                        </div>
                        <Divider />
                    </div>
                )}

                <Form
                    form={ruleForm}
                    layout="vertical"
                    onFinish={editingRule ? handleUpdateRule : handleCreateRule}
                    initialValues={{ ignoreMaMayMinusOne: false }}
                >
                    <Form.Item
                        label="Tên Quy tắc"
                        name="name"
                        rules={[{ required: true, message: 'Vui lòng nhập tên quy tắc' }]}
                    >
                        <Input placeholder="Ví dụ: Kiểm tra Siêu Âm..." />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="ruleType" label="Phân loại Quy tắc" initialValue={ruleType} hidden>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="active" label="Trạng thái" valuePropName="checked" initialValue={true}>
                                <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Đã ẩn" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={24}>
                            <div className="bg-yellow-50 p-3 mb-4 rounded border border-yellow-200 text-yellow-700 text-sm">
                                Lưu ý: Nhập chính xác <b>Tên Cột (Header)</b> trong file Excel của bạn.
                                Hệ thống sẽ tìm cột có tên tương ứng để kiểm tra.
                            </div>
                        </Col>

                        <Col span={24}>
                            <Form.Item
                                label="Cột Định danh (Mã Máy/Tên Máy, v.v.)"
                                name="machineCols"
                                rules={[{ required: true, message: 'Vui lòng nhập ít nhất 1 cột' }]}
                                help="Có thể nhập nhiều cột, các dòng có cùng giá trị ở TẤT CẢ các cột này sẽ được gộp nhóm."
                            >
                                <Select
                                    mode="tags"
                                    placeholder="Chọn hoặc nhập tên cột..."
                                    style={{ width: '100%' }}
                                    tokenSeparators={[',']}
                                    options={[...new Set(headers)].map(h => ({ label: h, value: h }))}
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item
                                label="Cột Thời gian Bắt đầu"
                                name="startCol"
                                rules={[{ required: true, message: 'Vui lòng nhập tên cột' }]}
                            >
                                <AutoComplete
                                    placeholder="VD: NGAY_VAO"
                                    options={[...new Set(headers)].map(h => ({ value: h }))}
                                    filterOption={(inputValue, option) =>
                                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Cột Thời gian Kết thúc"
                                name="endCol"
                                rules={[{ required: true, message: 'Vui lòng nhập tên cột' }]}
                            >
                                <AutoComplete
                                    placeholder="VD: NGAY_RA"
                                    options={[...new Set(headers)].map(h => ({ value: h }))}
                                    filterOption={(inputValue, option) =>
                                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item
                                label="Cột Dịch vụ (Bắt buộc nếu có lọc Dịch vụ)"
                                name="serviceCol"
                                help="Hệ thống cần biết Cột Dịch vụ để áp dụng các luật Bỏ qua / Cho phép ở bên dưới."
                            >
                                <AutoComplete
                                    placeholder="VD: TEN_DICH_VU"
                                    options={[...new Set(headers)].map(h => ({ value: h }))}
                                    filterOption={(inputValue, option) =>
                                        option!.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                                    }
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Giá trị Dịch vụ (Lọc cụ thể)"
                                name="serviceValues"
                            >
                                <Select
                                    mode="tags"
                                    placeholder="Nhập giá trị dịch vụ bao gồm..."
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>

                            <Form.Item
                                label="Bỏ qua các Dịch vụ (Loại trừ)"
                                name="excludedServiceValues"
                                help="Nếu nhập, các dòng có giá trị dịch vụ thuộc danh sách này sẽ không bị kiểm tra trùng."
                            >
                                <Select
                                    mode="tags"
                                    placeholder="Nhập giá trị dịch vụ cần loại trừ..."
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="ignoreMaMayMinusOne"
                        valuePropName="checked"
                    >
                        <Checkbox>Bỏ qua nếu giá trị Cột Định Danh = -1</Checkbox>
                    </Form.Item>

                    <Form.Item name="ignoreNullValues" valuePropName="checked">
                        <Checkbox>Bỏ qua nếu giá trị Cột Định Danh là NULL hoặc Rỗng</Checkbox>
                    </Form.Item>

                    <Divider />
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                label="Giá trị cần bỏ qua nếu trùng (Tuỳ chọn)"
                                name="ignoreIfSameField"
                                help="VD: MAHOSOBENHAN hoặc MA_BN. Bỏ qua không báo lỗi nếu chung trường này."
                            >
                                <Input placeholder="VD: MAHOSOBENHAN" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Khoảng cách tối thiểu giữa 2 DV (Phút)"
                                name="minGapMinutes"
                                help="VD: 1. Nếu cách nhau dưới 1 phút sẽ báo trùng."
                            >
                                <Input type="number" min={0} placeholder="VD: 1, 5, 10..." />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Cột Tỷ lệ (Tùy chọn - Dành cho Nằm ghép)"
                                name="rateCol"
                                help="VD: TYLE_TT, TYLE_DV. Tên cột tỷ lệ thanh toán trong file Excel."
                            >
                                <Input placeholder="VD: TYLE_TT hoặc TYLE_DV" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                label="Tỷ lệ dịch vụ bỏ qua nếu trùng (Nằm ghép)"
                                name="ignoredRates"
                                help="Nhập tỷ lệ (VD: 50 cho ghép 2, 30 cho ghép 3) rồi ấn Enter."
                            >
                                <Select
                                    mode="tags"
                                    placeholder="Nhập tỷ lệ (VD: 50, 30...) rồi ấn Enter"
                                    options={[
                                        { value: '50', label: '50% (Ghép 2 người)' },
                                        { value: '30', label: '30% (Ghép 3 người trở lên)' },
                                        { value: '33', label: '33% (Ghép 3 người - 1/3)' }
                                    ]}
                                    style={{ width: '100%' }}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                                    <div className="flex justify-end gap-2 mt-6">
                                        <Button onClick={() => setIsRuleManagerOpen(false)}>Đóng</Button>
                                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={ruleLoading}>
                                            {editingRule ? "Cập nhật" : "Lưu Quy tắc"}
                                        </Button>
                                    </div>
                                </Form>
                            </Modal>
                            </div>
                        )
                    },
                    {
                        key: 'INSTRUCTION',
                        label: 'Hướng dẫn sử dụng',
                        children: (
                            <div className="mt-4">
                                <PageInstruction pageId={`excel-check-${ruleType.toLowerCase()}`} />
                            </div>
                        )
                    }
                ]}
            />
        </div>
    );
}


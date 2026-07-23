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

const { Dragger } = Upload;
const { Option } = Select;

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
    ignoreIfSameField?: string;
    minGapMinutes?: number;
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

export default function ExcelReaderPage() {
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
        const res = await getDuplicateRules();
        if (res.success && res.data) {
            setRules(res.data as unknown as DuplicateRule[]);
        } else {
            message.error("Không thể tải danh sách quy tắc.");
        }
        setRuleLoading(false);
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleCreateRule = async (values: any) => {
        setRuleLoading(true);
        const res = await createDuplicateRule({
            name: values.name,
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
        return openDB('ExcelReaderDB', 3, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files');
                }
            },
        });
    };

    const saveFileToDB = async (file: File) => {
        const db = await initDB();
        await db.put('files', file, 'currentFile');
    };

    const getFileFromDB = async (): Promise<File | undefined> => {
        const db = await initDB();
        return await db.get('files', 'currentFile');
    };

    const clearFileFromDB = async () => {
        const db = await initDB();
        await db.delete('files', 'currentFile');
    };

    React.useEffect(() => {
        const loadCachedFile = async () => {
            try {
                const file = await getFileFromDB();
                if (file) {
                    setLoading(true);
                    setFileName(file.name);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = e.target?.result;
                            const wb = XLSX.read(data, { type: 'binary', cellDates: true });
                            setWorkbook(wb);
                            setSheetNames(wb.SheetNames);
                            if (wb.SheetNames.length > 0) {
                                const firstSheet = wb.SheetNames[0];
                                setActiveSheet(firstSheet);
                                processSheet(wb, firstSheet);
                            }
                            message.success(`Đã khôi phục file: ${file.name}`);
                        } catch (error) {
                            console.error(error);
                        } finally {
                            setLoading(false);
                        }
                    };
                    reader.readAsBinaryString(file);
                }
            } catch (err) {
                console.error("Failed to load cached file", err);
            }
        };
        loadCachedFile();
    }, []);

    const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (jsonData.length === 0) {
            setTableData([]);
            setTableColumns([]);
            setHeaders([]);
            return;
        }

        const h = jsonData[0] as string[];
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
        setTableData(data);
        setRawTableData(data);

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

            saveFileToDB(file); // Save to IndexedDB

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
                    const wb = XLSX.read(data, { type: 'binary', cellDates: true });
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
                    message.error('Lỗi đọc file.');
                } finally {
                    setLoading(false);
                    setUploadProgress(0);
                }
            };
            reader.readAsBinaryString(file);
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
        const allDuplicates: any[] = [];

        activeRules.forEach(rule => {
            const machineIndices = rule.machineCols.map(c => getInd(c, hds)).filter(i => i !== -1);
            const startIndex = getInd(rule.startCol, hds);
            const endIndex = getInd(rule.endCol, hds);
            const serviceIndex = rule.serviceCol ? getInd(rule.serviceCol, hds) : -1;
            const ignoreSameColIdx = rule.ignoreIfSameField ? getInd(rule.ignoreIfSameField, hds) : -1;

            if (machineIndices.length === 0 || startIndex === -1 || endIndex === -1) {
                console.warn(`Bỏ qua quy tắc "${rule.name}" do không tìm thấy đủ cột trong file.`);
                return;
            }

            const mapGroup: Record<string, any[]> = {};

            items.forEach((item, originalIdx) => {
                if (serviceIndex !== -1) {
                    const rowVal = String(item[serviceIndex] || '');
                    if (rule.serviceValues && rule.serviceValues.length > 0) {
                        if (!rule.serviceValues.includes(rowVal)) return;
                    }
                    if (rule.excludedServiceValues && rule.excludedServiceValues.length > 0) {
                        if (rule.excludedServiceValues.includes(rowVal)) return;
                    }
                }

                const machineValues = machineIndices.map(col => item[col]);
                const valMachineKey = machineValues.join('|');

                if (rule.ignoreMaMayMinusOne && machineValues.some((v: any) => String(v) === '-1')) return;
                if (rule.ignoreNullValues && machineValues.some((v: any) => v === null || v === undefined || String(v).trim() === '' || String(v).toLowerCase() === 'null')) return;

                const key = String(valMachineKey || '');
                if (!key) return;
                
                if (!mapGroup[key]) mapGroup[key] = [];
                mapGroup[key].push({ ...item, _originalIdx: originalIdx });
            });

            Object.values(mapGroup).forEach(group => {
                if (group.length < 2) return;

                const adj: Record<number, number[]> = {};
                for (let i = 0; i < group.length; i++) adj[i] = [];

                for (let i = 0; i < group.length; i++) {
                    const itemA = group[i];
                    const startA = parseDateStr(itemA[startIndex]);
                    const endA = parseDateStr(itemA[endIndex]);

                    if (!startA || !endA) continue;

                    for (let j = i + 1; j < group.length; j++) {
                        const itemB = group[j];
                        const startB = parseDateStr(itemB[startIndex]);
                        const endB = parseDateStr(itemB[endIndex]);

                        if (!startB || !endB) continue;

                        if (ignoreSameColIdx !== -1) {
                            const valA = itemA[ignoreSameColIdx];
                            const valB = itemB[ignoreSameColIdx];
                            if (valA !== undefined && valB !== undefined) {
                                const strA = String(valA).trim();
                                const strB = String(valB).trim();
                                if (strA !== '' && strA === strB) continue;
                            }
                        }

                        const overlapStart = Math.max(startA.getTime(), startB.getTime());
                        const overlapEnd = Math.min(endA.getTime(), endB.getTime());
                        const lenA = endA.getTime() - startA.getTime();
                        const lenB = endB.getTime() - startB.getTime();

                        let isOverlap = false;

                        if (rule.minGapMinutes && rule.minGapMinutes > 0) {
                            const gapMs = overlapStart - overlapEnd;
                            if (gapMs < rule.minGapMinutes * 60000) {
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

                        if (isOverlap) {
                            adj[i].push(j);
                            adj[j].push(i);
                        }
                    }
                }

                const visited = new Set<number>();
                for (let i = 0; i < group.length; i++) {
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
                        comp.forEach(idx => {
                            const origIdx = group[idx]._originalIdx;
                            const clone = {
                                ...items[origIdx],
                                __groupIndex: globalGroupCounter,
                                _violations: [rule.name]
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
            message.success("Không tìm thấy dữ liệu trùng theo các tiêu chí đã chọn.");
            setShowOnlyDuplicates(false);
        }

        const violatedUids = new Set(allDuplicates.map(d => d._uid));
        const nonViolated = items.filter(i => !violatedUids.has(i._uid));

        setTableData([...allDuplicates, ...nonViolated]);
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

        const exportHeaders = ["QUY_TAC_VI_PHAM", ...headers];
        const headerRow = ws.addRow(exportHeaders);
        headerRow.font = { bold: true };

        dups.forEach(item => {
            const rowVals: any[] = [(item._violations || []).join(', ')];
            headers.forEach((_, idx) => {
                rowVals.push(item[idx]);
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

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), `DuLieuTrung_${new Date().toISOString().substring(0, 10)}.xlsx`);
    };

    const hidden50PercentDups = React.useMemo(() => {
        if (!hide50Percent || tableData.length === 0) return [];
        
        const tyleDvIdx = headers.findIndex(h => h && (String(h).toUpperCase().trim() === 'TYLE_DV' || String(h).toUpperCase().trim() === 'TYLE_TT_DV'));
        if (tyleDvIdx === -1) return [];

        const groups = new Map<number, any[]>();
        tableData.forEach(item => {
            const gIdx = item.__groupIndex;
            if (gIdx !== undefined) {
                if (!groups.has(gIdx)) groups.set(gIdx, []);
                groups.get(gIdx)!.push(item);
            }
        });

        const invalidGroups = new Set<number>();
        groups.forEach((items, gIdx) => {
            const isAll50 = items.every(i => Number(i[tyleDvIdx]) === 50);
            if (isAll50) {
                invalidGroups.add(gIdx);
            }
        });

        return tableData.filter(item => item.__groupIndex !== undefined && invalidGroups.has(item.__groupIndex));
    }, [tableData, hide50Percent, headers]);

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

    if (!hasPermission('MENU_DOC_FILE_EXCEL')) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] p-12">
                <div className="text-red-500 text-7xl mb-4"><AuditOutlined /></div>
                <h1 className="text-3xl font-bold text-slate-800">Truy cập bị từ chối</h1>
                <p className="text-slate-500 mt-3 text-lg">Bạn không có quyền truy cập vào chức năng Đọc dữ liệu Excel.</p>
                <Button type="primary" size="large" className="mt-6 bg-blue-600" onClick={() => router.push('/')}>
                    Về trang chủ
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Đọc dữ liệu Excel</h1>
                    <p className="text-slate-500 font-medium">Tải lên và xem nhanh nội dung file Excel ngay trên trình duyệt</p>
                </div>
                {workbook && (
                    <Button onClick={reset} icon={<ReloadOutlined />}>Tải file khác</Button>
                )}
            </div>

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

                                <Tooltip title={currentUser ? "Thêm/Sửa Quy tắc" : "Đăng nhập để quản lý quy tắc"}>
                                    <Button
                                        icon={<SettingOutlined />}
                                        onClick={() => {
                                            if (currentUser) {
                                                openCreateModal();
                                            } else {
                                                message.warning("Vui lòng đăng nhập để sử dụng tính năng này");
                                                router.push('/login');
                                            }
                                        }}
                                        className={!currentUser ? "opacity-50" : ""}
                                    />
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
                                        message.info("Đã áp dụng bộ lọc nhóm 50%");
                                    }
                                }}
                            >
                                Bỏ qua nhóm trùng 50%
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
                                    Đã ẩn: {hidden50PercentDups.length} dòng 50%
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
                            <Table
                                components={{
                                    header: {
                                        cell: ResizableTitle,
                                    },
                                }}
                                columns={[
                                    {
                                        title: 'Quy tắc vi phạm',
                                        dataIndex: '_violations',
                                        key: '_violations',
                                        width: 250,
                                        fixed: 'left',
                                        render: (violations: string[]) => (
                                            violations && violations.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {violations.map((v, i) => <Tag color="red" key={i} className="whitespace-normal mb-1">{v}</Tag>)}
                                                </div>
                                            ) : null
                                        )
                                    },
                                    ...tableColumns
                                ].map((col: any) => {
                                    if (col.key === '_violations') return col;
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

                    <Form.Item name="active" valuePropName="checked" initialValue={true}>
                        <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Đã ẩn" />
                    </Form.Item>

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
                                label="Cột Dịch vụ (Tùy chọn)"
                                name="serviceCol"
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
                                help="VD: MAHOSOBENHAN. Bỏ qua không báo lỗi nếu chung trường này."
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
    );
}

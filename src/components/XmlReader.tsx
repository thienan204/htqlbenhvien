'use client';

import React, { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { HosoRecord, parseXmlContent, getXmlDataList, ExtendedHosoRecord } from '@/lib/xml';
import { addRecordsToDB, loadRecordsFromDB, clearDB } from '@/lib/db';

import { DEFAULT_RULES, ValidationEngine, ValidationRule, ValidationResult } from '@/lib/validation';
import { useRules } from "@/hooks/useRules";
import { copyToClipboard } from '@/utils/clipboard';
import { getBasePath } from '@/utils/config';
import { addWorkingDays, calculateRemainingTime } from '@/utils/dateUtils';

import { getSpecializedRules } from '@/actions/specialized-rules';
import { runDuplicateBedRule, runDuplicateDoctorRule, runMachineCheckRule } from '@/lib/specialized-rules-engine';
import { exportDuplicateBedExcel, exportDuplicateDoctorExcel } from '@/lib/specialized-export';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
    Table, Button, Upload, Tabs, Tag, message, Card, Input, Space,
    Descriptions, Badge, Spin, Progress, Modal, Select, Tooltip, Row, Col, Alert, Switch, Dropdown, Menu, InputNumber, DatePicker
} from 'antd';
import {
    InboxOutlined, UploadOutlined, FileExcelOutlined, SearchOutlined,
    CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, DeleteOutlined,
    CloudUploadOutlined, CloudDownloadOutlined, ContainerOutlined, SettingOutlined
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Dragger } = Upload;
const { TabPane } = Tabs;
const { Option } = Select;

// --- Helper Functions (Generic) ---
const renderValue = (val: any) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
        return val.__cdata !== undefined ? String(val.__cdata) : '';
    }
    return String(val);
};

const formatDateTime = (dateStr: any) => {
    const s = renderValue(dateStr);
    if (!s) return '';
    if (s.length === 12) { // YYYYMMDDHHmm
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)} ${s.substring(8, 10)}:${s.substring(10, 12)}`;
    }
    if (s.length >= 14) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)} ${s.substring(8, 10)}:${s.substring(10, 12)}`;
    }
    if (s.length >= 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    return s;
};

// Helper: Get Columns for Generic Table
const getDynamicColumns = (
    dataList: any[],
    rules: ValidationRule[] = [],
    xmlType: string = '',
    filters: Record<string, string> = {},
    setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>
) => {
    // 1. Gather all keys
    const keys = new Set<string>();
    dataList.forEach(item => {
        if (item && typeof item === 'object') {
            Object.keys(item).forEach(k => {
                if (k !== '__cdata' && !k.startsWith('_') && k !== 'STT' && k !== 'MA_LK') {
                    keys.add(k);
                }
            });
        }
    });

    if (xmlType) {
        rules.filter(r => r.xmlType === xmlType && r.active && r.field && r.field !== '___CUSTOM___').forEach(r => {
            if (r.field && !keys.has(r.field)) {
                keys.add(r.field);
            }
        });
    }

    const sortedKeys = Array.from(keys).sort((a, b) => {
        const priority = ['MA_LK', 'NGAY_YL', 'NGAY_TH_YL', 'NGAY_KQ', 'MA_DICH_VU', 'TEN_DICH_VU', 'MA_THUOC', 'TEN_THUOC'];
        const idxA = priority.indexOf(a);
        const idxB = priority.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
    });

    // 2. Build Antd Columns
    const columns: ColumnsType<any> = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center',
            render: (_: any, __: any, index: number) => index + 1,
            fixed: 'left',
        },
        ...sortedKeys.map(key => ({
            title: (
                <div className="flex flex-col gap-1">
                    <span>{key}</span>
                    <Input
                        placeholder="Tìm..."
                        size="small"
                        allowClear
                        value={filters?.[key] || ''}
                        onChange={(e) => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                        className="font-normal"
                    />
                </div>
            ),
            dataIndex: key,
            key: key,
            width: 150,
            ellipsis: true,
            render: (text: any) => {
                const val = (key.includes('NGAY') || key.includes('THOI_GIAN')) ? formatDateTime(text) : renderValue(text);
                return (
                    <Tooltip title={val} placement="topLeft">
                        <span onClick={() => {
                            copyToClipboard(val);
                            message.info('Copied!');
                        }} className="cursor-copy text-xs text-slate-700 font-medium">{val}</span>
                    </Tooltip>
                );
            },
            sorter: (a: any, b: any) => {
                const vA = renderValue(a[key]);
                const vB = renderValue(b[key]);
                return vA.localeCompare(vB);
            },
        }))
    ];

    return columns;
};

const fetchIcd10Map = async (recordsToValidate: ExtendedHosoRecord[]): Promise<Record<string, any>> => {
    const allCodes = new Set<string>();
    recordsToValidate.forEach(r => {
        if (r.summary?.MA_BENH) allCodes.add(r.summary.MA_BENH);
        if (r.summary?.MA_BENHKHAC) {
            const khac = String(r.summary.MA_BENHKHAC).split(';');
            khac.forEach(k => {
                if (k.trim()) allCodes.add(k.trim());
            });
        }
        if (r.summary?.MA_BENH_CHINH) allCodes.add(r.summary.MA_BENH_CHINH);
        if (r.summary?.MA_BENH_KT) {
            const kt = String(r.summary.MA_BENH_KT).split(';');
            kt.forEach(k => {
                if (k.trim()) allCodes.add(k.trim());
            });
        }
        if (r.summary?.MA_BENH_YHCT) {
            const yh = String(r.summary.MA_BENH_YHCT).split(';');
            yh.forEach(k => {
                if (k.trim()) allCodes.add(k.trim());
            });
        }
    });

    if (allCodes.size === 0) return {};

    try {
        const icdRes = await fetch('/api/icd10/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codes: Array.from(allCodes) })
        });
        if (icdRes.ok) {
            const data = await icdRes.json();
            return data.data || {};
        }
    } catch (e) {
        console.error('Lỗi khi fetch ICD-10:', e);
    }
    return {};
};

const applyIcd10Validation = (r: ExtendedHosoRecord, icd10Map: Record<string, any>) => {
    if (!r.validationResults) r.validationResults = [];
    
    const maBenh = r.summary?.MA_BENH;
    if (maBenh && icd10Map[maBenh]) {
        const icdInfo = icd10Map[maBenh];
        if (icdInfo.found) {
            if (icdInfo.is_not_main_disease) {
                r.validationResults.push({
                    ruleId: 'ICD10_NOT_MAIN',
                    ruleName: 'Mã không được dùng làm bệnh chính',
                    type: 'Xuất toán',
                    xmlType: 'XML1',
                    field: 'MA_BENH',
                    message: `Mã bệnh chính ${maBenh} không được dùng làm bệnh chính theo Thông tư 06`,
                    isError: true
                });
            }
            if (icdInfo.not_recommended_main) {
                r.validationResults.push({
                    ruleId: 'ICD10_NOT_REC_MAIN',
                    ruleName: 'Không khuyến khích làm bệnh chính',
                    type: 'Cảnh báo',
                    xmlType: 'XML1',
                    field: 'MA_BENH',
                    message: `Mã bệnh chính ${maBenh} không khuyến khích dùng làm bệnh chính`,
                    isError: true
                });
            }
            if (icdInfo.requires_more_specific) {
                r.validationResults.push({
                    ruleId: 'ICD10_REQ_SPECIFIC',
                    ruleName: 'Bắt buộc có mã chi tiết hơn',
                    type: 'Cảnh báo',
                    xmlType: 'XML1',
                    field: 'MA_BENH',
                    message: `Mã bệnh ${maBenh} yêu cầu mã chi tiết hơn (4 hoặc 5 ký tự)`,
                    isError: true
                });
            }
            if (icdInfo.is_death_cause_only) {
                r.validationResults.push({
                    ruleId: 'ICD10_DEATH_ONLY',
                    ruleName: 'Chỉ dùng cho nguyên nhân tử vong',
                    type: 'Xuất toán',
                    xmlType: 'XML1',
                    field: 'MA_BENH',
                    message: `Mã bệnh ${maBenh} chỉ được sử dụng cho nguyên nhân tử vong`,
                    isError: true
                });
            }
        }
    }
    
    if (r.summary?.MA_BENHKHAC) {
        const khac = String(r.summary.MA_BENHKHAC).split(';');
        khac.forEach(k => {
            const code = k.trim();
            if (code && icd10Map[code]) {
                const icdInfo = icd10Map[code];
                if (icdInfo.found) {
                    if (icdInfo.requires_more_specific) {
                        r.validationResults.push({
                            ruleId: 'ICD10_REQ_SPECIFIC_KHAC',
                            ruleName: 'Bắt buộc có mã chi tiết hơn',
                            type: 'Cảnh báo',
                            xmlType: 'XML1',
                            field: 'MA_BENHKHAC',
                            message: `Mã bệnh kèm theo ${code} yêu cầu mã chi tiết hơn`,
                            isError: true
                        });
                    }
                    if (icdInfo.is_death_cause_only) {
                        r.validationResults.push({
                            ruleId: 'ICD10_DEATH_ONLY',
                            ruleName: 'Chỉ dùng cho nguyên nhân tử vong',
                            type: 'Xuất toán',
                            xmlType: 'XML1',
                            field: 'MA_BENHKHAC',
                            message: `Mã bệnh kèm theo ${code} chỉ được sử dụng cho nguyên nhân tử vong`,
                            isError: true
                        });
                    }
                }
            }
        });
    }
};

export default function XmlReader() {
    const { user: authUser } = useAuth();
    const canUploadFile = authUser?.role === 'ADMIN' || authUser?.role === 'CNTT' || authUser?.role === 'BHYT';
    
    const router = useRouter();
    const [records, setRecords] = useState<ExtendedHosoRecord[]>([]);
    const [departments, setDepartments] = useState<Record<string, string>>({});
    const [selectedRecord, setSelectedRecord] = useState<ExtendedHosoRecord | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
    const [selectedKhoa, setSelectedKhoa] = useState<string | null>(null);

    // Specialized rules state
    const [specializedRules, setSpecializedRules] = useState<any[]>([]);
    const [isSpecializedChecking, setIsSpecializedChecking] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('XML1');
    const [user, setUser] = useState<any>(null);
    const [processingProgress, setProcessingProgress] = useState<{ current: number, total: number } | null>(null);
    const { rules, saveRules, isLoaded: isRulesLoaded, reloadRules } = useRules();
    const [mainFilter, setMainFilter] = useState<string>('ERROR');
    const [searchText, setSearchText] = useState('');
    const [showDetailErrorsOnly, setShowDetailErrorsOnly] = useState(false);
    const [colFilters, setColFilters] = useState<Record<string, string>>({});
    const [detailFilters, setDetailFilters] = useState<Record<string, string>>({});
    const [headerDepartmentFilter, setHeaderDepartmentFilter] = useState<string | null>(null);
    const [initialDBLoadDone, setInitialDBLoadDone] = useState(false);
    const [masterData, setMasterData] = useState<Record<string, Set<string>>>({});
    
    // DB Fetching State
    const [dbDateRange, setDbDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
    const [isLoadingDB, setIsLoadingDB] = useState(false);

    const fetchDataFromDB = async () => {
        if (!dbDateRange[0] || !dbDateRange[1]) {
            message.warning("Vui lòng chọn Từ ngày - Đến ngày để tải dữ liệu từ CSDL");
            return;
        }
        setIsLoadingDB(true);
        try {
            const fromDateStr = dbDateRange[0].startOf('day').format('YYYYMMDDHHmm');
            const toDateStr = dbDateRange[1].endOf('day').format('YYYYMMDDHHmm');
            const res = await fetch(`${getBasePath()}/api/xml1/fetch-full?fromDate=${fromDateStr}&toDate=${toDateStr}`);
            
            if (res.ok) {
                const data = await res.json();
                const initializedData = data.map((r: any) => ({
                    ...r,
                    validationResults: r.validationResults || []
                }));
                setRecords(initializedData);
                
                // Set sent records map
                try {
                    const maLienKetList = Array.from(new Set(data.map((r: any) => String(r.summary?.MA_LK)).filter(Boolean)));
                    if (maLienKetList.length > 0) {
                        const sentRes = await fetch(`${getBasePath()}/api/ho-so-da-gui/check-exists`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ maLienKetList })
                        });
                        if (sentRes.ok) {
                            const sentData = await sentRes.json();
                            setSentRecordsSet(new Set(sentData.exists || []));
                        }
                    }
                } catch (e) {
                    console.error('Error checking sent records:', e);
                }

                // Chạy kiểm tra lỗi mặc định sẽ tự động chạy qua useEffect khi records thay đổi
                message.success(`Đã tải ${data.length} hồ sơ từ CSDL.`);
            } else {
                const err = await res.json();
                message.error(`Lỗi: ${err.error}`);
            }
        } catch (error: any) {
            console.error("Error loading data from DB:", error);
            message.error(`Lỗi kết nối: ${error.message}`);
        } finally {
            setIsLoadingDB(false);
        }
    };
    const [isMasterDataLoaded, setIsMasterDataLoaded] = useState(false);
    const isFirstRuleLoad = React.useRef(true);
    const [sentRecordsSet, setSentRecordsSet] = useState<Set<string>>(new Set());
    const [editDeadlineDays, setEditDeadlineDays] = useState<number>(3);
    const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);

    // Load DB
    useEffect(() => {
        let ignore = false;

        const fetchConfig = async () => {
            try {
                const res = await fetch(`${getBasePath()}/api/configs`);
                if (res.ok && !ignore) {
                    const data = await res.json();
                    if (data && typeof data.value === 'number') {
                        setEditDeadlineDays(data.value);
                    }
                }
            } catch (e) {
                console.error("Error fetching config", e);
            }
        };
        fetchConfig();

        const fetchDepts = async () => {
            try {
                const res = await fetch(`${getBasePath()}/api/departments`);
                if (res.ok && !ignore) {
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

        const fetchUser = async () => {
            try {
                const res = await fetch(`${getBasePath()}/api/auth/me`);
                if (res.ok && !ignore) {
                    const data = await res.json();
                    if (data.authenticated && data.user) {
                        setUser(data.user);
                    }
                }
            } catch (e) {
                console.error("Error fetching user", e);
            }
        };
        fetchUser();

        const fetchSpecRules = async () => {
            const res = await getSpecializedRules();
            if (res && res.success) {
                setSpecializedRules((res.data || []).filter((r: any) => r.isActive && r.ruleType !== 'SYSTEM_CONFIG' && r.ruleType !== 'SQL'));
            }
        };
        fetchSpecRules();


        const initDB = async () => {
            // Dùng session cookie để nhận diện việc mở/đóng toàn bộ trình duyệt (cookie không set expires)
            const hasBrowserSession = document.cookie.includes('xml_reader_session_active=1');
            
            if (!hasBrowserSession) {
                // Khởi động lại trình duyệt -> Dọn dẹp DB cũ
                document.cookie = "xml_reader_session_active=1; path=/";
                await clearDB();
                if (!ignore) setInitialDBLoadDone(true);
            } else {
                // Luôn load dữ liệu từ IndexedDB để không bị mất khi chuyển tab/trang hoặc tắt tab
                const saved = await loadRecordsFromDB();
                if (ignore) return;
                if (saved.length > 0) {
                    setRecords(saved);
                    try {
                        const maLienKetList = Array.from(new Set(saved.map(r => String(r.summary?.MA_LK)).filter(Boolean)));
                        if (maLienKetList.length > 0) {
                            const res = await fetch(`${getBasePath()}/api/ho-so-da-gui/check-exists`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ maLienKetList })
                            });
                            if (res.ok) {
                                const data = await res.json();
                                setSentRecordsSet(new Set(data.exists || []));
                            }
                        }
                    } catch (e) {
                        console.error('Error checking sent records cache:', e);
                    }
                }
                setInitialDBLoadDone(true);
            }
        };
        initDB();

        return () => {
            ignore = true;
        };
    }, []);

    // Fetch dynamic master data required by rules
    useEffect(() => {
        if (!isRulesLoaded || !rules || rules.length === 0) {
            setIsMasterDataLoaded(true);
            return;
        }
        
        setIsMasterDataLoaded(false);

        const refs = new Set<string>();
        rules.forEach(rule => {
            if (!rule.active) return;
            
            if (rule.code) {
                const matches = rule.code.matchAll(/EXISTS_IN\(\s*['"]([^'"]+)['"]/g);
                for (const match of matches) {
                    if (match[1]) refs.add(match[1]);
                }
                
                const mismatchMatches = rule.code.matchAll(/CHECK_MISMATCH\(\s*['"]([^'"]+)['"]/g);
                for (const match of mismatchMatches) {
                    if (match[1]) refs.add(match[1]);
                }
                
                const priceMismatchMatches = rule.code.matchAll(/CHECK_PRICE_MISMATCH_MAU03_04\(\s*['"]([^'"]+)['"]/g);
                for (const match of priceMismatchMatches) {
                    if (match[1]) refs.add(match[1]);
                }

                if (rule.code.includes('CHECK_MAU05_PRICE_MISMATCH')) {
                    refs.add('Mau05_PRICE_MAP');
                }
            }
            if (rule.mathExpression) {
                const mathMatches = rule.mathExpression.matchAll(/EXISTS_IN\(\s*['"]([^'"]+)['"]/g);
                for (const match of mathMatches) {
                    if (match[1]) refs.add(match[1]);
                }
                
                const mathMismatchMatches = rule.mathExpression.matchAll(/CHECK_MISMATCH\(\s*['"]([^'"]+)['"]/g);
                for (const match of mathMismatchMatches) {
                    if (match[1]) refs.add(match[1]);
                }
                
                const mathPriceMismatchMatches = rule.mathExpression.matchAll(/CHECK_PRICE_MISMATCH_MAU03_04\(\s*['"]([^'"]+)['"]/g);
                for (const match of mathPriceMismatchMatches) {
                    if (match[1]) refs.add(match[1]);
                }

                if (rule.mathExpression.includes('CHECK_MAU05_PRICE_MISMATCH')) {
                    refs.add('Mau05_PRICE_MAP');
                }
            }
        });

        if (refs.size === 0) {
            setMasterData({});
            setIsMasterDataLoaded(true);
            return;
        }

        const fetchDynamicMaster = async () => {
            try {
                const params = Array.from(refs).join(',');
                const res = await fetch(`${getBasePath()}/api/dynamic-master?refs=${params}`);
                if (res.ok) {
                    const data = await res.json();
                    const parsedData: Record<string, Set<string>> = {};
                    for (const key in data) {
                        parsedData[key] = new Set(data[key]);
                    }
                    setMasterData(parsedData);
                }
            } catch (error) {
                console.error("Error fetching dynamic master data:", error);
            } finally {
                setIsMasterDataLoaded(true);
            }
        };

        fetchDynamicMaster();
    }, [rules, isRulesLoaded]);


    // Re-validate when rules change
    useEffect(() => {
        if (!isRulesLoaded) return;
        if (!initialDBLoadDone) return;
        if (!isMasterDataLoaded) return;

        let ignore = false;
        
        // Dùng async function ngoài setRecords để không block UI
        const runAsyncRevalidation = () => {
            // Lấy current records state mà không cần đưa vào dependency array
            setRecords(prev => {
                if (prev.length === 0 || ignore) return prev;
                
                // Ngăn chặn việc tự động validate lại (gây giật màn hình Đang xử lý...)
                // nếu dữ liệu được load từ IndexedDB đã có sẵn kết quả validate.
                // Người dùng có thể chủ động bấm "Chạy lại kiểm tra" nếu muốn áp dụng rule mới.
                const needsValidation = prev.some(r => !r.validationResults);
                if (!needsValidation) return prev;

                // Khởi chạy async processing tách biệt với luồng render
                setTimeout(async () => {
                    if (ignore) return;
                    setProcessingProgress({ current: 0, total: prev.length });
                    
                    const validator = new ValidationEngine(rules, masterData);
                    validator.setContextRecords(prev);
                    
                    const icd10Map = await fetchIcd10Map(prev);
                    validator.setExternalContext({ icd10Map });
                    
                    const newRecords = [...prev];
                    const VALIDATION_CHUNK_SIZE = 50;
                    for (let i = 0; i < newRecords.length; i += VALIDATION_CHUNK_SIZE) {
                        if (ignore) return;
                        const chunk = newRecords.slice(i, i + VALIDATION_CHUNK_SIZE);
                        chunk.forEach(r => {
                            r.validationResults = validator.validate(r);
                        });
                        setProcessingProgress({ current: i + chunk.length, total: prev.length });
                        await new Promise(resolve => setTimeout(resolve, 0));
                    }
                    
                    if (ignore) return;
                    setRecords(newRecords);
                    setProcessingProgress(null);
                    
                    if (selectedRecord) {
                        const updatedSelected = newRecords.find(r => r.id === selectedRecord.id ||
                            (r.sourceFile === selectedRecord.sourceFile && r.summary?.MA_LK === selectedRecord.summary?.MA_LK));
                        if (updatedSelected) setSelectedRecord(updatedSelected);
                    }
                }, 0);
                
                // Trả về prev tạm thời trong lúc chờ async chạy xong
                return prev;
            });
        };
        
        runAsyncRevalidation();

        return () => {
            ignore = true;
        };
    }, [rules, isRulesLoaded, initialDBLoadDone, masterData]); // Remove selectedRecord to avoid loop, handled inside

    // Handle File Upload
    const handleFileUpload = async (fileList: File[]) => {
        if (!fileList || fileList.length === 0) return;

        // Clear existing data before processing new upload
        setRecords([]);
        await clearDB();

        setProcessingProgress({ current: 0, total: fileList.length });
        const validator = new ValidationEngine(rules, masterData);
        // Load old records to support global duplicate checking
        const existingRecords = records || [];
        // Note: For large file uploads, we can construct the context combining existing and newly uploaded.
        // But for performance, setting initial is enough. It will re-validate once all batches finish later if needed, 
        // or we just set current known. 
        validator.setContextRecords(existingRecords);

        const BATCH_SIZE = 10;
        let processedCount = 0;
        const allUploadedMaLk = new Set<string>();

        try {
            for (let i = 0; i < fileList.length; i += BATCH_SIZE) {
                const batch = fileList.slice(i, i + BATCH_SIZE);
                const batchRecords: ExtendedHosoRecord[] = [];

                // Process batch concurrently
                await Promise.all(batch.map(async (file) => {
                    try {
                        const text = await file.text();
                        const parsed = parseXmlContent(text);
                        parsed.records.forEach(r => {
                            // Update context dynamically for current record if batch has new items
                            // Ideally, we could re-merge batch records but this is a lightweight approach
                            const newRecord = {
                                ...r,
                                sourceFile: file.name,
                                uuid: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
                            };
                            
                            // To support real cross-record during batch load, we might need all batch records
                            // We push it to batchRecords first
                            batchRecords.push(newRecord);
                            if (newRecord.summary?.MA_LK) allUploadedMaLk.add(String(newRecord.summary.MA_LK));
                        });
                    } catch (error: any) {
                        message.error(`Lỗi đọc file ${file.name}: ${error.message}`);
                    }
                }));

                // Update validator context dynamically with new batch items
                validator.setContextRecords([...existingRecords, ...batchRecords]);

                const icd10Map = await fetchIcd10Map(batchRecords);
                validator.setExternalContext({ icd10Map });

                // Validate in chunks to prevent blocking the main thread (for huge single XML files)
                const VALIDATION_CHUNK_SIZE = 50;
                for (let j = 0; j < batchRecords.length; j += VALIDATION_CHUNK_SIZE) {
                    const chunk = batchRecords.slice(j, j + VALIDATION_CHUNK_SIZE);
                    chunk.forEach(r => {
                        r.validationResults = validator.validate(r);
                    });
                    // Yield to browser to keep UI responsive
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                // Save batch to DB and State
                if (batchRecords.length > 0) {
                    await addRecordsToDB(batchRecords);
                    setRecords(prev => [...prev, ...batchRecords]);
                }

                processedCount += batch.length;
                setProcessingProgress({ current: Math.min(processedCount, fileList.length), total: fileList.length });

                // Yield to main thread to allow UI render
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            if (allUploadedMaLk.size > 0) {
                try {
                    const res = await fetch(`${getBasePath()}/api/ho-so-da-gui/check-exists`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ maLienKetList: Array.from(allUploadedMaLk) })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setSentRecordsSet(prev => {
                            const next = new Set(prev);
                            data.exists.forEach((m: string) => next.add(m));
                            return next;
                        });
                    }
                } catch (e) {
                    console.error('Error checking sent records:', e);
                }
            }

            message.success(`Đã xử lý xong ${fileList.length} file.`);

        } catch (err: any) {
            message.error(err.message || 'Có lỗi xảy ra trong quá trình xử lý');
        } finally {
            setProcessingProgress(null);
        }
    };

    const uploadProps: UploadProps = {
        name: 'file',
        multiple: true,
        accept: '.xml',
        showUploadList: false,
        beforeUpload: (file, fileList) => {
            // Antd calls beforeUpload for EACH file. We only want to run ONCE per batch.
            if (fileList.length > 0 && file === fileList[0]) {
                handleFileUpload(fileList);
            }
            return false;
        },
        fileList: []
    };

    const handleSaveErrorsToDB = async () => {
        const targetRecords = getFilteredRecords();
        if (targetRecords.length === 0) {
            message.warning("Không có dữ liệu để lưu");
            return;
        }

        const errorsToSave: any[] = [];
        targetRecords.forEach((record) => {
            const errors = record.validationResults.filter(v => v.isError);
            if (errors.length > 0) {
                const ngayVaoNoiTru = record.summary?.NGAY_VAO_NOI_TRU;
                errors.forEach(err => {
                    let code = '';
                    let name = '';
                    let ngayYL = null;
                    let ngayTHYL = null;
                    let ngayKQ = null;
                    let maKhoa = renderValue(record.summary?.MA_KHOA);
                    let maBacSi = '';
                    let tenBacSi = '';
                    let nguoiTH = '';
                    let tenNguoiTH = '';
                    let maMay = '';
                    let donGiaBH = '';

                    if (err.xmlType && err.index !== undefined) {
                        const group = record.groups.find(g => g.type === err.xmlType);
                        if (group) {
                            const list = getXmlDataList(group);
                            const item = list[err.index];
                            if (item) {
                                code = item.MA_DICH_VU || item.MA_THUOC || item.MA_VAT_TU || '';
                                name = item.TEN_DICH_VU || item.TEN_THUOC || item.TEN_VAT_TU || '';
                                ngayYL = item.NGAY_YL;
                                ngayTHYL = item.NGAY_TH_YL;
                                ngayKQ = item.NGAY_KQ;
                                if (item.MA_KHOA) maKhoa = renderValue(item.MA_KHOA);
                                
                                maBacSi = item.MA_BAC_SI || item.MA_BS || '';
                                tenBacSi = item.TEN_BAC_SI || item.TEN_BS || '';
                                nguoiTH = item.NGUOI_THUC_HIEN || item.MA_NGUOI_TH || '';
                                tenNguoiTH = item.TEN_NGUOI_THUC_HIEN || '';
                                maMay = item.MA_MAY || '';
                                donGiaBH = item.DON_GIA || item.DON_GIA_BH || '';
                            }
                        }
                    }

                    errorsToSave.push({
                        ma_lk: renderValue(record.summary?.MA_LK),
                        ma_bn: renderValue(record.summary?.MA_BN),
                        ma_khoa: maKhoa,
                        ho_ten: renderValue(record.summary?.HO_TEN),
                        ma_the: renderValue(record.summary?.MA_THE_BHYT),
                        ngay_vao: record.summary?.NGAY_VAO,
                        ngay_ra: record.summary?.NGAY_RA,
                        ngay_yl: ngayYL,
                        ngay_th_yl: ngayTHYL,
                        ngay_kq: ngayKQ,
                        ngay_vao_noi_tru: ngayVaoNoiTru,
                        ma_dv: renderValue(code),
                        ten_dv: renderValue(name),
                        ma_doituong_kcb: renderValue(record.summary?.MA_DOITUONG_KCB),
                        ma_bac_si: maBacSi,
                        ten_bac_si: tenBacSi,
                        nguoi_th: nguoiTH,
                        ten_nguoi_th: tenNguoiTH,
                        ma_may: maMay,
                        don_gia_bh: donGiaBH,
                        chi_tiet_loi: `[${err.xmlType}] ${err.message || err.ruleName}`,
                        sourceType: 'XML'
                    });
                });
            }
        });

        if (errorsToSave.length === 0) {
            message.info("Không có hồ sơ nào bị lỗi để lưu");
            return;
        }

        try {
            message.loading({ content: 'Đang lưu lỗi vào hệ thống...', key: 'saveErrors' });
            const res = await fetch('/api/error-management/xml-errors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ errors: errorsToSave })
            });

            if (res.ok) {
                const data = await res.json();
                message.success({ content: `Lưu thành công ${data.count} lỗi vào hệ thống!`, key: 'saveErrors' });
            } else {
                const err = await res.json();
                message.error({ content: `Lỗi: ${err.error}`, key: 'saveErrors' });
            }
        } catch (error) {
            message.error({ content: 'Không thể kết nối đến máy chủ', key: 'saveErrors' });
        }
    };

    const handleRunSpecializedRule = (rule: any) => {
        if (!rule.logicConfig) {
            message.error("Quy tắc chưa có cấu hình logic");
            return;
        }

        setIsSpecializedChecking(true);
        message.loading({ content: `Đang kiểm tra ${rule.name}...`, key: 'spec_check' });
        
        setTimeout(() => {
            let result: any;
            if (rule.ruleType === 'DUPLICATE_BED' || rule.logicConfig?.type === 'DUPLICATE_BED' || rule.slug?.includes('trung-giuong')) {
                result = runDuplicateBedRule(records, rule.logicConfig);
            } else if (rule.ruleType === 'DUPLICATE_DOCTOR' || rule.logicConfig?.type === 'DUPLICATE_DOCTOR' || rule.slug?.includes('trung-bac-si')) {
                result = runDuplicateDoctorRule(records, rule.logicConfig);
            } else if (rule.ruleType === 'MACHINE_CHECK' || rule.logicConfig?.type === 'MACHINE_CHECK' || rule.slug?.includes('may')) {
                result = runMachineCheckRule(records, rule.logicConfig);
            }

            if (result) {
                const overlaps = result.overlaps as Set<string>;
                if (overlaps.size > 0) {
                    const newRecords = records.map(r => {
                        if (overlaps.has(r.id)) {
                            // avoid duplicate tags
                            const existingResults = r.validationResults || [];
                            const hasThisError = existingResults.some((e: any) => e.message?.includes(rule.name));
                            if (!hasThisError) {
                                return {
                                    ...r,
                                    validationResults: [
                                        ...existingResults,
                                        { 
                                            ruleId: `CHUYEN_DE_${rule.id || 'RULE'}`,
                                            ruleName: rule.name,
                                            type: 'Cảnh báo',
                                            xmlType: 'XML1',
                                            field: 'MA_LK',
                                            message: `[Chuyên đề] ${rule.name}`,
                                            isError: true 
                                        } as ValidationResult
                                    ]
                                };
                            }
                        }
                        return r;
                    });
                    setRecords(newRecords);
                    message.success({ content: `Phát hiện ${overlaps.size} hồ sơ vi phạm chuyên đề ${rule.name}`, key: 'spec_check', duration: 4 });
                } else {
                    message.success({ content: `Không phát hiện vi phạm chuyên đề ${rule.name}`, key: 'spec_check', duration: 3 });
                }
            } else {
                message.warning({ content: `Chuyên đề ${rule.name} (Loại: ${rule.ruleType}) chưa được hỗ trợ kiểm tra trực tiếp.`, key: 'spec_check', duration: 4 });
            }
            setIsSpecializedChecking(false);
        }, 100);
    };

    const handleRunAllSpecializedRules = () => {
        setIsSpecializedChecking(true);
        message.loading({ content: `Đang chạy kiểm tra ${specializedRules.length} chuyên đề...`, key: 'spec_check_all' });
        
        setTimeout(() => {
            let totalOverlaps = 0;
            let currentRecords = [...records];
            
            for (const rule of specializedRules) {
                if (!rule.logicConfig) continue;
                
                let result: any;
                if (rule.ruleType === 'DUPLICATE_BED' || rule.logicConfig?.type === 'DUPLICATE_BED' || rule.slug?.includes('trung-giuong')) {
                    result = runDuplicateBedRule(currentRecords, rule.logicConfig);
                } else if (rule.ruleType === 'DUPLICATE_DOCTOR' || rule.logicConfig?.type === 'DUPLICATE_DOCTOR' || rule.slug?.includes('trung-bac-si')) {
                    result = runDuplicateDoctorRule(currentRecords, rule.logicConfig);
                } else if (rule.ruleType === 'MACHINE_CHECK' || rule.logicConfig?.type === 'MACHINE_CHECK' || rule.slug?.includes('may')) {
                    result = runMachineCheckRule(currentRecords, rule.logicConfig);
                }
                
                if (result) {
                    const overlaps = result.overlaps as Set<string>;
                    if (overlaps.size > 0) {
                        totalOverlaps += overlaps.size;
                        currentRecords = currentRecords.map(r => {
                            if (overlaps.has(r.id)) {
                                const existingResults = r.validationResults || [];
                                const hasThisError = existingResults.some((e: any) => e.message?.includes(rule.name));
                                if (!hasThisError) {
                                    return {
                                        ...r,
                                        validationResults: [
                                            ...existingResults,
                                            { 
                                                ruleId: `CHUYEN_DE_${rule.id || 'RULE'}`,
                                                ruleName: rule.name,
                                                type: 'Cảnh báo',
                                                xmlType: 'XML1',
                                                field: 'MA_LK',
                                                message: `[Chuyên đề] ${rule.name}`,
                                                isError: true 
                                            } as ValidationResult
                                        ]
                                    };
                                }
                            }
                            return r;
                        });
                    }
                }
            }
            
            setRecords(currentRecords);
            setIsSpecializedChecking(false);
            if (totalOverlaps > 0) {
                message.success({ content: `Đã phát hiện tổng cộng ${totalOverlaps} lỗi trên các hồ sơ`, key: 'spec_check_all', duration: 4 });
            } else {
                message.success({ content: `Tuyệt vời! Không phát hiện vi phạm chuyên đề nào`, key: 'spec_check_all', duration: 3 });
            }
        }, 100);
    };

    const handleExportSpecializedRule = (rule: any) => {
        if (!rule.logicConfig) {
            message.error("Quy tắc chưa có cấu hình logic");
            return;
        }

        setIsSpecializedChecking(true);
        message.loading({ content: `Đang xuất báo cáo ${rule.name}...`, key: 'spec_export' });

        setTimeout(async () => {
            try {
                if (rule.ruleType === 'DUPLICATE_BED' || rule.logicConfig?.type === 'DUPLICATE_BED' || rule.slug?.includes('trung-giuong') || rule.ruleType === 'MACHINE_CHECK' || rule.logicConfig?.type === 'MACHINE_CHECK' || rule.slug?.includes('may')) {
                    const result = runDuplicateBedRule(records, rule.logicConfig, departments, {});
                    if (result && result.results && result.results.length > 0) {
                        await exportDuplicateBedExcel(result.results, rule.name);
                        message.success({ content: `Đã xuất báo cáo ${rule.name}`, key: 'spec_export', duration: 3 });
                    } else {
                        message.warning({ content: `Không có dữ liệu vi phạm để xuất`, key: 'spec_export', duration: 3 });
                    }
                } else if (rule.ruleType === 'DUPLICATE_DOCTOR' || rule.logicConfig?.type === 'DUPLICATE_DOCTOR' || rule.slug?.includes('trung-bac-si')) {
                    const result = runDuplicateDoctorRule(records, rule.logicConfig, departments, {});
                    if (result && result.results && result.results.length > 0) {
                        await exportDuplicateDoctorExcel(result.results, rule.name);
                        message.success({ content: `Đã xuất báo cáo ${rule.name}`, key: 'spec_export', duration: 3 });
                    } else {
                        message.warning({ content: `Không có dữ liệu vi phạm để xuất`, key: 'spec_export', duration: 3 });
                    }
                } else {
                    message.warning({ content: `Chuyên đề ${rule.name} chưa được hỗ trợ xuất báo cáo.`, key: 'spec_export', duration: 3 });
                }
            } catch (error) {
                console.error(error);
                message.error({ content: `Lỗi xuất báo cáo`, key: 'spec_export', duration: 3 });
            } finally {
                setIsSpecializedChecking(false);
            }
        }, 100);
    };

    const handleSaveToDBForViewer = async () => {
        const targetRecords = getFilteredRecords();
        if (targetRecords.length === 0) {
            message.warning("Không có hồ sơ nào để lưu");
            return;
        }

        try {
            message.loading({ content: 'Đang kiểm tra trùng lặp...', key: 'saveXMLDB' });
            
            const maLkList = targetRecords.map(r => String(r.id || r.summary?.MA_LK)).filter(Boolean);
            const checkRes = await fetch('/api/xml1/check-exists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maLkList })
            });

            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.exists && checkData.exists.length > 0) {
                    Modal.confirm({
                        title: 'Cảnh báo trùng lặp hồ sơ',
                        content: `Phát hiện ${checkData.exists.length} hồ sơ đã tồn tại trong Database. Việc tiếp tục lưu sẽ tự động bỏ qua nếu dữ liệu giống hệt, hoặc cập nhật phiên bản mới nếu có thay đổi. Bạn có muốn tiếp tục?`,
                        okText: 'Tiếp tục lưu',
                        cancelText: 'Hủy bỏ',
                        onOk: () => proceedSaveToDBForViewer(targetRecords)
                    });
                    return;
                }
            }

            // No duplicates or error checking, proceed directly
            proceedSaveToDBForViewer(targetRecords);

        } catch (error: any) {
            message.error({ content: `Lỗi kết nối: ${error.message}`, key: 'saveXMLDB' });
        }
    };

    const proceedSaveToDBForViewer = async (targetRecords: ExtendedHosoRecord[]) => {
        try {
            message.loading({ content: 'Đang gửi dữ liệu...', key: 'saveXMLDB' });
            
            const payload = targetRecords.map(r => {
                return {
                    id: r.id || r.summary?.MA_LK,
                    summary: r.summary,
                    groups: r.groups,
                };
            });

            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            const formData = new FormData();
            formData.append('file', blob, 'filtered_records.json');

            const res = await fetch('/api/xml-import-json', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                message.success({ content: data.message || 'Bắt đầu lưu vào CSDL.', key: 'saveXMLDB' });
            } else {
                const err = await res.json();
                message.error({ content: `Lỗi: ${err.error || 'Có lỗi xảy ra'}`, key: 'saveXMLDB' });
            }
        } catch (error: any) {
            message.error({ content: `Lỗi kết nối: ${error.message}`, key: 'saveXMLDB' });
        }
    };

    // --- Header Actions ---
    const renderHeaderActions = () => (
        <div className="flex justify-end gap-3 mb-4">
            <Button
                onClick={handleSaveErrorsToDB}
                icon={<CloudUploadOutlined />}
                type="primary"
                className="bg-blue-600 shadow-md shadow-blue-200"
            >
                Lưu lỗi vào CSDL
            </Button>
            <Button
                onClick={() => router.push('/report')}
                icon={<FileExcelOutlined />}
                className="bg-white text-green-700 border-green-200 hover:border-green-400 hover:text-green-800"
            >
                Xem báo cáo chi tiết
            </Button>
            <Button
                onClick={handleExportExcel}
                icon={<FileExcelOutlined />}
                className="bg-green-600 text-white hover:bg-green-700 border-none shadow-md shadow-green-200"
            >
                Xuất Excel Tổng Hợp
            </Button>
        </div>
    );

    // Columns for Main List of Records
    const mainColumns: ColumnsType<ExtendedHosoRecord> = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, i) => i + 1
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 100,
            align: 'center',
            render: (_, record) => {
                const errors = record.validationResults.filter(v => v.isError);
                return errors.length > 0
                    ? <Tag icon={<CloseCircleOutlined />} color="error">Lỗi ({errors.length})</Tag>
                    : <Tag icon={<CheckCircleOutlined />} color="success">Đạt</Tag>;
            },
            filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                <div className="p-2 bg-white rounded-xl shadow-xl border border-slate-100 w-48 font-sans">
                    <div className="flex flex-col gap-1">
                        <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Lọc trạng thái</div>
                        {[
                            { label: 'Có lỗi', value: 'ERROR', color: 'bg-red-500' },
                            { label: 'Hợp lệ', value: 'VALID', color: 'bg-green-500' }
                        ].map(opt => {
                            const isSelected = selectedKeys.includes(opt.value);
                            return (
                                <div
                                    key={opt.value}
                                    className={`px-3 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50 text-slate-600'}`}
                                    onClick={() => {
                                        const newKeys = isSelected ? [] : [opt.value];
                                        setSelectedKeys(newKeys);
                                        confirm({ closeDropdown: true });
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                                        <span>{opt.label}</span>
                                    </div>
                                    {isSelected && <CheckCircleOutlined />}
                                </div>
                            );
                        })}
                        <div className="h-px bg-slate-100 my-1" />
                        <Button
                            type="text"
                            size="small"
                            className="text-slate-400 hover:text-slate-600 text-xs w-full text-left pl-3"
                            onClick={() => { clearFilters && clearFilters(); confirm({ closeDropdown: true }); }}
                        >
                            Xóa bộ lọc
                        </Button>
                    </div>
                </div>
            ),
            onFilter: (value, record) => {
                const hasError = record.validationResults.some(v => v.isError);
                return value === 'ERROR' ? hasError : !hasError;
            }
        },
        {
            title: (
                <div className="flex flex-col gap-1 items-center">
                    <span>Trạng thái Sửa BA</span>
                </div>
            ),
            key: 'edit_status',
            width: 130,
            align: 'center',
            render: (_, record) => {
                const ngayRaStr = String(record.summary?.NGAY_RA || '');
                if (!ngayRaStr || ngayRaStr.length < 8) return <Tag>Không rõ</Tag>;
                
                const year = parseInt(ngayRaStr.substring(0, 4));
                const month = parseInt(ngayRaStr.substring(4, 6)) - 1;
                const day = parseInt(ngayRaStr.substring(6, 8));
                let hour = 0; let min = 0;
                if (ngayRaStr.length >= 12) {
                    hour = parseInt(ngayRaStr.substring(8, 10));
                    min = parseInt(ngayRaStr.substring(10, 12));
                }
                const dateNgayRa = new Date(year, month, day, hour, min);
                const deadline = addWorkingDays(dateNgayRa, editDeadlineDays);
                const timeInfo = calculateRemainingTime(deadline);
                
                return timeInfo.isExpired 
                    ? <Tag color="error" className="m-0 border-red-300">Hết hạn</Tag> 
                    : <Tag color="success" className="m-0 border-green-300">Còn hạn</Tag>;
            }
        },
        {
            title: (
                <div className="flex flex-col gap-1 items-center">
                    <span className="flex items-center justify-center gap-2">
                        Thời gian còn lại
                        {user?.role === 'ADMIN' && (
                            <Tooltip title={`Cấu hình hạn sửa (đang là ${editDeadlineDays} ngày)`}>
                                <SettingOutlined 
                                    className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); setIsConfigModalVisible(true); }}
                                />
                            </Tooltip>
                        )}
                    </span>
                </div>
            ),
            key: 'remaining_time',
            width: 150,
            align: 'center',
            render: (_, record) => {
                const ngayRaStr = String(record.summary?.NGAY_RA || '');
                if (!ngayRaStr || ngayRaStr.length < 8) return '-';
                
                const year = parseInt(ngayRaStr.substring(0, 4));
                const month = parseInt(ngayRaStr.substring(4, 6)) - 1;
                const day = parseInt(ngayRaStr.substring(6, 8));
                let hour = 0; let min = 0;
                if (ngayRaStr.length >= 12) {
                    hour = parseInt(ngayRaStr.substring(8, 10));
                    min = parseInt(ngayRaStr.substring(10, 12));
                }
                const dateNgayRa = new Date(year, month, day, hour, min);
                const deadline = addWorkingDays(dateNgayRa, editDeadlineDays);
                const timeInfo = calculateRemainingTime(deadline);
                
                return <span className={timeInfo.isExpired ? 'text-red-500 font-medium text-xs' : 'text-green-600 font-medium text-xs'}>{timeInfo.text}</span>;
            }
        },
        {
            title: (
                <div className="flex flex-col gap-1">
                    <span>Mã LK</span>
                    <Input
                        placeholder="Tìm..."
                        size="small"
                        allowClear
                        value={colFilters.MA_LK}
                        onChange={(e) => setColFilters(prev => ({ ...prev, MA_LK: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ),
            dataIndex: ['summary', 'MA_LK'],
            key: 'MA_LK',
            render: (text) => {
                const isSent = sentRecordsSet.has(String(text));
                return (
                    <div className="flex items-center gap-1">
                        <span>{text}</span>
                        {isSent && <Tag color="orange" className="m-0 px-1 text-[10px] leading-tight font-bold border-orange-300">Đã gửi</Tag>}
                    </div>
                );
            }
        },
        {
            title: (
                <div className="flex flex-col gap-1">
                    <span>Mã BN</span>
                    <Input
                        placeholder="Tìm..."
                        size="small"
                        allowClear
                        value={colFilters.MA_BN}
                        onChange={(e) => setColFilters(prev => ({ ...prev, MA_BN: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ),
            dataIndex: ['summary', 'MA_BN'],
            key: 'MA_BN',
            width: 120,
        },
        {
            title: (
                <div className="flex flex-col gap-1">
                    <span>Mã Khoa</span>
                    <Input
                        placeholder="Tìm..."
                        size="small"
                        allowClear
                        value={colFilters.MA_KHOA}
                        onChange={(e) => setColFilters(prev => ({ ...prev, MA_KHOA: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ),
            key: 'MA_KHOA',
            width: 100,
            render: (_, record) => {
                const code = renderValue(record.summary?.MA_KHOA);
                return <div className="font-medium text-blue-700">{code}</div>;
            }
        },
        {
            title: 'Tên Khoa',
            key: 'TEN_KHOA',
            width: 200,
            render: (_, record) => {
                const code = renderValue(record.summary?.MA_KHOA);
                const name = code.split(';').map((c: string) => departments[c] || c).join('; ');
                return <div className="text-slate-600 truncate" title={name}>{name}</div>;
            }
        },
        {
            title: 'Họ tên',
            dataIndex: ['summary', 'HO_TEN'],
            key: 'HO_TEN',
            width: 200,
        },
        {
            title: 'Ngày vào',
            dataIndex: ['summary', 'NGAY_VAO'],
            key: 'NGAY_VAO',
            render: (text) => formatDateTime(text)
        },
        {
            title: (
                <div className="flex flex-col gap-1">
                    <span>Ngày ra</span>
                    <Input
                        placeholder="Tìm..."
                        size="small"
                        allowClear
                        value={colFilters.NGAY_RA}
                        onChange={(e) => setColFilters(prev => ({ ...prev, NGAY_RA: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ),
            dataIndex: ['summary', 'NGAY_RA'],
            key: 'NGAY_RA',
            render: (text) => formatDateTime(text)
        },
        {
            title: 'Mã ĐT',
            dataIndex: ['summary', 'MA_DOITUONG_KCB'],
            key: 'MA_DOITUONG_KCB',
            width: 80,
            render: (text) => <div className="text-center font-medium bg-slate-100 rounded px-1">{text}</div>
        },
        {
            title: (
                <div className="flex flex-col gap-1">
                    <span>Mã Loại KCB</span>
                    <Input
                        placeholder="Tìm..."
                        size="small"
                        allowClear
                        value={colFilters.MA_LOAI_KCB}
                        onChange={(e) => setColFilters(prev => ({ ...prev, MA_LOAI_KCB: e.target.value }))}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            ),
            dataIndex: ['summary', 'MA_LOAI_KCB'],
            key: 'MA_LOAI_KCB',
            width: 120,
            render: (text) => <div className="text-center font-medium bg-blue-50 text-blue-700 rounded px-1">{text}</div>
        },
        {
            title: 'File Nguồn',
            dataIndex: 'sourceFile',
            key: 'sourceFile',
            ellipsis: true
        }
    ];

    // Filter main records (client side filtering for simple cases if needed, but Table handles it mostly)
    // We only use this global 'filtered' for Export currently or custom filtering logic outside Table
    const getFilteredRecords = () => {
        let result = records.filter(r => {
            const isErr = r.validationResults.some(v => v.isError);
            const isSent = sentRecordsSet.has(String(r.summary?.MA_LK));
            
            if (mainFilter === 'ALL_SENT') return isSent;
            if (mainFilter === 'ALL_UNSENT') return !isSent;
            if (mainFilter === 'ERROR') return isErr;
            if (mainFilter === 'ERROR_SENT') return isErr && isSent;
            if (mainFilter === 'ERROR_UNSENT') return isErr && !isSent;
            if (mainFilter === 'VALID') return !isErr;
            if (mainFilter === 'VALID_SENT') return !isErr && isSent;
            if (mainFilter === 'VALID_UNSENT') return !isErr && !isSent;
            return true;
        });

        // Column Filters
        if (colFilters.MA_LK) {
            const k = colFilters.MA_LK.toLowerCase();
            result = result.filter(r => String(r.summary?.MA_LK || '').toLowerCase().includes(k));
        }
        if (colFilters.MA_BN) {
            const k = colFilters.MA_BN.toLowerCase();
            result = result.filter(r => String(r.summary?.MA_BN || '').toLowerCase().includes(k));
        }
        if (colFilters.MA_KHOA) {
            const k = colFilters.MA_KHOA.toLowerCase();
            result = result.filter(r => String(r.summary?.MA_KHOA || '').toLowerCase().includes(k));
        }
        if (colFilters.MA_LOAI_KCB) {
            const k = colFilters.MA_LOAI_KCB.toLowerCase();
            result = result.filter(r => String(r.summary?.MA_LOAI_KCB || '').toLowerCase().includes(k));
        }
        if (colFilters.NGAY_RA) {
            const k = colFilters.NGAY_RA.toLowerCase();
            result = result.filter(r => {
                const formatted = formatDateTime(r.summary?.NGAY_RA) || '';
                const raw = String(r.summary?.NGAY_RA || '');
                return formatted.toLowerCase().includes(k) || raw.toLowerCase().includes(k);
            });
        }


        if (headerDepartmentFilter) {
            result = result.filter(r => {
                const codes = String(r.summary?.MA_KHOA || '').split(';');
                return codes.includes(headerDepartmentFilter);
            });
        }

        if (searchText) {
            const lower = searchText.toLowerCase();
            result = result.filter(r =>
            (r.summary?.HO_TEN?.toLowerCase().includes(lower) ||
                r.summary?.MA_LK?.toLowerCase().includes(lower))
            );
        }
        return result;
    };

    const handleExportExcel = async () => {
        // Logic same as before, adapting to getFilteredRecords()
        const targetRecords = getFilteredRecords();
        if (targetRecords.length === 0) {
            message.warning("Không có dữ liệu để xuất");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Báo cáo lỗi');
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 5 },
            { header: 'Mã LK', key: 'ma_lk', width: 14 },
            { header: 'Mã BN', key: 'ma_bn', width: 14 },
            { header: 'Mã Khoa', key: 'ma_khoa', width: 10 },
            { header: 'Tên Khoa', key: 'ten_khoa', width: 25 },
            { header: 'Họ tên', key: 'ho_ten', width: 25 },
            { header: 'Mã thẻ', key: 'ma_the', width: 20 },
            { header: 'Ngày vào', key: 'ngay_vao', width: 16 },
            { header: 'Ngày ra', key: 'ngay_ra', width: 16 },
            { header: 'Ngày YL', key: 'ngay_yl', width: 16 },
            { header: 'Ngày TH YL', key: 'ngay_th_yl', width: 16 },
            { header: 'Ngày KQ', key: 'ngay_kq', width: 16 },
            { header: 'Ngày Vào Nội Trú', key: 'ngay_vao_noi_tru', width: 16 },
            { header: 'Mã DV/Thuốc', key: 'ma_dv', width: 15 },
            { header: 'Tên DV/Thuốc', key: 'ten_dv', width: 40 },
            { header: 'Đơn giá BH', key: 'don_gia_bh', width: 15 },
            { header: 'Mã đối tượng KCB', key: 'ma_doituong_kcb', width: 15 },
            { header: 'Chi tiết lỗi', key: 'error', width: 60 },
        ];
        worksheet.getRow(1).font = { bold: true };

        targetRecords.forEach((record, index) => {
            const errors = record.validationResults.filter(v => v.isError);
            const ngayVaoNoiTru = formatDateTime(record.summary?.NGAY_VAO_NOI_TRU);

            if (errors.length === 0) {
                worksheet.addRow({
                    stt: index + 1,
                    ma_lk: renderValue(record.summary?.MA_LK),
                    ma_bn: renderValue(record.summary?.MA_BN),
                    ma_khoa: renderValue(record.summary?.MA_KHOA),
                    ho_ten: renderValue(record.summary?.HO_TEN),
                    ma_the: renderValue(record.summary?.MA_THE_BHYT),
                    ngay_vao: formatDateTime(record.summary?.NGAY_VAO),
                    ngay_ra: formatDateTime(record.summary?.NGAY_RA),

                    ngay_vao_noi_tru: ngayVaoNoiTru,
                    ma_doituong_kcb: renderValue(record.summary?.MA_DOITUONG_KCB)
                });
            } else {
                errors.forEach(err => {
                    let code = '';
                    let name = '';
                    let ngayYL = '';
                    let ngayTHYL = '';
                    let ngayKQ = '';
                    let donGiaBh = '';
                    let maKhoa = renderValue(record.summary?.MA_KHOA);

                    if (err.xmlType && err.index !== undefined) {
                        const group = record.groups.find(g => g.type === err.xmlType);
                        if (group) {
                            const list = getXmlDataList(group);
                            const item = list[err.index];
                            if (item) {
                                code = item.MA_DICH_VU || item.MA_THUOC || item.MA_VAT_TU || '';
                                name = item.TEN_DICH_VU || item.TEN_THUOC || item.TEN_VAT_TU || '';
                                ngayYL = formatDateTime(item.NGAY_YL);
                                ngayTHYL = formatDateTime(item.NGAY_TH_YL);
                                ngayKQ = formatDateTime(item.NGAY_KQ);
                                donGiaBh = renderValue(item.DON_GIA_BH);
                                if (item.MA_KHOA) maKhoa = renderValue(item.MA_KHOA);
                            }
                        }
                    }
                    worksheet.addRow({
                        stt: index + 1,
                        ma_lk: renderValue(record.summary?.MA_LK),
                        ma_bn: renderValue(record.summary?.MA_BN),
                        ma_khoa: maKhoa,
                        ten_khoa: maKhoa.split(';').map((c: string) => departments[c] || c).join('; '),
                        ho_ten: renderValue(record.summary?.HO_TEN),
                        ma_the: renderValue(record.summary?.MA_THE_BHYT),
                        ngay_vao: formatDateTime(record.summary?.NGAY_VAO),
                        ngay_ra: formatDateTime(record.summary?.NGAY_RA),
                        ngay_yl: ngayYL,
                        ngay_th_yl: ngayTHYL,
                        ngay_kq: ngayKQ,
                        ngay_vao_noi_tru: ngayVaoNoiTru,
                        ma_doituong_kcb: renderValue(record.summary?.MA_DOITUONG_KCB),
                        ma_dv: renderValue(code),
                        ten_dv: renderValue(name),
                        don_gia_bh: donGiaBh,
                        error: `[${err.xmlType}] ${err.message || err.ruleName}`
                    });
                });
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Bao_cao_loi_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    // Render Detail View
    const renderDetailView = () => {
        if (!selectedRecord) return null;

        const isSent = sentRecordsSet.has(String(selectedRecord.summary?.MA_LK));
        const hasError = selectedRecord.validationResults.some(v => v.isError);

        const items = selectedRecord.groups.map(group => {
            const list = getXmlDataList(group);

            // Apply Filters to List and keep track of original index
            const filteredList = list.map((item, index) => ({ item, originalIndex: index })).filter(({ item }) => {
                return Object.entries(detailFilters).every(([key, value]) => {
                    if (!value) return true;
                    // Generic value lookup
                    const val = renderValue(item[key]);
                    return val.toLowerCase().includes(value.toLowerCase());
                });
            }).map(({ item, originalIndex }) => ({ ...item, __originalIndex: originalIndex }));

            const columns = getDynamicColumns(filteredList, rules, group.type, detailFilters, setDetailFilters);
            const isActive = activeTab === group.type;
            const hasError = selectedRecord.validationResults.some(v => v.xmlType === group.type && v.isError);
            const errorCount = selectedRecord.validationResults.filter(v => v.xmlType === group.type && v.isError).length;

            return {
                key: group.type,
                label: (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all border ${isActive
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200'
                        : hasError
                            ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}>
                        <span className="font-bold text-xs tracking-wide">{group.type}</span>
                        <Badge
                            count={filteredList.length}
                            style={{
                                backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                                color: isActive ? '#fff' : '#64748b',
                                boxShadow: 'none',
                                fontWeight: 700,
                                fontSize: '11px',
                                lineHeight: '18px'
                            }}
                        />
                        {errorCount > 0 &&
                            <Badge
                                count={errorCount}
                                style={{
                                    backgroundColor: '#ef4444',
                                    color: '#fff',
                                    boxShadow: 'none',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    lineHeight: '18px'
                                }}
                            />
                        }
                    </div>
                ),
                children: (
                    <div className="p-8 bg-slate-50 min-h-[600px]">
                        {/* Specialized Rendering for XML7 or Generic */}
                        {!['XML1', 'XML7', 'XML8', 'XML9', 'XML11'].includes(group.type) && filteredList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                                <FileExcelOutlined style={{ fontSize: 48, color: '#94a3b8' }} />
                                <div className="text-slate-400 mt-4 font-medium">Không có dữ liệu {group.type}</div>
                            </div>
                        ) : (
                            (filteredList.length <= 2) ? (
                                <div className="space-y-6">
                                    {filteredList.map((item, idx) => (
                                        <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                            {filteredList.length > 1 && <div className="mb-4 font-bold text-slate-500">Bản ghi #{idx + 1}</div>}
                                            <Descriptions bordered column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }} size="middle"
                                                styles={{
                                                    label: { background: '#f8fafc', width: '200px', fontWeight: 600, color: '#475569' },
                                                    content: { background: '#fff' }
                                                }}
                                            >
                                                {Object.entries(item || {}).map(([k, v]) => {
                                                    const isError = selectedRecord.validationResults.some(r => r.xmlType === group.type && r.field === k && r.isError && (r.index === undefined || r.index === idx));
                                                    return (
                                                        <Descriptions.Item
                                                            label={<span className={isError ? "text-red-600" : ""}>{k}</span>}
                                                            key={k}
                                                            className={isError ? "bg-red-50/50" : ""}
                                                        >
                                                            <span className={isError ? "text-red-700 font-medium" : "text-slate-700"}>
                                                                {(k.includes('NGAY') || k.includes('THOI_GIAN')) ? formatDateTime(v) : renderValue(v)}
                                                            </span>
                                                        </Descriptions.Item>
                                                    );
                                                })}
                                            </Descriptions>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                (() => {
                                    const dataSource = filteredList.map((item, idx) => {
                                        const originalIdx = item.__originalIndex;
                                        const rowErrors = selectedRecord.validationResults
                                            .filter(v => v.xmlType === group.type && v.index === originalIdx && v.isError)
                                            .map(v => v.message || v.ruleName);
                                        return {
                                            ...item,
                                            __key: `${group.type}_${idx}`,
                                            __idx: idx,
                                            __errors: rowErrors.length > 0 ? rowErrors.join('; ') : null
                                        };
                                    });

                                    const tableColumns = [...columns];
                                    tableColumns.splice(1, 0, {
                                        title: 'Trạng thái',
                                        key: '__errors',
                                        dataIndex: '__errors',
                                        width: 150,
                                        fixed: 'left',
                                        render: (text: any) => text ? <Tag color="error">Có lỗi</Tag> : <Tag color="success">Hợp lệ</Tag>,
                                        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
                                            <div className="p-2 bg-white rounded-xl shadow-xl border border-slate-100 w-48 font-sans">
                                                <div className="flex flex-col gap-1">
                                                    <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Lọc trạng thái</div>
                                                    {[
                                                        { label: 'Có lỗi', value: 'ERROR', color: 'bg-red-500' },
                                                        { label: 'Hợp lệ', value: 'VALID', color: 'bg-green-500' }
                                                    ].map(opt => {
                                                        const isSelected = selectedKeys.includes(opt.value);
                                                        return (
                                                            <div
                                                                key={opt.value}
                                                                className={`px-3 py-2 rounded-lg cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-slate-50 text-slate-600'}`}
                                                                onClick={() => {
                                                                    const newKeys = isSelected ? [] : [opt.value];
                                                                    setSelectedKeys(newKeys);
                                                                    confirm({ closeDropdown: true });
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${opt.color}`} />
                                                                    <span>{opt.label}</span>
                                                                </div>
                                                                {isSelected && <CheckCircleOutlined />}
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="h-px bg-slate-100 my-1" />
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        className="text-slate-400 hover:text-slate-600 text-xs w-full text-left pl-3"
                                                        onClick={() => { clearFilters && clearFilters(); confirm({ closeDropdown: true }); }}
                                                    >
                                                        Xóa bộ lọc
                                                    </Button>
                                                </div>
                                            </div>
                                        ),
                                        onFilter: (value: any, record: any) => value === 'ERROR' ? !!record.__errors : !record.__errors,
                                        defaultFilteredValue: ['ERROR']
                                    });

                                    tableColumns.splice(2, 0, {
                                        title: 'Chi tiết lỗi',
                                        key: '__errorMsg',
                                        dataIndex: '__errors',
                                        width: 300,
                                        render: (text: any) => text ? (
                                            <div className="text-red-600 whitespace-pre-wrap">
                                                {text.split('; ').map((err: string, i: number) => (
                                                    <div key={i} className="mb-1 flex items-start gap-1">
                                                        <div className="mt-1.5 w-1 h-1 bg-red-400 rounded-full shrink-0" />
                                                        <span>{err}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null
                                    });

                                    return (
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                            <Table
                                                dataSource={dataSource}
                                                columns={tableColumns}
                                                size="middle"
                                                scroll={{ x: 1200, y: 500 }}
                                                pagination={{ defaultPageSize: 10, showSizeChanger: true }}
                                                rowKey="__key"
                                                rowClassName={(record: any) => record.__errors ? 'bg-red-50/30 hover:bg-red-50 !important' : ''}
                                                bordered
                                            />
                                        </div>
                                    );
                                })()
                            )
                        )}
                    </div>
                )
            };
        });

        const isValActive = activeTab === 'VALIDATION';
        // Add Validation Result Tab
        items.push({
            key: 'VALIDATION',
            label: (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${isValActive
                    ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-200'
                    : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                    }`}>
                    <CheckCircleOutlined className={isValActive ? "text-white" : (selectedRecord.validationResults.some(v => v.isError) ? "text-red-500" : "text-green-500")} />
                    <span className="font-bold text-sm tracking-wide">KẾT QUẢ KIỂM TRA</span>
                    {selectedRecord.validationResults.filter(v => v.isError).length > 0 &&
                        <Badge
                            count={selectedRecord.validationResults.filter(v => v.isError).length}
                            style={{
                                backgroundColor: isValActive ? 'rgba(255,255,255,0.25)' : '#ef4444',
                                color: isValActive ? '#fff' : '#fff',
                                boxShadow: 'none',
                                fontWeight: 700
                            }}
                        />
                    }
                </div>
            ),
            children: (
                <div className="p-8 bg-slate-50 min-h-[600px]">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        {selectedRecord.validationResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <CheckCircleOutlined style={{ fontSize: 64, color: '#22c55e' }} />
                                <h3 className="text-slate-700 text-xl font-bold mt-4">Tuyệt vời!</h3>
                                <p className="text-slate-500">Hồ sơ này hoàn toàn hợp lệ theo các quy tắc hiện tại.</p>
                            </div>
                        ) : (
                            <div>
                                <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center">
                                    <div className="w-1 h-6 bg-red-500 rounded-full mr-3"></div>
                                    Chi tiết lỗi phát hiện
                                </h3>
                                <div className="space-y-3">
                                    {selectedRecord.validationResults.map((err, idx) => (
                                        <div key={idx} className={`p-4 rounded-xl border-l-4 ${err.isError ? 'bg-red-50 border-red-500' : 'bg-orange-50 border-orange-400'}`}>
                                            <div className="flex items-start">
                                                <div className="flex-1">
                                                    <div className={`font-bold text-sm ${err.isError ? 'text-red-700' : 'text-orange-700'}`}>
                                                        {err.ruleName}
                                                    </div>
                                                    <div className="text-slate-600 mt-1">{err.message}</div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Tag className="m-0 bg-white border-0 font-mono text-xs font-semibold text-slate-500">[{err.xmlType}]</Tag>
                                                        <span className="text-xs text-slate-400 font-mono">Field: {err.field} {err.index !== undefined ? `@ Row ${err.index + 1}` : ''}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
        });

        return (
            <Card
                title={
                    <div className="flex justify-between items-center py-1">
                        <Space size="large">
                            <Button
                                type="text"
                                icon={<UploadOutlined />}
                                onClick={() => setSelectedRecord(null)}
                                className="flex items-center text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                            >
                                Quay lại
                            </Button>
                            <div className="h-8 w-px bg-slate-200"></div>
                            <div className="flex items-center gap-4">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Chi tiết hồ sơ</div>
                                <div className="h-4 w-px bg-slate-300"></div>
                                <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    {selectedRecord.summary?.HO_TEN}
                                    <Tooltip title="Click để copy Mã LK">
                                        <Tag
                                            color="blue"
                                            className="m-0 rounded-full px-2 text-xs cursor-pointer hover:opacity-80 active:scale-95 transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(selectedRecord.summary?.MA_LK || '');
                                                message.success('Đã copy Mã LK!');
                                            }}
                                        >
                                            {selectedRecord.summary?.MA_LK}
                                        </Tag>
                                    </Tooltip>
                                    {selectedRecord.summary?.MA_BN && (
                                        <Tooltip title="Click để copy Mã BN">
                                            <Tag
                                                color="purple"
                                                className="m-0 rounded-full px-2 text-xs cursor-pointer hover:opacity-80 active:scale-95 transition-all"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyToClipboard(selectedRecord.summary?.MA_BN || '');
                                                    message.success('Đã copy Mã BN!');
                                                }}
                                            >
                                                {selectedRecord.summary?.MA_BN}
                                            </Tag>
                                        </Tooltip>
                                    )}
                                </div>
                            </div>
                        </Space>
                        <Space size="middle">
                            <span className="text-slate-500 font-medium">Chỉ hiện lỗi</span>
                            <Switch checked={showDetailErrorsOnly} onChange={setShowDetailErrorsOnly} />
                        </Space>
                    </div>
                }
                className="shadow-2xl rounded-3xl overflow-hidden border border-slate-100"
                styles={{
                    body: { padding: 0, background: '#f8fafc' },
                    header: { background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 32px' }
                }}
            >
                {isSent && hasError && (
                    <div className="px-8 pt-6">
                        <Alert
                            title="Cảnh báo: Hồ sơ này đã được gửi lên hệ thống BHXH nhưng vẫn có lỗi!"
                            type="warning"
                            showIcon
                            className="font-medium bg-amber-50 border-amber-300 text-amber-800 rounded-xl"
                        />
                    </div>
                )}
                {isSent && !hasError && (
                    <div className="px-8 pt-6">
                        <Alert
                            title="Thông tin: Hồ sơ này đã được gửi lên hệ thống BHXH."
                            type="info"
                            showIcon
                            className="font-medium bg-blue-50 border-blue-300 text-blue-800 rounded-xl"
                        />
                    </div>
                )}
                <Tabs type="card" 
                    activeKey={activeTab}
                    onChange={(key) => {
                        setActiveTab(key);
                        setDetailFilters({});
                    }}
                    items={items}
                    className="custom-tabs px-8 py-4 bg-white border-b border-slate-100"
                    tabBarStyle={{ margin: 0, border: 'none', paddingLeft: '32px' }}
                    tabBarGutter={12}
                />
            </Card>
        );
    };

    return (
        <div className="w-full max-w-[1920px] mx-auto px-[30px] py-6 space-y-6">
            {processingProgress && (
                <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center backdrop-blur-sm">
                    <div className="text-center">
                        <Spin size="large" />
                        <div className="mt-4 font-bold text-lg">Đang xử lý {processingProgress.current}/{processingProgress.total} file...</div>
                        <Progress percent={Math.round((processingProgress.current / processingProgress.total) * 100)} status="active" style={{ width: 300 }} />
                    </div>
                </div>
            )}



            {!selectedRecord ? (
                <div className="space-y-6">
                    {/* Header Actions */}
                    {/* Upload Area */}
                    {/* Source Selection Area */}
                    <div className="flex flex-col md:flex-row justify-center gap-6 mb-4 items-stretch">
                        {/* Option 1: Upload from local (restricted by role) */}
                        {canUploadFile && (
                            <div className="flex-1 max-w-md bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                                <div className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider text-center">Tải file từ máy tính</div>
                                <Dragger {...uploadProps} style={{ padding: '10px 20px', border: '2px dashed #1890ff', background: '#f0faff', borderRadius: '8px', cursor: 'pointer', width: '100%' }} showUploadList={false}>
                                    <div className="flex flex-col items-center group">
                                        <div className="p-1.5 bg-blue-100 rounded-full mb-1.5 group-hover:bg-blue-200 transition-colors">
                                            <CloudUploadOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                                        </div>
                                        <div className="text-sm font-medium text-gray-700">Tải file XML</div>
                                        <div className="text-[10px] text-gray-500">Kéo thả hoặc click</div>
                                    </div>
                                </Dragger>
                            </div>
                        )}

                        {/* Option 2: Load from DB */}
                        <div className="flex-1 max-w-md bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                            <div className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wider text-center">Tải từ Cơ sở dữ liệu</div>
                            <Space orientation="vertical" className="w-full">
                                <DatePicker.RangePicker
                                    placeholder={["Từ ngày (Ngày ra)", "Đến ngày (Ngày ra)"]}
                                    format="DD/MM/YYYY"
                                    style={{ width: '100%' }}
                                    value={dbDateRange}
                                    onChange={(dates) => setDbDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                                    allowClear
                                />
                                <Button 
                                    type="primary" 
                                    icon={<CloudDownloadOutlined />} 
                                    onClick={fetchDataFromDB} 
                                    className="bg-green-600 hover:bg-green-700 w-full"
                                    loading={isLoadingDB}
                                >
                                    Tải dữ liệu
                                </Button>
                            </Space>
                        </div>
                    </div>

                    {(() => {
                        const displayedRecords = getFilteredRecords();
                        return (
                            <>
                                {/* Header Actions */}
                                <div className="flex justify-between items-center bg-white py-2 px-4 rounded-lg shadow-sm border">
                                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                                        <div className="bg-blue-50 text-blue-600 p-1.5 rounded-lg">
                                            <ContainerOutlined />
                                        </div>
                                        <span>
                                            Hiển thị <span className="font-bold text-blue-600">{displayedRecords.length}</span> / <span className="font-bold text-slate-800">{records.length}</span> hồ sơ
                                        </span>
                                    </div>
                                    <Space>
                                        {user?.role === 'ADMIN' && (
                                            <Button 
                                                icon={<CloudUploadOutlined />} 
                                                type="default"
                                                className="text-purple-600 border-purple-200 hover:border-purple-400 hover:text-purple-700 bg-purple-50"
                                                onClick={handleSaveToDBForViewer}
                                                title="Lưu những hồ sơ lỗi (theo filter) vào Database để có thể xem lại ở XML Viewer"
                                            >
                                                Lưu DB (XML Viewer)
                                            </Button>
                                        )}
                                        <Dropdown
                                            menu={{
                                                items: [
                                                    {
                                                        key: 'run-all',
                                                        label: <span className="font-bold text-blue-600">Kiểm tra tất cả trên lưới</span>,
                                                        onClick: () => handleRunAllSpecializedRules()
                                                    },
                                                    { type: 'divider' },
                                                    ...specializedRules.map(rule => ({
                                                        key: rule.id,
                                                        label: rule.name,
                                                        children: [
                                                            { key: `${rule.id}-check`, label: 'Kiểm tra trên lưới', onClick: () => handleRunSpecializedRule(rule) },
                                                            { key: `${rule.id}-export`, label: 'Xuất Báo cáo Excel', onClick: () => handleExportSpecializedRule(rule) }
                                                        ]
                                                    }))
                                                ]
                                            }}
                                            trigger={['click']}
                                            disabled={specializedRules.length === 0}
                                        >
                                            <Button 
                                                type="default" 
                                                loading={isSpecializedChecking}
                                                className="text-teal-600 border-teal-200 hover:text-teal-700 hover:border-teal-400"
                                            >
                                                Kiểm tra theo chuyên đề {specializedRules.length > 0 && `(${specializedRules.length})`}
                                            </Button>
                                        </Dropdown>
                                        <Select
                                            placeholder="Lọc theo Khoa"
                                            allowClear
                                            showSearch
                                            style={{ width: 250 }}
                                            optionFilterProp="label"
                                            filterOption={(input, option: any) =>
                                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                            }
                                            options={Object.entries(departments).map(([code, name]) => ({
                                                value: code,
                                                label: `${code} - ${name}`
                                            }))}
                                            value={headerDepartmentFilter}
                                            onChange={setHeaderDepartmentFilter}
                                        />
                                        <Select
                                            value={mainFilter}
                                            onChange={setMainFilter}
                                            style={{ width: 220 }}
                                            options={[
                                                { value: 'ALL', label: 'Tất cả hồ sơ' },
                                                { value: 'ALL_SENT', label: 'Tất cả (Đã gửi)' },
                                                { value: 'ALL_UNSENT', label: 'Tất cả (Chưa gửi)' },
                                                { value: 'ERROR', label: 'Hồ sơ lỗi (Tất cả)' },
                                                { value: 'ERROR_SENT', label: 'Hồ sơ lỗi (Đã gửi)' },
                                                { value: 'ERROR_UNSENT', label: 'Hồ sơ lỗi (Chưa gửi)' },
                                                { value: 'VALID', label: 'Hồ sơ đúng (Tất cả)' },
                                                { value: 'VALID_SENT', label: 'Hồ sơ đúng (Đã gửi)' },
                                                { value: 'VALID_UNSENT', label: 'Hồ sơ đúng (Chưa gửi)' }
                                            ]}
                                        />
                                        <Button
                                            icon={<FileExcelOutlined />}
                                            onClick={() => router.push(`/report?filter=${mainFilter}`)}
                                            className="text-green-600 border-green-200 hover:text-green-700 hover:border-green-400"
                                        >
                                            Xem báo cáo
                                        </Button>
                                        <Button
                                            type="primary"
                                            icon={<FileExcelOutlined />}
                                            onClick={handleExportExcel}
                                            disabled={records.length === 0}
                                        >
                                            Xuất Excel
                                        </Button>



                                        <Button
                                            icon={<ReloadOutlined />}
                                            onClick={async () => {
                                                const latestRules = await reloadRules();
                                                if (records.length === 0) {
                                                    message.info('Không có hồ sơ nào để kiểm tra.');
                                                    return;
                                                }

                                                setProcessingProgress({ current: 0, total: records.length });
                                                
                                                // Run asynchronously to prevent browser freeze
                                                setTimeout(async () => {
                                                    try {
                                                        const currentRecords = [...records];
                                                        const validator = new ValidationEngine(latestRules, masterData);
                                                        validator.setContextRecords(currentRecords);
                                                        
                                                        const icd10Map = await fetchIcd10Map(currentRecords);
                                                        validator.setExternalContext({ icd10Map });

                                                        const VALIDATION_CHUNK_SIZE = 50;
                                                        for (let i = 0; i < currentRecords.length; i += VALIDATION_CHUNK_SIZE) {
                                                            const chunk = currentRecords.slice(i, i + VALIDATION_CHUNK_SIZE);
                                                            chunk.forEach(r => {
                                                                r.validationResults = validator.validate(r);
                                                            });
                                                            setProcessingProgress({ current: Math.min(i + chunk.length, currentRecords.length), total: currentRecords.length });
                                                            await new Promise(resolve => setTimeout(resolve, 0));
                                                        }
                                                        
                                                        setRecords(currentRecords);
                                                        addRecordsToDB(currentRecords).catch(e => console.error(e));
                                                        message.success('Đã tải lại quy tắc mới nhất và cập nhật cho dữ liệu hiện tại.');
                                                    } catch (error) {
                                                        console.error(error);
                                                        message.error('Có lỗi xảy ra khi chạy lại kiểm tra.');
                                                    } finally {
                                                        setProcessingProgress(null);
                                                    }
                                                }, 0);
                                            }}
                                        >
                                            Chạy lại kiểm tra
                                        </Button>
                                    </Space>
                                </div>

                                {/* Main Table */}
                                <div className="bg-white rounded-lg shadow-sm border p-4">
                                    <Table
                                        columns={mainColumns}
                                        dataSource={displayedRecords}
                                        rowKey={(r) => r.uuid || r.id}
                                        pagination={{
                                            defaultPageSize: 10,
                                            showSizeChanger: true,
                                            locale: { items_per_page: '/ trang' },
                                            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} hồ sơ`
                                        }}
                                        onRow={(record) => ({
                                            onClick: () => {
                                                setSelectedRecord(record);
                                                setActiveTab('XML1');
                                            },
                                            style: { cursor: 'pointer' }
                                        })}
                                        size="middle"
                                        bordered
                                    />
                                </div>
                            </>
                        );
                    })()}
                </div>
            ) : (
                renderDetailView()
            )}

            <Modal
                title="Cấu hình Hạn sửa Bệnh án"
                open={isConfigModalVisible}
                onOk={async () => {
                    try {
                        const res = await fetch(`${getBasePath()}/api/configs`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ value: editDeadlineDays })
                        });
                        if (res.ok) {
                            message.success('Đã lưu cấu hình thành công!');
                            setIsConfigModalVisible(false);
                        } else {
                            message.error('Lỗi khi lưu cấu hình.');
                        }
                    } catch (e) {
                        message.error('Lỗi kết nối.');
                    }
                }}
                onCancel={() => setIsConfigModalVisible(false)}
            >
                <div className="flex flex-col gap-4 py-4">
                    <Alert 
                        message="Hạn sửa bệnh án được tính từ Ngày Ra Viện cộng thêm số ngày quy định (không tính Thứ 7, Chủ Nhật)."
                        type="info" 
                        showIcon 
                    />
                    <div className="flex items-center gap-4">
                        <span className="font-medium">Số ngày cho phép sửa (sau xuất viện):</span>
                        <InputNumber
                            min={0}
                            max={365}
                            value={editDeadlineDays}
                            onChange={(val) => setEditDeadlineDays(val || 0)}
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

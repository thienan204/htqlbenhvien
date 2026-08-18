'use client';

import React, { useEffect, useState } from 'react';
import { Table, Tag, Card, Button, Spin, Empty, Descriptions, Input, Space, message, DatePicker, Modal, Select } from 'antd';
import { loadRecordsFromDB } from '@/lib/db';
import { ExtendedHosoRecord, getXmlDataList } from '@/lib/xml';
import { CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, SearchOutlined, FileExcelOutlined, ScanOutlined, FileTextOutlined, CloudUploadOutlined, CloudDownloadOutlined, FilterOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getDepartments } from '@/actions/department';
import { getBasePath } from '@/utils/config';
import dayjs from 'dayjs';

const DISTINCT_COLORS = [
    '#ffebee', '#e3f2fd', '#e8f5e9', '#f3e5f5', '#fff3e0', 
    '#e0f7fa', '#fce4ec', '#f1f8e9', '#fff8e1', '#e8eaf6', 
    '#efebe9', '#e0f2f1', '#f9fbe7', '#eceff1', '#fffde7', 
    '#ffcdd2', '#c8e6c9', '#b3e5fc', '#d1c4e9', '#ffecb3'
];

interface SpecializedRuleRunnerProps {
    rule: any;
}

export default function SpecializedRuleRunner({ rule }: SpecializedRuleRunnerProps) {
    const [records, setRecords] = useState<ExtendedHosoRecord[]>([]);
    const [loading, setLoading] = useState(true);
    // Generic logic results
    const [results, setResults] = useState<any[]>([]);

    // Duplicate Bed specific state
    const [bedServices, setBedServices] = useState<any[]>([]);
    const [isDuplicateBedMode, setIsDuplicateBedMode] = useState(false);
    const [filterBed, setFilterBed] = useState<string>('');
    const [filterKhoa, setFilterKhoa] = useState<string>('');
    const [filterMaGiuong, setFilterMaGiuong] = useState<string>('');
    const [filterTrinhDo, setFilterTrinhDo] = useState<string>('');
    const [filterNgayRaRange, setFilterNgayRaRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
    const [hide50Percent, setHide50Percent] = useState<boolean>(false);
    const [sentRecordsSet, setSentRecordsSet] = useState<Set<string>>(new Set());
    const [filterSentStatus, setFilterSentStatus] = useState<string>('ALL');

    // Duplicate Doctor specific state
    const [doctorOrders, setDoctorOrders] = useState<any[]>([]);
    const [isDuplicateDoctorMode, setIsDuplicateDoctorMode] = useState(false);
    const [filterNgayYlRange, setFilterNgayYlRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

    const [deptMap, setDeptMap] = useState<Record<string, string>>({});
    const [staffMap, setStaffMap] = useState<Record<string, { ho_ten: string, trinh_do: string }>>({});

    const [isSaving, setIsSaving] = useState(false);
    const [isSavingDoctor, setIsSavingDoctor] = useState(false);
    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [isSaveModalVisibleDoctor, setIsSaveModalVisibleDoctor] = useState(false);
    const [saveNote, setSaveNote] = useState('');
    const [saveFileName, setSaveFileName] = useState('');

    useEffect(() => {
        getDepartments().then(depts => {
            const map: Record<string, string> = {};
            depts.forEach(d => map[d.ma_khoa] = d.ten_khoa);
            setDeptMap(map);
        });

        // Lấy danh sách nhân viên để map Tên và Trình độ cho Bác sĩ
        fetch(`${getBasePath()}/api/staff?t=${new Date().getTime()}`)
            .then(res => res.json())
            .then(staffs => {
                const map: Record<string, { ho_ten: string, trinh_do: string }> = {};
                if (Array.isArray(staffs)) {
                    staffs.forEach((s: any) => {
                        const info = {
                            ho_ten: s.ho_ten || '',
                            trinh_do: s.trinh_do_ref?.name || s.trinh_do || ''
                        };
                        if (s.ma_nv) {
                            map[s.ma_nv] = info;
                        }
                        if (s.certificates && Array.isArray(s.certificates)) {
                            s.certificates.forEach((c: any) => {
                                if (c.so_cchn) map[c.so_cchn] = info;
                            });
                        }
                    });
                }
                setStaffMap(map);
            })
            .catch(err => console.error("Lỗi lấy danh sách nhân viên:", err));
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await loadRecordsFromDB();
            setRecords(data);

            try {
                const maLienKetList = Array.from(new Set(data.map(r => String(r.summary?.MA_LK)).filter(Boolean)));
                if (maLienKetList.length > 0) {
                    const res = await fetch(`${getBasePath()}/api/ho-so-da-gui/check-exists`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ maLienKetList })
                    });
                    if (res.ok) {
                        const resData = await res.json();
                        setSentRecordsSet(new Set(resData.exists || []));
                    }
                }
            } catch (e) {
                console.error('Error checking sent records:', e);
            }

            // Detection Logic: Check config type first, then legacy ruleType or slug conventions
            const isDuplicateBed = rule.logicConfig?.type === 'DUPLICATE_BED' ||
                rule.ruleType === 'DUPLICATE_BED' ||
                rule.slug?.includes('trung-giuong') ||
                rule.slug?.includes('trung-ma-giuong');

            const isDuplicateDoctor = rule.logicConfig?.type === 'DUPLICATE_DOCTOR' ||
                rule.ruleType === 'DUPLICATE_DOCTOR';

            if (isDuplicateDoctor) {
                setIsDuplicateDoctorMode(true);
                setIsDuplicateBedMode(false);
                // prepareDoctorOrders will be triggered by useEffect
            } else if (isDuplicateBed) {
                setIsDuplicateBedMode(true);
                setIsDuplicateDoctorMode(false);
                // prepareBedServices will be triggered by useEffect
            } else {
                setIsDuplicateBedMode(false);
                setIsDuplicateDoctorMode(false);
                executeRule(data);
            }

        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [rule]);

    const [dbDateRange, setDbDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

    const fetchDataFromDB = async () => {
        if (!dbDateRange[0] || !dbDateRange[1]) {
            message.warning("Vui lòng chọn Từ ngày - Đến ngày để tải dữ liệu từ CSDL (định dạng ngày sinh YYYYMMDD)");
            return;
        }
        setLoading(true);
        try {
            const fromDateStr = dbDateRange[0].startOf('day').format('YYYYMMDDHHmm');
            const toDateStr = dbDateRange[1].endOf('day').format('YYYYMMDDHHmm');
            const res = await fetch(`${getBasePath()}/api/xml1/fetch-full?fromDate=${fromDateStr}&toDate=${toDateStr}`);
            
            if (res.ok) {
                const data = await res.json();
                setRecords(data);
                
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

                const isDuplicateBed = rule.logicConfig?.type === 'DUPLICATE_BED' ||
                    rule.ruleType === 'DUPLICATE_BED' ||
                    rule.slug?.includes('trung-giuong') ||
                    rule.slug?.includes('trung-ma-giuong');

                const isDuplicateDoctor = rule.logicConfig?.type === 'DUPLICATE_DOCTOR' ||
                    rule.ruleType === 'DUPLICATE_DOCTOR';

                if (isDuplicateDoctor) {
                    setIsDuplicateDoctorMode(true);
                    setIsDuplicateBedMode(false);
                } else if (isDuplicateBed) {
                    setIsDuplicateBedMode(true);
                    setIsDuplicateDoctorMode(false);
                } else {
                    setIsDuplicateBedMode(false);
                    setIsDuplicateDoctorMode(false);
                    executeRule(data);
                }
                message.success(`Đã tải ${data.length} hồ sơ từ CSDL.`);
            } else {
                const err = await res.json();
                message.error(`Lỗi: ${err.error}`);
            }
        } catch (error: any) {
            console.error("Error loading data from DB:", error);
            message.error(`Lỗi kết nối: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Trigger preparation when records or deps change
    useEffect(() => {
        if (isDuplicateBedMode && records.length > 0) {
            prepareBedServices(records);
        } else if (isDuplicateDoctorMode && records.length > 0) {
            prepareDoctorOrders(records);
        }
    }, [records, isDuplicateBedMode, isDuplicateDoctorMode, rule, deptMap, staffMap]);

    const executeRule = (data: ExtendedHosoRecord[]) => {
        if (!rule || !rule.logicConfig) return;

        const config = rule.logicConfig;
        let validationResults: any[] = [];

        if (rule.ruleType === 'MACHINE_CHECK' && config.type === 'MACHINE_CHECK') {
            validationResults = checkMachine(data, config);
        }

        setResults(validationResults);
    };

    const handleSaveErrorsLogToDB = async () => {
        let targetRecords = [];
        if (isDuplicateDoctorMode) {
            targetRecords = getFilteredDoctorData();
        } else if (isDuplicateBedMode) {
            targetRecords = getFilteredData();
        } else {
            targetRecords = results;
        }

        if (targetRecords.length === 0) {
            message.warning("Không có dữ liệu lỗi để lưu");
            return;
        }

        const errorsToSave = targetRecords.map((item: any) => {
            const parseDateString = (d: any) => {
                if (!d) return null;
                if (d instanceof Date) return d;
                const dStr = String(d);
                if (dStr.length === 12 && !dStr.includes("-")) {
                    return new Date(`${dStr.substring(0,4)}-${dStr.substring(4,6)}-${dStr.substring(6,8)}T${dStr.substring(8,10)}:${dStr.substring(10,12)}:00`);
                }
                const parsed = new Date(d);
                return isNaN(parsed.getTime()) ? null : parsed;
            };

            return {
                ma_lk: item.MA_LK || item.ma_lk || "",
                ma_bn: item.MA_BN || item.ma_bn || "",
                ma_khoa: item.MA_KHOA || item.ma_khoa || "",
                ho_ten: item.HO_TEN || item.ho_ten || "",
                ngay_vao: parseDateString(item.NGAY_VAO || item.ngay_vao),
                ngay_ra: parseDateString(item.NGAY_RA || item.ngay_ra),
                ngay_yl: parseDateString(item.NGAY_YL || item.ngay_yl || item._start),
                ngay_th_yl: parseDateString(item.NGAY_TH_YL || item.ngay_th_yl),
                ngay_kq: parseDateString(item.NGAY_KQ || item.ngay_kq || item._end),
                ngay_vao_noi_tru: parseDateString(item.NGAY_VAO_NOI_TRU || item.ngay_vao_noi_tru),
                ma_dv: item.MA_DICH_VU || item.MA_THUOC || item.MA_VAT_TU || item.ma_dv || "",
                ten_dv: item.TEN_DICH_VU || item.TEN_THUOC || item.TEN_VAT_TU || item.ten_dv || "",
                don_gia_bh: item.DON_GIA || item.don_gia_bh || "",
                ma_may: item.KEY_VALUE ? String(item.KEY_VALUE).split('-')[0] : (item.ma_may || ""),
                ten_khoa: item.TEN_KHOA || item.ten_khoa || "",
                ma_doituong_kcb: item.MA_DOITUONG_KCB || item.ma_doituong_kcb || "",
                ma_bac_si: item.MA_BAC_SI || item.MA_BS || "",
                ten_bac_si: item.TEN_BAC_SI || item.TEN_BS || "",
                nguoi_th: item.NGUOI_THUC_HIEN || item.MA_NGUOI_TH || "",
                ten_nguoi_th: item.TEN_NGUOI_THUC_HIEN || "",
                khoang_thoi_gian_trung: item._overlapStr || (item._maxOverlap !== undefined ? `${Math.ceil(item._maxOverlap)} phút` : (isDuplicateDoctorMode ? "Cùng thời điểm" : "")),
                chi_tiet_loi: `[CHUYEN_DE] ${rule?.name || 'Quy tắc'} - ${item.message || 'Phát hiện trùng lặp'} [Nhóm: ${item.groupId || '1'}]`,
                sourceType: 'CHUYEN_DE'
            };
        });

        try {
            message.loading({ content: 'Đang lưu lỗi vào hệ thống...', key: 'saveErrorsLog' });
            const res = await fetch('/api/error-management/xml-errors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ errors: errorsToSave })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.count === 0 && data.duplicateCount > 0) {
                    message.warning({ content: `Tất cả ${data.duplicateCount} lỗi đã được lưu từ trước, bỏ qua lưu trùng lặp!`, key: 'saveErrorsLog' });
                } else if (data.duplicateCount > 0) {
                    message.success({ content: `Lưu thành công ${data.count} lỗi mới (bỏ qua ${data.duplicateCount} lỗi đã tồn tại)`, key: 'saveErrorsLog' });
                } else {
                    message.success({ content: `Lưu thành công ${data.count} lỗi chuyên đề!`, key: 'saveErrorsLog' });
                }
            } else {
                const err = await res.json();
                message.error({ content: `Lỗi: ${err.error}`, key: 'saveErrorsLog' });
            }
        } catch (error) {
            message.error({ content: 'Không thể kết nối đến máy chủ', key: 'saveErrorsLog' });
        }
    };

    const handleSaveXmlsToDB = async () => {
        let targetRecords = [];
        if (isDuplicateDoctorMode) {
            targetRecords = getFilteredDoctorData();
        } else if (isDuplicateBedMode) {
            targetRecords = getFilteredData();
        } else {
            targetRecords = results;
        }

        if (targetRecords.length === 0) {
            message.warning("Không có dữ liệu để lưu");
            return;
        }

        // Gather unique record IDs
        const recordIds = new Set(targetRecords.map((item: any) => item.recordId).filter(Boolean));
        if (recordIds.size === 0) {
            message.warning("Không tìm thấy thông tin gốc của hồ sơ để lưu.");
            return;
        }

        // Map back to original records and inject the validation result so it shows up in xml1-viewer
        const errorRecords = records.filter(r => recordIds.has(r.id)).map(r => {
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
                        }
                    ]
                };
            }
            return r;
        });

        try {
            message.loading({ content: 'Đang lưu toàn bộ XML vào CSDL...', key: 'saveErrors' });
            
            const payload = errorRecords.map(r => {
                return {
                    id: r.id || r.summary?.MA_LK,
                    summary: r.summary,
                    groups: r.groups,
                    validationResults: r.validationResults
                };
            });

            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            const formData = new FormData();
            formData.append('file', blob, 'filtered_records.json');

            const response = await fetch('/api/xml-import-json', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                if (data.count === 0 && data.duplicateCount > 0) {
                    message.warning({ content: data.message, key: 'saveErrors' });
                } else if (data.duplicateCount > 0) {
                    message.success({ content: data.message, key: 'saveErrors' });
                } else {
                    message.success({ content: data.message || `Đã lưu thành công ${data.count} hồ sơ!`, key: 'saveErrors' });
                }
            } else {
                const err = await response.json();
                message.error({ content: `Lỗi: ${err.error || 'Có lỗi xảy ra'}`, key: 'saveErrors' });
            }
        } catch (error: any) {
            message.error({ content: `Lỗi kết nối: ${error.message}`, key: 'saveErrors' });
        }
    };

    // --- Duplicate Bed Logic ---

    // 1. Prepare Data for Table View
    const prepareBedServices = (data: ExtendedHosoRecord[]) => {
        if (!rule || !rule.logicConfig) return;
        const config = rule.logicConfig;
        const { fields, filter } = config;

        const list: any[] = [];
        let index = 1;

        data.forEach(record => {
            // Scan all groups (or restrict if config says so)
            record.groups.forEach(group => {
                // If config specifies target XML type, check it. Otherwise default to XML3 for now as we are looking for services
                if (group.type === 'XML3') {
                    const servs = getXmlDataList(group);
                    servs.forEach((item: any) => {
                        // Dynamic Filter
                        let match = true;
                        if (filter) {
                            for (const [key, value] of Object.entries(filter)) {
                                // Ignore empty filter values
                                if (value === '' || value === null || value === undefined) continue;

                                // Special Array Filters
                                if (key === 'MA_DICH_VU_INCLUDE' && Array.isArray(value)) {
                                    if (value.length > 0 && !value.includes(item.MA_DICH_VU)) {
                                        match = false;
                                        break;
                                    }
                                    continue;
                                }

                                if (key === 'MA_DICH_VU_EXCLUDE' && Array.isArray(value)) {
                                    if (value.length > 0 && value.includes(item.MA_DICH_VU)) {
                                        match = false;
                                        break;
                                    }
                                    continue;
                                }

                                // loose comparison for numbers/strings or arrays
                                if (Array.isArray(value)) {
                                    if (value.length > 0 && !value.map(String).includes(String(item[key]))) {
                                        match = false;
                                        break;
                                    }
                                } else {
                                    if (item[key] != value) {
                                        match = false;
                                        break;
                                    }
                                }
                            }
                        }

                        if (match) {
                            let keyValues: string[] = [];
                            if (fields?.bed) {
                                if (Array.isArray(fields.bed) && fields.bed.length > 0) {
                                    const bedFieldStr = fields.bed[0];
                                    const rawVal = item[bedFieldStr] || record.summary?.[bedFieldStr] || '';
                                    
                                    keyValues = [String(rawVal).split(';')[0].trim()];
                                    
                                    if (fields.bed.length > 1) {
                                        const suffix = fields.bed.slice(1).map((b: string) => {
                                            const rv = item[b] || record.summary?.[b] || '';
                                            return String(rv).split(';')[0].trim();
                                        }).join('-');
                                        keyValues = keyValues.map(k => `${k}-${suffix}`);
                                    }
                                } else {
                                    const rawVal = item[fields.bed] || record.summary?.[fields.bed] || '';
                                    keyValues = [String(rawVal).split(';')[0].trim()];
                                }
                            } else {
                                keyValues = [item.MA_GIUONG || '']; // Fallback
                            }

                            if (keyValues.length === 0) keyValues = [''];

                            const startTime = fields?.startTime ? item[fields.startTime] : item.NGAY_YL;
                            const endTime = fields?.endTime ? item[fields.endTime] : item.NGAY_KQ;
                            const getMaKhoaRV = () => {
                                const xml7Group = record.groups?.find((g: any) => g.type === 'XML7');
                                if (xml7Group && xml7Group.data && xml7Group.data.length > 0) {
                                    return xml7Group.data[0].MA_KHOA_RV || '';
                                }
                                return '';
                            };
                            const deptCode = getMaKhoaRV() || (fields?.department ? item[fields.department] : (item.MA_KHOA || record.summary?.MA_KHOA));
                            const maBs = item.MA_BS || item.MA_BAC_SI || '';
                            const nguoiThucHien = item.NGUOI_THUC_HIEN || '';

                            keyValues.forEach((keyValue, kIndex) => {
                                list.push({
                                    key: `${record.id}_${item.MA_DICH_VU}_${index}_${kIndex}`,
                                    stt: index++,
                                    MA_LK: record.summary?.MA_LK,
                                    MA_BN: record.summary?.MA_BN,
                                    MA_THE_BHYT: record.summary?.MA_THE_BHYT,
                                    HO_TEN: record.summary?.HO_TEN,
                                    MA_KHOA: deptCode,
                                    TEN_KHOA: deptMap[deptCode] || '', // Lookup department name
                                    MA_BAC_SI: maBs,
                                    TEN_BAC_SI: staffMap[maBs]?.ho_ten || '',
                                    TRINH_DO: staffMap[maBs]?.trinh_do || '',
                                    NGUOI_THUC_HIEN: nguoiThucHien,
                                    TEN_NGUOI_THUC_HIEN: nguoiThucHien ? String(nguoiThucHien).split(';').map(c => staffMap[c.trim()]?.ho_ten || c.trim()).filter(Boolean).join('; ') : '',
                                    MA_GIUONG: item.MA_GIUONG || '', // Keep original MA_GIUONG for columns
                                    KEY_VALUE: keyValue || '',       // The dynamic value (e.g., Doctor code, Machine code)
                                    TYLE_BH: item.TYLE_TT_BH || '',
                                    TYLE_DV: item.TYLE_TT_DV || '',
                                    NGAY_YL: item.NGAY_YL || '',
                                    NGAY_KQ: item.NGAY_KQ || '',
                                    NGAY_VAO: record.summary?.NGAY_VAO || '',
                                    NGAY_RA: record.summary?.NGAY_RA || '',
                                    NGAY_VAO_NOI_TRU: record.summary?.NGAY_VAO_NOI_TRU || '',
                                    NGAY_TH_YL: item.NGAY_TH_YL || '',
                                    MA_DICH_VU: item.MA_DICH_VU,
                                    TEN_DICH_VU: item.TEN_DICH_VU,
                                    SOLUONG: item.SO_LUONG || 0,

                                    // Clean Data for sorting/overlap
                                    _start: parseDate(startTime),
                                    _end: parseDate(endTime).getTime() === 0 && parseDate(startTime).getTime() !== 0 ? parseDate(startTime) : parseDate(endTime),
                                    _ma_giuong: item.MA_GIUONG,     // Original
                                    _key_value: keyValue,           // Dynamic Grouping Key
                                    _ma_khoa: deptCode,

                                    original: item,
                                    recordId: record.id
                                });
                            });
                        }
                    });
                }
            });
        });
        setBedServices(list);
    };

    // 2. Scan for Overlaps (Triggered by button)
    const scanDuplicates = () => {
        setLoading(true);
        // Simulate delay for effect
        setTimeout(() => {
            // Group by Dynamic Key (fallback to MA_GIUONG)
            const groups: Record<string, typeof bedServices> = {};

            const ignoreNullValues = rule.logicConfig?.ignoreNullValues !== false;

            bedServices.forEach(item => {
                const groupKeyStr = String(item._key_value || item._ma_giuong || '');
                if (!groupKeyStr || groupKeyStr.trim() === '') return;
                if (ignoreNullValues && groupKeyStr === 'null') return;
                const key = groupKeyStr;
                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            });

            const duplicateItems: any[] = [];
            let globalColorIndex = 0;

            Object.entries(groups).forEach(([key, items]) => {
                if (items.length < 2) return;

                // Sort internally just for logical checking ordering
                items.sort((a, b) => a._start.getTime() - b._start.getTime());

                const adj: Record<number, number[]> = {};
                for (let i = 0; i < items.length; i++) adj[i] = [];

                for (let i = 0; i < items.length; i++) {
                    const curr = items[i];
                    for (let j = i + 1; j < items.length; j++) {
                        const next = items[j];

                        // Skip if date is absolutely invalid
                        if (curr._start.getTime() === 0 || next._start.getTime() === 0) continue;

                        const overlapMinutes = (Math.min(curr._end.getTime(), next._end.getTime()) - Math.max(curr._start.getTime(), next._start.getTime())) / 60000;
                        const tolerance = rule.logicConfig?.toleranceMinutes || 0;

                        const isExactMatch = curr._start.getTime() === next._start.getTime() && curr._start.getTime() === curr._end.getTime() && next._start.getTime() === next._end.getTime();
                        
                        // Nếu 1 trong 2 sự kiện là tức thời (duration = 0) và thời điểm đó nằm trọn trong sự kiện còn lại thì overlapMinutes sẽ = 0.
                        const isZeroDurationCollision = overlapMinutes === 0 && (curr._start.getTime() === curr._end.getTime() || next._start.getTime() === next._end.getTime());

                        // Dynamic Field skipping (e.g. MA_BN, MA_LK)
                        const ignoreIfSameField = rule.logicConfig?.ignoreIfSameField;
                        let isIgnoreMatch = false;

                        if (ignoreIfSameField) {
                            const valA = curr[ignoreIfSameField] !== undefined ? String(curr[ignoreIfSameField]) : (curr.original ? String(curr.original[ignoreIfSameField]) : undefined);
                            const valB = next[ignoreIfSameField] !== undefined ? String(next[ignoreIfSameField]) : (next.original ? String(next.original[ignoreIfSameField]) : undefined);

                            if (valA && valB && valA === valB && valA !== 'undefined') {
                                isIgnoreMatch = true;
                            }
                        }

                        if (isIgnoreMatch) {
                            continue; // Bỏ qua lặp 2 dịch vụ này vì chúng có cùng thuộc tính loại trừ
                        }

                        if (overlapMinutes > tolerance || isExactMatch || isZeroDurationCollision) {
                            adj[i].push(j);
                            adj[j].push(i);
                            
                            const maxStart = new Date(Math.max(curr._start.getTime(), next._start.getTime()));
                            const minEnd = new Date(Math.min(curr._end.getTime(), next._end.getTime()));
                            const overlapStr = `${dayjs(maxStart).format('DD/MM/YYYY HH:mm')} đến ${dayjs(minEnd).format('DD/MM/YYYY HH:mm')}`;

                            if (!curr._overlapStr || Math.ceil(overlapMinutes) >= (curr._maxOverlap || 0)) {
                                curr._overlapStr = overlapStr;
                            }
                            if (!next._overlapStr || Math.ceil(overlapMinutes) >= (next._maxOverlap || 0)) {
                                next._overlapStr = overlapStr;
                            }

                            curr._maxOverlap = Math.max(curr._maxOverlap || 0, Math.ceil(overlapMinutes));
                            next._maxOverlap = Math.max(next._maxOverlap || 0, Math.ceil(overlapMinutes));
                        }
                    }
                }

                // connected components
                const visited = new Set<number>();
                for (let i = 0; i < items.length; i++) {
                    if (visited.has(i)) continue;
                    if (adj[i].length === 0) continue;

                    const queue = [i];
                    visited.add(i);
                    const component = [i];

                    while (queue.length > 0) {
                        const u = queue.shift()!;
                        for (const v of adj[u]) {
                            if (!visited.has(v)) {
                                visited.add(v);
                                queue.push(v);
                                component.push(v);
                            }
                        }
                    }

                    if (component.length > 1) {
                        const groupColor = DISTINCT_COLORS[globalColorIndex % DISTINCT_COLORS.length];
                        const groupId = `group_${globalColorIndex}`;
                        globalColorIndex++;

                        component.forEach(idx => {
                            duplicateItems.push({
                                ...items[idx],
                                groupId,
                                rowColor: groupColor
                            });
                        });
                    }
                }
            });

            // Sort outcome by Machine -> GroupID -> Start time
            duplicateItems.sort((a, b) => {
                const aKey = a._key_value || a._ma_giuong || '';
                const bKey = b._key_value || b._ma_giuong || '';
                if (aKey !== bKey) return aKey.localeCompare(bKey);
                
                if (a.groupId !== b.groupId) return (a.groupId || '').localeCompare(b.groupId || '', undefined, { numeric: true });

                return a._start.getTime() - b._start.getTime();
            });

            if (duplicateItems.length > 0) {
                setBedServices(duplicateItems);
                message.warning(`Phát hiện ${duplicateItems.length} dịch vụ trùng lặp!`);
            } else {
                setBedServices([]);
                message.success('Không phát hiện trùng lặp nào!');
            }
            setLoading(false);
        }, 500);
    };

    const handleReload = () => {
        setFilterBed('');
        setFilterKhoa('');
        setFilterMaGiuong('');
        setFilterTrinhDo('');
        setFilterNgayRaRange([null, null]);
        setFilterSentStatus('ALL');
        fetchData();
    };

    const getFilteredData = () => {
        const matchingGroupsByDate = new Set<string>();
        // Check if user has selected any date range
        const hasDateRange = filterNgayRaRange && filterNgayRaRange.length === 2 && (filterNgayRaRange[0] || filterNgayRaRange[1]);

        if (hasDateRange) {
            const startRange = filterNgayRaRange[0] ? filterNgayRaRange[0].startOf('day').toDate() : null;
            const endRange = filterNgayRaRange[1] ? filterNgayRaRange[1].endOf('day').toDate() : null;

            bedServices.forEach(item => {
                if (item.NGAY_RA) {
                    const rowDate = parseDate(item.NGAY_RA);

                    let inRange = true;
                    if (startRange && rowDate < startRange) inRange = false;
                    if (endRange && rowDate > endRange) inRange = false;

                    if (inRange) {
                        if (item.groupId) {
                            matchingGroupsByDate.add(item.groupId);
                        } else {
                            matchingGroupsByDate.add(`ungrouped_${item.key}`);
                        }
                    }
                }
            });
        }

        let filtered = bedServices.filter(item => {
            const searchMatch = !filterBed ||
                (item.HO_TEN && item.HO_TEN.toLowerCase().includes(filterBed.toLowerCase())) ||
                (item.MA_LK && item.MA_LK.toString().includes(filterBed.toLowerCase()));

            const khoaMatch = !filterKhoa ||
                (item.MA_KHOA && item.MA_KHOA.toLowerCase().includes(filterKhoa.toLowerCase())) ||
                (item.TEN_KHOA && item.TEN_KHOA.toLowerCase().includes(filterKhoa.toLowerCase()));

            const giuongMatch = !filterMaGiuong ||
                (item.MA_GIUONG && item.MA_GIUONG.toLowerCase().includes(filterMaGiuong.toLowerCase())) ||
                (item.KEY_VALUE && item.KEY_VALUE.toLowerCase().includes(filterMaGiuong.toLowerCase()));

            const trinhDoMatch = !filterTrinhDo ||
                (item.TRINH_DO && item.TRINH_DO.toLowerCase().includes(filterTrinhDo.toLowerCase()));

            const sentMatch = filterSentStatus === 'ALL' ||
                (filterSentStatus === 'SENT' && sentRecordsSet.has(String(item.MA_LK))) ||
                (filterSentStatus === 'UNSENT' && !sentRecordsSet.has(String(item.MA_LK)));

            let ngayRaMatch = true;
            if (hasDateRange) {
                const matchesByGroup = item.groupId && matchingGroupsByDate.has(item.groupId);
                let matchesByRow = false;

                if (item.NGAY_RA) {
                    const rowDate = parseDate(item.NGAY_RA);
                    const startRange = filterNgayRaRange[0] ? filterNgayRaRange[0].startOf('day').toDate() : null;
                    const endRange = filterNgayRaRange[1] ? filterNgayRaRange[1].endOf('day').toDate() : null;

                    matchesByRow = true;
                    if (startRange && rowDate < startRange) matchesByRow = false;
                    if (endRange && rowDate > endRange) matchesByRow = false;
                }

                ngayRaMatch = matchesByGroup || matchesByRow;
            }

            return searchMatch && khoaMatch && giuongMatch && trinhDoMatch && ngayRaMatch && sentMatch;
        });

        if (hide50Percent) {
            const groups = new Map<string, any[]>();
            filtered.forEach(item => {
                const key = item.groupId || item.key;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(item);
            });

            const validGroups = new Set<string>();
            groups.forEach((items, key) => {
                if (key.startsWith('group_')) {
                    const isAll50 = items.every(i => Number(i.TYLE_DV) === 50);
                    if (!isAll50) {
                        validGroups.add(key);
                    }
                } else {
                    validGroups.add(key);
                }
            });

            filtered = filtered.filter(item => validGroups.has(item.groupId || item.key));
        }

        return filtered;
    };

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Báo cáo trùng lặp');

        // Headers
        const columns = [
            { header: 'STT', key: 'stt', width: 5 },
            { header: 'Mã LK', key: 'MA_LK', width: 15 },
            { header: 'Mã BN', key: 'MA_BN', width: 15 },
            { header: 'Mã Thẻ BHYT', key: 'MA_THE_BHYT', width: 20 },
            { header: 'Họ Tên', key: 'HO_TEN', width: 25 },
            { header: 'Mã Khoa', key: 'MA_KHOA', width: 10 },
            { header: 'Tên Khoa', key: 'TEN_KHOA', width: 20 },
            { header: 'Mã Bác sĩ', key: 'MA_BAC_SI', width: 15 },
            { header: 'Tên Bác sĩ', key: 'TEN_BAC_SI', width: 25 },
            { header: 'Trình độ', key: 'TRINH_DO', width: 15 },
            { header: 'Người Thực Hiện', key: 'NGUOI_THUC_HIEN', width: 15 },
            { header: 'Tên Người TH', key: 'TEN_NGUOI_THUC_HIEN', width: 25 },
            { header: rule.logicConfig?.filter?.MA_NHOM == 15 || rule.slug?.includes('giuong') ? 'Mã Giường' : 'Mã Máy', key: 'KEY_VALUE', width: 15 },
            { header: 'Số Lượng', key: 'SOLUONG', width: 10 },
            { header: 'Tỷ lệ BH', key: 'TYLE_BH', width: 10 },
            { header: 'Tỷ lệ DV', key: 'TYLE_DV', width: 10 },
            { header: 'Ngày Vào', key: 'NGAY_VAO', width: 20 },
            { header: 'Ngày Ra', key: 'NGAY_RA', width: 20 },
            { header: 'Ngày YL', key: 'NGAY_YL', width: 20 },
            { header: 'Ngày TH YL', key: 'NGAY_TH_YL', width: 20 },
            { header: 'Ngày KQ', key: 'NGAY_KQ', width: 20 },
            { header: 'Mã DV', key: 'MA_DICH_VU', width: 15 },
            { header: 'Tên Dịch Vụ', key: 'TEN_DICH_VU', width: 30 },
        ];
        sheet.columns = columns;

        // Data
        const dataToExport = getFilteredData();

        dataToExport.forEach((item, index) => {
            const row = sheet.addRow({
                stt: index + 1,
                MA_LK: item.MA_LK,
                MA_BN: item.MA_BN,
                MA_THE_BHYT: item.MA_THE_BHYT,
                HO_TEN: item.HO_TEN,
                MA_KHOA: item.MA_KHOA,
                TEN_KHOA: item.TEN_KHOA,
                MA_BAC_SI: item.MA_BAC_SI,
                TEN_BAC_SI: item.TEN_BAC_SI,
                TRINH_DO: item.TRINH_DO,
                NGUOI_THUC_HIEN: item.NGUOI_THUC_HIEN,
                TEN_NGUOI_THUC_HIEN: item.TEN_NGUOI_THUC_HIEN,
                KEY_VALUE: item.KEY_VALUE ? String(item.KEY_VALUE).split('-')[0] : '', // Chỉnh sửa: Chỉ lấy phần đầu (MA_GIUONG)
                SOLUONG: item.SOLUONG,
                TYLE_BH: item.TYLE_BH,
                TYLE_DV: item.TYLE_DV,
                NGAY_VAO: formatDateTime(item.NGAY_VAO),
                NGAY_RA: formatDateTime(item.NGAY_RA),
                NGAY_YL: formatDateTime(item.NGAY_YL),
                NGAY_TH_YL: item.NGAY_TH_YL ? formatDateTime(item.NGAY_TH_YL) : '',
                NGAY_KQ: formatDateTime(item.NGAY_KQ),
                MA_DICH_VU: item.MA_DICH_VU,
                TEN_DICH_VU: item.TEN_DICH_VU
            });

            if (item.rowColor) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF' + item.rowColor.replace('#', '').toUpperCase() }
                    };
                });
            }
        });

        // Style header
        sheet.getRow(1).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        // Generate filename from rule name
        const ruleName = rule.name || 'bao_cao_trung_lap';
        // Remove illegal characters for filenames
        const safeName = ruleName.replace(/[/\\?%*:|"<>]/g, '-');

        saveAs(blob, `${safeName}_${new Date().getTime()}.xlsx`);
    };

    const handleSaveToServer = () => {
        const dataToExport = getFilteredData();
        if (dataToExport.length === 0) {
            message.warning("Không có dữ liệu để lưu");
            return;
        }
        const ruleName = rule.name || 'bao_cao_trung_lap';
        const safeName = ruleName.replace(/[/\\?%*:|"<>]/g, '-');
        setSaveFileName(`${safeName}_${new Date().getTime()}`);
        setSaveNote('');
        setIsSaveModalVisible(true);
    };

    const confirmSaveToServer = async () => {
        setIsSaveModalVisible(false);
        setIsSaving(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Báo cáo trùng lặp');

            const columns = [
                { header: 'STT', key: 'stt', width: 5 },
                { header: 'Mã LK', key: 'MA_LK', width: 15 },
                { header: 'Mã BN', key: 'MA_BN', width: 15 },
                { header: 'Mã Thẻ BHYT', key: 'MA_THE_BHYT', width: 20 },
                { header: 'Họ Tên', key: 'HO_TEN', width: 25 },
                { header: 'Mã Khoa', key: 'MA_KHOA', width: 10 },
                { header: 'Tên Khoa', key: 'TEN_KHOA', width: 20 },
                { header: 'Mã Bác sĩ', key: 'MA_BAC_SI', width: 15 },
                { header: 'Tên Bác sĩ', key: 'TEN_BAC_SI', width: 25 },
                { header: 'Trình độ', key: 'TRINH_DO', width: 15 },
                { header: 'Người Thực Hiện', key: 'NGUOI_THUC_HIEN', width: 15 },
                { header: 'Tên Người TH', key: 'TEN_NGUOI_THUC_HIEN', width: 25 },
                { header: rule.logicConfig?.filter?.MA_NHOM == 15 || rule.slug?.includes('giuong') ? 'Mã Giường' : 'Mã Máy', key: 'KEY_VALUE', width: 15 },
                { header: 'Số Lượng', key: 'SOLUONG', width: 10 },
                { header: 'Tỷ lệ BH', key: 'TYLE_BH', width: 10 },
                { header: 'Tỷ lệ DV', key: 'TYLE_DV', width: 10 },
                { header: 'Ngày Vào', key: 'NGAY_VAO', width: 20 },
                { header: 'Ngày Ra', key: 'NGAY_RA', width: 20 },
                { header: 'Ngày YL', key: 'NGAY_YL', width: 20 },
                { header: 'Ngày TH YL', key: 'NGAY_TH_YL', width: 20 },
                { header: 'Ngày KQ', key: 'NGAY_KQ', width: 20 },
                { header: 'Mã DV', key: 'MA_DICH_VU', width: 15 },
                { header: 'Tên Dịch Vụ', key: 'TEN_DICH_VU', width: 30 },
            ];
            sheet.columns = columns;

            const dataToExport = getFilteredData();
            if (dataToExport.length === 0) {
                message.warning("Không có dữ liệu để lưu");
                return;
            }

            dataToExport.forEach((item, index) => {
                const row = sheet.addRow({
                    stt: index + 1,
                    MA_LK: item.MA_LK,
                    MA_BN: item.MA_BN,
                    MA_THE_BHYT: item.MA_THE_BHYT,
                    HO_TEN: item.HO_TEN,
                    MA_KHOA: item.MA_KHOA,
                    TEN_KHOA: item.TEN_KHOA,
                    MA_BAC_SI: item.MA_BAC_SI,
                    TEN_BAC_SI: item.TEN_BAC_SI,
                    TRINH_DO: item.TRINH_DO,
                    NGUOI_THUC_HIEN: item.NGUOI_THUC_HIEN,
                    TEN_NGUOI_THUC_HIEN: item.TEN_NGUOI_THUC_HIEN,
                    KEY_VALUE: item.KEY_VALUE ? String(item.KEY_VALUE).split('-')[0] : '',
                    SOLUONG: item.SOLUONG,
                    TYLE_BH: item.TYLE_BH,
                    TYLE_DV: item.TYLE_DV,
                    NGAY_VAO: formatDateTime(item.NGAY_VAO),
                    NGAY_RA: formatDateTime(item.NGAY_RA),
                    NGAY_YL: formatDateTime(item.NGAY_YL),
                    NGAY_TH_YL: item.NGAY_TH_YL ? formatDateTime(item.NGAY_TH_YL) : '',
                    NGAY_KQ: formatDateTime(item.NGAY_KQ),
                    MA_DICH_VU: item.MA_DICH_VU,
                    TEN_DICH_VU: item.TEN_DICH_VU
                });

                if (item.rowColor) {
                    row.eachCell((cell) => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF' + item.rowColor.replace('#', '').toUpperCase() }
                        };
                    });
                }
            });

            sheet.getRow(1).font = { bold: true };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const safeName = (saveFileName || (rule.name || 'bao_cao_trung_lap')).replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileName = `${safeName}.xlsx`;

            const formData = new FormData();
            formData.append('file', blob, fileName);
            formData.append('note', saveNote);

            const res = await fetch('/api/saved-reports', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                message.success('Đã lưu file lên máy chủ thành công!');
            } else {
                message.error('Lỗi khi lưu file: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving to server:', error);
            message.error('Có lỗi xảy ra khi lưu file');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportExcelDoctor = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Báo cáo trùng Bác Sĩ');

        // Headers
        const columns = [
            { header: 'STT', key: 'stt', width: 5 },
            { header: 'Mã LK', key: 'MA_LK', width: 15 },
            { header: 'Mã BN', key: 'MA_BN', width: 15 },
            { header: 'Họ Tên', key: 'HO_TEN', width: 25 },
            { header: 'Mã Bác sĩ', key: 'MA_BS', width: 15 },
            { header: 'Họ Tên BS', key: 'TEN_BAC_SI', width: 25 },
            { header: 'Trình độ', key: 'TRINH_DO', width: 15 },
            { header: 'Ngày chỉ định', key: 'THOI_GIAN_YL', width: 20 },
            { header: 'Loại', key: 'TYPE', width: 10 },
            { header: 'Mã', key: 'MA_LOAI', width: 15 },
            { header: 'Tên Dịch Vụ / Thuốc', key: 'TEN_LOAI', width: 35 },
            { header: 'Mã Khoa', key: 'MA_KHOA', width: 10 },
            { header: 'Tên Khoa', key: 'TEN_KHOA', width: 20 },
        ];
        sheet.columns = columns;

        // Data
        const dataToExport = getFilteredDoctorData();

        dataToExport.forEach((item, index) => {
            const row = sheet.addRow({
                stt: index + 1,
                MA_LK: item.MA_LK,
                MA_BN: item.MA_BN,
                HO_TEN: item.HO_TEN,
                MA_BS: item.MA_BS,
                TEN_BAC_SI: item.TEN_BAC_SI,
                TRINH_DO: item.TRINH_DO,
                THOI_GIAN_YL: formatDateTime(item.THOI_GIAN_YL),
                TYPE: item.TYPE,
                MA_LOAI: item.MA_LOAI,
                TEN_LOAI: item.TEN_LOAI,
                MA_KHOA: item.MA_KHOA,
                TEN_KHOA: item.TEN_KHOA
            });

            if (item.rowColor) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF' + item.rowColor.replace('#', '').toUpperCase() }
                    };
                });
            }
        });

        // Style header
        sheet.getRow(1).font = { bold: true };

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const ruleName = rule.name || 'bao_cao_trung_bac_si';
        const safeName = ruleName.replace(/[/\\?%*:|"<>]/g, '-');
        saveAs(blob, `${safeName}_${new Date().getTime()}.xlsx`);
    };

    const handleSaveToServerDoctor = () => {
        const dataToExport = getFilteredDoctorData();
        if (dataToExport.length === 0) {
            message.warning("Không có dữ liệu để lưu");
            return;
        }
        const ruleName = rule.name || 'bao_cao_trung_bac_si';
        const safeName = ruleName.replace(/[/\\?%*:|"<>]/g, '-');
        setSaveFileName(`${safeName}_${new Date().getTime()}`);
        setSaveNote('');
        setIsSaveModalVisibleDoctor(true);
    };

    const confirmSaveToServerDoctor = async () => {
        setIsSaveModalVisibleDoctor(false);
        setIsSavingDoctor(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Báo cáo trùng Bác Sĩ');

            const columns = [
                { header: 'STT', key: 'stt', width: 5 },
                { header: 'Mã LK', key: 'MA_LK', width: 15 },
                { header: 'Mã BN', key: 'MA_BN', width: 15 },
                { header: 'Họ Tên', key: 'HO_TEN', width: 25 },
                { header: 'Mã Bác sĩ', key: 'MA_BS', width: 15 },
                { header: 'Họ Tên BS', key: 'TEN_BAC_SI', width: 25 },
                { header: 'Trình độ', key: 'TRINH_DO', width: 15 },
                { header: 'Ngày chỉ định', key: 'THOI_GIAN_YL', width: 20 },
                { header: 'Loại', key: 'TYPE', width: 10 },
                { header: 'Mã', key: 'MA_LOAI', width: 15 },
                { header: 'Tên Dịch Vụ / Thuốc', key: 'TEN_LOAI', width: 35 },
                { header: 'Mã Khoa', key: 'MA_KHOA', width: 10 },
                { header: 'Tên Khoa', key: 'TEN_KHOA', width: 20 },
            ];
            sheet.columns = columns;

            const dataToExport = getFilteredDoctorData();
            if (dataToExport.length === 0) {
                message.warning("Không có dữ liệu để lưu");
                return;
            }

            dataToExport.forEach((item, index) => {
                const row = sheet.addRow({
                    stt: index + 1,
                    MA_LK: item.MA_LK,
                    MA_BN: item.MA_BN,
                    HO_TEN: item.HO_TEN,
                    MA_BS: item.MA_BS,
                    TEN_BAC_SI: item.TEN_BAC_SI,
                    TRINH_DO: item.TRINH_DO,
                    THOI_GIAN_YL: formatDateTime(item.THOI_GIAN_YL),
                    TYPE: item.TYPE,
                    MA_LOAI: item.MA_LOAI,
                    TEN_LOAI: item.TEN_LOAI,
                    MA_KHOA: item.MA_KHOA,
                    TEN_KHOA: item.TEN_KHOA
                });

                if (item.rowColor) {
                    row.eachCell((cell) => {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF' + item.rowColor.replace('#', '').toUpperCase() }
                        };
                    });
                }
            });

            sheet.getRow(1).font = { bold: true };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const safeName = (saveFileName || (rule.name || 'bao_cao_trung_bac_si')).replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileName = `${safeName}.xlsx`;

            const formData = new FormData();
            formData.append('file', blob, fileName);
            formData.append('note', saveNote);

            const res = await fetch('/api/saved-reports', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                message.success('Đã lưu file lên máy chủ thành công!');
            } else {
                message.error('Lỗi khi lưu file: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving to server:', error);
            message.error('Có lỗi xảy ra khi lưu file');
        } finally {
            setIsSavingDoctor(false);
        }
    };

    // --- Logic Handlers (Old) ---

    // ======================================
    // DUPLICATE DOCTOR LOGIC
    // ======================================
    const prepareDoctorOrders = (data: ExtendedHosoRecord[]) => {
        if (!rule || !rule.logicConfig) return;
        const config = rule.logicConfig;
        const fieldMaBs = config.fields?.doctor || 'MA_BS';
        const fieldNgayYl = config.fields?.time || 'NGAY_YL';

        const list: any[] = [];
        let index = 1;

        data.forEach(record => {
            record.groups.forEach(group => {
                // We care about XML2 (Thuốc) and XML3 (Dịch Vụ)
                if (group.type === 'XML2' || group.type === 'XML3') {
                    const items = getXmlDataList(group);
                    items.forEach((item: any) => {
                        const maBs = item[fieldMaBs] || item.MA_BAC_SI || item.MA_BS;
                        const ngayYl = item[fieldNgayYl] || item.NGAY_YL;

                        // Only consider items that have both Doctor Code and Order Date
                        if (maBs && ngayYl) {
                            // Filter by MA_NHOM if configured
                            const configuredMaNhom = config.filter?.MA_NHOM;
                            if (configuredMaNhom && Array.isArray(configuredMaNhom) && configuredMaNhom.length > 0) {
                                if (!configuredMaNhom.includes(Number(item.MA_NHOM))) {
                                    return; // Bỏ qua nếu mã nhóm không thuộc danh sách yêu cầu
                                }
                            }

                            const getMaKhoaRV = () => {
                                const xml7Group = record.groups?.find((g: any) => g.type === 'XML7');
                                if (xml7Group && xml7Group.data && xml7Group.data.length > 0) {
                                    return xml7Group.data[0].MA_KHOA_RV || '';
                                }
                                return '';
                            };
                            const deptCode = getMaKhoaRV() || item.MA_KHOA || record.summary?.MA_KHOA || '';
                            const isThuoc = group.type === 'XML2';

                            list.push({
                                key: `${record.id}_${item.MA_DICH_VU || item.MA_THUOC}_${index}`,
                                stt: index++,
                                MA_LK: record.summary?.MA_LK,
                                MA_BN: record.summary?.MA_BN || '',
                                HO_TEN: record.summary?.HO_TEN,
                                MA_KHOA: deptCode,
                                TEN_KHOA: deptMap[deptCode] || '',
                                MA_BS: maBs,
                                TEN_BAC_SI: staffMap[maBs]?.ho_ten || '',
                                TRINH_DO: staffMap[maBs]?.trinh_do || '',
                                THOI_GIAN_YL: ngayYl, // Nguyên gốc thời gian, có thể đến giây (14 ký tự)
                                TYPE: isThuoc ? 'Thuốc' : 'Dịch Vụ',
                                MA_LOAI: isThuoc ? item.MA_THUOC : item.MA_DICH_VU,
                                TEN_LOAI: isThuoc ? item.TEN_THUOC : item.TEN_DICH_VU,
                                NGAY_VAO: record.summary?.NGAY_VAO || '',
                                NGAY_RA: record.summary?.NGAY_RA || '',
                                NGAY_VAO_NOI_TRU: record.summary?.NGAY_VAO_NOI_TRU || '',

                                // Grouping properties
                                _ma_bs: maBs,
                                _ngay_yl: ngayYl,
                                _ma_lk: record.summary?.MA_LK,
                                _ma_bn: record.summary?.MA_BN || '',

                                original: item,
                                recordId: record.id
                            });
                        }
                    });
                }
            });
        });

        setDoctorOrders(list);
    };

    const scanDoctorDuplicates = () => {
        setLoading(true);
        setTimeout(() => {
            const overlaps = new Set<string>();
            const colors = ['bg-red-50', 'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-orange-50', 'bg-pink-50'];

            // Group by: [MA_BS] + [THOI_GIAN_YL]
            // We only flag duplicates occurring ON DIFFERENT PATIENTS, at the EXACT SAME SECOND, by the SAME DOCTOR.
            const groups: Record<string, typeof doctorOrders> = {};

            const ignoreNullValues = rule?.logicConfig?.ignoreNullValues !== false;

            doctorOrders.forEach(item => {
                const maBS = String(item._ma_bs || '');
                if (!maBS || maBS.trim() === '') return;
                if (ignoreNullValues && maBS === 'null') return;
                
                const groupKey = `${maBS}_${item._ngay_yl}`;
                if (!groups[groupKey]) groups[groupKey] = [];
                groups[groupKey].push(item);
            });

            // Filter groups that have MORE THAN 1 DISTINCT PATIENT (Collision detected!)
            let filteredList: any[] = [];
            let colorIdx = 0;

            Object.entries(groups).forEach(([groupKey, items]) => {
                const distinctPatients = new Set(items.map(item => item._ma_bn));
                if (distinctPatients.size > 1) { // Same doctor same time but DIFFERENT patients
                    // Assign a collision color
                    const assignedColor = DISTINCT_COLORS[colorIdx % DISTINCT_COLORS.length];
                    colorIdx++;

                    items.forEach(item => {
                        const timeStr = item.THOI_GIAN_YL; 
                        const formattedTime = dayjs(parseDate(timeStr)).format('DD/MM/YYYY HH:mm');
                        filteredList.push({
                            ...item,
                            groupId: groupKey,
                            rowColor: assignedColor,
                            _overlapStr: `${formattedTime} đến ${formattedTime}`
                        });
                        overlaps.add(item.key);
                    });
                }
            });

            // Sort by Doctor -> Time
            filteredList.sort((a, b) => {
                if (a._ma_bs !== b._ma_bs) return (a._ma_bs || '').localeCompare(b._ma_bs || '');
                if (a._ngay_yl !== b._ngay_yl) return (a._ngay_yl || '').localeCompare(b._ngay_yl || '');
                return a.stt - b.stt;
            });

            if (overlaps.size > 0) {
                setDoctorOrders(filteredList);
                message.warning(`Phát hiện ${filteredList.length} chỉ định dịch vụ/thuốc trùng thời điểm!`);
            } else {
                setDoctorOrders([]);
                message.success('Không phát hiện Trùng Mã Bác Sĩ / Thời gian nào!');
            }
            setLoading(false);
        }, 500);
    };

    const getFilteredDoctorData = () => {
        const matchingGroupsByDate = new Set<string>();
        // Check if user has selected any date range
        const hasDateRange = filterNgayYlRange && filterNgayYlRange.length === 2 && (filterNgayYlRange[0] || filterNgayYlRange[1]);

        if (hasDateRange) {
            const startRange = filterNgayYlRange[0] ? filterNgayYlRange[0].startOf('day').toDate() : null;
            const endRange = filterNgayYlRange[1] ? filterNgayYlRange[1].endOf('day').toDate() : null;

            doctorOrders.forEach(item => {
                if (item.THOI_GIAN_YL) {
                    const rowDate = parseDate(item.THOI_GIAN_YL);

                    let inRange = true;
                    if (startRange && rowDate < startRange) inRange = false;
                    if (endRange && rowDate > endRange) inRange = false;

                    if (inRange) {
                        if (item.groupId) {
                            matchingGroupsByDate.add(item.groupId);
                        } else {
                            matchingGroupsByDate.add(`ungrouped_${item.key}`);
                        }
                    }
                }
            });
        }

        const filtered = doctorOrders.filter(item => {
            let ngayYlMatch = true;
            if (hasDateRange) {
                const matchesByGroup = item.groupId && matchingGroupsByDate.has(item.groupId);
                let matchesByRow = false;

                if (item.THOI_GIAN_YL) {
                    const rowDate = parseDate(item.THOI_GIAN_YL);
                    const startRange = filterNgayYlRange[0] ? filterNgayYlRange[0].startOf('day').toDate() : null;
                    const endRange = filterNgayYlRange[1] ? filterNgayYlRange[1].endOf('day').toDate() : null;

                    matchesByRow = true;
                    if (startRange && rowDate < startRange) matchesByRow = false;
                    if (endRange && rowDate > endRange) matchesByRow = false;
                }

                ngayYlMatch = matchesByGroup || matchesByRow;
            }

            const sentMatch = filterSentStatus === 'ALL' ||
                (filterSentStatus === 'SENT' && sentRecordsSet.has(String(item.MA_LK))) ||
                (filterSentStatus === 'UNSENT' && !sentRecordsSet.has(String(item.MA_LK)));

            return ngayYlMatch && sentMatch;
        });

        return filtered;
    };

    // 2. Machine Check
    const checkMachine = (data: ExtendedHosoRecord[], config: any) => {
        const { fields, constraints, filter } = config;
        const machineUsage: Record<string, any[]> = {};
        const errors: any[] = [];

        data.forEach(record => {
            // Find services matching filter (e.g. ma_nhom = 1)
            record.groups.forEach(group => {
                // Determine if group is relevant (e.g. XML3 for services)
                if (!group.type.startsWith('XML')) return; // Check all XMLs?

                const list = getXmlDataList(group);
                list.forEach((item: any) => {
                    // Check filter
                    if (filter && filter.ma_nhom && item.MA_NHOM != filter.ma_nhom) return;

                    const machineCode = item[fields.machineCode];
                    const serviceCode = item[fields.serviceCode];
                    const timeStr = item[fields.time];

                    if (machineCode && timeStr) {
                        if (!machineUsage[machineCode]) machineUsage[machineCode] = [];
                        machineUsage[machineCode].push({
                            id: record.summary?.MA_LK,
                            patientName: record.summary?.HO_TEN,
                            serviceName: item.TEN_DICH_VU,
                            time: parseDate(timeStr),
                            originalRecord: record
                        });
                    }
                });
            });
        });

        // Validate Constraints
        Object.entries(machineUsage).forEach(([code, usages]) => {
            // Sort by time
            usages.sort((a, b) => a.time.getTime() - b.time.getTime());

            // 1. Max Per Day
            if (constraints?.maxPerDay) {
                const byDay: Record<string, number> = {};
                usages.forEach(u => {
                    const day = u.time.toISOString().split('T')[0];
                    byDay[day] = (byDay[day] || 0) + 1;
                });
                Object.entries(byDay).forEach(([day, count]) => {
                    if (count > constraints.maxPerDay) {
                        errors.push({
                            key: `${code}_${day}`,
                            message: `Máy ${code} quá tải ngày ${day}: ${count} lần (Max: ${constraints.maxPerDay})`,
                            type: 'OVERLOAD',
                            details: { machine: code, day, count }
                        });
                    }
                });
            }
        });

        return errors;
    };

    const parseDate = (str: string) => {
        // YYYYMMDD or YYYYMMDDHHmm or YYYYMMDDHHmmss
        if (!str) return new Date(0);
        const y = parseInt(str.substring(0, 4)) || 0;
        const m = (parseInt(str.substring(4, 6)) || 1) - 1;
        const d = parseInt(str.substring(6, 8)) || 1;
        const h = str.length >= 10 ? parseInt(str.substring(8, 10)) : 0;
        const min = str.length >= 12 ? parseInt(str.substring(10, 12)) : 0;
        const sec = str.length >= 14 ? parseInt(str.substring(12, 14)) : 0;
        const dObj = new Date(y, m, d, h, min, sec);
        if (isNaN(dObj.getTime())) return new Date(0);
        return dObj;
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '';
        // Length 14 (YYYYMMDDHHmmss) -> DD/MM/YYYY HH:mm:ss
        if (dateStr.length >= 14) {
            return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)} ${dateStr.substring(8, 10)}:${dateStr.substring(10, 12)}:${dateStr.substring(12, 14)}`;
        }
        // Length 12 (YYYYMMDDHHmm) -> DD/MM/YYYY HH:mm:ss
        if (dateStr.length >= 12) {
            return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)} ${dateStr.substring(8, 10)}:${dateStr.substring(10, 12)}:00`;
        }
        return dateStr;
    };

    // --- Columns ---
    const bedColumns = [
        { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
        {
            title: 'Mã LK', dataIndex: 'MA_LK', key: 'MA_LK', width: 140,
            render: (text: string) => {
                const isSent = sentRecordsSet.has(String(text));
                return (
                    <div className="flex items-center gap-1">
                        <span className="font-semibold text-blue-600">{text}</span>
                        {isSent && <Tag color="orange" className="m-0 px-1 text-[10px] leading-tight font-bold border-orange-300">Đã gửi</Tag>}
                    </div>
                );
            }
        },
        { title: 'Mã BN', dataIndex: 'MA_BN', key: 'MA_BN', width: 110 },
        { title: 'Mã Thẻ BHYT', dataIndex: 'MA_THE_BHYT', key: 'MA_THE_BHYT', width: 160 },
        { title: 'Họ Tên', dataIndex: 'HO_TEN', key: 'HO_TEN', width: 200, className: 'uppercase font-medium' },
        { title: 'Mã Khoa', dataIndex: 'MA_KHOA', key: 'MA_KHOA', width: 100, className: 'font-bold text-blue-700' },
        { title: 'Tên Khoa', dataIndex: 'TEN_KHOA', key: 'TEN_KHOA', width: 200, className: 'text-slate-500' },
        { title: 'Mã Bác sĩ', dataIndex: 'MA_BAC_SI', key: 'MA_BAC_SI', width: 120, className: 'font-bold text-purple-600' },
        { title: 'Tên Bác sĩ', dataIndex: 'TEN_BAC_SI', key: 'TEN_BAC_SI', width: 200, className: 'font-medium text-purple-700' },
        { title: 'Trình độ', dataIndex: 'TRINH_DO', key: 'TRINH_DO', width: 120 },
        { title: 'Người TH', dataIndex: 'NGUOI_THUC_HIEN', key: 'NGUOI_THUC_HIEN', width: 120, className: 'font-bold text-emerald-600' },
        { title: 'Tên Người TH', dataIndex: 'TEN_NGUOI_THUC_HIEN', key: 'TEN_NGUOI_THUC_HIEN', width: 200, className: 'font-medium text-emerald-700' },
        {
            title: rule.logicConfig?.filter?.MA_NHOM == 15 || rule.slug?.includes('giuong') ? 'Mã Giường' : 'Mã Máy',
            dataIndex: 'KEY_VALUE',
            key: 'KEY_VALUE',
            width: 100,
            className: 'font-bold text-red-500',
            render: (text: string) => text ? String(text).split('-')[0] : '' // Chỉnh sửa hiển thị UI: Chỉ lấy phần đầu (MA_GIUONG)
        },
        {
            title: 'SL', dataIndex: 'SOLUONG', key: 'SOLUONG', width: 60, align: 'center' as const,
            render: (v: any) => <span className="font-semibold">{v}</span>
        },
        {
            title: 'Tỷ lệ BH', dataIndex: 'TYLE_BH', key: 'TYLE_BH', width: 80, align: 'center' as const,
            render: (v: any) => v ? <Tag color="orange">{v}</Tag> : '-'
        },
        {
            title: 'Tỷ lệ DV', dataIndex: 'TYLE_DV', key: 'TYLE_DV', width: 80, align: 'center' as const,
            render: (v: any) => v ? <Tag color="cyan">{v}</Tag> : '-'
        },
        {
            title: 'Ngày Vào', dataIndex: 'NGAY_VAO', key: 'NGAY_VAO', width: 150,
            render: (text: string) => formatDateTime(text)
        },
        {
            title: 'Ngày Ra', dataIndex: 'NGAY_RA', key: 'NGAY_RA', width: 150,
            render: (text: string) => formatDateTime(text)
        },
        {
            title: 'Ngày YL', dataIndex: 'NGAY_YL', key: 'NGAY_YL', width: 150,
            render: (text: string) => formatDateTime(text)
        },
        {
            title: 'Ngày TH YL', dataIndex: 'NGAY_TH_YL', key: 'NGAY_TH_YL', width: 140,
            render: (text: string) => text ? formatDateTime(text) : '-'
        },
        {
            title: 'Ngày KQ', dataIndex: 'NGAY_KQ', key: 'NGAY_KQ', width: 150,
            render: (text: string) => formatDateTime(text)
        },
        { title: 'Mã Dịch Vụ', dataIndex: 'MA_DICH_VU', key: 'MA_DICH_VU', width: 150 },
        { title: 'Tên Dịch Vụ', dataIndex: 'TEN_DICH_VU', key: 'TEN_DICH_VU', width: 350, ellipsis: true },
    ];

    const genericColumns = [
        {
            title: 'Nội dung lỗi',
            dataIndex: 'message',
            key: 'message',
            render: (text: string) => <div className="text-red-600 font-medium">{text}</div>
        },
        {
            title: 'Loại',
            dataIndex: 'type',
            key: 'type',
            render: (t: string) => t ? <Tag>{t}</Tag> : <Tag>LOGIC</Tag>
        }
    ];

    const doctorColumns = [
        { title: 'STT', key: 'stt', width: 60, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
        {
            title: 'Mã LK', dataIndex: 'MA_LK', key: 'MA_LK', width: 140,
            render: (text: string) => {
                const isSent = sentRecordsSet.has(String(text));
                return (
                    <div className="flex items-center gap-1">
                        <span className="font-semibold text-blue-600">{text}</span>
                        {isSent && <Tag color="orange" className="m-0 px-1 text-[10px] leading-tight font-bold border-orange-300">Đã gửi</Tag>}
                    </div>
                );
            }
        },
        { title: 'Mã BN', dataIndex: 'MA_BN', key: 'MA_BN', width: 110 },
        { title: 'Họ Tên', dataIndex: 'HO_TEN', key: 'HO_TEN', width: 200, className: 'uppercase font-medium' },
        { title: 'Mã Bác sĩ', dataIndex: 'MA_BS', key: 'MA_BS', width: 120, className: 'font-bold text-purple-600' },
        { title: 'Họ Tên BS', dataIndex: 'TEN_BAC_SI', key: 'TEN_BAC_SI', width: 200, className: 'font-medium text-purple-700' },
        { title: 'Trình độ', dataIndex: 'TRINH_DO', key: 'TRINH_DO', width: 120 },
        {
            title: 'Ngày chỉ định (Tính đến giây)', dataIndex: 'THOI_GIAN_YL', key: 'THOI_GIAN_YL', width: 180, className: 'font-bold text-red-500',
            render: (text: string) => formatDateTime(text)
        },
        {
            title: 'Loại', dataIndex: 'TYPE', key: 'TYPE', width: 100, align: 'center' as const,
            render: (type: string) => type === 'Thuốc' ? <Tag color="green">{type}</Tag> : <Tag color="blue">{type}</Tag>
        },
        { title: 'Mã', dataIndex: 'MA_LOAI', key: 'MA_LOAI', width: 120 },
        { title: 'Tên Dịch Vụ / Thuốc', dataIndex: 'TEN_LOAI', key: 'TEN_LOAI', width: 350, ellipsis: true },
        { title: 'Mã Khoa', dataIndex: 'MA_KHOA', key: 'MA_KHOA', width: 100 },
        { title: 'Tên Khoa', dataIndex: 'TEN_KHOA', key: 'TEN_KHOA', width: 200 },
    ];

    if (loading) return (
        <div className="p-12 text-center">
            <Spin size="large" />
            <div className="mt-4 text-slate-500 font-medium">Đang tải dữ liệu...</div>
        </div>
    );

    if (records.length === 0) return (
        <Empty
            description="Chưa có dữ liệu XML. Vui lòng tải file ở trang chủ trước."
            image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
            <Button type="primary" href="/">Về trang chủ tải file</Button>
        </Empty>
    );

    // Render Request View (Duplicate Doctor Mode)
    if (isDuplicateDoctorMode) {
        return (
            <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-lg font-bold text-slate-700">Kiểm tra Trùng Bác Sĩ (Cùng Y Lệnh)</div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Select
                            value={filterSentStatus}
                            onChange={setFilterSentStatus}
                            style={{ width: 150 }}
                            options={[
                                { value: 'ALL', label: 'Tất cả' },
                                { value: 'SENT', label: 'Đã gửi đề nghị' },
                                { value: 'UNSENT', label: 'Chưa gửi đề nghị' }
                            ]}
                        />
                        <DatePicker.RangePicker
                            placeholder={["Từ ngày (Ngày chỉ định)", "Đến ngày (Ngày chỉ định)"]}
                            format="DD/MM/YYYY"
                            style={{ width: 280 }}
                            onChange={(dates) => {
                                setFilterNgayYlRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null]);
                            }}
                            allowClear
                        />
                        <DatePicker.RangePicker
                            placeholder={["Từ ngày (CSDL)", "Đến ngày (CSDL)"]}
                            format="DD/MM/YYYY"
                            style={{ width: 280 }}
                            value={dbDateRange}
                            onChange={(dates) => setDbDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                            allowClear
                        />
                        <Button type="primary" icon={<CloudDownloadOutlined />} onClick={fetchDataFromDB} className="bg-green-600 hover:bg-green-700">Tải từ CSDL</Button>
                        <Button icon={<ReloadOutlined />} onClick={fetchData}>Tải lại dữ liệu (Local)</Button>
                        <Button icon={<FileExcelOutlined />} onClick={handleExportExcelDoctor}>Xuất Excel</Button>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            onClick={handleSaveErrorsLogToDB}
                            className="bg-red-600 hover:bg-red-700 shadow-md shadow-red-200"
                            disabled={getFilteredDoctorData().length === 0}
                        >
                            Lưu lỗi vào CSDL
                        </Button>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            onClick={handleSaveXmlsToDB}
                            className="bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                            disabled={getFilteredDoctorData().length === 0}
                        >
                            Lưu DB (XMLVIEW)
                        </Button>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            onClick={handleSaveToServerDoctor}
                            loading={isSavingDoctor}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Lưu Excel máy chủ
                        </Button>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            onClick={handleSaveXmlsToDB}
                            className="bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                            disabled={getFilteredDoctorData().length === 0}
                        >
                            Lưu DB (XMLVIEW)
                        </Button>
                        <Button
                            type="primary"
                            danger
                            icon={<ScanOutlined />}
                            onClick={scanDoctorDuplicates}
                        >
                            Quét Trùng Lặp
                        </Button>
                    </div>
                </div>

                <Table
                    dataSource={getFilteredDoctorData()} // Apply local filtering logic here if needed!
                    columns={doctorColumns}
                    size="middle"
                    bordered
                    scroll={{ x: 1300, y: 600 }}
                    pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                    onRow={(record) => ({
                        style: { backgroundColor: record.rowColor || undefined }
                    })}
                />
                <Modal
                    title="Nhập thông tin cho báo cáo lưu"
                    open={isSaveModalVisibleDoctor}
                    onOk={confirmSaveToServerDoctor}
                    onCancel={() => setIsSaveModalVisibleDoctor(false)}
                    okText="Lưu"
                    cancelText="Hủy"
                >
                    <div className="space-y-4">
                        <div>
                            <div className="mb-1 font-medium text-slate-600">Tên file (không bao gồm .xlsx)</div>
                            <Input
                                placeholder="Nhập tên file"
                                value={saveFileName}
                                onChange={(e) => setSaveFileName(e.target.value)}
                            />
                        </div>
                        <div>
                            <div className="mb-1 font-medium text-slate-600">Ghi chú (tùy chọn)</div>
                            <Input.TextArea
                                rows={4}
                                placeholder="Nhập ghi chú (VD: số liệu từ ngày... đến ngày...)"
                                value={saveNote}
                                onChange={(e) => setSaveNote(e.target.value)}
                            />
                        </div>
                    </div>
                </Modal>
            </div>
        );
    }

    // Render Request View (Duplicate Bed Mode)
    if (isDuplicateBedMode) {
        return (
            <div className="space-y-4">
                {/* Header Section */}
                {/* Header Section */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex flex-row items-center gap-2">
                        <Input
                            prefix={<SearchOutlined className="text-slate-400" />}
                            placeholder="Tìm kiếm..."
                            style={{ width: 180 }}
                            value={filterBed}
                            onChange={(e) => setFilterBed(e.target.value)}
                        />
                        <Input
                            placeholder="Mã/Tên Khoa"
                            style={{ width: 140 }}
                            value={filterKhoa}
                            onChange={(e) => setFilterKhoa(e.target.value)}
                            allowClear
                        />
                        <Input
                            placeholder="Mã Giường"
                            style={{ width: 120 }}
                            value={filterMaGiuong}
                            onChange={(e) => setFilterMaGiuong(e.target.value)}
                            allowClear
                        />
                        <Input
                            placeholder="Trình độ"
                            style={{ width: 120 }}
                            value={filterTrinhDo}
                            onChange={(e) => setFilterTrinhDo(e.target.value)}
                            allowClear
                        />
                        <DatePicker.RangePicker
                            placeholder={["Từ ngày (Ngày ra)", "Đến ngày (Ngày ra)"]}
                            format="DD/MM/YYYY"
                            style={{ width: 280 }}
                            value={filterNgayRaRange}
                            onChange={(dates) => {
                                setFilterNgayRaRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null]);
                            }}
                            allowClear
                        />
                        <Select
                            value={filterSentStatus}
                            onChange={setFilterSentStatus}
                            style={{ width: 150 }}
                            options={[
                                { value: 'ALL', label: 'Tất cả' },
                                { value: 'SENT', label: 'Đã gửi đề nghị' },
                                { value: 'UNSENT', label: 'Chưa gửi đề nghị' }
                            ]}
                        />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <DatePicker.RangePicker
                            placeholder={["Từ ngày (CSDL)", "Đến ngày (CSDL)"]}
                            format="DD/MM/YYYY"
                            style={{ width: 280 }}
                            value={dbDateRange}
                            onChange={(dates) => setDbDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                            allowClear
                        />
                        <Button type="primary" icon={<CloudDownloadOutlined />} onClick={fetchDataFromDB} className="bg-green-600 hover:bg-green-700">Tải từ CSDL</Button>
                        <Button icon={<ReloadOutlined />} onClick={handleReload}>Tải lại (Local)</Button>
                        <Button 
                            icon={<FilterOutlined />} 
                            onClick={() => setHide50Percent(!hide50Percent)}
                            type={hide50Percent ? "primary" : "default"}
                            danger={hide50Percent}
                        >
                            {hide50Percent ? "Đang ẩn cặp 50%" : "Ẩn cặp 50%"}
                        </Button>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            onClick={handleSaveErrorsLogToDB}
                            className="bg-red-600 hover:bg-red-700 shadow-md shadow-red-200"
                            disabled={getFilteredData().length === 0}
                        >
                            Lưu lỗi vào CSDL
                        </Button>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            onClick={handleSaveXmlsToDB}
                            className="bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                            disabled={getFilteredData().length === 0}
                        >
                            Lưu DB (XMLVIEW)
                        </Button>
                        <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>Xuất Excel</Button>
                        <Button
                            type="primary"
                            icon={<CloudUploadOutlined />}
                            onClick={handleSaveToServer}
                            loading={isSaving}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Lưu Excel máy chủ
                        </Button>
                        <Button
                            type="primary"
                            danger
                            icon={<ScanOutlined />}
                            onClick={scanDuplicates}
                        >
                            Quét Trùng Lặp
                        </Button>
                    </div>
                </div>

                <Table
                    dataSource={getFilteredData()}
                    columns={bedColumns}
                    size="middle"
                    bordered
                    scroll={{ x: 1500, y: 600 }}
                    pagination={{ defaultPageSize: 20, showSizeChanger: true }}
                    onRow={(record) => ({
                        style: { backgroundColor: record.rowColor || undefined }
                    })}
                />
                <Modal
                    title="Nhập thông tin cho báo cáo lưu"
                    open={isSaveModalVisible}
                    onOk={confirmSaveToServer}
                    onCancel={() => setIsSaveModalVisible(false)}
                    okText="Lưu"
                    cancelText="Hủy"
                >
                    <div className="space-y-4">
                        <div>
                            <div className="mb-1 font-medium text-slate-600">Tên file (không bao gồm .xlsx)</div>
                            <Input
                                placeholder="Nhập tên file"
                                value={saveFileName}
                                onChange={(e) => setSaveFileName(e.target.value)}
                            />
                        </div>
                        <div>
                            <div className="mb-1 font-medium text-slate-600">Ghi chú (tùy chọn)</div>
                            <Input.TextArea
                                rows={4}
                                placeholder="Nhập ghi chú (VD: số liệu từ ngày... đến ngày...)"
                                value={saveNote}
                                onChange={(e) => setSaveNote(e.target.value)}
                            />
                        </div>
                    </div>
                </Modal>
            </div>
        );
    }

    // Generic View
    return (
        <div className="space-y-6">
            <Card title={`Kết quả kiểm tra (${records.length} hồ sơ)`} extra={
                <Space>
                    <DatePicker.RangePicker
                        placeholder={["Từ ngày (CSDL)", "Đến ngày (CSDL)"]}
                        format="DD/MM/YYYY"
                        style={{ width: 280 }}
                        value={dbDateRange}
                        onChange={(dates) => setDbDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                        allowClear
                    />
                    <Button type="primary" icon={<CloudDownloadOutlined />} onClick={fetchDataFromDB} className="bg-green-600 hover:bg-green-700">Tải từ CSDL</Button>
                    <Button icon={<ReloadOutlined />} onClick={fetchData}>Chạy lại (Local)</Button>
                    <Button
                        type="primary"
                        icon={<CloudUploadOutlined />}
                        onClick={handleSaveXmlsToDB}
                        className="bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200"
                        disabled={results.length === 0}
                    >
                        Lưu DB (XMLVIEW)
                    </Button>
                </Space>
            }>
                {results.length === 0 ? (
                    <div className="text-center py-8 text-green-600 container-none">
                        <CheckCircleOutlined style={{ fontSize: 48 }} className="mb-4" />
                        <div className="text-lg font-medium">Không phát hiện lỗi nào theo quy tắc này!</div>
                    </div>
                ) : (
                    <Table
                        dataSource={results}
                        columns={genericColumns}
                        rowKey="key"
                    />
                )}
            </Card>
        </div>
    );
}


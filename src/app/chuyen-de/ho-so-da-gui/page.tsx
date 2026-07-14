"use client";

import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileType, CheckCircle, AlertCircle, RefreshCw, Search, History, Download, Filter, GitCompare, HelpCircle } from 'lucide-react';
import { Tabs, Table, Input, Button, Tag, Space, Typography, Select, Modal, Switch, DatePicker, Collapse } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getBasePath } from '@/utils/config';
import * as xlsx from 'xlsx';

const { Title } = Typography;

export default function HoSoDaGuiPage() {
    // --- IMPORT STATES ---
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // --- COMPARE STATES ---
    const [compareFiles, setCompareFiles] = useState<File[]>([]);
    const [isComparing, setIsComparing] = useState(false);
    const [compareResult, setCompareResult] = useState<any>(null);
    const [compareError, setCompareError] = useState<string | null>(null);
    const [showInstructions, setShowInstructions] = useState(false);
    
    // --- COMPARE FILTER STATES ---
    const [compareFilterModalVisible, setCompareFilterModalVisible] = useState(false);
    const [compareFilterHS, setCompareFilterHS] = useState<string[]>([]);
    const [compareFilterTT, setCompareFilterTT] = useState<string[]>([]);
    const [compareDateRangeStr, setCompareDateRangeStr] = useState<[string, string] | null>(null);

    // --- MAPPING STATES ---
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
        maThe: '', hoTen: '', ngaySinh: '', gioiTinh: '', chanDoan: '',
        ngayVao: '', ngayRa: '', tongChi: '', tongChiBH: '', baoHiemTT: '',
        benhNhanCCT: '', benhNhanTT: '', nguonKhac: ''
    });

    // --- LIST STATES ---
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
    const [searchText, setSearchText] = useState('');
    const [filterTrangThaiHS, setFilterTrangThaiHS] = useState<string | null>(null);
    const [filterTrangThaiTT, setFilterTrangThaiTT] = useState<string | null>(null);
    const [onlyModified, setOnlyModified] = useState(false);
    const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

    // --- HISTORY STATES ---
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedMaLienKet, setSelectedMaLienKet] = useState<string | null>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // --- SELECTION & DELETE STATES ---
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [listDateRangeStr, setListDateRangeStr] = useState<[string, string] | null>(null);

    const fetchList = async (page = 1, pageSize = 20, search = '', ttHS = filterTrangThaiHS, ttTT = filterTrangThaiTT, modifiedOnly = onlyModified, dateRange = listDateRangeStr) => {
        setLoading(true);
        try {
            let url = `${getBasePath()}/api/ho-so-da-gui?page=${page}&limit=${pageSize}&search=${encodeURIComponent(search)}&trangThaiHS=${encodeURIComponent(ttHS || '')}&trangThaiTT=${encodeURIComponent(ttTT || '')}&onlyModified=${modifiedOnly}`;
            if (dateRange) {
                const formatForApi = (dateStr: string) => {
                    const [d, m, y] = dateStr.split('/');
                    return `${y}${m}${d}`;
                };
                url += `&ngayRaTu=${formatForApi(dateRange[0])}&ngayRaDen=${formatForApi(dateRange[1])}`;
            }
            
            const res = await fetch(url);
            const json = await res.json();
            if (json.success) {
                let finalData = json.data;
                if (modifiedOnly && finalData.length > 0) {
                    finalData = finalData.map((row: any, i: number, arr: any[]) => {
                        const changedFields = new Set<string>();
                        const checkDiff = (otherRow: any) => {
                            if (otherRow && otherRow.maLienKet === row.maLienKet) {
                                Object.keys(row).forEach(key => {
                                    const skipKeys = ['id', 'createdAt', 'updatedAt', 'versionType', 'hasHistory', 'stt', 'maLienKet'];
                                    if (!skipKeys.includes(key)) {
                                        if (String(row[key] || '') !== String(otherRow[key] || '')) {
                                            changedFields.add(key);
                                        }
                                    }
                                });
                            }
                        };
                        checkDiff(arr[i + 1]); // So với bản cũ hơn (nằm dưới)
                        checkDiff(arr[i - 1]); // So với bản mới hơn (nằm trên)
                        
                        return { ...row, changedFields: Array.from(changedFields) };
                    });
                }
                setData(finalData);
                setPagination({
                    current: json.pagination.page,
                    pageSize: json.pagination.limit,
                    total: json.pagination.total,
                });
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách:', error);
        } finally {
            setLoading(false);
        }
    };

    const [filterOptionsHS, setFilterOptionsHS] = useState<{value: string, label: string}[]>([]);
    const [filterOptionsTT, setFilterOptionsTT] = useState<{value: string, label: string}[]>([]);

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const res = await fetch(`${getBasePath()}/api/ho-so-da-gui/filters`);
                const json = await res.json();
                if (json.success) {
                    setFilterOptionsHS(json.data.trangThaiHS.map((s: string) => ({ value: s, label: s })));
                    setFilterOptionsTT(json.data.trangThaiTT.map((s: string) => ({ value: s, label: s })));
                }
            } catch (error) {
                console.error('Lỗi khi tải bộ lọc:', error);
            }
        };
        fetchFilters();
        fetchList(pagination.current, pagination.pageSize, searchText, filterTrangThaiHS, filterTrangThaiTT, onlyModified, listDateRangeStr);
    }, []);

    const handleTableChange = (newPagination: any) => {
        fetchList(newPagination.current, newPagination.pageSize, searchText, filterTrangThaiHS, filterTrangThaiTT, onlyModified, listDateRangeStr);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchText(value);

        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        const timeout = setTimeout(() => {
            fetchList(1, pagination.pageSize, value, filterTrangThaiHS, filterTrangThaiTT, onlyModified, listDateRangeStr);
        }, 500);

        setTypingTimeout(timeout);
    };

    const handleSearch = (value: string) => {
        if (typingTimeout) clearTimeout(typingTimeout);
        setSearchText(value);
        fetchList(1, pagination.pageSize, value, filterTrangThaiHS, filterTrangThaiTT, onlyModified, listDateRangeStr);
    };

    const handleFilterHSChange = (value: string) => {
        setFilterTrangThaiHS(value);
        fetchList(1, pagination.pageSize, searchText, value, filterTrangThaiTT, onlyModified, listDateRangeStr);
    };

    const handleFilterTTChange = (value: string) => {
        setFilterTrangThaiTT(value);
        fetchList(1, pagination.pageSize, searchText, filterTrangThaiHS, value, onlyModified, listDateRangeStr);
    };

    const handleOnlyModifiedChange = (checked: boolean) => {
        setOnlyModified(checked);
        fetchList(1, pagination.pageSize, searchText, filterTrangThaiHS, filterTrangThaiTT, checked, listDateRangeStr);
    };

    const handleListDateRangeChange = (dates: any, dateStrings: [string, string]) => {
        const val = dates ? dateStrings : null;
        setListDateRangeStr(val);
        fetchList(1, pagination.pageSize, searchText, filterTrangThaiHS, filterTrangThaiTT, onlyModified, val);
    };

    const handleViewHistory = async (maLienKet: string) => {
        setSelectedMaLienKet(maLienKet);
        setHistoryModalVisible(true);
        setLoadingHistory(true);
        try {
            const res = await fetch(`${getBasePath()}/api/ho-so-da-gui/${maLienKet}/history`);
            const json = await res.json();
            if (json.success) setHistoryData(json.data);
        } catch (error) {
            console.error("Lỗi:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleExportDiff = async () => {
        try {
            const res = await fetch(`${getBasePath()}/api/ho-so-da-gui/export-diff`);
            if (!res.ok) {
                const data = await res.json();
                Modal.error({
                    title: 'Không thể xuất báo cáo',
                    content: data.error || 'Có lỗi xảy ra khi xuất file.'
                });
                return;
            }
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'DoiChieuHoSo.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            Modal.error({ title: 'Lỗi', content: 'Không thể kết nối tới máy chủ.' });
        }
    };

    const handleDeleteSelected = () => {
        if (selectedRowKeys.length === 0) return;
        Modal.confirm({
            title: 'Xác nhận xóa',
            content: `Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} hồ sơ đã chọn không? Hành động này không thể hoàn tác.`,
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    const res = await fetch(`${getBasePath()}/api/ho-so-da-gui`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: selectedRowKeys })
                    });
                    const json = await res.json();
                    if (json.success) {
                        Modal.success({ title: 'Thành công', content: json.message });
                        setSelectedRowKeys([]);
                        fetchList(1, pagination.pageSize, searchText, filterTrangThaiHS, filterTrangThaiTT, onlyModified, listDateRangeStr);
                    } else {
                        Modal.error({ title: 'Lỗi', content: json.error });
                    }
                } catch (error) {
                    Modal.error({ title: 'Lỗi', content: 'Không thể kết nối tới máy chủ.' });
                }
            }
        });
    };

    const handleDeleteAll = () => {
        Modal.confirm({
            title: 'Cảnh báo nguy hiểm',
            content: 'Bạn đang yêu cầu XÓA TOÀN BỘ hồ sơ thỏa mãn bộ lọc hiện tại (hoặc tất cả nếu không lọc). Hành động này cực kỳ nguy hiểm và không thể hoàn tác. Bạn có chắc chắn muốn tiếp tục?',
            okText: 'Xóa Toàn Bộ',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    const res = await fetch(`${getBasePath()}/api/ho-so-da-gui`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            deleteAll: true,
                            search: searchText,
                            trangThaiHS: filterTrangThaiHS,
                            trangThaiTT: filterTrangThaiTT,
                            ngayRaTu: listDateRangeStr?.[0],
                            ngayRaDen: listDateRangeStr?.[1]
                        })
                    });
                    const json = await res.json();
                    if (json.success) {
                        Modal.success({ title: 'Thành công', content: json.message });
                        setSelectedRowKeys([]);
                        fetchList(1, pagination.pageSize, searchText, filterTrangThaiHS, filterTrangThaiTT, onlyModified, listDateRangeStr);
                    } else {
                        Modal.error({ title: 'Lỗi', content: json.error });
                    }
                } catch (error) {
                    Modal.error({ title: 'Lỗi', content: 'Không thể kết nối tới máy chủ.' });
                }
            }
        });
    };

    // --- IMPORT LOGIC ---
    const onDrop = (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            setResult(null);
            setError(null);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxFiles: 1
    });

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${getBasePath()}/api/ho-so-da-gui/import`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setResult(data);
                setFile(null);
                // Reload list after import
                fetchList(1, pagination.pageSize, searchText);
            } else {
                setError(data.error || 'Có lỗi xảy ra khi tải file lên');
            }
        } catch (err: any) {
            setError('Lỗi kết nối tới máy chủ');
        } finally {
            setIsUploading(false);
        }
    };

    // --- COMPARE LOGIC ---
    const autoMapColumns = (headers: string[]) => {
        const mapping: Record<string, string> = {};
        const findMatch = (keywords: string[]) => {
            return headers.find(h => keywords.some(k => h.toUpperCase().includes(k.toUpperCase()))) || '';
        };
        
        mapping.maThe = findMatch(['MA_THE', 'Mã thẻ']);
        mapping.hoTen = findMatch(['HO_TEN', 'Họ tên']);
        mapping.ngaySinh = findMatch(['NGAY_SINH', 'Ngày sinh', 'Năm sinh']);
        mapping.gioiTinh = findMatch(['GIOI_TINH', 'Giới tính']);
        mapping.chanDoan = findMatch(['MA_BENH', 'Mã bệnh', 'Chẩn đoán']);
        mapping.ngayVao = findMatch(['NGAY_VAO', 'Ngày vào']);
        mapping.ngayRa = findMatch(['NGAY_RA', 'Ngày ra']);
        mapping.tongChi = findMatch(['T_TONGCHI_BV', 'Tổng chi', 'T_TONGCHI']);
        mapping.tongChiBH = findMatch(['T_TONGCHI_BH', 'Tổng chi BH']);
        mapping.baoHiemTT = findMatch(['T_BHTT', 'Bảo hiểm TT', 'Bảo hiểm thanh toán']);
        mapping.benhNhanCCT = findMatch(['T_BNCCT', 'Bệnh nhân CCT', 'Cùng chi trả']);
        mapping.benhNhanTT = findMatch(['T_BNTT', 'Bệnh nhân TT', 'Người bệnh tự trả']);
        mapping.nguonKhac = findMatch(['T_NGUONKHAC', 'Nguồn khác']);
        
        setColumnMapping(mapping);
    };

    const onDropCompare = (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setCompareFiles(prev => [...prev, ...acceptedFiles]);
            setCompareResult(null);
            setCompareError(null);
            
            // Đọc dòng đầu tiên của file đầu tiên để lấy Headers
            if (excelHeaders.length === 0) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target?.result as ArrayBuffer);
                        const workbook = xlsx.read(data, { type: 'array' });
                        const sheet = workbook.Sheets[workbook.SheetNames[0]];
                        const headers: string[] = [];
                        const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1:A1');
                        for(let c = range.s.c; c <= range.e.c; ++c) {
                            const cell = sheet[xlsx.utils.encode_cell({c, r: range.s.r})];
                            if(cell && cell.v) headers.push(String(cell.v).trim());
                        }
                        setExcelHeaders(headers);
                        autoMapColumns(headers);
                    } catch (err) {
                        console.error('Không thể đọc headers từ file Excel', err);
                    }
                };
                reader.readAsArrayBuffer(acceptedFiles[0]);
            }
        }
    };

    const { getRootProps: getCompareRootProps, getInputProps: getCompareInputProps, isDragActive: isCompareDragActive } = useDropzone({
        onDrop: onDropCompare,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        }
    });

    const handleCompare = async () => {
        if (compareFiles.length === 0) return;

        setCompareFilterModalVisible(false);
        setIsComparing(true);
        setCompareError(null);
        setCompareResult(null);

        const formData = new FormData();
        compareFiles.forEach(f => formData.append('file', f));
        
        if (compareFilterHS.length > 0) {
            formData.append('trangThaiHS', compareFilterHS.join(','));
        }
        
        if (compareFilterTT.length > 0) {
            formData.append('trangThaiTT', compareFilterTT.join(','));
        }
        
        if (compareDateRangeStr) {
            const [start, end] = compareDateRangeStr;
            const formatForApi = (dateStr: string) => {
                const [d, m, y] = dateStr.split('/');
                return `${y}${m}${d}`;
            };
            formData.append('ngayRaTu', formatForApi(start));
            formData.append('ngayRaDen', formatForApi(end));
        }

        // Gửi thông tin map cột
        formData.append('columnMapping', JSON.stringify(columnMapping));

        try {
            const response = await fetch(`${getBasePath()}/api/ho-so-da-gui/compare-c79`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setCompareResult(data.data);
            } else {
                setCompareError(data.error || 'Có lỗi xảy ra khi đối chiếu');
            }
        } catch (err: any) {
            setCompareError('Lỗi kết nối tới máy chủ');
        } finally {
            setIsComparing(false);
        }
    };

    // Hàm bọc render để highlight các cột bị thay đổi
    const highlightIfChanged = (dataIndex: string, renderFunc?: any) => {
        return (text: any, record: any, index: number) => {
            const isChanged = record.changedFields?.includes(dataIndex);
            const content = renderFunc ? renderFunc(text, record, index) : text;
            
            if (isChanged) {
                return <span className="inline-block bg-orange-100 text-orange-800 border border-orange-300 rounded px-1.5 py-0.5 text-sm font-semibold">{content || '-'}</span>;
            }
            return content;
        };
    };

    // --- TABLE COLUMNS ---
    const columns: ColumnsType<any> = [
        { title: 'STT', dataIndex: 'stt', key: 'stt', width: 60, align: 'center', fixed: 'left' },
        { 
            title: 'Mã Liên Kết', 
            dataIndex: 'maLienKet', 
            key: 'maLienKet', 
            width: 140, 
            fixed: 'left',
            render: (text, record) => (
                <div className="flex flex-col">
                    <span className="font-medium text-blue-600">{text}</span>
                    {record.versionType && (
                        <Tag 
                            color={record.versionType === 'Bản gốc' ? 'default' : (record.versionType === 'Bản mới nhất' ? 'green' : 'orange')} 
                            className={`mt-1 w-max ${record.versionType === 'Bản gốc' ? 'border-slate-300 text-slate-500' : (record.versionType === 'Bản mới nhất' ? 'border-green-200' : 'border-orange-200')}`} 
                            style={{ fontSize: '10px', padding: '0 4px', lineHeight: '16px' }}
                        >
                            {record.versionType}
                        </Tag>
                    )}
                </div>
            )
        },
        { title: 'Họ Tên', dataIndex: 'hoTen', key: 'hoTen', width: 160, render: highlightIfChanged('hoTen', (text: any) => <b>{text}</b>), fixed: 'left' },
        { title: 'Mã BN', dataIndex: 'maBN', key: 'maBN', width: 120, render: highlightIfChanged('maBN') },
        { title: 'Mã Thẻ', dataIndex: 'maThe', key: 'maThe', width: 160, render: highlightIfChanged('maThe') },
        { title: 'Ngày Sinh', dataIndex: 'ngaySinh', key: 'ngaySinh', width: 120, render: highlightIfChanged('ngaySinh') },
        { title: 'Giới Tính', dataIndex: 'gioiTinh', key: 'gioiTinh', width: 100, render: highlightIfChanged('gioiTinh') },
        { title: 'Ngày Vào', dataIndex: 'ngayVao', key: 'ngayVao', width: 140, render: highlightIfChanged('ngayVao') },
        { title: 'Ngày Ra', dataIndex: 'ngayRa', key: 'ngayRa', width: 140, render: highlightIfChanged('ngayRa') },
        { title: 'Chẩn Đoán', dataIndex: 'chanDoan', key: 'chanDoan', width: 200, ellipsis: true, render: highlightIfChanged('chanDoan') },
        { title: 'Tổng Chi', dataIndex: 'tongChi', key: 'tongChi', width: 120, align: 'right', render: highlightIfChanged('tongChi', (val: any) => val?.toLocaleString('vi-VN')) },
        { title: 'Bệnh Nhân TT', dataIndex: 'benhNhanTT', key: 'benhNhanTT', width: 130, align: 'right', render: highlightIfChanged('benhNhanTT', (val: any) => val?.toLocaleString('vi-VN')) },
        { title: 'Bệnh Nhân CCT', dataIndex: 'benhNhanCCT', key: 'benhNhanCCT', width: 140, align: 'right', render: highlightIfChanged('benhNhanCCT', (val: any) => val?.toLocaleString('vi-VN')) },
        { title: 'Bảo Hiểm TT', dataIndex: 'baoHiemTT', key: 'baoHiemTT', width: 130, align: 'right', render: highlightIfChanged('baoHiemTT', (val: any) => val?.toLocaleString('vi-VN')) },
        { title: 'Ngày TT', dataIndex: 'ngayTT', key: 'ngayTT', width: 120, render: highlightIfChanged('ngayTT') },
        { title: 'Ngày ĐN TT', dataIndex: 'ngayDeNghiTT', key: 'ngayDeNghiTT', width: 140, render: highlightIfChanged('ngayDeNghiTT') },
        { title: 'Ngày Gửi', dataIndex: 'ngayGuiHS', key: 'ngayGuiHS', width: 140, render: highlightIfChanged('ngayGuiHS') },
        { title: 'Loại HS', dataIndex: 'loaiHS', key: 'loaiHS', width: 100, render: highlightIfChanged('loaiHS') },
        { title: 'Trạng Thái TT', dataIndex: 'trangThaiTT', key: 'trangThaiTT', width: 150, render: highlightIfChanged('trangThaiTT') },
        { title: 'Mã Lỗi', dataIndex: 'maLoi', key: 'maLoi', width: 100, render: highlightIfChanged('maLoi', (val: any) => val ? <Tag color="red">{val}</Tag> : '') },
        { title: 'Miêu Tả', dataIndex: 'mieuTa', key: 'mieuTa', width: 250, ellipsis: true, render: highlightIfChanged('mieuTa') },
        { 
            title: 'Trạng Thái HS', 
            dataIndex: 'trangThaiHS', 
            key: 'trangThaiHS',
            width: 150,
            fixed: 'right',
            render: highlightIfChanged('trangThaiHS', (status: any) => {
                let color = 'default';
                if (status?.includes('Thành công') || status?.includes('Đã gửi')) color = 'success';
                else if (status?.includes('Lỗi') || status?.includes('Từ chối') || status?.includes('thay thế')) color = 'error';
                else if (status?.includes('Đang xử lý')) color = 'processing';
                return <Tag color={color} style={{ margin: 0 }}>{status || 'N/A'}</Tag>;
            })
        },
        {
            title: 'Thao Tác',
            key: 'action',
            fixed: 'right',
            width: 120,
            render: (_, record) => (
                <Button type="link" size="small" onClick={() => handleViewHistory(record.maLienKet)} icon={<History size={16} />}>
                    Lịch sử
                </Button>
            )
        }
    ];

    // --- TAB CONTENTS ---
    const listContent = (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <Space>
                    <Title level={4} style={{ margin: 0 }}>Danh Sách Hồ Sơ Đã Gửi</Title>
                    <Button icon={<Download size={16} />} onClick={handleExportDiff} className="ml-4">Xuất File Đối Chiếu</Button>
                    {selectedRowKeys.length > 0 && (
                        <Button danger onClick={handleDeleteSelected}>Xóa {selectedRowKeys.length} đã chọn</Button>
                    )}
                    <Button danger type="dashed" onClick={handleDeleteAll}>Xóa toàn bộ (theo bộ lọc)</Button>
                </Space>
                <Space className="flex-wrap" style={{ marginTop: '8px' }}>
                    <div className="flex items-center gap-2 mr-2 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
                        <Filter size={16} className="text-orange-600" />
                        <span className="text-sm font-medium text-orange-700">Chỉ hiện hồ sơ sửa đổi</span>
                        <Switch size="small" checked={onlyModified} onChange={handleOnlyModifiedChange} className="ml-1" />
                    </div>
                    <DatePicker.RangePicker 
                        format="DD/MM/YYYY"
                        placeholder={['Ngày ra từ', 'Ngày ra đến']}
                        style={{ width: 240 }}
                        onChange={handleListDateRangeChange}
                    />
                    <Select
                        placeholder="Trạng thái Hồ sơ"
                        allowClear
                        onChange={handleFilterHSChange}
                        style={{ width: 160 }}
                        options={filterOptionsHS.length > 0 ? filterOptionsHS : [
                            { value: 'Thành công', label: 'Thành công' },
                            { value: 'Lỗi', label: 'Lỗi' },
                            { value: 'Từ chối', label: 'Từ chối' },
                            { value: 'thay thế', label: 'Hồ sơ thay thế' },
                        ]}
                    />
                    <Select
                        placeholder="Trạng thái Thanh toán"
                        allowClear
                        onChange={handleFilterTTChange}
                        style={{ width: 220 }}
                        options={filterOptionsTT.length > 0 ? filterOptionsTT : [
                            { value: 'Chưa đề nghị thanh toán', label: 'Chưa đề nghị thanh toán' },
                            { value: 'Đã thanh toán', label: 'Đã thanh toán' },
                        ]}
                    />
                    <Input.Search 
                        placeholder="Tìm kiếm toàn bộ dữ liệu..." 
                        allowClear 
                        onChange={handleSearchChange}
                        onSearch={handleSearch} 
                        value={searchText}
                        style={{ width: 260 }} 
                    />
                </Space>
            </div>
            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys),
                }}
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={pagination}
                onChange={handleTableChange}
                scroll={{ x: 'max-content' }}
                size="small"
                bordered
            />
        </div>
    );

    const importContent = (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <div 
                    {...getRootProps()} 
                    className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'
                    } ${file ? 'bg-slate-50' : ''}`}
                >
                    <input {...getInputProps()} />
                    
                    {file ? (
                        <div className="flex flex-col items-center">
                            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                                <FileType size={32} />
                            </div>
                            <p className="font-semibold text-slate-700 text-lg">{file.name}</p>
                            <p className="text-sm text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            <p className="text-sm text-blue-600 mt-4 cursor-pointer hover:underline">Nhấn hoặc kéo file khác vào đây để thay đổi</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-slate-500">
                            <UploadCloud size={48} className="mb-4 text-slate-400" />
                            <p className="text-lg font-medium text-slate-700">Kéo thả file Excel vào đây</p>
                            <p className="text-sm mt-1">hoặc nhấn để chọn file (.xlsx, .xls)</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                            !file || isUploading 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        }`}
                    >
                        {isUploading ? (
                            <>
                                <RefreshCw className="animate-spin" size={18} />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <UploadCloud size={18} />
                                Bắt đầu Import
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                        <h3 className="font-medium text-red-800">Lỗi Import</h3>
                        <p className="text-red-600 text-sm mt-1">{error}</p>
                    </div>
                </div>
            )}

            {result && (
                <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <CheckCircle className="text-green-500" size={24} />
                        <h3 className="text-lg font-bold text-slate-800">Import Thành Công</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                            <p className="text-sm text-slate-500 font-medium">Tổng số dòng hợp lệ</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">{result.total}</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <p className="text-sm text-blue-600 font-medium">Hồ sơ thêm mới tinh</p>
                            <p className="text-3xl font-bold text-blue-700 mt-1">+{result.newCount}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                            <p className="text-sm text-amber-600 font-medium">Lưu thêm lịch sử (Thay đổi)</p>
                            <p className="text-3xl font-bold text-amber-700 mt-1">+{result.historyCount}</p>
                        </div>
                        <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
                            <p className="text-sm text-slate-500 font-medium">Bỏ qua (Giống hệt)</p>
                            <p className="text-3xl font-bold text-slate-600 mt-1">{result.skipCount}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderCompareDiff = () => {
        if (historyData.length < 2) {
            return (
                <div className="py-10 flex flex-col items-center justify-center">
                    <CheckCircle className="text-green-500 mb-2" size={32} />
                    <p className="text-slate-500 font-medium">Hồ sơ này chưa có lịch sử chỉnh sửa hoặc chưa từng thay đổi.</p>
                </div>
            );
        }

        const latest = historyData[historyData.length - 1];
        const prev = historyData[historyData.length - 2];
        
        const fields = [
            { key: 'hoTen', label: 'Họ Tên' },
            { key: 'maThe', label: 'Mã Thẻ' },
            { key: 'ngayVao', label: 'Ngày Vào' },
            { key: 'ngayRa', label: 'Ngày Ra' },
            { key: 'chanDoan', label: 'Chẩn Đoán' },
            { key: 'tongChi', label: 'Tổng Chi' },
            { key: 'trangThaiHS', label: 'Trạng Thái HS' },
            { key: 'trangThaiTT', label: 'Trạng Thái TT' },
            { key: 'maLoi', label: 'Mã Lỗi' },
            { key: 'mieuTa', label: 'Miêu Tả' }
        ];
        
        return (
            <div>
                <div className="mb-4 text-sm text-slate-500 flex justify-between">
                    <span>Đang so sánh bản ghi mới nhất với bản ghi liền trước đó.</span>
                    <span>Lần import cuối: <b>{new Date(latest.createdAt).toLocaleString('vi-VN')}</b></span>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr>
                                <th className="px-4 py-3 w-1/4">Trường Dữ Liệu</th>
                                <th className="px-4 py-3 w-3/8">Bản Liền Trước</th>
                                <th className="px-4 py-3 w-3/8">Bản Mới Nhất</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {fields.map(f => {
                                const isChanged = String(prev[f.key]) !== String(latest[f.key]);
                                return (
                                    <tr key={f.key} className={isChanged ? 'bg-orange-50' : ''}>
                                        <td className="px-4 py-3 font-medium text-slate-700">{f.label}</td>
                                        <td className="px-4 py-3 text-slate-600">{prev[f.key] || '-'}</td>
                                        <td className={`px-4 py-3 ${isChanged ? 'font-bold text-blue-700' : 'text-slate-600'}`}>{latest[f.key] || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const compareContent = (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-end mb-3">
                <button 
                    onClick={() => setShowInstructions(!showInstructions)}
                    className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                >
                    <HelpCircle size={16} />
                    {showInstructions ? 'Ẩn hướng dẫn' : 'Xem hướng dẫn đối chiếu'}
                </button>
            </div>

            {/* Hướng dẫn sử dụng */}
            {showInstructions && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 text-blue-900 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-blue-600">
                            <AlertCircle size={22} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg mb-2">Hướng dẫn đối chiếu C79/C80</h3>
                            <p className="mb-2">Chức năng này giúp bạn kiểm tra chéo chi phí giữa <b>File Excel kết xuất từ cổng BHXH (Mẫu C79/C80)</b> và <b>Dữ liệu hồ sơ bệnh án đang có trên phần mềm</b>.</p>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                <li><b>Bước 1:</b> Kết xuất file Excel mẫu C79 hoặc C80 từ cổng giám định BHYT.</li>
                                <li><b>Bước 2:</b> Kéo thả hoặc bấm vào khung bên dưới để tải file Excel lên.</li>
                                <li><b>Bước 3:</b> Bấm <b>"Bắt đầu đối chiếu"</b>. Hệ thống sẽ tự động tìm kiếm các hồ sơ trong phần mềm đang ở trạng thái <b>"Đã đề nghị thanh toán"</b> để so sánh.</li>
                            </ul>
                            <div className="mt-3 text-sm bg-white bg-opacity-60 p-3 rounded-lg border border-blue-100">
                                <span className="font-medium">Tiêu chí ghép nối (Matching):</span> Hệ thống sẽ ưu tiên tìm các hồ sơ khớp chính xác <b>Mã Thẻ + Ngày Vào + Ngày Ra</b>. 
                                Nếu ngày giờ có sự sai lệch nhỏ về phút, hệ thống sẽ tự động tìm hồ sơ có <b>tổng chi phí khớp nhất</b> để đối chiếu.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-6">
                <div 
                    {...getCompareRootProps()} 
                    className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isCompareDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'
                    } ${compareFiles.length > 0 ? 'bg-slate-50' : ''}`}
                >
                    <input {...getCompareInputProps()} />
                    
                    {compareFiles.length > 0 ? (
                        <div className="flex flex-col items-center">
                            <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
                                <FileType size={32} />
                            </div>
                            <p className="font-semibold text-slate-700 text-lg">Đã chọn {compareFiles.length} file</p>
                            <ul className="text-sm text-slate-500 mt-2 text-center max-w-md max-h-24 overflow-y-auto">
                                {compareFiles.map((f, idx) => (
                                    <li key={idx} className="truncate" title={f.name}>{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</li>
                                ))}
                            </ul>
                            <div className="flex gap-4 mt-4">
                                <span className="text-sm text-indigo-600 cursor-pointer hover:underline">Thêm file khác</span>
                                <span 
                                    className="text-sm text-red-500 cursor-pointer hover:underline"
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setCompareFiles([]); 
                                        setCompareResult(null); 
                                        setExcelHeaders([]);
                                    }}
                                >
                                    Xóa tất cả
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-slate-500">
                            <GitCompare size={48} className="mb-4 text-slate-400" />
                            <p className="text-lg font-medium text-slate-700">Tải lên file mẫu C79/C80 (.xlsx)</p>
                            <p className="text-sm mt-1">Hệ thống sẽ đối chiếu chi phí với hồ sơ đang ở trạng thái Đã đề nghị thanh toán</p>
                            <p className="text-xs mt-2 text-indigo-500 italic">Hỗ trợ tải lên nhiều file cùng lúc</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={() => setCompareFilterModalVisible(true)}
                        disabled={compareFiles.length === 0 || isComparing}
                        className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                            compareFiles.length === 0 || isComparing 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                        }`}
                    >
                        {isComparing ? (
                            <>
                                <RefreshCw className="animate-spin" size={18} />
                                Đang đối chiếu...
                            </>
                        ) : (
                            <>
                                <GitCompare size={18} />
                                Bắt đầu đối chiếu
                            </>
                        )}
                    </button>
                </div>
            </div>

            <Modal
                title="Tùy chọn lọc dữ liệu đối chiếu"
                open={compareFilterModalVisible}
                onOk={handleCompare}
                onCancel={() => setCompareFilterModalVisible(false)}
                okText="Bắt đầu đối chiếu"
                cancelText="Hủy bỏ"
                okButtonProps={{ className: 'bg-indigo-600' }}
            >
                <div className="py-4 flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tình trạng hồ sơ (Trạng thái HS)</label>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="Chọn các trạng thái muốn đối chiếu (để trống là lấy tất cả)"
                            options={filterOptionsHS}
                            value={compareFilterHS}
                            onChange={(vals) => setCompareFilterHS(vals)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Trạng thái thanh toán (Trạng thái TT)</label>
                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="Chọn các trạng thái muốn đối chiếu (để trống là mặc định: Đã đề nghị thanh toán)"
                            options={filterOptionsTT}
                            value={compareFilterTT}
                            onChange={(vals) => setCompareFilterTT(vals)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ngày ra viện</label>
                        <DatePicker.RangePicker 
                            format="DD/MM/YYYY"
                            style={{ width: '100%' }}
                            onChange={(dates, dateStrings) => {
                                setCompareDateRangeStr(dates ? [dateStrings[0], dateStrings[1]] : null);
                            }}
                        />
                    </div>
                    <div className="text-sm text-slate-500 bg-slate-50 p-3 rounded mt-2">
                        Hệ thống sẽ lọc những hồ sơ thỏa mãn các điều kiện trên <b>chỉ ở trên phần mềm</b> trước khi thực hiện đối chiếu chéo. (Toàn bộ dữ liệu trong file Excel tải lên sẽ được giữ nguyên để đem đi đối chiếu).
                    </div>
                    
                    {excelHeaders.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                            <h4 className="font-semibold text-slate-700 mb-3">Cấu hình Map Cột Excel</h4>
                            <p className="text-sm text-slate-500 mb-4">Hệ thống đã tự động gán các cột tương ứng từ file Excel. Bạn có thể kiểm tra và tùy chỉnh lại nếu cần thiết.</p>
                            
                            <div className="max-h-[300px] overflow-y-auto pr-2 border rounded-lg p-3 bg-slate-50">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    {Object.entries({
                                        maThe: 'Mã Thẻ BHYT (*)', hoTen: 'Họ Tên (*)', ngaySinh: 'Ngày Sinh', gioiTinh: 'Giới Tính', chanDoan: 'Chẩn Đoán',
                                        ngayVao: 'Ngày Vào (*)', ngayRa: 'Ngày Ra (*)', tongChi: 'Tổng Chi', tongChiBH: 'Tổng Chi BH', 
                                        baoHiemTT: 'Bảo Hiểm TT', benhNhanCCT: 'Bệnh Nhân CCT', benhNhanTT: 'Bệnh Nhân TT', nguonKhac: 'Nguồn Khác'
                                    }).map(([key, label]) => (
                                        <div key={key} className="flex flex-col">
                                            <label className="text-xs font-medium text-slate-600 mb-1">{label}</label>
                                            <Select
                                                allowClear
                                                showSearch
                                                size="small"
                                                placeholder="Bỏ qua"
                                                value={columnMapping[key]}
                                                onChange={(val) => setColumnMapping(prev => ({ ...prev, [key]: val || '' }))}
                                                options={excelHeaders.map(h => ({ value: h, label: h }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {compareError && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                        <h3 className="font-medium text-red-800">Lỗi Đối Chiếu</h3>
                        <p className="text-red-600 text-sm mt-1">{compareError}</p>
                    </div>
                </div>
            )}

            {compareResult && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Tổng quan đối chiếu</h3>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 border-l-4 border-l-slate-500">
                                <p className="text-sm text-slate-700 font-medium">Tổng hồ sơ so sánh</p>
                                <p className="text-3xl font-bold text-slate-700 mt-1">{compareResult.summary.totalExcel}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 border border-green-200 border-l-4 border-l-green-500">
                                <p className="text-sm text-green-700 font-medium">Khớp hoàn toàn</p>
                                <p className="text-3xl font-bold text-green-600 mt-1">{compareResult.summary.exactMatches}</p>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 border-l-4 border-l-orange-500">
                                <p className="text-sm text-orange-600 font-medium">Lệch thông tin / chi phí</p>
                                <p className="text-3xl font-bold text-orange-700 mt-1">{compareResult.summary.diffMatches}</p>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 border-l-4 border-l-blue-500">
                                <p className="text-sm text-blue-600 font-medium">Có trong Excel, vắng PM</p>
                                <p className="text-3xl font-bold text-blue-700 mt-1">{compareResult.summary.notInDb}</p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4 border border-red-200 border-l-4 border-l-red-500">
                                <p className="text-sm text-red-600 font-medium">Có trong PM, vắng Excel</p>
                                <p className="text-3xl font-bold text-red-700 mt-1">{compareResult.summary.notInExcel}</p>
                            </div>
                        </div>
                    </div>

                    {compareResult.details.diffMatches.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Hồ sơ lệch thông tin / chi phí</h3>
                            <Table 
                                dataSource={compareResult.details.diffMatches}
                                rowKey={(r: any) => r.excel.maThe + r.excel.ngayVao}
                                size="small"
                                bordered
                                pagination={{ pageSize: 10 }}
                                scroll={{ x: 1500 }}
                                columns={[
                                    { 
                                        title: 'Họ Tên', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'hoTen'], width: 150 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'hoTen'], width: 150, render: (val, record: any) => {
                                                return <span className={record.diff?.hoTenDiff ? 'text-red-500 font-bold' : ''}>{val}</span>;
                                            } },
                                        ]
                                    },
                                    { 
                                        title: 'Ngày Sinh', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'ngaySinh'], width: 100 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'ngaySinh'], width: 100, render: (val, record: any) => {
                                                return <span className={record.diff?.ngaySinhDiff ? 'text-red-500 font-bold' : ''}>{val}</span>;
                                            } },
                                        ]
                                    },
                                    { 
                                        title: 'Giới Tính', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'gioiTinh'], width: 80 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'gioiTinh'], width: 80, render: (val, record: any) => {
                                                return <span className={record.diff?.gioiTinhDiff ? 'text-red-500 font-bold' : ''}>{val}</span>;
                                            } },
                                        ]
                                    },
                                    { 
                                        title: 'Mã Bệnh', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'chanDoan'], width: 100 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'chanDoan'], width: 100, render: (val, record: any) => {
                                                return <span className={record.diff?.chanDoanDiff ? 'text-red-500 font-bold' : ''}>{val}</span>;
                                            } },
                                        ]
                                    },
                                    { 
                                        title: 'Ngày Vào', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'ngayVao'], width: 130 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'ngayVao'], width: 130, render: (val, record: any) => {
                                                return <span className={record.diff?.ngayVaoDiff ? 'text-red-500 font-bold' : ''}>{val}</span>;
                                            } },
                                        ]
                                    },
                                    { 
                                        title: 'Ngày Ra', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'ngayRa'], width: 130 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'ngayRa'], width: 130, render: (val, record: any) => {
                                                return <span className={record.diff?.ngayRaDiff ? 'text-red-500 font-bold' : ''}>{val}</span>;
                                            } },
                                        ]
                                    },
                                    { 
                                        title: 'Tổng Chi', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'tongChi'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'tongChi'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Chênh lệch', dataIndex: ['diff', 'tongChi'], align: 'right', render: v => v !== 0 ? <span className="text-red-600 font-bold">{v?.toLocaleString('vi-VN')}</span> : '-', width: 90 }
                                        ]
                                    },
                                    { 
                                        title: 'Tổng Chi BH', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'tongChiBH'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'tongChiBH'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Chênh lệch', dataIndex: ['diff', 'tongChiBH'], align: 'right', render: v => v !== 0 ? <span className="text-red-600 font-bold">{v?.toLocaleString('vi-VN')}</span> : '-', width: 90 }
                                        ]
                                    },
                                    { 
                                        title: 'Bảo Hiểm TT', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'baoHiemTT'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'baoHiemTT'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Chênh lệch', dataIndex: ['diff', 'baoHiemTT'], align: 'right', render: v => v !== 0 ? <span className="text-red-600 font-bold">{v?.toLocaleString('vi-VN')}</span> : '-', width: 90 }
                                        ]
                                    },
                                    { 
                                        title: 'Bệnh Nhân CCT', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'benhNhanCCT'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'benhNhanCCT'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Chênh lệch', dataIndex: ['diff', 'benhNhanCCT'], align: 'right', render: v => v !== 0 ? <span className="text-red-600 font-bold">{v?.toLocaleString('vi-VN')}</span> : '-', width: 90 }
                                        ]
                                    },
                                    { 
                                        title: 'Bệnh Nhân TT', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'benhNhanTT'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'benhNhanTT'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Chênh lệch', dataIndex: ['diff', 'benhNhanTT'], align: 'right', render: v => v !== 0 ? <span className="text-red-600 font-bold">{v?.toLocaleString('vi-VN')}</span> : '-', width: 90 }
                                        ]
                                    },
                                    { 
                                        title: 'Nguồn khác', 
                                        children: [
                                            { title: 'Excel', dataIndex: ['excel', 'nguonKhac'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Phần mềm', dataIndex: ['db', 'nguonKhac'], align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                            { title: 'Chênh lệch', dataIndex: ['diff', 'nguonKhac'], align: 'right', render: v => v !== 0 ? <span className="text-red-600 font-bold">{v?.toLocaleString('vi-VN')}</span> : '-', width: 90 }
                                        ]
                                    },
                                ]}
                            />
                        </div>
                    )}
                    
                    {compareResult.details.notInDb.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Dữ liệu có trong Excel nhưng không có trong phần mềm (hoặc khác trạng thái)</h3>
                            <Table 
                                dataSource={compareResult.details.notInDb}
                                rowKey={(r: any) => r.maThe + r.ngayVao}
                                size="small"
                                bordered
                                pagination={{ pageSize: 10 }}
                                scroll={{ x: 600 }}
                                columns={[
                                    { title: 'STT', dataIndex: 'stt', width: 60 },
                                    { title: 'Mã Thẻ', dataIndex: 'maThe', width: 150 },
                                    { title: 'Họ Tên', dataIndex: 'hoTen', width: 150 },
                                    { title: 'Ngày Vào', dataIndex: 'ngayVao', width: 100 },
                                    { title: 'Ngày Ra', dataIndex: 'ngayRa', width: 100 },
                                    { title: 'Tổng Chi', dataIndex: 'tongChi', align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 100 },
                                ]}
                            />
                        </div>
                    )}

                    {compareResult.details.notInExcel.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mt-6">
                            <h3 className="text-lg font-bold text-red-800 mb-4">Dữ liệu có trong Phần mềm nhưng không có trong Excel</h3>
                            <Table 
                                dataSource={compareResult.details.notInExcel}
                                rowKey="id"
                                size="small"
                                bordered
                                pagination={{ pageSize: 10 }}
                                scroll={{ x: 800 }}
                                columns={[
                                    { title: 'Mã Liên Kết', dataIndex: 'maLienKet', width: 150 },
                                    { title: 'Họ Tên', dataIndex: 'hoTen', width: 150 },
                                    { title: 'Mã Thẻ', dataIndex: 'maThe', width: 150 },
                                    { title: 'Ngày Vào', dataIndex: 'ngayVao', width: 120 },
                                    { title: 'Ngày Ra', dataIndex: 'ngayRa', width: 120 },
                                    { title: 'Tổng Chi', dataIndex: 'tongChi', align: 'right', render: v => v?.toLocaleString('vi-VN'), width: 120 },
                                    { title: 'Trạng Thái HS', dataIndex: 'trangThaiHS', width: 150 },
                                ]}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    const items = [
        {
            key: '1',
            label: 'Danh Sách Hồ Sơ',
            children: listContent,
        },
        {
            key: '2',
            label: 'Import Dữ Liệu',
            children: importContent,
        },
        {
            key: '3',
            label: 'Đối Chiếu C79',
            children: compareContent,
        },
    ];

    return (
        <div className="p-6 max-w-[98%] mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Quản Lý Hồ Sơ Đã Gửi</h1>
                <p className="text-slate-500 mt-1">
                    Xem danh sách và tải lên dữ liệu kết xuất từ cổng giám định BHXH.
                </p>
            </div>
            
            <Tabs defaultActiveKey="1" items={items} />

            <Modal
                title={`Lịch sử đối chiếu: ${selectedMaLienKet || ''}`}
                open={historyModalVisible}
                onCancel={() => setHistoryModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setHistoryModalVisible(false)}>Đóng</Button>
                ]}
                width={800}
            >
                {loadingHistory ? (
                    <div className="py-10 text-center"><RefreshCw className="animate-spin inline mr-2" size={18} /> Đang tải...</div>
                ) : renderCompareDiff()}
            </Modal>
        </div>
    );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Table, Button, Tabs, Upload, message, Card, Input, Space, Popconfirm, Tag, Spin, Progress, Modal, DatePicker, Select, Tooltip, InputNumber, Alert } from 'antd';
import { InboxOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, FileTextOutlined, MedicineBoxOutlined, ExperimentOutlined, ProfileOutlined, ToolOutlined, DashboardOutlined, DatabaseOutlined, PlayCircleOutlined, FileExcelOutlined, WarningOutlined, SettingOutlined } from '@ant-design/icons';
import { addWorkingDays, calculateRemainingTime } from '@/utils/dateUtils';
import type { UploadProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '@/contexts/AuthContext';

const { Dragger } = Upload;

const formatXMLDate = (dateString: any) => {
    if (!dateString || typeof dateString !== 'string') return dateString;
    if (/^\d{12}$/.test(dateString)) {
        return `${dateString.substring(6, 8)}/${dateString.substring(4, 6)}/${dateString.substring(0, 4)} ${dateString.substring(8, 10)}:${dateString.substring(10, 12)}`;
    }
    if (/^\d{8}$/.test(dateString)) {
        return `${dateString.substring(6, 8)}/${dateString.substring(4, 6)}/${dateString.substring(0, 4)}`;
    }
    return dateString;
};

export default function XmlViewerPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);

    const handleCopy = (text: any) => {
        if (!text) return;
        navigator.clipboard.writeText(String(text));
        message.success(`Đã copy: ${text}`);
    };
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);
    const [searchText, setSearchText] = useState('');
    const [fromDate, setFromDate] = useState<string>('');
    const [toDate, setToDate] = useState<string>('');
    const [errorStatus, setErrorStatus] = useState<string>('ALL');
    const [isValidating, setIsValidating] = useState(false);
    
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [recordDetails, setRecordDetails] = useState<any>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);

    const [editDeadlineDays, setEditDeadlineDays] = useState<number>(3);
    const [isConfigModalVisible, setIsConfigModalVisible] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch('/api/configs');
                if (res.ok) {
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
    }, []);

    const { user } = useAuth();

    const fetchData = async (p = page, s = searchText, fDate = fromDate, tDate = toDate, errStt = errorStatus) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/xml1?page=${p}&limit=${limit}&search=${s}&fromDate=${fDate}&toDate=${tDate}&errorStatus=${errStt}`);
            const json = await res.json();
            if (json.data) {
                setData(json.data);
                setTotal(json.total);
            }
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu XML1');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let currentSearch = searchText;
        if (page === 1 && typeof window !== 'undefined' && !searchText) {
            const params = new URLSearchParams(window.location.search);
            const searchParam = params.get('search');
            if (searchParam) {
                setSearchText(searchParam);
                currentSearch = searchParam;
            }
        }
        fetchData(page, currentSearch, fromDate, toDate, errorStatus);
    }, [page]);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchText(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            setPage(1);
            fetchData(1, value);
        }, 500);
    };

    const handleSearch = (value: string) => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        setSearchText(value);
        setPage(1);
        fetchData(1, value, fromDate, toDate, errorStatus);
    };

    const handleDateChange = (dates: any, dateStrings: [string, string]) => {
        const [start, end] = dateStrings;
        // Transform DD/MM/YYYY to YYYYMMDD0000 for fromDate, and YYYYMMDD2359 for toDate
        let fDate = '';
        let tDate = '';
        if (start && end) {
            const [sDay, sMonth, sYear] = start.split('/');
            const [eDay, eMonth, eYear] = end.split('/');
            fDate = `${sYear}${sMonth}${sDay}0000`;
            tDate = `${eYear}${eMonth}${eDay}2359`;
        }
        setFromDate(fDate);
        setToDate(tDate);
        setPage(1);
        fetchData(1, searchText, fDate, tDate, errorStatus);
    };

    const handleErrorStatusChange = (value: string) => {
        setErrorStatus(value);
        setPage(1);
        fetchData(1, searchText, fromDate, toDate, value);
    };

    const handleRunValidation = async () => {
        setIsValidating(true);
        try {
            const payload = selectedRowKeys.length > 0 
                ? { ids: selectedRowKeys } 
                : { filters: { search: searchText, fromDate, toDate, errorStatus } };
                
            const res = await fetch('/api/xml1/validate-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();
            if (json.success) {
                message.success(json.message);
                fetchData(page, searchText, fromDate, toDate, errorStatus);
                // Also refresh details if currently viewing one
                if (selectedRecord) {
                    handleRowClick(selectedRecord);
                }
            } else {
                message.error('Lỗi khi giám định: ' + json.error);
            }
        } catch (error) {
            message.error('Lỗi hệ thống khi giám định');
        } finally {
            setIsValidating(false);
        }
    };

    const handleViewReport = () => {
        let url = 'xml1-report';
        const params = new URLSearchParams();
        
        if (selectedRowKeys.length > 0) {
            params.append('ids', selectedRowKeys.join(','));
        } else {
            if (searchText) params.append('search', searchText);
            if (fromDate) params.append('fromDate', fromDate);
            if (toDate) params.append('toDate', toDate);
            if (errorStatus) params.append('errorStatus', errorStatus);
        }
        
        const fullUrl = `${url}?${params.toString()}`;
        window.open(fullUrl, '_blank');
    };

    const handleRowClick = async (record: any) => {
        setSelectedRecord(record);
        setDetailsLoading(true);
        try {
            const res = await fetch(`/api/xml-details/${record.id}`);
            const json = await res.json();
            if (json.data) {
                setRecordDetails(json.data);
            }
        } catch (error) {
            message.error('Lỗi tải chi tiết hồ sơ');
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (selectedRowKeys.length === 0) return;
        try {
            const res = await fetch('/api/xml1', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedRowKeys })
            });
            const json = await res.json();
            if (json.success) {
                message.success(`Đã xóa ${json.count} hồ sơ thành công!`);
                setSelectedRowKeys([]);
                if (selectedRecord && selectedRowKeys.includes(selectedRecord.id)) {
                    setSelectedRecord(null);
                    setRecordDetails(null);
                }
                fetchData();
            } else {
                message.error('Lỗi khi xóa: ' + json.error);
            }
        } catch (error) {
            message.error('Lỗi hệ thống khi xóa');
        }
    };

    const handleDeleteByFilter = async () => {
        if (!fromDate && !toDate && !searchText && errorStatus === 'ALL') {
             message.error('Vui lòng chọn ít nhất một điều kiện lọc (ngày ra viện, tìm kiếm, v.v.) để xóa hàng loạt.');
             return;
        }
        
        try {
            const res = await fetch('/api/xml1', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filters: { search: searchText, fromDate, toDate, errorStatus } })
            });
            const json = await res.json();
            if (json.success) {
                message.success(`Đã xóa ${json.count} hồ sơ thành công!`);
                setSelectedRowKeys([]);
                setSelectedRecord(null);
                setRecordDetails(null);
                fetchData();
            } else {
                message.error('Lỗi khi xóa: ' + json.error);
            }
        } catch (error) {
            message.error('Lỗi hệ thống khi xóa');
        }
    };

    const uploadProps: UploadProps = {
        name: 'file',
        multiple: false,
        accept: '.zip',
        showUploadList: false,
        customRequest: async (options) => {
            const { file, onSuccess, onError, onProgress } = options;
            setUploading(true);
            setUploadProgress(0);
            
            const formData = new FormData();
            formData.append('file', file as Blob);

            try {
                // Fake progress simulation
                const timer = setInterval(() => {
                    setUploadProgress(p => p >= 90 ? 90 : p + 10);
                }, 500);

                const res = await fetch('/api/xml-import-zip', {
                    method: 'POST',
                    body: formData,
                });
                
                clearInterval(timer);
                setUploadProgress(100);

                if (res.status === 413) {
                    throw new Error('File tải lên quá lớn (vượt giới hạn của hệ thống/Nginx). Vui lòng chia nhỏ file ZIP.');
                }

                let json;
                try {
                    json = await res.json();
                } catch (parseError) {
                    throw new Error(`Lỗi máy chủ (${res.status}): Không thể đọc dữ liệu trả về (có thể cấu hình Nginx chặn file lớn).`);
                }

                if (res.ok && json.success) {
                    message.success(json.message || 'Tải lên và xử lý thành công');
                    if (onSuccess) onSuccess("ok");
                    fetchData(1);
                } else {
                    message.error(json.error || 'Lỗi khi xử lý file');
                    if (onError) onError(new Error(json.error));
                }
            } catch (error: any) {
                message.error(error.message || 'Lỗi mạng khi tải file');
                if (onError) onError(error);
            } finally {
                setTimeout(() => {
                    setUploading(false);
                    setUploadProgress(0);
                }, 1000);
            }
        },
    };

    const columns: ColumnsType<any> = data.length > 0 ? (() => {
        const keys = Object.keys(data[0]).filter(k => k !== 'id' && k !== 'checksum' && k !== 'isLatest');
        const metadataKeys = ['version', 'importBatchId', 'createdAt'];
        const normalKeys = keys.filter(k => !metadataKeys.includes(k));
        // Ensure hasError is explicitly placed at the beginning
        const orderedKeys = keys.filter(k => k !== 'hasError' && k !== 'errorCount');
        
        return ['hasError', '__edit_status', '__remaining_time', ...orderedKeys.filter(k => !metadataKeys.includes(k)), ...metadataKeys].filter(k => keys.includes(k) || ['hasError', '__edit_status', '__remaining_time'].includes(k)).map(k => {
            if (k === 'version') {
                return { title: 'VERSION', dataIndex: 'version', key: 'version', render: (v: any) => <Tag color="blue">v{v}</Tag> };
            }
            if (k === 'createdAt') {
                return { title: 'CREATED_AT', dataIndex: 'createdAt', key: 'createdAt', render: (v: any) => new Date(v).toLocaleString() };
            }
            if (k === 'hasError') {
                return { 
                    title: 'TRẠNG THÁI', 
                    dataIndex: 'hasError', 
                    key: 'hasError', 
                    fixed: 'left',
                    width: 120,
                    render: (v: boolean, record: any) => v 
                        ? <Tag color="error" icon={<WarningOutlined />}>Lỗi ({record.errorCount || 0})</Tag> 
                        : <Tag color="success">Hợp lệ</Tag>
                };
            }
            if (k === '__edit_status') {
                return {
                    title: 'TRẠNG THÁI SỬA BA',
                    key: '__edit_status',
                    width: 150,
                    align: 'center',
                    fixed: 'left',
                    render: (_: any, record: any) => {
                        const ngayRaStr = String(record.NGAY_RA || '');
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
                };
            }
            if (k === '__remaining_time') {
                return {
                    title: (
                        <div className="flex items-center justify-center gap-2">
                            THỜI GIAN CÒN LẠI
                            {user?.role === 'ADMIN' && (
                                <Tooltip title={`Cấu hình hạn sửa (đang là ${editDeadlineDays} ngày)`}>
                                    <SettingOutlined 
                                        className="cursor-pointer text-slate-400 hover:text-blue-600 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); setIsConfigModalVisible(true); }}
                                    />
                                </Tooltip>
                            )}
                        </div>
                    ),
                    key: '__remaining_time',
                    width: 170,
                    align: 'center',
                    fixed: 'left',
                    render: (_: any, record: any) => {
                        const ngayRaStr = String(record.NGAY_RA || '');
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
                };
            }

            return {
                title: k.toUpperCase(),
                dataIndex: k,
                key: k,
                fixed: k === 'MA_LK' ? 'left' : undefined,
                render: (v: any) => (k.includes('NGAY') || k.includes('THOI_GIAN')) ? formatXMLDate(v) : v,
                onCell: (record: any) => ({
                    onClick: () => {
                        const val = record[k];
                        const formatted = (k === 'createdAt') ? new Date(val).toLocaleString() : ((k.includes('NGAY') || k.includes('THOI_GIAN')) ? formatXMLDate(val) : val);
                        if (formatted) handleCopy(formatted);
                    },
                    style: { cursor: 'copy', title: 'Click để copy' }
                })
            };
        }).filter(Boolean) as ColumnsType<any>;
    })() : [];

    const generateDynamicColumns = (dataList: any[], xmlIndex: number): ColumnsType<any> => {
        if (!dataList || dataList.length === 0) return [];
        const sample = dataList[0];
        const keys = Object.keys(sample).filter(k => k !== 'id' && k !== 'xml1Id' && !k.startsWith('__'));
        
        const cols: ColumnsType<any> = [
            {
                title: 'Trạng thái',
                key: '__status',
                dataIndex: '__hasError',
                fixed: 'left',
                width: 150,
                render: (hasError: boolean, record: any) => hasError 
                    ? <Tooltip title={record.__errorMsg}><Tag color="error" className="cursor-help"><WarningOutlined /> Có lỗi</Tag></Tooltip> 
                    : <Tag color="success">Hợp lệ</Tag>,
                filters: [
                    { text: 'Có lỗi', value: true },
                    { text: 'Hợp lệ', value: false }
                ],
                onFilter: (value: any, record: any) => record.__hasError === value,
                // Default filter to true (Có lỗi) only if there's at least one error in this XML tab
                defaultFilteredValue: dataList.some(d => d.__hasError) ? [true] : null
            },
            ...keys.map(k => ({
            title: k,
            dataIndex: k,
            key: k,
            render: (v: any, record: any, index: number) => {
                const formatted = (k.includes('NGAY') || k.includes('THOI_GIAN')) ? formatXMLDate(v) : v;
                const originalIdx = record.__originalIndex !== undefined ? record.__originalIndex : index;
                
                const hasError = recordDetails?.validationErrors?.some((err: any) => 
                    err.xmlType === `XML${xmlIndex}` && 
                    err.field === k && 
                    (err.index === undefined || err.index === originalIdx)
                );
                
                if (hasError) {
                    return <div className="bg-red-100 text-red-700 p-1 -m-1 font-bold rounded border border-red-300" title="Có lỗi cảnh báo">{formatted}</div>;
                }
                return formatted;
            },
            onCell: (record: any) => ({
                onClick: () => {
                    const val = record[k];
                    const formatted = (k.includes('NGAY') || k.includes('THOI_GIAN')) ? formatXMLDate(val) : val;
                    if (formatted) handleCopy(formatted);
                },
                style: { cursor: 'copy', title: 'Click để copy' }
            })
        }))
        ];
        return cols;
    };

    const getTabIcon = (index: number) => {
        if (index === 2) return <MedicineBoxOutlined className="text-green-500" />;
        if (index === 3) return <ExperimentOutlined className="text-purple-500" />;
        if (index === 4) return <ToolOutlined className="text-orange-500" />;
        if (index === 5) return <ProfileOutlined className="text-teal-500" />;
        return <FileTextOutlined className="text-slate-500" />;
    };

    const xml1ErrorCount = recordDetails?.validationErrors?.filter((err: any) => err.xmlType === 'XML1').length || 0;

    const tabItems = [
        {
            key: 'XML1',
            label: (
                <span className="font-bold text-blue-600">
                    <DatabaseOutlined className="mr-2" />XML1 (Tổng hợp)
                    {xml1ErrorCount > 0 && <span className="ml-2 text-red-500 font-bold bg-red-100 px-2 py-0.5 rounded-full text-xs animate-pulse">Lỗi ({xml1ErrorCount})</span>}
                </span>
            ),
            children: (
                <>
                    <div className="flex justify-between mb-4 mt-[5px]">
                        <Space className="flex-wrap gap-y-2">
                            <Input.Search 
                                placeholder="Tìm MA_LK hoặc Tên bệnh nhân..." 
                                onSearch={handleSearch}
                                onChange={handleSearchChange}
                                value={searchText}
                                style={{ width: 250 }}
                                allowClear
                            />
                            <DatePicker.RangePicker 
                                format="DD/MM/YYYY" 
                                onChange={handleDateChange} 
                                placeholder={['Ngày ra viện từ', 'Đến ngày']}
                                style={{ width: 250 }}
                            />
                            <Select
                                value={errorStatus}
                                onChange={handleErrorStatusChange}
                                style={{ width: 180 }}
                                options={[
                                    { value: 'ALL', label: 'Tất cả' },
                                    { value: 'ERROR', label: 'Có lỗi (Cảnh báo)' },
                                    { value: 'VALID', label: 'Hợp lệ' }
                                ]}
                            />
                            <Button icon={<FileTextOutlined />} onClick={handleViewReport}>
                                Xem báo cáo
                            </Button>
                            <Button icon={<PlayCircleOutlined />} onClick={handleRunValidation} loading={isValidating}>
                                {selectedRowKeys.length > 0 ? 'Chạy kiểm tra đã chọn' : 'Chạy lại kiểm tra'}
                            </Button>
                            <Button icon={<ReloadOutlined />} onClick={() => fetchData(page, searchText, fromDate, toDate, errorStatus)}>Làm mới</Button>
                        </Space>
                        
                        {user?.role === 'ADMIN' && (
                            <Space>
                                <Popconfirm 
                                    title="Xóa theo bộ lọc" 
                                    description="Bạn có chắc chắn muốn xóa TẤT CẢ hồ sơ theo bộ lọc hiện tại? Tất cả XML liên quan cũng sẽ bị xóa vĩnh viễn (Cascade)."
                                    onConfirm={handleDeleteByFilter}
                                >
                                    <Button type="primary" danger ghost icon={<DeleteOutlined />}>
                                        Xóa theo bộ lọc
                                    </Button>
                                </Popconfirm>
                                <Popconfirm 
                                    title="Xóa hồ sơ" 
                                    description="Bạn có chắc chắn muốn xóa? Tất cả XML2..15 của MA_LK này cũng sẽ bị xóa vĩnh viễn (Cascade)."
                                    onConfirm={handleDelete}
                                >
                                    <Button type="primary" danger disabled={selectedRowKeys.length === 0} icon={<DeleteOutlined />}>
                                        Xóa {selectedRowKeys.length > 0 ? `(${selectedRowKeys.length})` : ''} hồ sơ
                                    </Button>
                                </Popconfirm>
                            </Space>
                        )}
                    </div>

                    <Table 
                        bordered
                        rowSelection={user?.role === 'ADMIN' ? {
                            selectedRowKeys,
                            onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys),
                            onSelect: (record, selected) => {
                                if (selected) {
                                    handleRowClick(record);
                                }
                            }
                        } : undefined}
                        columns={columns} 
                        dataSource={data} 
                        rowKey="id"
                        loading={loading}
                        scroll={{ x: 'max-content', y: 500 }}
                        pagination={{
                            current: page,
                            pageSize: limit,
                            total: total,
                            showSizeChanger: true,
                            showTotal: (total) => `Tổng số ${total} hồ sơ`,
                            onChange: (p, s) => { setPage(p); setLimit(s); }
                        }}
                        onRow={(record) => {
                            return {
                                onClick: () => handleRowClick(record),
                            };
                        }}
                        rowClassName={(record) => selectedRecord?.id === record.id ? 'bg-blue-100 font-semibold shadow-inner transition-all duration-300 cursor-pointer' : 'hover:bg-slate-50 cursor-pointer transition-colors duration-200'}
                        className="border border-slate-200 rounded-lg overflow-hidden"
                    />
                </>
            )
        }
    ];

    if (selectedRecord) {
        Array.from({ length: 14 }).forEach((_, idx) => {
            const xmlIndex = idx + 2; // XML2 to XML15
            const dataKey = `xml${xmlIndex}Records`;
            const recordsForTab = recordDetails?.[dataKey];
            
            if (recordsForTab && recordsForTab.length > 0) {
                const errorCount = recordDetails?.validationErrors?.filter((err: any) => err.xmlType === `XML${xmlIndex}`).length || 0;
                
                // Map the data to inject __originalIndex and __hasError
                const dataSource = recordsForTab.map((item: any, idx: number) => {
                    const rowErrors = recordDetails?.validationErrors?.filter((err: any) => err.xmlType === `XML${xmlIndex}` && err.index === idx) || [];
                    return {
                        ...item,
                        __originalIndex: idx,
                        __hasError: rowErrors.length > 0,
                        __errorMsg: rowErrors.map((e: any) => e.message || e.ruleName).join('; ')
                    };
                });
                
                tabItems.push({
                    key: `XML${xmlIndex}`,
                    label: (
                        <span className="font-medium">
                            {getTabIcon(xmlIndex)} XML{xmlIndex} 
                            <Tag className="ml-1" color="blue">{recordsForTab.length}</Tag>
                            {errorCount > 0 && <span className="ml-1 text-red-500 font-bold bg-red-100 px-2 py-0.5 rounded-full text-xs animate-pulse">Lỗi ({errorCount})</span>}
                        </span>
                    ),
                    children: (
                        <div className="animate-fadeIn p-2">
                            <Table 
                                bordered
                                columns={generateDynamicColumns(dataSource, xmlIndex)}
                                dataSource={dataSource}
                                rowKey={(record: any) => record.id || record.__originalIndex}
                                scroll={{ x: 'max-content', y: 450 }}
                                size="small"
                                pagination={{ pageSize: 50 }}
                                className="border border-slate-200 rounded-lg overflow-hidden shadow-sm"
                                rowClassName="hover:bg-slate-50 transition-colors"
                            />
                        </div>
                    )
                });
            }
        });

        if (recordDetails?.validationErrors && recordDetails.validationErrors.length > 0) {
            tabItems.push({
                key: 'ERRORS',
                label: <span className="font-bold text-red-500"><WarningOutlined className="mr-2" />Lỗi Cảnh báo <Tag className="ml-1" color="error">{recordDetails.validationErrors.length}</Tag></span>,
                children: (
                    <div className="animate-fadeIn p-4 bg-red-50 rounded-lg border border-red-200">
                        <h3 className="text-red-700 font-bold mb-4">Danh sách lỗi phát hiện:</h3>
                        <div className="flex flex-col gap-3">
                            {recordDetails.validationErrors.map((err: any, i: number) => (
                                <div key={i} className="p-3 bg-white rounded shadow-sm border-l-4 border-l-red-500">
                                    <div className="font-bold text-red-600">{err.ruleCode}: {err.ruleName}</div>
                                    <div className="text-sm text-slate-600 mt-1">{err.description}</div>
                                    <div className="mt-2">
                                        <Tag color="volcano" className="font-mono m-0 mr-2">[{err.xmlType}]</Tag> 
                                        <span className="text-xs text-slate-500 font-mono font-bold bg-slate-100 p-1 rounded border border-slate-200">Field: {err.field} {err.index !== undefined ? `@ Row ${err.index + 1}` : ''}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            });
        }
    }

    const tabBarExtra = selectedRecord ? (
        <div className="mr-4 mb-2 flex items-center bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm animate-fadeIn">
            <Tag color="indigo" className="font-bold border-none m-0 mr-2 cursor-pointer hover:opacity-80" title="Click để copy Mã LK" onClick={() => handleCopy(selectedRecord.MA_LK)}>{selectedRecord.MA_LK}</Tag>
            <Tag color="blue" className="font-bold border-none m-0 mr-2 cursor-pointer hover:opacity-80" title="Click để copy Mã BN" onClick={() => handleCopy(selectedRecord.MA_BN)}>{selectedRecord.MA_BN}</Tag>
            <span className="font-bold text-indigo-700 uppercase cursor-pointer hover:opacity-80" title="Click để copy Tên BN" onClick={() => handleCopy(selectedRecord.HO_TEN)}>{selectedRecord.HO_TEN}</span>
        </div>
    ) : null;

    return (
        <div className="p-6 bg-slate-100 min-h-screen">
            <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 p-8 rounded-2xl shadow-xl mb-8 flex justify-between items-center transform transition-all hover:shadow-2xl">
                <div>
                    <h1 className="text-3xl font-extrabold m-0 text-white tracking-tight">Hệ sinh thái XML 3176</h1>
                    <p className="text-blue-100 mt-2 text-sm font-medium opacity-90">Quản lý, Phân tích và Lưu trữ dữ liệu BHYT tập trung</p>
                </div>
                <Button 
                    type="primary" 
                    size="large" 
                    className="bg-white text-indigo-600 border-none hover:bg-slate-50 hover:scale-105 transition-transform duration-300 shadow-lg font-bold rounded-xl h-12 px-6" 
                    icon={<InboxOutlined className="text-lg" />} 
                    onClick={() => setIsUploadModalVisible(true)}
                >
                    TẢI LÊN DỮ LIỆU ZIP
                </Button>
            </div>
            
            <Modal
                title="Tải lên dữ liệu XML 3176 (ZIP)"
                open={isUploadModalVisible}
                onCancel={() => !uploading && setIsUploadModalVisible(false)}
                footer={null}
                destroyOnHidden
            >
                <div className="p-2">
                    <Dragger {...uploadProps} disabled={uploading}>
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined className="text-blue-500" />
                        </p>
                        <p className="ant-upload-text font-semibold">Click hoặc kéo thả file ZIP chứa XML vào đây</p>
                        <p className="ant-upload-hint text-slate-500">
                            Hỗ trợ upload hàng ngàn file XML thông qua chuẩn nén .zip. Hệ thống sẽ xử lý siêu tốc ở Background.
                        </p>
                    </Dragger>
                    {uploading && (
                        <div className="mt-4">
                            <Progress percent={uploadProgress} status="active" />
                            <p className="text-center text-sm text-slate-500 mt-2">Đang xử lý dữ liệu và kiểm tra Checksum...</p>
                        </div>
                    )}
                </div>
            </Modal>

            <Card variant="borderless" className="shadow-2xl rounded-2xl overflow-hidden bg-white border-0">
                <Tabs 
                    defaultActiveKey="XML1" 
                    items={tabItems} 
                    type="card"
                    size="large"
                    tabBarExtraContent={tabBarExtra}
                    tabBarStyle={{ padding: '16px 16px 0 16px', background: '#f8fafc', margin: 0, borderBottom: '1px solid #e2e8f0' }}
                />
                
                {detailsLoading && (
                    <div className="text-center p-12 bg-white">
                        <Spin size="large" /> 
                        <div className="mt-4 text-slate-500 font-medium animate-pulse">Đang giải mã và tải dữ liệu XML liên quan...</div>
                    </div>
                )}
                
                {selectedRecord && !detailsLoading && !recordDetails && (
                    <div className="text-center p-12 bg-white text-slate-400">
                        <DatabaseOutlined className="text-4xl mb-4 opacity-50" />
                        <p>Hồ sơ này không có dữ liệu chi tiết XML2-15.</p>
                    </div>
                )}
            </Card>

            <Modal
                title="Cấu hình Hạn sửa Bệnh án"
                open={isConfigModalVisible}
                onCancel={() => setIsConfigModalVisible(false)}
                footer={[
                    <Button key="close" onClick={() => setIsConfigModalVisible(false)}>
                        Đóng
                    </Button>
                ]}
                destroyOnHidden
            >
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex flex-col gap-2">
                        <label className="font-semibold text-slate-700">
                            Số ngày làm việc cho phép sửa Bệnh án:
                        </label>
                        <div className="flex items-center gap-3">
                            <InputNumber 
                                min={1} 
                                max={365} 
                                value={editDeadlineDays} 
                                onChange={async (val) => {
                                    if (val) {
                                        setEditDeadlineDays(val);
                                        try {
                                            await fetch('/api/configs', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    key: 'editDeadlineDays',
                                                    value: val,
                                                    description: 'Số ngày làm việc cho phép sửa bệnh án'
                                                })
                                            });
                                            message.success('Đã lưu cấu hình!');
                                        } catch (e) {
                                            message.error('Lỗi khi lưu cấu hình');
                                        }
                                    }
                                }}
                            />
                            <span className="text-slate-500">ngày</span>
                        </div>
                        <Alert 
                            type="info" 
                            showIcon 
                            title="Quy tắc tính Hạn sửa BA"
                            description="Thời hạn sửa bệnh án được tính bằng: Ngày ra viện + Số ngày làm việc (Được tự động loại trừ các ngày Thứ 7 và Chủ nhật)."
                            className="mt-4"
                        />
                    </div>
                </div>
            </Modal>
        </div>
    );
}

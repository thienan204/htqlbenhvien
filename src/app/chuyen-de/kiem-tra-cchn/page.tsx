'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Select, Tag, Tooltip, Modal } from 'antd';
import { SyncOutlined, CheckCircleOutlined, SafetyCertificateOutlined, PlusOutlined, SettingOutlined, HistoryOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { getXmlDataList } from '@/lib/xml';
import dynamic from 'next/dynamic';

const CertificatesModal = dynamic(() => import('@/app/staff/components/CertificatesModal'), { ssr: false });

export default function KiemTraCCHNPage() {
    const { hasPermission } = useAuth();
    const [fileData, setFileData] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Column Config
    const [colMaBacSi, setColMaBacSi] = useState('MA_BAC_SI');
    const [colNguoiThucHien, setColNguoiThucHien] = useState('NGUOI_THUC_HIEN');
    const [colMaDichVu, setColMaDichVu] = useState('MA_DICH_VU');
    const [colTenDichVu, setColTenDichVu] = useState('TEN_DICH_VU');
    
    // Filters
    const [excludedNhom, setExcludedNhom] = useState<string[]>([]);
    
    // Validation Data
    const [validationResults, setValidationResults] = useState<any[]>([]);

    const [isMounted, setIsMounted] = useState(false);

    // Certificates Modal State
    const [openCertModal, setOpenCertModal] = useState(false);
    const [certStaffId, setCertStaffId] = useState<string | null>(null);
    const [certStaffName, setCertStaffName] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
        loadCachedFile();
    }, []);

    const loadCachedFile = async () => {
        setLoading(true);
        try {
            const { openDB } = await import('idb');
            
            try {
                const xmlDb = await openDB('xml-reader-db', 3);
                if (xmlDb.objectStoreNames.contains('records')) {
                    const records = await xmlDb.getAll('records');
                    if (records && records.length > 0) {
                        const extractedRows: any[] = [];
                        let rowIndex = 0;
                        records.forEach(record => {
                            const xml3Group = record.groups?.find((g: any) => g.type === 'XML3');
                            const items = getXmlDataList(xml3Group);
                            if (items && items.length > 0) {
                                items.forEach((item: any) => {
                                    if (item) {
                                        const getVal = (val: any) => val?.__cdata !== undefined ? String(val.__cdata) : (val !== undefined && val !== null ? String(val) : '');
                                        extractedRows.push({
                                            key: rowIndex++,
                                            MA_BAC_SI: getVal(item.MA_BAC_SI),
                                            NGUOI_THUC_HIEN: getVal(item.NGUOI_THUC_HIEN),
                                            MA_DICH_VU: getVal(item.MA_DICH_VU),
                                            TEN_DICH_VU: getVal(item.TEN_DICH_VU),
                                            MA_NHOM: getVal(item.MA_NHOM)
                                        });
                                    }
                                });
                            }
                        });

                        if (extractedRows.length > 0) {
                            setHeaders(['MA_BAC_SI', 'NGUOI_THUC_HIEN', 'MA_DICH_VU', 'TEN_DICH_VU', 'MA_NHOM']);
                            setColMaBacSi('MA_BAC_SI');
                            setColNguoiThucHien('NGUOI_THUC_HIEN');
                            setColMaDichVu('MA_DICH_VU');
                            setColTenDichVu('TEN_DICH_VU');
                            setFileData(extractedRows);
                            message.success(`Đã nạp ${extractedRows.length} dịch vụ từ Công cụ Kiểm tra lỗi XML.`);
                            setLoading(false);
                            return;
                        }
                    }
                }
                message.info('Chưa có dữ liệu XML. Vui lòng sang "Công cụ Kiểm tra lỗi" để nạp file XML trước.');
            } catch (e) {
                console.log("Không đọc được xml-reader-db", e);
                message.info('Chưa có dữ liệu XML. Vui lòng sang "Công cụ Kiểm tra lỗi" để nạp file XML trước.');
            }
        } catch (error) {
            console.error('Error loading file from IDB:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async () => {
        if (!colMaDichVu || (!colMaBacSi && !colNguoiThucHien)) {
            message.error('Vui lòng cấu hình Cột Mã Dịch Vụ và ít nhất 1 cột CCHN!');
            return;
        }

        setLoading(true);
        try {
            const checks: any[] = [];
            
            // Collect all unique validations needed
            fileData.forEach((row, idx) => {
                const maDichVu = String(row[colMaDichVu] || '').trim();
                const tenDichVu = String(row[colTenDichVu] || '').trim();
                const maNhom = String(row.MA_NHOM || '').trim();
                
                if (!maDichVu) return;
                
                // Bỏ qua nếu thuộc nhóm BHYT cần loại trừ
                if (maNhom && excludedNhom.includes(maNhom)) return;

                // NGUOI CHI DINH
                if (colMaBacSi) {
                    const cchns = String(row[colMaBacSi] || '').split(';').map(s => s.trim()).filter(Boolean);
                    cchns.forEach(cchn => {
                        checks.push({
                            rowIdx: idx + 2,
                            type: 'Chỉ định',
                            cchn,
                            ma_dich_vu: maDichVu,
                            ten_dich_vu: tenDichVu,
                            ma_nhom: String(row.MA_NHOM || '')
                        });
                    });
                }

                // NGUOI THUC HIEN
                if (colNguoiThucHien) {
                    const cchns = String(row[colNguoiThucHien] || '').split(';').map(s => s.trim()).filter(Boolean);
                    cchns.forEach(cchn => {
                        checks.push({
                            rowIdx: idx + 2,
                            type: 'Thực hiện',
                            cchn,
                            ma_dich_vu: maDichVu,
                            ten_dich_vu: tenDichVu,
                            ma_nhom: String(row.MA_NHOM || '')
                        });
                    });
                }
            });

            if (checks.length === 0) {
                message.info('Không có dữ liệu hợp lệ để kiểm tra.');
                setLoading(false);
                return;
            }

            // Call Validation Engine
            const res = await fetch('/api/cchn/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checks })
            });

            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            
            setValidationResults(data.errors || []);
            
            if (data.errors && data.errors.length > 0) {
                message.warning(`Phát hiện ${data.errors.length} trường hợp vi phạm!`);
            } else {
                message.success('Tuyệt vời! Tất cả dịch vụ đều đúng Phạm vi chuyên môn.');
            }

        } catch (error) {
            console.error(error);
            message.error('Lỗi khi kiểm tra. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncServices = async () => {
        if (fileData.length === 0) {
            message.warning('Không có dữ liệu XML để đồng bộ.');
            return;
        }

        if (!colMaDichVu || (!colMaBacSi && !colNguoiThucHien)) {
            message.error('Vui lòng cấu hình Cột Mã Dịch Vụ và ít nhất 1 cột CCHN!');
            return;
        }

        setLoading(true);
        try {
            const syncRecordsMap = new Map<string, any>();

            fileData.forEach((row) => {
                const maDichVu = String(row[colMaDichVu] || '').trim();
                const tenDichVu = String(row[colTenDichVu] || '').trim();

                if (!maDichVu) return;

                const addCchnToMap = (cchnString: string, isChiDinh: boolean, isThucHien: boolean) => {
                    const cchns = cchnString.split(';').map(s => s.trim()).filter(Boolean);
                    cchns.forEach(cchn => {
                        const key = `${cchn}_${maDichVu}`;
                        if (!syncRecordsMap.has(key)) {
                            syncRecordsMap.set(key, { 
                                cchn, 
                                ma_dich_vu: maDichVu, 
                                ten_dich_vu: tenDichVu,
                                isChiDinh,
                                isThucHien
                            });
                        } else {
                            // Merge flags if record already exists for this CCHN + MaDichVu
                            const existing = syncRecordsMap.get(key);
                            existing.isChiDinh = existing.isChiDinh || isChiDinh;
                            existing.isThucHien = existing.isThucHien || isThucHien;
                        }
                    });
                };

                if (colMaBacSi) addCchnToMap(String(row[colMaBacSi] || ''), true, false);
                if (colNguoiThucHien) addCchnToMap(String(row[colNguoiThucHien] || ''), false, true);
            });

            const records = Array.from(syncRecordsMap.values());

            if (records.length === 0) {
                message.info('Không có dữ liệu hợp lệ để đồng bộ.');
                setLoading(false);
                return;
            }

            const res = await fetch('/api/cchn/sync-xml-services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records })
            });

            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            
            if (data.success) {
                message.success(`Đã đồng bộ thành công! Thêm mới ${data.count} bản ghi dịch vụ vào hồ sơ CCHN.`);
            } else {
                message.error('Có lỗi xảy ra khi đồng bộ.');
            }

        } catch (error) {
            console.error(error);
            message.error('Lỗi kết nối đồng bộ. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAssign = async (ma_pham_vi: string, record: any) => {
        try {
            const res = await fetch('/api/pham-vi-chuyen-mon/quick-assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ma_pham_vi, ma_dich_vu: record.ma_dich_vu })
            });
            if (res.ok) {
                message.success(`Đã gán dịch vụ ${record.ma_dich_vu} vào PVHN ${ma_pham_vi}`);
                setValidationResults(prev => prev.filter(r => r !== record));
            } else {
                const data = await res.json();
                message.error(data.error || 'Lỗi khi gán dịch vụ');
            }
        } catch (e) {
            message.error('Lỗi kết nối');
        }
    };

    const handleBulkAssign = async () => {
        const mappableRecords = validationResults.filter(r => r.scopes && r.scopes.length > 0);
        if (mappableRecords.length === 0) {
            message.warning('Không có dòng vi phạm nào đủ điều kiện để gán tự động (cần có sẵn Phạm vi chuyên môn).');
            return;
        }

        // Lọc trùng lặp ở client trước khi gửi để tối ưu payload
        const uniqueMappings = new Map<string, { ma_pham_vi: string, ma_dich_vu: string }>();
        mappableRecords.forEach(r => {
            if (r.scopes && r.scopes.length > 0 && r.ma_dich_vu) {
                const ma_pham_vi = r.scopes[0]; // Chọn phạm vi đầu tiên
                uniqueMappings.set(`${ma_pham_vi}_${r.ma_dich_vu}`, { ma_pham_vi, ma_dich_vu: r.ma_dich_vu });
            }
        });
        
        const allMappings = Array.from(uniqueMappings.values());
        if (allMappings.length === 0) return;

        setLoading(true);
        try {
            // Chia nhỏ thành các chunk 500 phần tử để tránh lỗi 413 Payload Too Large của Next.js
            const chunkSize = 500;
            let totalSuccess = 0;
            let totalErrorCount = 0;
            let allErrors: string[] = [];

            for (let i = 0; i < allMappings.length; i += chunkSize) {
                const chunk = allMappings.slice(i, i + chunkSize);
                
                const res = await fetch('/api/pham-vi-chuyen-mon/bulk-quick-assign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mappings: chunk })
                });

                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }

                const data = await res.json();
                if (data.success) {
                    totalSuccess += data.successCount || 0;
                    totalErrorCount += data.errorCount || 0;
                    if (data.errors) {
                        allErrors = [...allErrors, ...data.errors];
                    }
                } else {
                    throw new Error(data.error || 'Lỗi khi gán hàng loạt');
                }
            }

            // Tổng hợp kết quả
            if (totalErrorCount > 0) {
                // Lọc trùng lỗi
                const uniqueErrors = Array.from(new Set(allErrors)).slice(0, 50);
                Modal.warning({
                    title: `Gán tự động hoàn tất: Thành công ${totalSuccess}, Lỗi ${totalErrorCount}`,
                    content: (
                        <div className="max-h-60 overflow-y-auto mt-4">
                            <p className="mb-2 text-slate-600">Một số dịch vụ không thể gán tự động, thường do chưa có trong danh mục Mẫu 05:</p>
                            <ul className="list-disc pl-4 text-red-500 text-sm space-y-1">
                                {uniqueErrors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                                {allErrors.length > 50 && <li className="italic text-slate-500">...và {allErrors.length - 50} lỗi khác</li>}
                            </ul>
                        </div>
                    ),
                    width: 600
                });
            } else {
                message.success(`Tuyệt vời! Đã gán tự động thành công ${totalSuccess} dịch vụ (đã lọc trùng).`);
            }
            
            // Tự động kiểm tra lại để dọn dẹp bảng
            handleValidate();

        } catch (e: any) {
            console.error('Bulk assign error:', e);
            message.error(`Lỗi kết nối khi gán tự động: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted) return null;

    if (!hasPermission('MENU_CHUYEN_DE')) {
        return <div className="p-12 text-center text-red-500 font-bold text-xl">Truy cập bị từ chối</div>;
    }

    return (
        <div className="p-4 space-y-6 max-w-[98%] mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-2xl">
                        <SafetyCertificateOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Kiểm tra CCHN BHYT</h1>
                        <p className="text-slate-500 m-0">Kiểm tra vi phạm Phạm vi chuyên môn theo quy định mới nhất</p>
                    </div>
                </div>
                <Space>
                    <Button icon={<SyncOutlined />} onClick={loadCachedFile} loading={loading}>
                        Nạp lại XML Cache
                    </Button>
                    <Tooltip title="Tự động trích xuất toàn bộ Mã Dịch Vụ từ file XML và lưu vào Hồ sơ Nhân sự (dựa theo Cột CCHN). Giúp hệ thống ghi nhận lịch sử thực hiện dịch vụ thực tế của từng Bác sĩ/Điều dưỡng để quản lý Phạm vi chuyên môn.">
                        <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleSyncServices} loading={loading} className="bg-emerald-600 hover:bg-emerald-500">
                            Đồng bộ Dịch vụ vào Hồ sơ Nhân sự
                        </Button>
                    </Tooltip>
                    <Tooltip title="Xem lịch sử các mã dịch vụ đã được đồng bộ">
                        <Button 
                            icon={<HistoryOutlined />} 
                            onClick={() => window.open('/htqlbenhvien/staff/quan-ly-lich-su-dich-vu', '_blank')}
                        />
                    </Tooltip>
                </Space>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <Card size="small" className="bg-blue-50 border-blue-100 shadow-sm">
                    <div className="text-blue-500 text-sm font-semibold mb-1">Tổng số dòng Dữ liệu XML3</div>
                    <div className="text-3xl font-black text-blue-700">{fileData.length}</div>
                </Card>
                <Card size="small" className={`shadow-sm ${validationResults.length > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className={`${validationResults.length > 0 ? 'text-red-500' : 'text-emerald-500'} text-sm font-semibold mb-1`}>Tổng Số Lỗi Vi Phạm</div>
                    <div className={`text-3xl font-black ${validationResults.length > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{validationResults.length}</div>
                </Card>
            </div>

            <Card title="Cấu hình Cột Dữ Liệu" className="shadow-sm" extra={
                <Button type="primary" size="large" danger icon={<CheckCircleOutlined />} onClick={handleValidate} loading={loading}>
                    KIỂM TRA TOÀN BỘ DỮ LIỆU
                </Button>
            }>
                <Space size="large" className="w-full flex-wrap">
                    <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">Cột CCHN Người Chỉ Định</div>
                        <Select showSearch allowClear className="w-48" value={colMaBacSi} onChange={setColMaBacSi}>
                            {headers.map(h => <Select.Option key={h} value={h}>{h}</Select.Option>)}
                        </Select>
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">Cột CCHN Người Thực Hiện</div>
                        <Select showSearch allowClear className="w-48" value={colNguoiThucHien} onChange={setColNguoiThucHien}>
                            {headers.map(h => <Select.Option key={h} value={h}>{h}</Select.Option>)}
                        </Select>
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">Cột Mã Dịch Vụ</div>
                        <Select showSearch className="w-48" value={colMaDichVu} onChange={setColMaDichVu}>
                            {headers.map(h => <Select.Option key={h} value={h}>{h}</Select.Option>)}
                        </Select>
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">Cột Tên Dịch Vụ (Tùy chọn)</div>
                        <Select showSearch allowClear className="w-48" value={colTenDichVu} onChange={setColTenDichVu}>
                            {headers.map(h => <Select.Option key={h} value={h}>{h}</Select.Option>)}
                        </Select>
                    </div>
                    <div>
                        <div className="text-xs font-semibold text-slate-500 mb-1">Loại trừ Nhóm BHYT</div>
                        <Select 
                            mode="multiple" 
                            allowClear 
                            className="w-48" 
                            placeholder="VD: 14, 15..."
                            value={excludedNhom} 
                            onChange={setExcludedNhom}
                        >
                            {Array.from(new Set(fileData.map(r => String(r.MA_NHOM || '').trim()).filter(Boolean))).map(n => (
                                <Select.Option key={n} value={n}>{n}</Select.Option>
                            ))}
                        </Select>
                    </div>
                </Space>
            </Card>

            {validationResults.length > 0 && (
                <Card 
                    title={<span className="text-red-600 font-bold">Chi tiết các trường hợp Vi phạm</span>} 
                    className="shadow-sm border-red-200"
                    extra={
                        <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleBulkAssign} loading={loading} className="bg-blue-600 hover:bg-blue-500">
                            Gán tự động toàn bộ lỗi
                        </Button>
                    }
                >
                    <Table
                        scroll={{ x: 1400 }}
                        dataSource={validationResults}
                        columns={[
                            { title: 'STT', key: 'stt', width: 60, render: (_: any, record: any) => validationResults.indexOf(record) + 1 },
                            { title: 'Dòng Excel', dataIndex: 'rowIdx', width: 100 },
                            { 
                                title: 'Vai trò', 
                                dataIndex: 'type', 
                                width: 120, 
                                filters: [
                                    { text: 'Chỉ định', value: 'Chỉ định' },
                                    { text: 'Thực hiện', value: 'Thực hiện' }
                                ],
                                onFilter: (value: any, record: any) => record.type === value,
                                render: text => <Tag color={text === 'Chỉ định' ? 'blue' : 'purple'}>{text}</Tag> 
                            },
                            { title: 'CCHN Bác Sĩ', dataIndex: 'cchn', width: 150, render: text => <span className="font-bold">{text}</span> },
                            { title: 'Tên Bác Sĩ', dataIndex: 'ten_bac_si', width: 150, render: text => <span className="text-slate-600 font-semibold">{text}</span> },
                            { 
                                title: 'Khoa/Phòng', 
                                dataIndex: 'ten_khoa', 
                                width: 150, 
                                filters: Array.from(new Set(validationResults.map(r => r.ten_khoa).filter(Boolean))).map(k => ({ text: String(k), value: String(k) })),
                                onFilter: (value: any, record: any) => record.ten_khoa === value,
                                render: text => <span className="text-slate-500">{text}</span> 
                            },
                            { 
                                title: 'Nhóm BHYT (XML3)', 
                                dataIndex: 'ma_nhom', 
                                width: 120, 
                                filters: Array.from(new Set(validationResults.map(r => r.ma_nhom).filter(Boolean))).map(k => ({ text: String(k), value: String(k) })),
                                onFilter: (value: any, record: any) => record.ma_nhom === value,
                                render: text => <Tag color="orange">{text}</Tag> 
                            },
                            { title: 'Mã Dịch Vụ', dataIndex: 'ma_dich_vu', width: 120 },
                            { title: 'Tên Dịch Vụ', dataIndex: 'ten_dich_vu', width: 250 },
                            { title: 'Lý do vi phạm', dataIndex: 'reason', width: 250, render: text => <span className="text-red-500">{text}</span> },
                            {
                                title: 'Thao tác',
                                key: 'action',
                                width: 180,
                                render: (_: any, record: any) => {
                                    if (!record.staff_id) return <span className="text-slate-400 italic text-xs">Cần khai báo nhân sự</span>;
                                    
                                    if (record.scopes && record.scopes.length > 0) {
                                        return (
                                            <div className="flex flex-col gap-2">
                                                {record.scopes.map((scope: string) => (
                                                    <Button 
                                                        key={scope} 
                                                        size="small" 
                                                        type="primary" 
                                                        ghost 
                                                        icon={<PlusOutlined />}
                                                        onClick={() => handleQuickAssign(scope, record)}
                                                    >
                                                        Gán PV: {scope}
                                                    </Button>
                                                ))}
                                            </div>
                                        );
                                    }
                                    
                                    return (
                                        <Button 
                                            size="small" 
                                            icon={<SettingOutlined />}
                                            onClick={() => {
                                                setCertStaffId(record.staff_id);
                                                setCertStaffName(record.ten_bac_si);
                                                setOpenCertModal(true);
                                            }}
                                        >
                                            Cập nhật PVHN
                                        </Button>
                                    );
                                }
                            }
                        ]}
                        pagination={{ pageSize: 20 }}
                        size="small"
                        rowKey={(r) => `${r.rowIdx}_${r.cchn}_${r.ma_dich_vu}_${r.type}`}
                    />
                </Card>
            )}

            {openCertModal && (
                <CertificatesModal
                    open={openCertModal}
                    onClose={() => setOpenCertModal(false)}
                    staffId={certStaffId}
                    staffName={certStaffName}
                    onSuccess={() => {
                        handleValidate(); // Re-validate after adding CCHN
                    }}
                />
            )}
        </div>
    );
}

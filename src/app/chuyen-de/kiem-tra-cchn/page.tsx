'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Select, Tag } from 'antd';
import { SyncOutlined, CheckCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { getXmlDataList } from '@/lib/xml';

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
    
    // Validation Data
    const [validationResults, setValidationResults] = useState<any[]>([]);

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        loadCachedFile();
    }, []);

    const loadCachedFile = async () => {
        setLoading(true);
        try {
            const { openDB } = await import('idb');
            
            try {
                const xmlDb = await openDB('xml-reader-db', 2);
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
                
                if (!maDichVu) return;

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

    if (!isMounted) return null;

    if (!hasPermission('MENU_CHUYEN_DE')) {
        return <div className="p-12 text-center text-red-500 font-bold text-xl">Truy cập bị từ chối</div>;
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
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
                </Space>
            </Card>

            {validationResults.length > 0 && (
                <Card title={<span className="text-red-600 font-bold">Chi tiết các trường hợp Vi phạm</span>} className="shadow-sm border-red-200">
                    <Table
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
                            { title: 'Tên Dịch Vụ', dataIndex: 'ten_dich_vu' },
                            { title: 'Lý do vi phạm', dataIndex: 'reason', render: text => <span className="text-red-500">{text}</span> }
                        ]}
                        pagination={{ pageSize: 20 }}
                        size="small"
                        rowKey={(r) => `${r.rowIdx}_${r.cchn}_${r.ma_dich_vu}_${r.type}`}
                    />
                </Card>
            )}
        </div>
    );
}

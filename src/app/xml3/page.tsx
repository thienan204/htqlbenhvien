'use client';

import React, { useState, useEffect } from 'react';
import { Table, Input, Card, Tag, Button, Tooltip } from 'antd';
import { loadRecordsFromDB } from '@/lib/db';
import { getXmlDataList, ExtendedHosoRecord } from '@/lib/xml';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

// Helper to format values
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
    if (s.length >= 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    return s;
};

export default function Xml3Page() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [searchText, setSearchText] = useState('');
    const [filteredData, setFilteredData] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!searchText) {
            setFilteredData(data);
        } else {
            const lower = searchText.toLowerCase();
            const filtered = data.filter(item =>
                String(item.MA_LK || '').toLowerCase().includes(lower) ||
                String(item.HO_TEN || '').toLowerCase().includes(lower) ||
                String(item.MA_DICH_VU || '').toLowerCase().includes(lower) ||
                String(item.TEN_DICH_VU || '').toLowerCase().includes(lower)
            );
            setFilteredData(filtered);
        }
    }, [searchText, data]);

    const loadData = async () => {
        setLoading(true);
        try {
            const records = await loadRecordsFromDB();
            const xml3Items: any[] = [];

            records.forEach(record => {
                const xml3Group = record.groups.find(g => g.type === 'XML3');
                if (xml3Group) {
                    const items = getXmlDataList(xml3Group);
                    items.forEach(item => {
                        // Flatten and add parent info
                        xml3Items.push({
                            ...item,
                            // Unique key for table
                            __key: `${record.id}_${item.MA_DICH_VU}_${Math.random()}`,
                            // Parent Info
                            MA_LK: record.summary?.MA_LK,
                            MA_BN: record.summary?.MA_BN,
                            HO_TEN: record.summary?.HO_TEN,
                            NGAY_SINH: record.summary?.NGAY_SINH,
                            NGAY_VAO: record.summary?.NGAY_VAO,
                            NGAY_RA: record.summary?.NGAY_RA,
                            originalRecord: record
                        });
                    });
                }
            });
            setData(xml3Items);
            setFilteredData(xml3Items);
        } catch (error) {
            console.error("Failed to load data", error);
        } finally {
            setLoading(false);
        }
    };

    const columns: ColumnsType<any> = [
        {
            title: 'STT',
            key: 'index',
            width: 60,
            align: 'center',
            render: (_, __, i) => i + 1,
            fixed: 'left',
        },
        {
            title: 'Mã LK',
            dataIndex: 'MA_LK',
            key: 'MA_LK',
            width: 120,
            fixed: 'left',
            render: (text) => <span className="font-bold text-blue-600">{renderValue(text)}</span>,
            sorter: (a, b) => String(a.MA_LK).localeCompare(String(b.MA_LK)),
        },
        {
            title: 'Họ Tên',
            dataIndex: 'HO_TEN',
            key: 'HO_TEN',
            width: 150,
            fixed: 'left',
            render: (text) => <span className="text-slate-700 font-medium">{renderValue(text)}</span>,
            sorter: (a, b) => String(a.HO_TEN).localeCompare(String(b.HO_TEN)),
        },
        {
            title: 'Mã BN',
            dataIndex: 'MA_BN',
            key: 'MA_BN',
            width: 120,
            render: (text) => <span className="font-mono text-slate-700">{renderValue(text)}</span>,
            sorter: (a, b) => renderValue(a.MA_BN).localeCompare(renderValue(b.MA_BN)),
        },
        {
            title: 'Ngày sinh',
            dataIndex: 'NGAY_SINH',
            key: 'NGAY_SINH',
            width: 100,
            render: (text) => formatDateTime(text)
        },
        {
            title: 'Ngày vào',
            dataIndex: 'NGAY_VAO',
            key: 'NGAY_VAO',
            width: 120,
            render: (text) => formatDateTime(text)
        },
        {
            title: 'Ngày ra',
            dataIndex: 'NGAY_RA',
            key: 'NGAY_RA',
            width: 120,
            render: (text) => formatDateTime(text)
        },
        {
            title: 'Mã Dịch Vụ',
            dataIndex: 'MA_DICH_VU',
            key: 'MA_DICH_VU',
            width: 150,
            render: (text) => <span className="font-mono text-slate-700">{renderValue(text)}</span>,
            sorter: (a, b) => renderValue(a.MA_DICH_VU).localeCompare(renderValue(b.MA_DICH_VU)),
        },
        {
            title: 'Tên Dịch Vụ',
            dataIndex: 'TEN_DICH_VU',
            key: 'TEN_DICH_VU',
            width: 300,
            render: (text) => (
                <Tooltip title={renderValue(text)}>
                    <div className="truncate">{renderValue(text)}</div>
                </Tooltip>
            )
        },
        {
            title: 'Mã Nhóm',
            dataIndex: 'MA_NHOM',
            key: 'MA_NHOM',
            width: 100,
            render: (text) => renderValue(text)
        },
        {
            title: 'Đơn vị tính',
            dataIndex: 'DON_VI_TINH',
            key: 'DON_VI_TINH',
            width: 100,
            render: (text) => renderValue(text)
        },
        {
            title: 'Số lượng',
            dataIndex: 'SO_LUONG',
            key: 'SO_LUONG',
            width: 100,
            align: 'right',
            render: (text) => renderValue(text)
        },
        {
            title: 'Đơn giá',
            dataIndex: 'DON_GIA',
            key: 'DON_GIA',
            width: 120,
            align: 'right',
            render: (text) => {
                const val = parseFloat(renderValue(text));
                return isNaN(val) ? text : new Intl.NumberFormat('vi-VN').format(val);
            }
        },
        {
            title: 'Thành tiền',
            dataIndex: 'THANH_TIEN',
            key: 'THANH_TIEN',
            width: 120,
            align: 'right',
            render: (text) => {
                const val = parseFloat(renderValue(text));
                return isNaN(val) ? text : new Intl.NumberFormat('vi-VN').format(val);
            }
        },
        {
            title: 'Tỷ lệ',
            dataIndex: 'TY_LE_TT',
            key: 'TY_LE_TT',
            width: 80,
            align: 'center',
            render: (text) => renderValue(text)
        },
        {
            title: 'Ngày YL',
            dataIndex: 'NGAY_YL',
            key: 'NGAY_YL',
            width: 120,
            render: (text) => formatDateTime(text)
        },
        {
            title: 'Ngày TH YL',
            dataIndex: 'NGAY_TH_YL',
            key: 'NGAY_TH_YL',
            width: 120,
            render: (text) => formatDateTime(text)
        },
        {
            title: 'Ngày KQ',
            dataIndex: 'NGAY_KQ',
            key: 'NGAY_KQ',
            width: 120,
            render: (text) => formatDateTime(text)
        },
        {
            title: 'Mã Khoa',
            dataIndex: 'MA_KHOA',
            key: 'MA_KHOA',
            width: 100,
            render: (text) => renderValue(text)
        },
        {
            title: 'Mã Giường',
            dataIndex: 'MA_GIUONG',
            key: 'MA_GIUONG',
            width: 100,
            render: (text) => renderValue(text)
        },
        {
            title: 'Mã Bác sĩ',
            dataIndex: 'MA_BAC_SI',
            key: 'MA_BAC_SI',
            width: 100,
            render: (text) => renderValue(text)
        },
        {
            title: 'Kết quả',
            dataIndex: 'KET_QUA',
            key: 'KET_QUA',
            width: 200,
            render: (text) => (
                <div className="truncate max-w-xs" title={renderValue(text)}>
                    {renderValue(text)}
                </div>
            )
        }
    ];

    return (
        <main className="min-h-screen bg-slate-50 p-6 md:p-8 pt-24">
            <div className="max-w-[98%] mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Chi tiết Dịch vụ (XML3)</h1>
                        <p className="text-slate-500 font-medium">Xem danh sách toàn bộ chi tiết dịch vụ kỹ thuật & vật tư y tế</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Input
                            placeholder="Tìm kiếm..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            className="w-full md:w-64"
                            allowClear
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={loadData}
                            loading={loading}
                        >
                            Tải lại
                        </Button>
                        <Button
                            danger
                            type="dashed"
                            onClick={() => {
                                // 1. Filter Bed Groups (13, 14, 15)
                                const bedItems = data.filter(item => ['13', '14', '15'].includes(String(item.MA_NHOM)));

                                // 2. Group by NGAY_YL (Date only) + MA_GIUONG + MA_DICH_VU (Cross-patient check)
                                const groups: Record<string, any[]> = {};
                                bedItems.forEach(item => {
                                    const rawDate = String(item.NGAY_YL || '');
                                    // Take first 8 chars (YYYYMMDD) to ignore time
                                    const dateOnly = rawDate.length >= 8 ? rawDate.substring(0, 8) : rawDate;
                                    const maGiuong = String(item.MA_GIUONG || '').trim();
                                    const maDichVu = String(item.MA_DICH_VU || '').trim();

                                    // Key does NOT include MA_LK anymore
                                    const key = `${dateOnly}_${maGiuong}_${maDichVu}`;
                                    if (!groups[key]) groups[key] = [];
                                    groups[key].push(item);
                                });

                                // 3. Find duplicates (groups with >= 2 items)
                                const duplicates = Object.values(groups).filter(g => g.length >= 2).flat();

                                // 4. Update view
                                setFilteredData(duplicates);
                                if (duplicates.length > 0) {
                                    alert(`Tìm thấy ${duplicates.length} bản ghi trùng giường (cùng ngày, cùng giường, cùng mã dịch vụ, có thể khác bệnh nhân) trong các nhóm 13, 14, 15.`);
                                } else {
                                    alert("Không tìm thấy bản ghi nào trùng giường (xét theo nhóm 13, 14, 15, ngày y lệnh và mã dịch vụ).");
                                }
                            }}
                        >
                            KT Trùng Giường
                        </Button>
                    </div>
                </div>

                <Card className="shadow-sm border-slate-200 rounded-2xl overflow-hidden" styles={{ body: { padding: 0 } }}>
                    <Table
                        columns={columns}
                        dataSource={filteredData}
                        rowKey="__key"
                        loading={loading}
                        scroll={{ x: 1500, y: 'calc(100vh - 280px)' }}
                        pagination={{
                            defaultPageSize: 20,
                            showSizeChanger: true,
                            pageSizeOptions: ['20', '50', '100', '500'],
                            showTotal: (total) => `Tổng ${total} dòng`
                        }}
                        size="middle"
                        bordered
                    />
                </Card>
            </div>
        </main>
    );
}

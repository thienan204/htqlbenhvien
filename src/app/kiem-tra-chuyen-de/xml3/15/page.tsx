'use client';

import React, { useState, useEffect } from 'react';
import { Table, Input, Card, Tag, Button, Tooltip, Breadcrumb, message, Select } from 'antd';
import { loadRecordsFromDB } from '@/lib/db';
import { getXmlDataList, ExtendedHosoRecord } from '@/lib/xml';
import { SearchOutlined, ReloadOutlined, AuditOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { ColumnsType } from 'antd/es/table';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { copyToClipboard } from '@/utils/clipboard';
import { getBasePath } from '@/utils/config';

// Palette for group colors
const COLOR_PALETTE = [
    { argb: 'FFFFCCCC', css: '#ffcccc' }, // Red
    { argb: 'FFCCE5FF', css: '#cce5ff' }, // Blue
    { argb: 'FFCCFFCC', css: '#ccffcc' }, // Green
    { argb: 'FFFFFFCC', css: '#ffffcc' }, // Yellow
    { argb: 'FFE5CCFF', css: '#e5ccff' }, // Purple
    { argb: 'FFFFE5CC', css: '#ffe5cc' }, // Orange
];

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
    if (s.length >= 12) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)} ${s.substring(8, 10)}:${s.substring(10, 12)}`;
    }
    if (s.length >= 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    return s;
};

export default function KiemTraChuyenDeXml3Group15Page() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [searchText, setSearchText] = useState('');
    const [filteredData, setFilteredData] = useState<any[]>([]);
    const [departments, setDepartments] = useState<Record<string, string>>({});
    const [tyleDVFilter, setTyleDVFilter] = useState<string | null>(null);

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const res = await fetch(`${getBasePath()}/api/departments`);
                if (res.ok) {
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

            if (tyleDVFilter) {
                const finalFiltered = filtered.filter(item => String(item.TYLE_TT_DV) === tyleDVFilter);
                setFilteredData(finalFiltered);
            } else {
                setFilteredData(filtered);
            }
        }
    }, [searchText, data, tyleDVFilter]);

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
                        // Only include Group 15
                        if (String(item.MA_NHOM) === '15') {
                            // Flatten and add parent info
                            xml3Items.push({
                                ...item,
                                // Unique key for table
                                __key: `${record.id}_${item.MA_DICH_VU}_${Math.random()}`,
                                // Parent Info
                                // Note: MA_KHOA comes from 'item' (XML3), allowing tracking of dept transfers
                                MA_LK: record.summary?.MA_LK,
                                MA_BN: record.summary?.MA_BN,
                                HO_TEN: record.summary?.HO_TEN,
                                NGAY_SINH: record.summary?.NGAY_SINH,
                                NGAY_VAO: record.summary?.NGAY_VAO,
                                NGAY_RA: record.summary?.NGAY_RA,
                                originalRecord: record
                            });
                        }
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

    const handleCellClick = (e: React.MouseEvent, val: any) => {
        e.stopPropagation();
        const textToCopy = renderValue(val);
        if (!textToCopy) return;
        copyToClipboard(textToCopy).then(() => {
            message.success(`Đã copy: ${textToCopy}`);
        }).catch(() => { });
    };

    const sharedOnCell = (dataIndex: string) => (record: any) => ({
        onClick: (e: React.MouseEvent) => handleCellClick(e, record[dataIndex]),
        style: { cursor: 'pointer' },
        title: 'Click để copy giá trị này'
    });

    // Special handling for calculated/rendered columns if needed, but dataIndex is usually sufficient for raw value.
    // For 'Ten Khoa', dataIndex is MA_KHOA, but we want name.

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
            onCell: sharedOnCell('MA_LK'),
            render: (text) => <span className="font-bold text-blue-600">{renderValue(text)}</span>,
            sorter: (a, b) => String(a.MA_LK).localeCompare(String(b.MA_LK)),
        },
        {
            title: 'Họ Tên',
            dataIndex: 'HO_TEN',
            key: 'HO_TEN',
            width: 150,
            fixed: 'left',
            onCell: sharedOnCell('HO_TEN'),
            render: (text) => <span className="text-slate-700 font-medium">{renderValue(text)}</span>,
            sorter: (a, b) => String(a.HO_TEN).localeCompare(String(b.HO_TEN)),
        },
        {
            title: 'Mã Khoa',
            dataIndex: 'MA_KHOA',
            key: 'MA_KHOA_COL',
            width: 100,
            onCell: sharedOnCell('MA_KHOA'),
            render: (text) => <span className="font-bold text-blue-700">{renderValue(text)}</span>
        },
        {
            title: 'Tên Khoa',
            dataIndex: 'MA_KHOA',
            key: 'TEN_KHOA_COL',
            width: 200,
            onCell: (record) => ({
                onClick: (e) => handleCellClick(e, departments[record.MA_KHOA] || ''),
                style: { cursor: 'pointer' },
                title: 'Click để copy tên khoa'
            }),
            render: (text) => <span className="text-slate-600">{departments[renderValue(text)] || ''}</span>
        },
        // Only essential columns for bed checking
        {
            title: 'Mã Giường',
            dataIndex: 'MA_GIUONG',
            key: 'MA_GIUONG',
            width: 120,
            onCell: sharedOnCell('MA_GIUONG'),
            render: (text) => <Tag color="geekblue">{renderValue(text) || '(Trống)'}</Tag>
        },
        {
            title: 'Tỷ lệ BH',
            dataIndex: 'TYLE_TT_BH',
            key: 'TYLE_TT_BH',
            width: 100,
            align: 'center',
            onCell: sharedOnCell('TYLE_TT_BH'),
            render: (text) => <Tag color="orange">{renderValue(text)}</Tag>
        },
        {
            title: 'Tỷ lệ DV',
            dataIndex: 'TYLE_TT_DV',
            key: 'TYLE_TT_DV',
            width: 100,
            align: 'center',
            onCell: sharedOnCell('TYLE_TT_DV'),
            render: (text) => <Tag color="cyan">{renderValue(text)}</Tag>
        },
        {
            title: 'Ngày YL',
            dataIndex: 'NGAY_YL',
            key: 'NGAY_YL',
            width: 120,
            onCell: (record) => ({
                onClick: (e) => handleCellClick(e, formatDateTime(record.NGAY_YL)),
                style: { cursor: 'pointer' },
                title: 'Click để copy Ngày YL'
            }),
            render: (text) => formatDateTime(text),
            defaultSortOrder: 'ascend',
            sorter: (a, b) => String(a.NGAY_YL).localeCompare(String(b.NGAY_YL)),
        },
        {
            title: 'Ngày KQ',
            dataIndex: 'NGAY_KQ',
            key: 'NGAY_KQ',
            width: 120,
            onCell: (record) => ({
                onClick: (e) => handleCellClick(e, formatDateTime(record.NGAY_KQ)),
                style: { cursor: 'pointer' },
                title: 'Click để copy Ngày KQ'
            }),
            render: (text) => formatDateTime(text)
        },
        {
            title: 'Mã Dịch Vụ',
            dataIndex: 'MA_DICH_VU',
            key: 'MA_DICH_VU',
            width: 150,
            onCell: sharedOnCell('MA_DICH_VU'),
            render: (text) => <span className="font-mono text-slate-700">{renderValue(text)}</span>,
        },
        {
            title: 'Tên Dịch Vụ',
            dataIndex: 'TEN_DICH_VU',
            key: 'TEN_DICH_VU',
            width: 250,
            onCell: sharedOnCell('TEN_DICH_VU'),
            render: (text) => (
                <Tooltip title={renderValue(text)}>
                    <div className="truncate">{renderValue(text)}</div>
                </Tooltip>
            )
        },
    ];

    const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

    const handleRowClick = (record: any) => {
        // Row click now only selects row, doesn't copy JSON
        setSelectedRowKey(record.__key);
    };

    const handleCheckDuplicate = () => {
        const mapYL: Record<string, any[]> = {};
        const mapKQ: Record<string, any[]> = {};

        // 0. Filter input data if filter is active
        let inputData = data;
        if (tyleDVFilter) {
            inputData = inputData.filter(item => String(item.TYLE_TT_DV) === tyleDVFilter);
        }
        // Also apply search text if desired, but user asked specifically for TYLE_TT_DV.
        // Let's assume WYSIWYG (What You See Is What You Get) -> if searchText is active, maybe we should respect it?
        // But duplicates search is complex. Let's stick to the requested filter for now or combine "filteredData" roughly?
        // Actually, using the logic "filter theo TYLE_TT_DV" specifically requested.

        // 1. Group by keys
        inputData.forEach(item => {
            const maGiuong = String(item.MA_GIUONG || '').trim();
            const maDichVu = String(item.MA_DICH_VU || '').trim();
            const maKhoa = String(item.MA_KHOA || '').trim();

            const rawDate = String(item.NGAY_YL || '');
            const dateHour = rawDate.length >= 10 ? rawDate.substring(0, 10) : rawDate;
            const keyYL = `${maKhoa}_${maGiuong}_${maDichVu}_${dateHour}`;
            if (!mapYL[keyYL]) mapYL[keyYL] = [];
            mapYL[keyYL].push(item);

            const rawDateKQ = String(item.NGAY_KQ || '');
            const dateKQHour = rawDateKQ.length >= 10 ? rawDateKQ.substring(0, 10) : rawDateKQ;
            const keyKQ = `${maKhoa}_${maGiuong}_${maDichVu}_${dateKQHour}`;
            if (!mapKQ[keyKQ]) mapKQ[keyKQ] = [];
            mapKQ[keyKQ].push(item);
        });

        // 2. Build Adjacency Graph
        // Nodes: item.__key
        // Edges: if in same group
        const adj: Record<string, string[]> = {};
        const allItemsMap: Record<string, any> = {};

        const addEdge = (u: string, v: string) => {
            if (!adj[u]) adj[u] = [];
            if (!adj[v]) adj[v] = [];
            adj[u].push(v);
            adj[v].push(u);
        };

        // Process YL Groups
        Object.values(mapYL).forEach(group => {
            if (group.length < 2) return;
            for (let i = 0; i < group.length; i++) {
                allItemsMap[group[i].__key] = group[i];
                if (!adj[group[i].__key]) adj[group[i].__key] = []; // Ensure node exists
                for (let j = i + 1; j < group.length; j++) {
                    addEdge(group[i].__key, group[j].__key);
                }
            }
        });

        // Process KQ Groups
        Object.values(mapKQ).forEach(group => {
            if (group.length < 2) return;
            for (let i = 0; i < group.length; i++) {
                allItemsMap[group[i].__key] = group[i];
                if (!adj[group[i].__key]) adj[group[i].__key] = [];
                for (let j = i + 1; j < group.length; j++) {
                    addEdge(group[i].__key, group[j].__key);
                }
            }
        });

        // 3. Find Connected Components
        const visited = new Set<string>();
        const duplicates: any[] = [];
        let groupIndex = 0;

        Object.keys(adj).forEach(key => {
            if (visited.has(key)) return;

            const component: string[] = [];
            const queue = [key];
            visited.add(key);

            while (queue.length > 0) {
                const u = queue.shift()!;
                component.push(u);

                const neighbors = adj[u] || [];
                for (const v of neighbors) {
                    if (!visited.has(v)) {
                        visited.add(v);
                        queue.push(v);
                    }
                }
            }

            if (component.length > 0) {
                component.forEach(k => {
                    const item = allItemsMap[k];
                    duplicates.push({ ...item, __groupIndex: groupIndex });
                });
                groupIndex++;
            }
        });

        duplicates.sort((a, b) => {
            if (a.__groupIndex !== b.__groupIndex) {
                return (a.__groupIndex || 0) - (b.__groupIndex || 0);
            }
            return String(a.MA_LK).localeCompare(String(b.MA_LK));
        });

        setFilteredData(duplicates);

        if (duplicates.length > 0) {
            message.warning(`Tìm thấy ${duplicates.length} bản ghi trùng (theo nhóm)!`);
        } else {
            message.info("Không tìm thấy bản ghi nào trùng giường.");
        }
    };

    const handleExportExcel = async () => {
        if (filteredData.length === 0) {
            message.warning("Không có dữ liệu để xuất!");
            return;
        }

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("TrungGiuongNhom15");

        ws.columns = [
            { header: 'STT', key: 'STT', width: 5 },
            { header: 'Mã LK', key: 'MA_LK', width: 15 },
            { header: 'Họ Tên', key: 'HO_TEN', width: 25 },
            { header: 'Mã Khoa', key: 'MA_KHOA', width: 10 },
            { header: 'Tên Khoa', key: 'TEN_KHOA', width: 20 },
            { header: 'Mã Giường', key: 'MA_GIUONG', width: 15 },
            { header: 'Tỷ lệ BH', key: 'TYLE_TT_BH', width: 10 },
            { header: 'Tỷ lệ DV', key: 'TYLE_TT_DV', width: 10 },
            { header: 'Ngày YL', key: 'NGAY_YL', width: 18 },
            { header: 'Ngày KQ', key: 'NGAY_KQ', width: 18 },
            { header: 'Mã DV', key: 'MA_DICH_VU', width: 15 },
            { header: 'Tên DV', key: 'TEN_DICH_VU', width: 30 },
        ];

        filteredData.forEach((item, index) => {
            const row = ws.addRow({
                STT: index + 1,
                MA_LK: renderValue(item.MA_LK),
                HO_TEN: renderValue(item.HO_TEN),
                MA_KHOA: renderValue(item.MA_KHOA),
                TEN_KHOA: departments[renderValue(item.MA_KHOA)] || '',
                MA_GIUONG: renderValue(item.MA_GIUONG),
                TYLE_TT_BH: renderValue(item.TYLE_TT_BH),
                TYLE_TT_DV: renderValue(item.TYLE_TT_DV),
                NGAY_YL: formatDateTime(item.NGAY_YL),
                NGAY_KQ: formatDateTime(item.NGAY_KQ),
                MA_DICH_VU: renderValue(item.MA_DICH_VU),
                TEN_DICH_VU: renderValue(item.TEN_DICH_VU),
            });

            if (item.__groupIndex !== undefined) {
                const colorObj = COLOR_PALETTE[item.__groupIndex % COLOR_PALETTE.length];
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: colorObj.argb }
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                    };
                });
            }
        });

        // Header style
        ws.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF0F0F0' }
            };
        });

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), `TrungGiuong_Nhom15_${new Date().toISOString().substring(0, 10)}.xlsx`);
    };

    return (
        <div className="space-y-6 p-6 max-w-[98%] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <Breadcrumb
                        items={[
                            { title: 'Kiểm tra chuyên đề' },
                            { title: <a href="/kiem-tra-chuyen-de/xml3">XML3</a> },
                            { title: 'Nhóm 15 (Giường)' },
                        ]}
                        className="mb-2"
                    />
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <AuditOutlined className="text-blue-500" />
                        Trùng Giường (Nhóm 15)
                    </h1>
                    <p className="text-slate-500 font-medium">Danh sách các dịch vụ thuộc nhóm 15 và kiểm tra trùng lặp</p>
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
                    <Select
                        placeholder="Tỷ lệ DV"
                        style={{ width: 120 }}
                        allowClear
                        value={tyleDVFilter}
                        onChange={setTyleDVFilter}
                        options={[...new Set(data.map(item => String(item.TYLE_TT_DV || '')))].filter(Boolean).sort((a, b) => Number(b) - Number(a)).map(val => ({ label: `${val}%`, value: val }))}
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={loadData}
                        loading={loading}
                    >
                        Tải lại
                    </Button>
                    <Button
                        icon={<FileExcelOutlined />}
                        onClick={handleExportExcel}
                        className="bg-green-600 hover:bg-green-500 text-white border-none"
                    >
                        Xuất Excel
                    </Button>
                    <Button
                        type="primary"
                        danger
                        onClick={handleCheckDuplicate}
                    >
                        Quét Trùng Lặp
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm border-slate-200 rounded-2xl overflow-hidden" styles={{ body: { padding: 0 } }}>
                <Table
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="__key"
                    loading={loading}
                    scroll={{ x: 1200, y: 'calc(100vh - 280px)' }}
                    pagination={{
                        defaultPageSize: 20,
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50', '100', '500'],
                        showTotal: (total) => `Tổng ${total} dòng`
                    }}
                    size="middle"
                    bordered
                    onRow={(record) => {
                        let style: React.CSSProperties = { cursor: 'pointer' };
                        if (record.__key === selectedRowKey) {
                            style.backgroundColor = '#e6f7ff';
                        } else if (record.__groupIndex !== undefined) {
                            const colorObj = COLOR_PALETTE[record.__groupIndex % COLOR_PALETTE.length];
                            style.backgroundColor = colorObj.css;
                        }
                        return {
                            onClick: () => handleRowClick(record),
                            style: style,
                            title: 'Click chuột trái để copy dữ liệu dòng'
                        };
                    }}
                    rowClassName={(record) => ''}
                />
            </Card>
        </div>
    );
}

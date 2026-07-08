'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Spin, Tag, Empty, Input } from 'antd';
import { DownloadOutlined, AuditOutlined, SearchOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';

const COLOR_PALETTE = [
    { argb: 'FFFFCCCC', css: '#ffcccc' }, // Red
    { argb: 'FFCCE5FF', css: '#cce5ff' }, // Blue
    { argb: 'FFCCFFCC', css: '#ccffcc' }, // Green
    { argb: 'FFFFFFCC', css: '#ffffcc' }, // Yellow
    { argb: 'FFE5CCFF', css: '#e5ccff' }, // Purple
    { argb: 'FFFFE5CC', css: '#ffe5cc' }, // Orange
];

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

export default function DuplicatesPage() {
    const [loading, setLoading] = useState(true);
    const [headers, setHeaders] = useState<string[]>([]);
    const [dups, setDups] = useState<any[]>([]);
    const [colWidths, setColWidths] = useState<Record<number, number>>({});
    const [searchText, setSearchText] = useState('');

    const filteredDups = React.useMemo(() => {
        if (!searchText) return dups;
        const lowercasedFilter = searchText.toLowerCase();
        
        const matchingGroupIndices = new Set<number>();
        const matchingIndividualKeys = new Set<any>();
        
        dups.forEach((item, index) => {
            const isMatch = Object.keys(item).some(key => {
                if (key === '__groupIndex' || key === 'key') return false;
                const value = item[key];
                if (value === null || value === undefined) return false;
                return String(value).toLowerCase().includes(lowercasedFilter);
            });
            
            if (isMatch) {
                if (item.__groupIndex !== undefined) {
                    matchingGroupIndices.add(item.__groupIndex);
                } else {
                    matchingIndividualKeys.add(item.key !== undefined ? item.key : index);
                }
            }
        });

        return dups.filter((item, index) => {
            if (item.__groupIndex !== undefined) {
                return matchingGroupIndices.has(item.__groupIndex);
            }
            return matchingIndividualKeys.has(item.key !== undefined ? item.key : index);
        });
    }, [dups, searchText]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const { openDB } = await import('idb');
                const db = await openDB('ExcelReaderDB', 2);
                const data = await db.get('files', 'currentDuplicates');
                
                if (data) {
                    setHeaders(data.headers || []);
                    setDups(data.dups || []);
                }
            } catch (err) {
                console.error("Failed to load duplicates from DB", err);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, []);

    const handleExportDuplicates = async () => {
        if (filteredDups.length === 0) return;

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Du Lieu Trung");

        const headerRow = ws.addRow(headers);
        headerRow.font = { bold: true };

        filteredDups.forEach(item => {
            const rowVals: any[] = [];
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

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
                <Spin size="large" />
                <span className="text-slate-500 font-medium">Đang tải dữ liệu...</span>
            </div>
        );
    }

    if (dups.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Empty description="Không có dữ liệu trùng lặp hoặc phiên làm việc đã hết hạn. Vui lòng quay lại trang phân tích Excel và thử lại." />
            </div>
        );
    }

    const handleResize = (index: number) => (e: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
        setColWidths(prev => ({
            ...prev,
            [index]: size.width,
        }));
    };

    const tableColumns = headers.map((header, index) => {
        const width = colWidths[index] || 150;
        return {
            title: <span className="font-bold">{header || `Column ${index + 1}`}</span>,
            dataIndex: index,
            key: index,
            width: width,
            ellipsis: true,
            onHeaderCell: () => ({
                width: width,
                onResize: handleResize(index),
            }),
            render: (text: any) => {
                let stringValue = '';
                if (text instanceof Date) {
                    stringValue = text.toLocaleString('vi-VN');
                } else {
                    stringValue = String(text ?? '');
                }

                if (!searchText) {
                    return <span className="text-slate-700">{stringValue}</span>;
                }

                const escapeRegExp = (string: string) => {
                    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                };

                const parts = stringValue.split(new RegExp(`(${escapeRegExp(searchText)})`, 'gi'));

                return (
                    <span className="text-slate-700">
                        {parts.map((part, i) =>
                            part.toLowerCase() === searchText.toLowerCase() ? (
                                <mark key={i} className="bg-yellow-300 p-0 text-slate-900 font-medium">{part}</mark>
                            ) : (
                                part
                            )
                        )}
                    </span>
                );
            }
        };
    });

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm z-10 shrink-0 gap-4">
                <div className="flex items-center gap-3 shrink-0">
                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                        <AuditOutlined className="text-xl" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 m-0">Danh sách Dữ liệu Trùng lặp</h1>
                        <p className="text-sm text-slate-500 m-0">Được nhóm theo màu sắc giống như file xuất Excel</p>
                    </div>
                    <Tag color="purple" className="ml-4 text-base px-3 py-1">{filteredDups.length} bản ghi</Tag>
                </div>
                
                <div className="flex-1 max-w-md">
                    <Input
                        placeholder="Tìm kiếm trong dữ liệu..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        suffix={searchText ? <span className="text-slate-400 text-sm">{filteredDups.length} kết quả</span> : null}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        size="large"
                    />
                </div>

                <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportDuplicates} className="bg-green-600 shrink-0" size="large">
                    Xuất file Excel này
                </Button>
            </div>
            
            <div className="flex-1 overflow-hidden p-4">
                <div className="h-full bg-white rounded-lg shadow-sm border overflow-hidden custom-scrollbar-table">
                    <Table
                        components={{
                            header: {
                                cell: ResizableTitle,
                            },
                        }}
                        columns={tableColumns}
                        dataSource={filteredDups}
                        scroll={{ x: Object.values(colWidths).reduce((a, b) => a + b, 0) || tableColumns.length * 150, y: 800 }}
                        pagination={false}
                        virtual
                        bordered
                        size="small"
                        onRow={(record) => {
                            if (record.__groupIndex !== undefined) {
                                const colorObj = COLOR_PALETTE[record.__groupIndex % COLOR_PALETTE.length];
                                return { style: { backgroundColor: colorObj.css } };
                            }
                            return {};
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

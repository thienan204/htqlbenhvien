'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Spin, Tag, Empty, Input, Modal, Checkbox, Select, Tooltip } from 'antd';
import { DownloadOutlined, AuditOutlined, SearchOutlined, SettingOutlined, MenuOutlined, SaveOutlined } from '@ant-design/icons';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Resizable } from 'react-resizable';
import type { ResizeCallbackData } from 'react-resizable';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
};

const getAcronym = (str: string) => {
    if (!str) return '';
    const cleanStr = removeAccents(str);
    return cleanStr.split(/\s+/).map(word => word.charAt(0)).join('').toLowerCase();
};

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
    if (!width) return <th {...restProps} />;
    return (
        <Resizable
            width={width}
            height={0}
            handle={<span className="react-resizable-handle" onClick={(e) => e.stopPropagation()} />}
            onResize={onResize}
            draggableOpts={{ enableUserSelectHack: false }}
        >
            <th {...restProps} />
        </Resizable>
    );
};

const SortableItem = ({ id, name, checked, alias, onChange, onAliasChange }: { id: string, name: string, checked: boolean, alias?: string, onChange: (c: boolean) => void, onAliasChange: (a: string) => void }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-3 p-3 bg-white border rounded mb-2 shadow-sm group">
            <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-blue-500 p-1">
                <MenuOutlined />
            </div>
            <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} className="mr-2" />
            <Input 
                value={alias || name} 
                onChange={e => onAliasChange(e.target.value)} 
                variant="borderless"
                style={{ padding: 0, fontWeight: 500, color: '#334155' }}
                className="flex-1"
            />
        </div>
    );
};

interface ColConfig {
    name: string;
    visible: boolean;
    alias?: string;
}

interface OverlapExcelDuplicatesProps {
    ruleType: string;
    pageTitle?: string;
}

export default function OverlapExcelDuplicates({ ruleType, pageTitle = 'Danh sách Dữ liệu Trùng lặp' }: OverlapExcelDuplicatesProps) {
    const [loading, setLoading] = useState(true);
    const [headers, setHeaders] = useState<string[]>([]);
    const [dups, setDups] = useState<any[]>([]);
    const [colWidths, setColWidths] = useState<Record<number, number>>({});
    const [searchText, setSearchText] = useState('');
    const [selectedRules, setSelectedRules] = useState<string[]>([]);
    
    // Config states
    const [colConfigs, setColConfigs] = useState<ColConfig[]>([]);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [violationColName, setViolationColName] = useState('Quy tắc vi phạm');
    const [loadingConfig, setLoadingConfig] = useState(false);

    const uniqueRules = React.useMemo(() => {
        const rules = new Set<string>();
        dups.forEach(item => {
            if (item._violations) {
                if (Array.isArray(item._violations)) {
                    item._violations.forEach((v: string) => rules.add(v));
                } else if (typeof item._violations === 'string') {
                    rules.add(item._violations);
                }
            }
        });
        return Array.from(rules);
    }, [dups]);

    const filteredDups = React.useMemo(() => {
        if (!searchText && selectedRules.length === 0) return dups;
        
        const lowercasedFilter = searchText.toLowerCase();
        const matchingGroupIndices = new Set<number>();
        const matchingIndividualKeys = new Set<any>();
        
        dups.forEach((item, index) => {
            let textMatch = true;
            if (searchText) {
                textMatch = Object.keys(item).some(key => {
                    if (key === '__groupIndex' || key === 'key') return false;
                    const value = item[key];
                    if (value === null || value === undefined) return false;
                    
                    const stringValue = String(value);
                    const lowerValue = stringValue.toLowerCase();
                    const noAccentValue = removeAccents(lowerValue);
                    const acronym = getAcronym(stringValue);

                    return lowerValue.includes(lowercasedFilter) || 
                           noAccentValue.includes(lowercasedFilter) ||
                           acronym.includes(lowercasedFilter);
                });
            }

            let ruleMatch = true;
            if (selectedRules.length > 0) {
                const itemRules = Array.isArray(item._violations) ? item._violations : (item._violations ? [item._violations] : []);
                ruleMatch = selectedRules.some(r => itemRules.includes(r));
            }
            
            const isMatch = textMatch && ruleMatch;
            if (isMatch) {
                if (item.__groupIndex !== undefined) matchingGroupIndices.add(item.__groupIndex);
                else matchingIndividualKeys.add(item.key !== undefined ? item.key : index);
            }
        });

        return dups.filter((item, index) => {
            if (item.__groupIndex !== undefined) return matchingGroupIndices.has(item.__groupIndex);
            return matchingIndividualKeys.has(item.key !== undefined ? item.key : index);
        });
    }, [dups, searchText, selectedRules]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const { openDB } = await import('idb');
                const db = await openDB(`OverlapCheckerDB_${ruleType}`, 3);
                const data = await db.get('files', 'currentDuplicates');
                
                if (data && data.headers) {
                    setHeaders(data.headers);
                    setDups(data.dups || []);
                    
                    try {
                        const res = await fetch('/api/pttt-excel/config');
                        if (res.ok) {
                            const configData = await res.json();
                            if (configData.violationColName) {
                                setViolationColName(configData.violationColName);
                            }
                            const savedColConfigs = configData.colConfigs || [];
                            
                            const actualHeaderNames = new Set(data.headers);
                            const finalConfig: ColConfig[] = [];
                            
                            savedColConfigs.forEach((c: ColConfig) => {
                                if (actualHeaderNames.has(c.name)) {
                                    finalConfig.push(c);
                                    actualHeaderNames.delete(c.name);
                                }
                            });
                            Array.from(actualHeaderNames).forEach(h => {
                                finalConfig.push({ name: String(h), visible: true, alias: String(h) });
                            });
                            setColConfigs(finalConfig);
                        } else {
                            setColConfigs(data.headers.map((h: string) => ({ name: h, visible: true, alias: h })));
                        }
                    } catch (e) {
                        console.error(e);
                        setColConfigs(data.headers.map((h: string) => ({ name: h, visible: true, alias: h })));
                    }
                }
            } catch (err) {
                console.error("Failed to load duplicates from DB", err);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setColConfigs((items) => {
                const oldIndex = items.findIndex(i => i.name === active.id);
                const newIndex = items.findIndex(i => i.name === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleToggleCol = (name: string, visible: boolean) => {
        setColConfigs(prev => prev.map(c => c.name === name ? { ...c, visible } : c));
    };

    const saveConfigToServer = async () => {
        setLoadingConfig(true);
        try {
            await fetch('/api/pttt-excel/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    colConfigs,
                    violationColName
                })
            });
            setIsConfigOpen(false);
        } catch (error) {
            console.error("Failed to save config", error);
        } finally {
            setLoadingConfig(false);
        }
    };

    const handleExportDuplicates = async () => {
        if (filteredDups.length === 0) return;

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Du Lieu Trung");

        const visibleCols = colConfigs.filter(c => c.visible);
        const orderedOriginalIndices = visibleCols.map(c => headers.indexOf(c.name));

        const exportHeaders = ['STT', violationColName, 'Khoảng thời gian trùng', ...visibleCols.map(c => c.alias || c.name)];
        const headerRow = ws.addRow(exportHeaders);
        headerRow.font = { bold: true };

        filteredDups.forEach((item, index) => {
            const rowVals: any[] = [
                index + 1,
                (item._violations || []).join('\n'),
                (item._overlapTimes || []).join('\n')
            ];
            orderedOriginalIndices.forEach((originalIndex) => {
                let val = item[originalIndex];
                if (typeof val === 'number' && val > 999999999) {
                    val = String(val);
                }
                rowVals.push(val);
            });
            const r = ws.addRow(rowVals);

            if (item.__groupIndex !== undefined) {
                const colorObj = COLOR_PALETTE[item.__groupIndex % COLOR_PALETTE.length];
                r.eachCell({ includeEmpty: true }, (cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorObj.argb } };
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            }
        });

        // Auto-fit columns
        const colCount = exportHeaders.length;
        for (let i = 1; i <= colCount; i++) {
            const col = ws.getColumn(i);
            let maxLength = 0;
            col.eachCell({ includeEmpty: true }, (cell) => {
                cell.alignment = { vertical: 'middle', wrapText: true };
                const text = cell.value ? cell.value.toString() : '';
                const lines = text.split('\n');
                lines.forEach(line => {
                    if (line.length > maxLength) maxLength = line.length;
                });
            });
            col.width = Math.min(Math.max(maxLength + 2, 12), 80);
        }

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf]), `PTTT_DuLieuTrung_${new Date().toISOString().substring(0, 10)}.xlsx`);
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
        setColWidths(prev => ({ ...prev, [index]: size.width }));
    };

    const visibleCols = colConfigs.filter(c => c.visible);
    const orderedOriginalIndices = visibleCols.map(c => headers.indexOf(c.name));

    const maxRuleWidth = 140;
    const maxTimeWidth = filteredDups.length === 0 ? 200 : Math.max(180, Math.min(600, Math.max(...filteredDups.map(item => {
        const times = Array.isArray(item._overlapTimes) ? item._overlapTimes : (item._overlapTimes ? [item._overlapTimes] : []);
        return times.length === 0 ? 0 : Math.max(...times.map((t: string) => t.length * 5.8 + 32));
    }))));

    const tableColumns = [
        {
            title: <span className="font-bold text-center">STT</span>,
            dataIndex: 'stt',
            key: 'stt',
            width: 60,
            fixed: 'left' as const,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => <span className="font-medium text-slate-500">{index + 1}</span>
        },
        {
            title: <span className="font-bold">{violationColName}</span>,
            dataIndex: '_violations',
            key: '_violations',
            width: maxRuleWidth,
            fixed: 'left' as const,
            align: 'center' as const,
            render: (violations: any) => {
                const arr = Array.isArray(violations) ? violations : (violations ? [violations] : []);
                return arr.length > 0 ? (
                    <Tooltip title={
                        <div className="flex flex-col gap-1 p-1 max-w-sm">
                            <strong className="text-white mb-1">Các quy tắc vi phạm:</strong>
                            {arr.map((v: string, i: number) => (
                                <Tag color="error" key={i} className="whitespace-normal mb-1">{v}</Tag>
                            ))}
                        </div>
                    } color="#1e293b" placement="right">
                        <Tag color="red" className="m-0 cursor-help font-medium">
                            <AuditOutlined className="mr-1" /> {arr.length} Quy tắc
                        </Tag>
                    </Tooltip>
                ) : null;
            }
        },
        {
            title: <span className="font-bold">Khoảng thời gian trùng</span>,
            dataIndex: '_overlapTimes',
            key: '_overlapTimes',
            width: maxTimeWidth,
            fixed: 'left' as const,
            render: (times: string[]) => {
                const arr = Array.isArray(times) ? times : (times ? [times] : []);
                return arr.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        {arr.map((t: string, i: number) => <Tag color="orange" key={i} className="whitespace-normal mb-1 font-medium">{t}</Tag>)}
                    </div>
                ) : null;
            }
        },
        ...orderedOriginalIndices.map((originalIndex) => {
            const header = headers[originalIndex];
            const config = visibleCols.find(c => c.name === header);
            const alias = config?.alias || header;
            const width = colWidths[originalIndex] || 150;
            return {
                title: <span className="font-bold">{alias || `Column ${originalIndex + 1}`}</span>,
                dataIndex: originalIndex,
                key: originalIndex,
                width: width,
                ellipsis: true,
                onHeaderCell: () => ({ width: width, onResize: handleResize(originalIndex) }),
                render: (text: any) => {
                    let stringValue = '';
                    if (text instanceof Date) stringValue = text.toLocaleString('vi-VN');
                    else stringValue = String(text ?? '');

                    if (!searchText) return <span className="text-slate-700">{stringValue}</span>;

                    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const parts = stringValue.split(new RegExp(`(${escapeRegExp(searchText)})`, 'gi'));

                    return (
                        <span className="text-slate-700">
                            {parts.map((part, i) =>
                                part.toLowerCase() === searchText.toLowerCase() ? (
                                    <mark key={i} className="bg-yellow-300 p-0 text-slate-900 font-medium">{part}</mark>
                                ) : part
                            )}
                        </span>
                    );
                }
            };
        })
    ];


    return (
        <div className="flex flex-col h-screen bg-slate-50">
            <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm z-10 shrink-0 gap-4">
                <div className="flex items-center gap-3 shrink-0">
                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                        <AuditOutlined className="text-xl" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 m-0">{pageTitle}</h1>
                        <p className="text-sm text-slate-500 m-0">Được nhóm theo màu sắc giống như file xuất Excel</p>
                    </div>
                    <Tag color="purple" className="ml-4 text-base px-3 py-1">{filteredDups.length} bản ghi</Tag>
                </div>
                
                <div className="flex-1 max-w-2xl flex gap-2">
                    {uniqueRules.length > 0 && (
                        <Select
                            mode="multiple"
                            allowClear
                            placeholder="Lọc quy tắc..."
                            value={selectedRules}
                            onChange={setSelectedRules}
                            style={{ minWidth: 250 }}
                            maxTagCount="responsive"
                            options={uniqueRules.map(r => ({ label: r, value: r }))}
                            size="large"
                        />
                    )}
                    <Input
                        placeholder="Tìm kiếm trong dữ liệu..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        suffix={(searchText || selectedRules.length > 0) ? <span className="text-slate-400 text-sm">{filteredDups.length} kết quả</span> : null}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        size="large"
                        className="flex-1"
                    />
                </div>

                <div className="flex gap-2 shrink-0">
                    <Button icon={<SettingOutlined />} onClick={() => setIsConfigOpen(true)} size="large">
                        Cấu hình cột ({visibleCols.length}/{colConfigs.length})
                    </Button>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportDuplicates} className="bg-green-600 shrink-0" size="large">
                        Xuất file Excel này
                    </Button>
                </div>
            </div>
            
            <div className="flex-1 overflow-hidden p-4">
                <div className="h-full bg-white rounded-lg shadow-sm border overflow-hidden custom-scrollbar-table">
                    <style>{`
                        .ant-table-cell-fix-left,
                        .ant-table-cell-fix-right {
                            background-color: inherit !important;
                        }
                    `}</style>
                    <Table
                        components={{ header: { cell: ResizableTitle } }}
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

            <Modal
                title="Cấu hình hiển thị cột (PTTT)"
                open={isConfigOpen}
                onCancel={() => setIsConfigOpen(false)}
                onOk={saveConfigToServer}
                confirmLoading={loadingConfig}
                okText="Lưu & Áp dụng chung"
                cancelText="Hủy"
                styles={{ body: { maxHeight: '60vh', overflowY: 'auto' } }}
            >
                <div className="mb-4 text-sm text-slate-500">
                    Tích chọn để hiển thị cột. Bạn có thể nhấn vào tên cột để sửa lại tên hiển thị. Kéo thả biểu tượng <MenuOutlined /> để đổi thứ tự. Cấu hình sẽ được lưu dùng chung cho tất cả máy tính.
                </div>
                
                <div className="mb-6 p-4 border rounded bg-slate-50 shadow-sm">
                    <div className="font-medium text-slate-700 mb-2">Đổi tên cột Cố định:</div>
                    <Input 
                        value={violationColName} 
                        onChange={e => setViolationColName(e.target.value)} 
                        prefix={<span className="text-slate-400 font-bold mr-2">Quy tắc vi phạm → </span>}
                    />
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={colConfigs.map(c => c.name)} strategy={verticalListSortingStrategy}>
                        {colConfigs.map(c => (
                            <SortableItem 
                                key={c.name} 
                                id={c.name} 
                                name={c.name} 
                                checked={c.visible} 
                                alias={c.alias}
                                onChange={(visible) => handleToggleCol(c.name, visible)} 
                                onAliasChange={(alias) => setColConfigs(prev => prev.map(p => p.name === c.name ? { ...p, alias } : p))}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </Modal>
        </div>
    );
}

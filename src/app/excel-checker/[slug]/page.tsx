'use client';

import React, { useState, useEffect } from 'react';
import { Card, Upload, message, Table, Typography, Tag, Select, Row, Col, Button } from 'antd';
import { InboxOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { getBasePath } from '@/utils/config';
import { ExcelTemplate, executeRules, RowResult, EngineContext } from '@/lib/excel-rule-engine';
import { useAuth } from '@/contexts/AuthContext';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function ExcelCheckerPage({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = React.use(params);
    const slug = resolvedParams.slug;
    const { user } = useAuth();

    const [template, setTemplate] = useState<ExcelTemplate | null>(null);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    
    // Results filter
    const [filterRule, setFilterRule] = useState<string>('ERRORS_ONLY');
    
    // Custom context per rule
    const [ruleFilters, setRuleFilters] = useState<Record<string, { allowed: string[], excluded: string[] }>>({});
    
    // Results
    const [parsedItems, setParsedItems] = useState<any[]>([]);
    const [results, setResults] = useState<RowResult[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);

    useEffect(() => {
        fetchTemplate();
    }, [slug]);

    const fetchTemplate = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/excel-templates/${slug}`);
            if (res.ok) {
                const data = await res.json();
                setTemplate(data);
                
                // Try to load saved custom filters for this template from localStorage
                const savedFilters = localStorage.getItem(`excel_filters_${data.id}`);
                if (savedFilters) {
                    try {
                        const parsed = JSON.parse(savedFilters);
                        // Check if it's the new format (not having .allowed at the root)
                        if (!parsed.allowed && !parsed.excluded) {
                             setRuleFilters(parsed);
                        }
                    } catch(e) {}
                }
            } else {
                message.error('Không tìm thấy kịch bản kiểm tra này.');
            }
        } catch (error) {
            message.error('Lỗi kết nối.');
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (ruleId: string, type: 'allowed' | 'excluded', values: string[]) => {
        setRuleFilters(prev => {
            const updated = { ...prev };
            if (!updated[ruleId]) updated[ruleId] = { allowed: [], excluded: [] };
            updated[ruleId][type] = values;
            
            // Save to localStorage for next time
            if (template) {
                localStorage.setItem(`excel_filters_${template.id}`, JSON.stringify(updated));
            }
            return updated;
        });
    };

    const handleFileUpload = (file: File) => {
        if (!template) return false;
        setChecking(true);
        setResults([]);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // Convert to JSON array
                const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
                
                if (rawData.length < 2) {
                    message.error('File không có dữ liệu');
                    setChecking(false);
                    return;
                }

                const fileHeaders = rawData[0].map(h => String(h).trim());
                setHeaders(fileHeaders);

                // Convert rows to objects based on headers
                const items = [];
                for (let i = 1; i < rawData.length; i++) {
                    const rowArray = rawData[i];
                    // Skip completely empty rows
                    if (!rowArray || rowArray.length === 0 || rowArray.every(c => c === null || c === undefined || c === '')) continue;
                    
                    const rowObj: any = {};
                    for (let j = 0; j < fileHeaders.length; j++) {
                        rowObj[fileHeaders[j]] = rowArray[j];
                    }
                    items.push(rowObj);
                }

                setParsedItems(items);
                runCheck(fileHeaders, items);

            } catch (error) {
                console.error(error);
                message.error('Lỗi khi đọc hoặc phân tích file.');
                setChecking(false);
            }
        };
        reader.readAsArrayBuffer(file);
        return false; // Prevent auto upload
    };

    const runCheck = (fileHeaders: string[], itemsToCheck: any[]) => {
        if (!template || itemsToCheck.length === 0) return;
        setChecking(true);
        
        // Use setTimeout to allow UI to update loading state
        setTimeout(() => {
            const context: EngineContext = {
                customRuleFilters: ruleFilters,
                departmentCode: user?.ma_khoa
            };
            
            const finalResults = executeRules(fileHeaders, itemsToCheck, template, context);
            setResults(finalResults);
            
            const violationCount = finalResults.filter(r => r._violations.length > 0).length;
            if (violationCount > 0) {
                message.warning(`Phát hiện ${violationCount} dòng vi phạm quy tắc!`);
            } else {
                message.success('Kiểm tra hoàn tất. Không phát hiện lỗi nào!');
            }
            setChecking(false);
        }, 50);
    };

    const exportToExcel = () => {
        if (results.length === 0) return;
        
        // Filter only rows with violations for the export, or all? Let's export all but sorted, or just violations
        const violationsOnly = results.filter(r => r._violations.length > 0);
        const dataToExport = violationsOnly.length > 0 ? violationsOnly : results;

        const wsData = dataToExport.map(row => {
            const out: any = {
                'Quy tắc Vi phạm': row._violations.join(', '),
                'Khoảng T.Gian Trùng': row._overlap_duration || ''
            };
            
            // Add original columns
            headers.forEach(h => {
                out[h] = row[h];
            });
            return out;
        });

        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Ket_Qua");
        
        const fileName = (template?.outputConfig?.exportFileName || 'Danh_sach_kiem_tra') + '.xlsx';
        XLSX.writeFile(wb, fileName);
    };

    if (loading) return <div style={{ padding: 24 }}>Đang tải cấu hình...</div>;
    if (!template) return <div style={{ padding: 24 }}>Không tìm thấy trang.</div>;

    // Build Table Columns
    const tableColumns = [
        {
            title: 'Quy tắc Vi phạm',
            dataIndex: '_violations',
            key: '_violations',
            fixed: 'left' as any,
            render: (v: string[]) => {
                const rulesToShow = (filterRule === 'ALL' || filterRule === 'ERRORS_ONLY') ? v : v.filter(r => r === filterRule);
                return (
                    <>
                        {rulesToShow.map(rule => <Tag color="red" key={rule}>{rule}</Tag>)}
                    </>
                );
            }
        },
        {
            title: 'Khoảng T.Gian Trùng',
            dataIndex: '_overlap_duration',
            key: '_overlap_duration',
            fixed: 'left' as any,
            render: (v: string) => v ? <div style={{ color: '#cf1322' }} dangerouslySetInnerHTML={{ __html: v }} /> : '-'
        },
        ...headers
            .filter(h => !template.outputConfig?.displayColumns || template.outputConfig.displayColumns.length === 0 || template.outputConfig.displayColumns.includes(h))
            .map(h => ({
                title: h,
                dataIndex: h,
                key: h,
                ellipsis: true,
            }))
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>{template.name}</Title>
                    {template.description && <Text type="secondary">{template.description}</Text>}
                </div>
                <div>
                    <Upload
                        accept=".xlsx, .xls"
                        beforeUpload={handleFileUpload}
                        maxCount={1}
                        showUploadList={false}
                    >
                        <Button type="primary" size="large" icon={<UploadOutlined />} loading={checking}>
                            {checking ? 'Đang xử lý...' : 'Tải File Excel Lên'}
                        </Button>
                    </Upload>
                </div>
            </div>

            {/* Service filter UI moved to table header */}

            <Card 
                    title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <span>Phát hiện <strong style={{ color: '#cf1322' }}>{results.filter(r => r._violations.length > 0).length}</strong> vi phạm</span>
                            <Select 
                                value={filterRule} 
                                onChange={setFilterRule} 
                                style={{ width: 250 }}
                            >
                                <Select.Option value="ERRORS_ONLY">Chỉ hiển thị dòng có lỗi</Select.Option>
                                <Select.Option value="ALL">Hiển thị Tất cả dữ liệu (Gốc)</Select.Option>
                                {template.rules?.map(r => (
                                    <Select.Option key={r.ruleName} value={r.ruleName}>Lỗi: {r.ruleName}</Select.Option>
                                ))}
                            </Select>
                            
                            {(() => {
                                if (filterRule === 'ALL' || filterRule === 'ERRORS_ONLY') return null;
                                const currentRule = template.rules?.find(r => r.ruleName === filterRule);
                                if (!currentRule || !currentRule.mapping.serviceCol) return null;
                                
                                return (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Text strong>Chỉ KT mã:</Text>
                                            <Select 
                                                mode="tags" 
                                                style={{ minWidth: 150 }} 
                                                placeholder={`VD: SA01`}
                                                value={ruleFilters[currentRule.id]?.allowed || []}
                                                onChange={(v) => handleFilterChange(currentRule.id, 'allowed', v)}
                                                tokenSeparators={[',']}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Text strong style={{ color: '#cf1322' }}>Bỏ qua mã:</Text>
                                            <Select 
                                                mode="tags" 
                                                style={{ minWidth: 150 }} 
                                                placeholder={`VD: XQ02`}
                                                value={ruleFilters[currentRule.id]?.excluded || []}
                                                onChange={(v) => handleFilterChange(currentRule.id, 'excluded', v)}
                                                tokenSeparators={[',']}
                                            />
                                        </div>
                                    </>
                                );
                            })()}

                            <Button type="primary" loading={checking} onClick={() => runCheck(headers, parsedItems)}>
                                Áp dụng Lọc & Kiểm tra lại
                            </Button>
                        </div>
                    }
                    style={{ marginTop: 16 }}
                    extra={<Button type="primary" icon={<FileExcelOutlined />} onClick={exportToExcel}>Xuất Excel</Button>}
                >
                    <Table 
                        dataSource={
                            filterRule === 'ALL' ? results 
                            : filterRule === 'ERRORS_ONLY' ? results.filter(r => r._violations.length > 0)
                            : results.filter(r => r._violations.includes(filterRule))
                        }
                        columns={tableColumns}
                        rowKey="_uid"
                        scroll={{ x: 'max-content' }}
                        rowClassName={(record) => {
                            if (record._violations.length === 0) return '';
                            if (record._groupId !== undefined) {
                                return `row-group-${record._groupId % 6}`;
                            }
                            return 'row-error'; // Fallback
                        }}
                        pagination={{ pageSize: 50 }}
                    />
                    <style>{`
                        .row-error { background-color: #fff2f0 !important; }
                        .row-group-0 { background-color: #fff2f0 !important; } /* light red */
                        .row-group-1 { background-color: #e6f7ff !important; } /* light blue */
                        .row-group-2 { background-color: #f6ffed !important; } /* light green */
                        .row-group-3 { background-color: #fffbe6 !important; } /* light yellow */
                        .row-group-4 { background-color: #f9f0ff !important; } /* light purple */
                        .row-group-5 { background-color: #e6fffb !important; } /* light cyan */
                    `}</style>
                </Card>
        </div>
    );
}

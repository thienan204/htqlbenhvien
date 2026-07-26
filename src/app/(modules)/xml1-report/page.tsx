'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Table, Tag, Button, Spin, message, Typography } from 'antd';
import { FileTextOutlined, ArrowLeftOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';

function ReportContent() {
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any[]>([]);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            try {
                const idsParam = searchParams.get('ids');
                let payload: any = {};
                
                if (idsParam) {
                    payload.ids = idsParam.split(',');
                } else {
                    payload.filters = {
                        search: searchParams.get('search') || '',
                        fromDate: searchParams.get('fromDate') || '',
                        toDate: searchParams.get('toDate') || '',
                        errorStatus: searchParams.get('errorStatus') || 'ALL'
                    };
                }

                const res = await fetch('/api/xml1/report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const json = await res.json();
                if (json.success) {
                    setReportData(json.data.map((item: any, index: number) => ({ ...item, _key: `${item.ma_lk}_${index}` })));
                } else {
                    message.error('Lỗi lấy báo cáo: ' + json.error);
                }
            } catch (error) {
                message.error('Lỗi kết nối khi tải báo cáo');
            } finally {
                setLoading(false);
            }
        };

        fetchReport();
    }, [searchParams]);

    const formatXmlDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const str = dateStr.toString().trim();
        if (str.length === 12) {
            return `${str.substring(6,8)}/${str.substring(4,6)}/${str.substring(0,4)} ${str.substring(8,10)}:${str.substring(10,12)}`;
        }
        if (str.length === 8) {
            return `${str.substring(6,8)}/${str.substring(4,6)}/${str.substring(0,4)}`;
        }
        return str;
    };

    const handleExportExcel = () => {
        if (reportData.length === 0) {
            message.warning('Không có dữ liệu để xuất!');
            return;
        }

        const exportData = reportData.map((row, index) => ({
            'STT': index + 1,
            'MÃ LK': row.ma_lk,
            'MÃ BỆNH NHÂN': row.ma_bn,
            'HỌ TÊN': row.ho_ten,
            'NGÀY VÀO': formatXmlDate(row.ngay_vao),
            'NGÀY RA': formatXmlDate(row.ngay_ra),
            'NGÀY Y LỆNH': formatXmlDate(row.ngay_yl),
            'NGÀY THỰC HIỆN YL': formatXmlDate(row.ngay_th_yl),
            'NGÀY KẾT QUẢ': formatXmlDate(row.ngay_kq),
            'LOẠI XML': row.xmlType,
            'MÃ LỖI': row.ruleCode,
            'TÊN LỖI': row.ruleName,
            'MÔ TẢ CHI TIẾT': row.description,
            'TRƯỜNG DỮ LIỆU': row.field || '',
            'DÒNG': row.index !== undefined ? row.index + 1 : ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bao_Cao_Loi");
        
        // Auto-size columns
        const wscols = [
            {wch: 5}, {wch: 15}, {wch: 15}, {wch: 25}, 
            {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15}, {wch: 15},
            {wch: 10}, {wch: 15}, {wch: 35}, {wch: 50}, {wch: 20}, {wch: 10}
        ];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `Bao_Cao_Loi_${new Date().getTime()}.xlsx`);
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="max-w-screen-2xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div className="flex items-center text-blue-700">
                        <FileTextOutlined className="mr-3 text-3xl" />
                        <div>
                            <Typography.Title level={4} style={{ margin: 0, color: '#1d4ed8' }}>
                                BÁO CÁO CHI TIẾT LỖI CẢNH BÁO
                            </Typography.Title>
                            <div className="text-slate-500 mt-1 flex items-center">
                                Tổng cộng: <Tag color="red" className="ml-2 rounded-full px-3">{reportData.length} lỗi</Tag>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button 
                            type="primary" 
                            icon={<FileExcelOutlined />} 
                            onClick={handleExportExcel}
                            disabled={loading || reportData.length === 0}
                            style={{ backgroundColor: '#10b981' }}
                        >
                            Xuất Excel
                        </Button>
                        <Button 
                            icon={<ArrowLeftOutlined />} 
                            onClick={() => window.close()}
                        >
                            Đóng tab
                        </Button>
                    </div>
                </div>

                <Table 
                    bordered
                    size="middle"
                    loading={loading}
                    dataSource={reportData}
                    rowKey="_key"
                    pagination={{ pageSize: 100, showSizeChanger: true, pageSizeOptions: ['50', '100', '200', '500'] }}
                    scroll={{ x: 'max-content', y: 'calc(100vh - 280px)' }}
                    className="shadow-sm border border-slate-200 rounded-lg overflow-hidden"
                    columns={[
                        {
                            title: 'STT',
                            key: 'stt',
                            width: 60,
                            align: 'center',
                            render: (_, __, index) => index + 1
                        },
                        {
                            title: 'MÃ LK',
                            dataIndex: 'ma_lk',
                            key: 'ma_lk',
                            width: 120,
                            fixed: 'left',
                            render: (text) => <span className="font-bold text-indigo-600">{text}</span>
                        },
                        {
                            title: 'MÃ BN',
                            dataIndex: 'ma_bn',
                            key: 'ma_bn',
                            width: 120,
                        },
                        {
                            title: 'HỌ TÊN',
                            dataIndex: 'ho_ten',
                            key: 'ho_ten',
                            width: 180,
                            fixed: 'left'
                        },
                        {
                            title: 'NGÀY VÀO',
                            dataIndex: 'ngay_vao',
                            key: 'ngay_vao',
                            width: 140,
                            render: (text) => formatXmlDate(text)
                        },
                        {
                            title: 'NGÀY RA',
                            dataIndex: 'ngay_ra',
                            key: 'ngay_ra',
                            width: 140,
                            render: (text) => formatXmlDate(text)
                        },
                        {
                            title: 'NGÀY YL',
                            dataIndex: 'ngay_yl',
                            key: 'ngay_yl',
                            width: 140,
                            render: (text) => formatXmlDate(text)
                        },
                        {
                            title: 'NGÀY TH YL',
                            dataIndex: 'ngay_th_yl',
                            key: 'ngay_th_yl',
                            width: 140,
                            render: (text) => formatXmlDate(text)
                        },
                        {
                            title: 'NGÀY KQ',
                            dataIndex: 'ngay_kq',
                            key: 'ngay_kq',
                            width: 140,
                            render: (text) => formatXmlDate(text)
                        },
                        {
                            title: 'XML',
                            dataIndex: 'xmlType',
                            key: 'xmlType',
                            width: 100,
                            render: (text) => <Tag color="volcano" className="font-mono">{text}</Tag>
                        },
                        {
                            title: 'MÃ LỖI',
                            dataIndex: 'ruleCode',
                            key: 'ruleCode',
                            width: 120,
                            render: (text) => <span className="font-bold text-red-600">{text}</span>
                        },
                        {
                            title: 'TÊN LỖI',
                            dataIndex: 'ruleName',
                            key: 'ruleName',
                            width: 250
                        },
                        {
                            title: 'MÔ TẢ CHI TIẾT',
                            dataIndex: 'description',
                            key: 'description',
                            width: 400,
                            render: (text) => <div className="text-slate-600 whitespace-pre-wrap">{text}</div>
                        },
                        {
                            title: 'TRƯỜNG DỮ LIỆU',
                            dataIndex: 'field',
                            key: 'field',
                            width: 150,
                            render: (text) => <Tag className="font-mono">{text}</Tag>
                        },
                        {
                            title: 'VỊ TRÍ DÒNG',
                            dataIndex: 'index',
                            key: 'index',
                            width: 100,
                            render: (text) => text !== undefined ? `Dòng ${text + 1}` : '-'
                        }
                    ]}
                />
            </div>
        </div>
    );
}

export default function ReportPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Spin size="large" /></div>}>
            <ReportContent />
        </Suspense>
    );
}

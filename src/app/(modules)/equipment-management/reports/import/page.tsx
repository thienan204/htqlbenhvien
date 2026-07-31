'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Typography, DatePicker, Select, Input, Button, Space, message, Row, Col, Tabs } from 'antd';
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function ImportReportPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    
    // Tab state
    const [reportType, setReportType] = useState<'summary' | 'detail'>('summary');

    // Filters state
    const [dateRange, setDateRange] = useState<any>(null);
    const [warehouseId, setWarehouseId] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        fetchWarehouses();
    }, []);

    useEffect(() => {
        fetchData();
    }, [reportType]); // Re-fetch when changing tab

    const fetchWarehouses = async () => {
        try {
            const res = await fetch('/api/warehouses');
            if (res.ok) setWarehouses(await res.json());
        } catch (error) {
            console.error(error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (dateRange && dateRange[0] && dateRange[1]) {
                params.append('startDate', dateRange[0].format('YYYY-MM-DD'));
                params.append('endDate', dateRange[1].format('YYYY-MM-DD'));
            }
            if (warehouseId) params.append('warehouse_id', warehouseId);
            if (searchText) params.append('search', searchText);
            params.append('reportType', reportType);

            const res = await fetch(`/api/reports/import?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setData(result.map((item: any, index: number) => ({ ...item, key: item.id || index.toString() })));
            } else {
                message.error('Lỗi lấy dữ liệu báo cáo');
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setDateRange(null);
        setWarehouseId(null);
        setSearchText('');
        setTimeout(() => {
            fetchData();
        }, 100);
    };

    const handleExportExcel = () => {
        if (data.length === 0) {
            message.warning('Không có dữ liệu để xuất');
            return;
        }

        const excelData = data.map((item, index) => {
            const baseRow: any = {
                'STT': index + 1,
                'Ngày chứng từ': item.document_date ? dayjs(item.document_date).format('DD/MM/YYYY') : '',
                'Mã phiếu': item.voucher_code,
            };

            if (reportType === 'detail') {
                baseRow['Mã thiết bị'] = item.ma_vttb;
                baseRow['Tên Vật tư / Thiết bị'] = item.ten_vttb;
                baseRow['Số Serial'] = item.serial;
            } else {
                baseRow['Tên Vật tư / Thiết bị'] = item.ten_vttb;
            }

            baseRow['Kho nhập'] = item.warehouse_name;
            baseRow['Nhà cung cấp'] = item.supplier_name;
            baseRow['Số lượng'] = item.quantity;
            baseRow['Đơn giá (VAT)'] = item.dongia_vat;
            baseRow['Thành tiền'] = item.thanh_tien;

            return baseRow;
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Bao_cao_nhap_kho');
        
        let wscols = [];
        if (reportType === 'detail') {
            wscols = [
                { wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 30 }, { wch: 20 }, 
                { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }
            ];
        } else {
            wscols = [
                { wch: 5 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, 
                { wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 15 }
            ];
        }
        worksheet['!cols'] = wscols;

        const fileName = reportType === 'summary' ? 'Bao_Cao_Nhap_Kho_Tong_Hop' : 'Bao_Cao_Nhap_Kho_Chi_Tiet';
        XLSX.writeFile(workbook, `${fileName}_${dayjs().format('YYYYMMDD')}.xlsx`);
    };

    // Columns cho báo cáo tổng hợp
    const summaryColumns = [
        { title: 'STT', key: 'stt', width: 60, render: (_: any, __: any, index: number) => index + 1 },
        { title: 'Ngày chứng từ', dataIndex: 'document_date', key: 'document_date', render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '' },
        { title: 'Mã phiếu', dataIndex: 'voucher_code', key: 'voucher_code' },
        { title: 'Tên Vật tư / Thiết bị', dataIndex: 'ten_vttb', key: 'ten_vttb' },
        { title: 'Kho nhập', dataIndex: 'warehouse_name', key: 'warehouse_name' },
        { title: 'Nhà cung cấp', dataIndex: 'supplier_name', key: 'supplier_name' },
        { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
        { title: 'Đơn giá (VAT)', dataIndex: 'dongia_vat', key: 'dongia_vat', align: 'right' as const, render: (val: number) => val?.toLocaleString('vi-VN') },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', key: 'thanh_tien', align: 'right' as const, render: (val: number) => val?.toLocaleString('vi-VN') }
    ];

    // Columns cho báo cáo chi tiết
    const detailColumns = [
        { title: 'STT', key: 'stt', width: 60, render: (_: any, __: any, index: number) => index + 1 },
        { title: 'Ngày chứng từ', dataIndex: 'document_date', key: 'document_date', render: (val: string) => val ? dayjs(val).format('DD/MM/YYYY') : '' },
        { title: 'Mã phiếu', dataIndex: 'voucher_code', key: 'voucher_code' },
        { title: 'Mã Thiết bị', dataIndex: 'ma_vttb', key: 'ma_vttb' },
        { title: 'Tên Vật tư / Thiết bị', dataIndex: 'ten_vttb', key: 'ten_vttb' },
        { title: 'Số Serial', dataIndex: 'serial', key: 'serial' },
        { title: 'Kho nhập', dataIndex: 'warehouse_name', key: 'warehouse_name' },
        { title: 'Nhà cung cấp', dataIndex: 'supplier_name', key: 'supplier_name' },
        { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', align: 'right' as const },
        { title: 'Đơn giá (VAT)', dataIndex: 'dongia_vat', key: 'dongia_vat', align: 'right' as const, render: (val: number) => val?.toLocaleString('vi-VN') },
        { title: 'Thành tiền', dataIndex: 'thanh_tien', key: 'thanh_tien', align: 'right' as const, render: (val: number) => val?.toLocaleString('vi-VN') }
    ];

    const currentColumns = reportType === 'summary' ? summaryColumns : detailColumns;

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <Title level={3} className="!mb-1 text-slate-800">Báo Cáo Nhập Kho</Title>
                    <p className="text-slate-500">Thống kê chi tiết vật tư, thiết bị nhập vào kho</p>
                </div>
                <Button 
                    type="primary" 
                    icon={<DownloadOutlined />} 
                    onClick={handleExportExcel}
                    className="bg-green-600"
                    size="large"
                >
                    Xuất Excel
                </Button>
            </div>

            <Card className="mb-6 shadow-sm border-slate-200">
                <Row gutter={[16, 16]} align="bottom">
                    <Col xs={24} sm={12} md={6}>
                        <div className="mb-1 text-slate-500 font-medium text-sm">Từ ngày - Đến ngày</div>
                        <RangePicker 
                            className="w-full" 
                            format="DD/MM/YYYY"
                            value={dateRange}
                            onChange={(dates) => setDateRange(dates)}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <div className="mb-1 text-slate-500 font-medium text-sm">Kho nhập</div>
                        <Select
                            className="w-full"
                            placeholder="Tất cả các kho"
                            allowClear
                            value={warehouseId}
                            onChange={(val) => setWarehouseId(val)}
                            options={warehouses.map(w => ({ value: w.id, label: w.name }))}
                            showSearch
                            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <div className="mb-1 text-slate-500 font-medium text-sm">Tìm kiếm</div>
                        <Input
                            placeholder="Tên thiết bị, nhà cung cấp..."
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onPressEnter={fetchData}
                            allowClear
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Space>
                            <Button type="primary" icon={<SearchOutlined />} onClick={fetchData}>
                                Tìm kiếm
                            </Button>
                            <Button icon={<ReloadOutlined />} onClick={handleReset}>
                                Làm mới
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Card className="shadow-sm border-slate-200" styles={{ body: { padding: 0 } }}>
                <Tabs type="card" 
                    activeKey={reportType} 
                    onChange={(key) => setReportType(key as 'summary' | 'detail')}
                    className="px-4 pt-2"
                    items={[
                        { key: 'summary', label: 'Báo cáo Tổng hợp' },
                        { key: 'detail', label: 'Báo cáo Chi tiết' }
                    ]}
                />
                
                <Table 
                    columns={currentColumns} 
                    dataSource={data} 
                    loading={loading}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    scroll={{ x: 1000 }}
                    summary={pageData => {
                        let totalQty = 0;
                        let totalPrice = 0;
                        pageData.forEach(({ quantity, thanh_tien }) => {
                            totalQty += quantity || 0;
                            totalPrice += thanh_tien || 0;
                        });

                        const colSpan = reportType === 'summary' ? 6 : 8;

                        return (
                            <Table.Summary.Row className="bg-slate-50 font-bold">
                                <Table.Summary.Cell index={0} colSpan={colSpan} className="text-right">Tổng cộng</Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">{totalQty.toLocaleString('vi-VN')}</Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right"></Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right">
                                    <span className="text-red-600">{totalPrice.toLocaleString('vi-VN')}</span>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                        );
                    }}
                />
            </Card>
        </div>
    );
}

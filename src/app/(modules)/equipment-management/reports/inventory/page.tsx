'use client';

import React, { useState } from 'react';
import { Card, DatePicker, Button, Table, Typography, message, Space, Row, Col } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function InventoryReportPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [dateRange, setDateRange] = useState<any>(null);

    const handleSearch = async () => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) {
            message.warning("Vui lòng chọn khoảng thời gian Từ ngày - Đến ngày");
            return;
        }

        try {
            setLoading(true);
            const startDate = dateRange[0].format('YYYY-MM-DD');
            const endDate = dateRange[1].format('YYYY-MM-DD');

            const res = await fetch(`/api/reports/inventory?startDate=${startDate}&endDate=${endDate}`);
            if (res.ok) {
                const result = await res.json();
                setData(result);
            } else {
                message.error("Có lỗi xảy ra khi lấy báo cáo");
            }
        } catch (error) {
            console.error(error);
            message.error("Lỗi kết nối máy chủ");
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        { title: 'STT', key: 'index', render: (text: any, record: any, index: number) => index + 1, width: 60, align: 'center' as const },
        { title: 'Tên Thiết Bị / Vật Tư', dataIndex: 'ten_vttb', key: 'ten_vttb' },
        { title: 'ĐVT', dataIndex: 'don_vi', key: 'don_vi', align: 'center' as const },
        { title: 'Tồn đầu kỳ', dataIndex: 'ton_dau', key: 'ton_dau', align: 'right' as const, render: (val: number) => val.toLocaleString('vi-VN') },
        { title: 'Nhập trong kỳ', dataIndex: 'nhap_trong_ky', key: 'nhap_trong_ky', align: 'right' as const, render: (val: number) => <span className="text-green-600">{val.toLocaleString('vi-VN')}</span> },
        { title: 'Xuất trong kỳ', dataIndex: 'xuat_trong_ky', key: 'xuat_trong_ky', align: 'right' as const, render: (val: number) => <span className="text-orange-600">{val.toLocaleString('vi-VN')}</span> },
        { title: 'Tồn cuối kỳ', dataIndex: 'ton_cuoi', key: 'ton_cuoi', align: 'right' as const, render: (val: number) => <strong className="text-blue-600">{val.toLocaleString('vi-VN')}</strong> },
    ];

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="mb-6">
                <Title level={3} className="!mb-0 text-slate-800">Báo Cáo Nhập Xuất Tồn Kho</Title>
                <p className="text-slate-500 mt-1">Tính tồn kho nối tiếp dựa trên khoảng thời gian</p>
            </div>

            <Card className="mb-6 shadow-sm border-slate-200">
                <Row gutter={16} align="middle">
                    <Col>
                        <span className="font-medium mr-2">Thời gian:</span>
                        <RangePicker 
                            format="DD/MM/YYYY" 
                            onChange={(dates) => setDateRange(dates)} 
                            size="large"
                        />
                    </Col>
                    <Col>
                        <Button 
                            type="primary" 
                            icon={<SearchOutlined />} 
                            onClick={handleSearch} 
                            loading={loading}
                            size="large"
                            className="bg-blue-600"
                        >
                            Xem báo cáo
                        </Button>
                    </Col>
                    <Col>
                        <Button 
                            icon={<DownloadOutlined />} 
                            disabled={data.length === 0}
                            size="large"
                        >
                            Xuất Excel
                        </Button>
                    </Col>
                </Row>
            </Card>

            <Card className="shadow-sm border-slate-200">
                <Table 
                    columns={columns} 
                    dataSource={data} 
                    rowKey="ten_vttb"
                    loading={loading}
                    bordered
                    pagination={{ pageSize: 20 }}
                    summary={pageData => {
                        let totalDau = 0, totalNhap = 0, totalXuat = 0, totalCuoi = 0;
                        pageData.forEach(({ ton_dau, nhap_trong_ky, xuat_trong_ky, ton_cuoi }) => {
                            totalDau += ton_dau || 0;
                            totalNhap += nhap_trong_ky || 0;
                            totalXuat += xuat_trong_ky || 0;
                            totalCuoi += ton_cuoi || 0;
                        });
                        return (
                            <Table.Summary.Row className="bg-slate-100 font-bold">
                                <Table.Summary.Cell index={0} colSpan={3} align="center">Tổng Cộng</Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">{totalDau.toLocaleString('vi-VN')}</Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right"><span className="text-green-600">{totalNhap.toLocaleString('vi-VN')}</span></Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right"><span className="text-orange-600">{totalXuat.toLocaleString('vi-VN')}</span></Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="right"><span className="text-blue-600">{totalCuoi.toLocaleString('vi-VN')}</span></Table.Summary.Cell>
                            </Table.Summary.Row>
                        );
                    }}
                />
            </Card>
        </div>
    );
}

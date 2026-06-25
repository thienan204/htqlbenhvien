'use client';

import React, { useState } from 'react';
import { Tabs, Table, Tag, Typography, Card, Space, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined, BookOutlined } from '@ant-design/icons';
import { xmlDictionaryData, XmlDictionaryItem } from '@/data/xml-dictionary';

const { Text, Paragraph } = Typography;

export default function BangChiTieuPage() {
    const [searchText, setSearchText] = useState('');

    const columns: ColumnsType<XmlDictionaryItem> = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 60,
            align: 'center',
            render: (text) => <Text strong>{text}</Text>
        },
        {
            title: 'Chỉ tiêu',
            dataIndex: 'chiTieu',
            key: 'chiTieu',
            width: 150,
            render: (text) => <Text code className="text-blue-700 font-bold text-sm bg-blue-50 border-blue-100">{text}</Text>
        },
        {
            title: 'Kiểu',
            dataIndex: 'kieuDuLieu',
            key: 'kieuDuLieu',
            width: 100,
            render: (text, record) => (
                <div className="flex flex-col">
                    <Text>{text}</Text>
                    {record.kichThuocToiDa && <Text type="secondary" className="text-xs">Max: {record.kichThuocToiDa}</Text>}
                </div>
            )
        },
        {
            title: 'QĐ 130/4750',
            dataIndex: 'dienGiai130',
            key: 'dienGiai130',
            render: (text) => (
                <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'Xem thêm' }} className="mb-0 text-sm whitespace-pre-line text-slate-700">
                    {text}
                </Paragraph>
            )
        },
        {
            title: 'QĐ 3176 (Thay đổi)',
            dataIndex: 'dinhChinh4750',
            key: 'dinhChinh4750',
            render: (text) => (
                <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: 'Xem thêm' }} className="mb-0 text-sm whitespace-pre-line text-slate-700">
                    {text}
                </Paragraph>
            )
        },
        {
            title: 'Ghi chú',
            dataIndex: 'dieuChinh',
            key: 'dieuChinh',
            width: 100,
            align: 'center',
            render: (text) => {
                if (!text) return null;
                if (text.toLowerCase().includes('sửa đổi')) return <Tag color="gold" className="font-bold">{text}</Tag>;
                if (text.toLowerCase().includes('mới')) return <Tag color="green" className="font-bold">{text}</Tag>;
                if (text.toLowerCase().includes('xóa')) return <Tag color="red" className="font-bold">{text}</Tag>;
                return <Tag color="blue">{text}</Tag>;
            }
        }
    ];

    const tabItems = Object.keys(xmlDictionaryData).map(xmlType => {
        const data = xmlDictionaryData[xmlType];
        
        const filteredData = data.filter(item => 
            item.chiTieu.toLowerCase().includes(searchText.toLowerCase()) ||
            item.dienGiai130.toLowerCase().includes(searchText.toLowerCase())
        );

        return {
            key: xmlType,
            label: xmlType,
            children: (
                <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-4">
                    <Table
                        columns={columns}
                        dataSource={filteredData}
                        rowKey="chiTieu"
                        pagination={false}
                        bordered
                        size="small"
                        rowClassName={(record, index) => index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
                        scroll={{ y: 'calc(100vh - 280px)', x: 'max-content' }}
                    />
                </div>
            )
        };
    });

    return (
        <div className="min-h-screen bg-slate-100 p-6 flex flex-col">
            <div className="mb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <BookOutlined className="text-blue-600" />
                        Từ điển Bảng Chỉ Tiêu XML
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">
                        Tra cứu các trường dữ liệu theo QĐ 130/4750 và QĐ 3176
                    </p>
                </div>
                <div>
                    <Input
                        placeholder="Tìm kiếm Tên trường, Mô tả..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        className="w-80 rounded-full shadow-sm"
                        allowClear
                        size="large"
                    />
                </div>
            </div>

            <div className="flex-1 drop-shadow-sm">
                <Tabs 
                    type="card" 
                    items={tabItems} 
                    className="custom-tabs"
                    tabBarStyle={{ marginBottom: 0 }}
                />
            </div>

            <style jsx global>{`
                .custom-tabs .ant-tabs-nav {
                    background: #1e293b; /* slate-800 */
                    border-radius: 8px 8px 0 0;
                    padding: 8px 8px 0 8px;
                }
                .custom-tabs .ant-tabs-tab {
                    border: none !important;
                    background: transparent !important;
                    color: #94a3b8 !important;
                }
                .custom-tabs .ant-tabs-tab-active {
                    background: white !important;
                    color: #0f172a !important;
                    font-weight: bold;
                    border-radius: 6px 6px 0 0 !important;
                }
                .custom-tabs .ant-table-thead > tr > th {
                    background-color: #3b82f6 !important; /* blue-500 */
                    color: white !important;
                    font-weight: bold;
                }
                .custom-tabs .ant-table-wrapper .ant-table-container {
                    border-radius: 8px;
                    overflow: hidden;
                }
            `}</style>
        </div>
    );
}

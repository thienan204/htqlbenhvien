'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Input, Checkbox, Row, Col, Tag, Tooltip, Space, Layout, Menu, Modal, Descriptions, Button, message } from 'antd';
import { SearchOutlined, WarningOutlined, InfoCircleOutlined, WomanOutlined, ManOutlined, AlertOutlined, StopOutlined, BookOutlined, DownloadOutlined } from '@ant-design/icons';
import { useDebounce } from '@/hooks/useDebounce';
import * as xlsx from 'xlsx';

export default function Icd10Page() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    
    const [chapters, setChapters] = useState<any[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

    const [selectedRecord, setSelectedRecord] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Filters
    const [searchText, setSearchText] = useState('');
    const debouncedSearch = useDebounce(searchText, 500);
    
    const [filters, setFilters] = useState({
        is_not_main_disease: false,
        not_recommended_main: false,
        requires_more_specific: false,
        is_death_cause_only: false,
        is_female_only: false,
        is_male_only: false,
        is_phu_luc_1_tt25: false,
        is_phu_luc_2_tt25: false,
        is_phu_luc_3_tt25: false,
        is_phu_luc_4_tt25: false
    });

    const fetchChapters = async () => {
        try {
            const res = await fetch('/api/icd10/chapters');
            if (res.ok) {
                const result = await res.json();
                setChapters(result.data);
            }
        } catch (error) {
            console.error('Lỗi khi tải danh sách chương', error);
        }
    };

    const fetchIcd10 = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', '50');
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (selectedChapter) params.append('chapter', selectedChapter);
            
            Object.entries(filters).forEach(([key, val]) => {
                if (val) params.append(key, 'true');
            });

            const res = await fetch(`/api/icd10?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                setData(result.data);
                setTotal(result.pagination.total);
            }
        } catch (error) {
            console.error('Lỗi khi tải ICD-10', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            params.append('page', '1');
            params.append('limit', '50000'); // Lấy tối đa theo bộ lọc
            if (debouncedSearch) params.append('search', debouncedSearch);
            if (selectedChapter) params.append('chapter', selectedChapter);
            
            Object.entries(filters).forEach(([key, val]) => {
                if (val) params.append(key, 'true');
            });

            const res = await fetch(`/api/icd10?${params.toString()}`);
            if (res.ok) {
                const result = await res.json();
                if (result.data.length === 0) {
                    message.warning('Không có dữ liệu để xuất!');
                    return;
                }
                const dataToExport = result.data.map((item: any) => ({
                    'Mã Chương': item.ma_chuong,
                    'Tên Chương': item.ten_chuong,
                    'Mã Nhóm': item.ma_nhom,
                    'Tên Nhóm': item.ten_nhom,
                    'Mã Loại': item.ma_loai,
                    'Tên Loại': item.ten_loai,
                    'Mã Bệnh': item.ma_benh,
                    'Tên Bệnh': item.ten_benh,
                    'Mã Chi Tiết': item.ma_chi_tiet,
                    'Tên Chi Tiết': item.ten_chi_tiet,
                    'Ghi chú': item.ghi_chu,
                    'Trạng thái': item.isActive ? 'Đang hiệu lực' : 'Hết hiệu lực',
                    'Không được dùng làm bệnh chính': item.is_not_main_disease ? 'x' : '',
                    'Không khuyến khích làm bệnh chính': item.not_recommended_main ? 'x' : '',
                    'Mã không được sử dụng vì có mã cụ thể hơn': item.requires_more_specific ? 'x' : '',
                    'Chỉ có ở Nữ giới': item.is_female_only ? 'x' : '',
                    'Chỉ có ở Nam giới': item.is_male_only ? 'x' : '',
                    'Chỉ cho nguyên nhân tử vong': item.is_death_cause_only ? 'x' : '',
                    'Thuộc Phụ lục 01-TT01/2025': item.is_phu_luc_1_tt25 ? 'x' : '',
                    'Thuộc Phụ lục 02-TT01/2025': item.is_phu_luc_2_tt25 ? 'x' : '',
                    'Thuộc Phụ lục 3-TT01/2025': item.is_phu_luc_3_tt25 ? 'x' : '',
                    'Thuộc Phụ lục 4-TT01/2025': item.is_phu_luc_4_tt25 ? 'x' : ''
                }));

                const worksheet = xlsx.utils.json_to_sheet(dataToExport);
                const workbook = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(workbook, worksheet, 'ICD10');
                xlsx.writeFile(workbook, `ICD10_Export_${new Date().getTime()}.xlsx`);
            }
        } catch (error) {
            console.error('Lỗi khi xuất Excel', error);
            message.error('Lỗi khi xuất Excel');
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        fetchChapters();
    }, []);

    useEffect(() => {
        fetchIcd10();
    }, [page, debouncedSearch, filters, selectedChapter]);

    const handleFilterChange = (key: keyof typeof filters, checked: boolean) => {
        setFilters(prev => ({ ...prev, [key]: checked }));
        setPage(1); // reset to first page on filter change
    };

    const columns = [
        {
            title: 'Mã Bệnh',
            dataIndex: 'ma_chi_tiet',
            key: 'ma_chi_tiet',
            width: 120,
            render: (text: string) => <span className="font-bold text-blue-600">{text}</span>
        },
        {
            title: 'Tên Bệnh',
            dataIndex: 'ten_chi_tiet',
            key: 'ten_chi_tiet',
        },
        {
            title: 'Chương / Nhóm',
            key: 'group',
            width: 200,
            render: (_: any, record: any) => (
                <div className="text-xs text-slate-500">
                    <div className="font-semibold">{record.ma_chuong}</div>
                    <div className="truncate w-full" title={record.ten_nhom}>{record.ten_nhom}</div>
                </div>
            )
        },
        {
            title: 'Quy tắc Check XML (Cảnh báo)',
            key: 'rules',
            width: 250,
            render: (_: any, record: any) => (
                <Space orientation="vertical" size={2} className="w-full">
                    {record.is_not_main_disease && (
                        <Tag icon={<StopOutlined />} color="red" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                            KHÔNG ĐƯỢC DÙNG LÀ BỆNH CHÍNH
                        </Tag>
                    )}
                    {record.not_recommended_main && (
                        <Tag icon={<WarningOutlined />} color="orange" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                            KHÔNG KHUYẾN KHÍCH DÙNG LÀ BỆNH CHÍNH
                        </Tag>
                    )}
                    {record.requires_more_specific && (
                        <div className="w-full flex flex-col gap-1">
                            <Tag icon={<AlertOutlined />} color="magenta" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                                MÃ KHÔNG ĐƯỢC SỬ DỤNG VÌ CÓ MÃ 4 HOẶC 5 KÝ TỰ CỤ THỂ HƠN
                            </Tag>
                            {record.valid_children && record.valid_children.length > 0 && (
                                <div className="text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                                    <span className="font-semibold text-slate-700">Mã chi tiết hợp lệ: </span>
                                    <span className="text-blue-600 font-medium">{record.valid_children.join(', ')}</span>
                                </div>
                            )}
                        </div>
                    )}
                    {record.is_death_cause_only && (
                        <Tag icon={<InfoCircleOutlined />} color="purple" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                            CHỈ DÙNG CHO NGUYÊN NHÂN TỬ VONG
                        </Tag>
                    )}
                    {record.is_female_only && (
                        <Tag icon={<WomanOutlined />} color="pink" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                            CHỈ CÓ / CHỦ YẾU Ở NỮ GIỚI
                        </Tag>
                    )}
                    {record.is_male_only && (
                        <Tag icon={<ManOutlined />} color="blue" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                            CHỈ CÓ / CHỦ YẾU Ở NAM GIỚI
                        </Tag>
                    )}
                    {record.is_phu_luc_1_tt25 && (
                        <Tag icon={<InfoCircleOutlined />} color="success" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                            THUỘC PHỤ LỤC 01-TT01/2025
                        </Tag>
                    )}
                    {record.is_phu_luc_2_tt25 && (
                        <Tag icon={<InfoCircleOutlined />} color="cyan" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                            THUỘC PHỤ LỤC 02-TT01/2025
                        </Tag>
                    )}
                    {record.is_phu_luc_3_tt25 && (
                        <Tag icon={<InfoCircleOutlined />} color="purple" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                            THUỘC PHỤ LỤC 3-TT01/2025
                        </Tag>
                    )}
                    {record.is_phu_luc_4_tt25 && (
                        <Tag icon={<InfoCircleOutlined />} color="orange" className="w-full truncate text-xs whitespace-normal h-auto py-1">
                            THUỘC PHỤ LỤC 4-TT01/2025
                        </Tag>
                    )}
                </Space>
            )
        }
    ];

    const { Sider, Content } = Layout;

    return (
        <Layout className="min-h-screen bg-slate-50">
            <Sider width={320} theme="light" className="border-r border-slate-200 overflow-y-auto" style={{ height: '100vh', position: 'sticky', top: 0 }}>
                <div className="p-4 font-bold text-lg text-slate-800 border-b border-slate-100 flex items-center gap-2">
                    <BookOutlined className="text-blue-600" />
                    Chương Bệnh (ICD-10)
                </div>
                <Menu
                    mode="inline"
                    selectedKeys={selectedChapter ? [selectedChapter] : ['all']}
                    onClick={(e) => {
                        setSelectedChapter(e.key === 'all' ? null : e.key);
                        setPage(1);
                    }}
                    items={[
                        { key: 'all', label: 'Tất cả các chương' },
                        ...chapters.map(c => ({
                            key: c.ma_chuong,
                            label: (
                                <div className="flex flex-col py-1">
                                    <span className="font-semibold text-xs text-blue-600">Chương {c.ma_chuong} {c.ma_nhom ? `(${c.ma_nhom})` : ''}</span>
                                    <span className="text-xs whitespace-normal leading-tight">{c.ten_chuong}</span>
                                </div>
                            )
                        }))
                    ]}
                />
            </Sider>
            <Content className="p-6 space-y-6">
                <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl">
                        <SearchOutlined />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Tra cứu Danh mục ICD-10</h1>
                        <p className="text-slate-500 m-0">Ban hành kèm theo Thông tư 06/2026/TT-BYT (Hơn 15.000 mã bệnh)</p>
                    </div>
                </div>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100">
                <div className="mb-6 space-y-4">
                    <Input
                        size="large"
                        placeholder="Tìm kiếm theo mã bệnh (VD: A00) hoặc tên bệnh (VD: bệnh tả)..."
                        prefix={<SearchOutlined className="text-slate-400" />}
                        value={searchText}
                        onChange={e => {
                            setSearchText(e.target.value);
                            setPage(1);
                        }}
                        className="max-w-2xl rounded-lg"
                        allowClear
                    />

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-center mb-3">
                            <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                <AlertOutlined className="text-orange-500" />
                                Bộ lọc bắt lỗi XML (Theo quy định TT06)
                            </div>
                            <Button 
                                type="primary" 
                                icon={<DownloadOutlined />} 
                                loading={exporting} 
                                onClick={handleExportExcel}
                                className="bg-green-600 hover:bg-green-700 border-none shadow-sm"
                                size="small"
                            >
                                Xuất Excel theo bộ lọc
                            </Button>
                        </div>
                        <Row gutter={[16, 16]}>
                            <Col span={8}>
                                <Checkbox 
                                    checked={filters.is_not_main_disease}
                                    onChange={e => handleFilterChange('is_not_main_disease', e.target.checked)}
                                >
                                    <span className="text-red-600">Không được dùng làm bệnh chính</span>
                                </Checkbox>
                            </Col>
                            <Col span={8}>
                                <Checkbox 
                                    checked={filters.not_recommended_main}
                                    onChange={e => handleFilterChange('not_recommended_main', e.target.checked)}
                                >
                                    <span className="text-orange-500">Không khuyến khích làm bệnh chính</span>
                                </Checkbox>
                            </Col>
                            <Col span={8}>
                                <Checkbox 
                                    checked={filters.requires_more_specific}
                                    onChange={e => handleFilterChange('requires_more_specific', e.target.checked)}
                                >
                                    <span className="text-fuchsia-600">Mã không được sử dụng vì có mã 4 hoặc 5 ký tự cụ thể hơn</span>
                                </Checkbox>
                            </Col>
                            <Col span={8}>
                                <Checkbox 
                                    checked={filters.is_female_only}
                                    onChange={e => handleFilterChange('is_female_only', e.target.checked)}
                                >
                                    <span className="text-pink-600">Chỉ có ở Nữ giới</span>
                                </Checkbox>
                            </Col>
                            <Col span={8}>
                                <Checkbox 
                                    checked={filters.is_male_only}
                                    onChange={e => handleFilterChange('is_male_only', e.target.checked)}
                                >
                                    <span className="text-blue-600">Chỉ có ở Nam giới</span>
                                </Checkbox>
                            </Col>
                            <Col span={8}>
                                <Checkbox 
                                    checked={filters.is_death_cause_only}
                                    onChange={e => handleFilterChange('is_death_cause_only', e.target.checked)}
                                >
                                    <span className="text-purple-600">Chỉ cho nguyên nhân tử vong</span>
                                </Checkbox>
                            </Col>
                            <Col span={8}>
                                <Tooltip title="DANH MỤC MỘT SỐ BỆNH ĐƯỢC KHÁM BỆNH, CHỮA BỆNH TẠI CƠ SỞ KHÁM BỆNH, CHỮA BỆNH CẤP CHUYÊN SÂU" placement="top">
                                    <Checkbox 
                                        checked={filters.is_phu_luc_1_tt25}
                                        onChange={e => handleFilterChange('is_phu_luc_1_tt25', e.target.checked)}
                                    >
                                        <span className="text-emerald-600 font-semibold">Thuộc Phụ lục 01-TT01/2025</span>
                                    </Checkbox>
                                </Tooltip>
                            </Col>
                            <Col span={8}>
                                <Tooltip title="DANH MỤC MỘT SỐ BỆNH ĐƯỢC KHÁM BỆNH, CHỮA BỆNH TẠI CƠ SỞ KHÁM BỆNH, CHỮA BỆNH CẤP CƠ BẢN" placement="top">
                                    <Checkbox 
                                        checked={filters.is_phu_luc_2_tt25}
                                        onChange={e => handleFilterChange('is_phu_luc_2_tt25', e.target.checked)}
                                    >
                                        <span className="text-cyan-600 font-semibold">Thuộc Phụ lục 02-TT01/2025</span>
                                    </Checkbox>
                                </Tooltip>
                            </Col>
                            <Col span={8}>
                                <Tooltip title="DANH MỤC MỘT SỐ BỆNH ĐƯỢC SỬ DỤNG PHIẾU CHUYỂN CƠ SỞ KHÁM BỆNH, CHỮA BỆNH CÓ GIÁ TRỊ SỬ DỤNG MỘT NĂM" placement="top">
                                    <Checkbox 
                                        checked={filters.is_phu_luc_3_tt25}
                                        onChange={e => handleFilterChange('is_phu_luc_3_tt25', e.target.checked)}
                                    >
                                        <span className="text-purple-600 font-semibold">Thuộc Phụ lục 3-TT01/2025</span>
                                    </Checkbox>
                                </Tooltip>
                            </Col>
                            <Col span={8}>
                                <Tooltip title="DANH MỤC MỘT SỐ BỆNH ĐƯỢC CHUYỂN CƠ SỞ KHÁM BỆNH, CHỮA BỆNH BẢO HIỂM Y TẾ CẤP BAN ĐẦU ĐỂ QUẢN LÝ" placement="top">
                                    <Checkbox 
                                        checked={filters.is_phu_luc_4_tt25}
                                        onChange={e => handleFilterChange('is_phu_luc_4_tt25', e.target.checked)}
                                    >
                                        <span className="text-orange-600 font-semibold">Thuộc Phụ lục 4-TT01/2025</span>
                                    </Checkbox>
                                </Tooltip>
                            </Col>
                        </Row>
                    </div>
                </div>

                <Table
                    dataSource={data}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: page,
                        pageSize: 50,
                        total: total,
                        showSizeChanger: false,
                        showTotal: (total) => `Tìm thấy ${total} mã bệnh`,
                        onChange: (p) => setPage(p)
                    }}
                    onRow={(record) => ({
                        onClick: () => {
                            setSelectedRecord(record);
                            setIsModalOpen(true);
                        }
                    })}
                    rowClassName="hover:bg-blue-50/50 cursor-pointer"
                    size="middle"
                />

                <Modal
                    title={<div className="text-xl font-bold text-slate-800">Chi tiết Mã bệnh: {selectedRecord?.ma_chi_tiet}</div>}
                    open={isModalOpen}
                    onCancel={() => setIsModalOpen(false)}
                    footer={null}
                    width={800}
                    centered
                >
                    {selectedRecord && (
                        <>
                            <Descriptions bordered column={1} size="small" className="mt-4">
                                <Descriptions.Item label={<span className="font-semibold text-slate-600">Mã bệnh (Chi tiết)</span>}><span className="font-bold text-blue-600">{selectedRecord.ma_chi_tiet}</span></Descriptions.Item>
                            <Descriptions.Item label={<span className="font-semibold text-slate-600">Tên bệnh</span>}>{selectedRecord.ten_chi_tiet}</Descriptions.Item>
                            <Descriptions.Item label={<span className="font-semibold text-slate-600">Chương</span>}>Chương {selectedRecord.ma_chuong}: {selectedRecord.ten_chuong}</Descriptions.Item>
                            <Descriptions.Item label={<span className="font-semibold text-slate-600">Nhóm bệnh</span>}>{selectedRecord.ma_nhom}: {selectedRecord.ten_nhom}</Descriptions.Item>
                            {selectedRecord.ma_loai && (
                                <Descriptions.Item label={<span className="font-semibold text-slate-600">Loại bệnh</span>}>{selectedRecord.ma_loai}: {selectedRecord.ten_loai}</Descriptions.Item>
                            )}
                            <Descriptions.Item label={<span className="font-semibold text-slate-600">Mã nhóm 3 ký tự</span>}>{selectedRecord.ma_benh}: {selectedRecord.ten_benh}</Descriptions.Item>
                            {selectedRecord.ghi_chu && (
                                <Descriptions.Item label={<span className="font-semibold text-slate-600">Hướng dẫn mã hóa (WHO 2019)</span>}><span className="text-slate-600 italic whitespace-pre-wrap">{selectedRecord.ghi_chu}</span></Descriptions.Item>
                            )}
                            <Descriptions.Item label={<span className="font-semibold text-slate-600">Cảnh báo XML (TT06)</span>}>
                                <Space orientation="vertical" size={4} className="w-full">
                                    {selectedRecord.is_not_main_disease && (
                                        <Tag icon={<StopOutlined />} color="red" className="whitespace-normal h-auto py-1">KHÔNG ĐƯỢC DÙNG LÀ BỆNH CHÍNH</Tag>
                                    )}
                                    {selectedRecord.not_recommended_main && (
                                        <Tag icon={<WarningOutlined />} color="orange" className="whitespace-normal h-auto py-1">KHÔNG KHUYẾN KHÍCH DÙNG LÀ BỆNH CHÍNH</Tag>
                                    )}
                                    {selectedRecord.requires_more_specific && (
                                        <div className="w-full flex flex-col gap-1">
                                            <Tag icon={<AlertOutlined />} color="magenta" className="whitespace-normal h-auto py-1 w-max">MÃ KHÔNG ĐƯỢC SỬ DỤNG VÌ CÓ MÃ 4 HOẶC 5 KÝ TỰ CỤ THỂ HƠN</Tag>
                                            {selectedRecord.valid_children && selectedRecord.valid_children.length > 0 && (
                                                <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                                                    <span className="font-semibold text-slate-700">Các mã chi tiết hợp lệ có thể sử dụng thay thế: </span>
                                                    <span className="text-blue-600 font-semibold">{selectedRecord.valid_children.join(', ')}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {selectedRecord.is_death_cause_only && (
                                        <Tag icon={<InfoCircleOutlined />} color="purple" className="whitespace-normal h-auto py-1">CHỈ DÙNG CHO NGUYÊN NHÂN TỬ VONG</Tag>
                                    )}
                                    {selectedRecord.is_female_only && (
                                        <Tag icon={<WomanOutlined />} color="pink" className="whitespace-normal h-auto py-1">CHỈ CÓ / CHỦ YẾU Ở NỮ GIỚI</Tag>
                                    )}
                                    {selectedRecord.is_male_only && (
                                        <Tag icon={<ManOutlined />} color="blue" className="whitespace-normal h-auto py-1">CHỈ CÓ / CHỦ YẾU Ở NAM GIỚI</Tag>
                                    )}
                                    {selectedRecord.is_phu_luc_1_tt25 && (
                                        <Tag icon={<InfoCircleOutlined />} color="success" className="whitespace-normal h-auto py-1 font-semibold">THUỘC PHỤ LỤC 01-TT01/2025</Tag>
                                    )}
                                    {selectedRecord.is_phu_luc_2_tt25 && (
                                        <Tag icon={<InfoCircleOutlined />} color="cyan" className="whitespace-normal h-auto py-1 font-semibold">THUỘC PHỤ LỤC 02-TT01/2025</Tag>
                                    )}
                                    {selectedRecord.is_phu_luc_3_tt25 && (
                                        <Tag icon={<InfoCircleOutlined />} color="purple" className="whitespace-normal h-auto py-1 font-semibold">THUỘC PHỤ LỤC 3-TT01/2025</Tag>
                                    )}
                                    {selectedRecord.is_phu_luc_4_tt25 && (
                                        <Tag icon={<InfoCircleOutlined />} color="orange" className="whitespace-normal h-auto py-1 font-semibold">THUỘC PHỤ LỤC 4-TT01/2025</Tag>
                                    )}
                                    {!selectedRecord.is_not_main_disease && !selectedRecord.not_recommended_main && !selectedRecord.requires_more_specific && !selectedRecord.is_death_cause_only && !selectedRecord.is_female_only && !selectedRecord.is_male_only && !selectedRecord.is_phu_luc_1_tt25 && !selectedRecord.is_phu_luc_2_tt25 && !selectedRecord.is_phu_luc_3_tt25 && !selectedRecord.is_phu_luc_4_tt25 && (
                                        <span className="text-slate-400 italic">Không có cảnh báo đặc biệt</span>
                                    )}
                                </Space>
                            </Descriptions.Item>
                        </Descriptions>
                        
                        {selectedRecord.fullData && Object.keys(selectedRecord.fullData).length > 0 && (
                            <div className="mt-6">
                                <div className="text-sm font-bold text-slate-800 bg-slate-100 p-2 rounded-t-lg border border-b-0 border-slate-200">
                                    Thông tin gốc từ Excel (Đầy đủ các cột)
                                </div>
                                <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-b-lg">
                                    <Descriptions bordered column={1} size="small" className="w-full">
                                        {Object.entries(selectedRecord.fullData).map(([key, value]) => (
                                            <Descriptions.Item key={key} label={<span className="font-semibold text-slate-600 text-xs">{key}</span>}>
                                                <span className="text-sm whitespace-pre-wrap">{String(value)}</span>
                                            </Descriptions.Item>
                                        ))}
                                    </Descriptions>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Modal>
            </Card>
            </Content>
        </Layout>
    );
}

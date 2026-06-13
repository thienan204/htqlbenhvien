'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Tag, message, Card, Breadcrumb, Select, Space, Tooltip, Modal, Input } from 'antd';
import { FileExcelOutlined, ArrowLeftOutlined, FilterOutlined, CloudUploadOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { loadRecordsFromDB } from '@/lib/db';
import { ExtendedHosoRecord, getXmlDataList } from '@/lib/xml';
import { copyToClipboard } from '@/utils/clipboard';
import { getBasePath } from '@/utils/config';

// --- Helper Functions ---
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
    if (s.length === 12) { // YYYYMMDDHHmm
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)} ${s.substring(8, 10)}:${s.substring(10, 12)}`;
    }
    if (s.length >= 14) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)} ${s.substring(8, 10)}:${s.substring(10, 12)}`;
    }
    if (s.length >= 8) {
        return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
    }
    return s;
};

// --- Types ---
interface ReportRow {
    key: string;
    stt: number;
    ma_lk: string;
    ma_bn: string;
    ho_ten: string;
    ma_the: string;
    ngay_vao: string;
    ngay_ra: string;
    ngay_yl: string;
    ngay_th_yl: string;
    ngay_kq: string;
    ngay_vao_noi_tru: string;
    ma_dv: string;
    ten_dv: string;
    don_gia_bh: string;
    ma_khoa: string;
    ten_khoa: string;
    chi_tiet_loi: string;
    isError: boolean;
    ma_doituong_kcb: string;
}

export default function ReportPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialFilter = searchParams.get('filter') as 'ALL' | 'ERROR' | 'VALID' || 'ALL';

    const [loading, setLoading] = useState(true);
    const [fullDataSource, setFullDataSource] = useState<ReportRow[]>([]);
    const [departments, setDepartments] = useState<Record<string, string>>({});
    const [filterType, setFilterType] = useState<'ALL' | 'ERROR' | 'VALID'>(initialFilter);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
    const [saveNote, setSaveNote] = useState('');
    const [saveFileName, setSaveFileName] = useState('');

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

        const fetchData = async () => {
            try {
                const records = await loadRecordsFromDB();
                const rows: ReportRow[] = [];
                let index = 1;

                records.forEach((record) => {
                    const errors = record.validationResults.filter(v => v.isError);
                    const ngayVaoNoiTru = formatDateTime(record.summary?.NGAY_VAO_NOI_TRU);

                    if (errors.length === 0) {
                        rows.push({
                            key: `${record.id}_valid`,
                            stt: index++,
                            ma_lk: renderValue(record.summary?.MA_LK),
                            ma_bn: renderValue(record.summary?.MA_BN),
                            ho_ten: renderValue(record.summary?.HO_TEN),
                            ma_the: renderValue(record.summary?.MA_THE_BHYT),
                            ngay_vao: formatDateTime(record.summary?.NGAY_VAO),
                            ngay_ra: formatDateTime(record.summary?.NGAY_RA),
                            ngay_yl: '',
                            ngay_th_yl: '',
                            ngay_kq: '',
                            ngay_vao_noi_tru: ngayVaoNoiTru,
                            ma_dv: '',
                            ten_dv: '',
                            don_gia_bh: '',
                            ma_khoa: renderValue(record.summary?.MA_KHOA),
                            ten_khoa: departments[renderValue(record.summary?.MA_KHOA)] || '',
                            chi_tiet_loi: '',
                            isError: false,
                            ma_doituong_kcb: renderValue(record.summary?.MA_DOITUONG_KCB)
                        });
                    } else {
                        errors.forEach((err, errIdx) => {
                            let code = '';
                            let name = '';
                            let ngayYL = '';
                            let ngayTHYL = '';
                            let ngayKQ = '';
                            let donGiaBh = '';
                            let maKhoa = renderValue(record.summary?.MA_KHOA);

                            if (err.xmlType && err.index !== undefined) {
                                const group = record.groups.find(g => g.type === err.xmlType);
                                if (group) {
                                    const list = getXmlDataList(group);
                                    const item = list[err.index];
                                    if (item) {
                                        code = item.MA_DICH_VU || item.MA_THUOC || item.MA_VAT_TU || '';
                                        name = item.TEN_DICH_VU || item.TEN_THUOC || item.TEN_VAT_TU || '';
                                        ngayYL = formatDateTime(item.NGAY_YL);
                                        ngayTHYL = formatDateTime(item.NGAY_TH_YL);
                                        ngayKQ = formatDateTime(item.NGAY_KQ);
                                        donGiaBh = renderValue(item.DON_GIA_BH);
                                        if (item.MA_KHOA) maKhoa = renderValue(item.MA_KHOA);
                                    }
                                }
                            }

                            rows.push({
                                key: `${record.id}_error_${errIdx}`,
                                stt: index++, // Excel usually increments row count
                                ma_lk: renderValue(record.summary?.MA_LK),
                                ma_bn: renderValue(record.summary?.MA_BN),
                                ho_ten: renderValue(record.summary?.HO_TEN),
                                ma_the: renderValue(record.summary?.MA_THE_BHYT),
                                ngay_vao: formatDateTime(record.summary?.NGAY_VAO),
                                ngay_ra: formatDateTime(record.summary?.NGAY_RA),
                                ngay_yl: ngayYL,
                                ngay_th_yl: ngayTHYL,
                                ngay_kq: ngayKQ,
                                ngay_vao_noi_tru: ngayVaoNoiTru,
                                ma_dv: renderValue(code),
                                ten_dv: renderValue(name),
                                don_gia_bh: donGiaBh,
                                ma_khoa: maKhoa,
                                ten_khoa: departments[maKhoa] || '',
                                chi_tiet_loi: `[${err.xmlType}] ${err.message || err.ruleName}`,
                                isError: true,
                                ma_doituong_kcb: renderValue(record.summary?.MA_DOITUONG_KCB)
                            });
                        });
                    }
                });

                // Sort by MA_BN then MA_DV as requested
                rows.sort((a, b) => {
                    const bnCompare = (a.ma_bn || '').localeCompare(b.ma_bn || '');
                    if (bnCompare !== 0) return bnCompare;
                    return (a.ma_dv || '').localeCompare(b.ma_dv || '');
                });

                setFullDataSource(rows);
            } catch (error) {
                console.error("Error loading data:", error);
                message.error("Lỗi tải dữ liệu");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Filter Logic
    const filteredDataSource = useMemo(() => {
        if (filterType === 'ALL') return fullDataSource;
        if (filterType === 'ERROR') return fullDataSource.filter(r => r.isError);
        if (filterType === 'VALID') return fullDataSource.filter(r => !r.isError);
        return fullDataSource;
    }, [fullDataSource, filterType]);

    // Update URL when filter changes
    const handleFilterChange = (value: 'ALL' | 'ERROR' | 'VALID') => {
        setFilterType(value);
        router.replace(`?filter=${value}`);
    };

    const handleExportExcel = async () => {
        if (filteredDataSource.length === 0) {
            message.warning("Không có dữ liệu để xuất");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Báo cáo lỗi');
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 5 },
            { header: 'Mã BN', key: 'ma_bn', width: 14 },
            { header: 'Mã BN', key: 'ma_bn', width: 14 },
            { header: 'Mã Khoa', key: 'ma_khoa', width: 10 },
            { header: 'Tên Khoa', key: 'ten_khoa', width: 25 },
            { header: 'Họ tên', key: 'ho_ten', width: 25 },
            { header: 'Ngày vào', key: 'ngay_vao', width: 16 },
            { header: 'Ngày ra', key: 'ngay_ra', width: 16 },
            { header: 'Ngày YL', key: 'ngay_yl', width: 16 },
            { header: 'Ngày TH YL', key: 'ngay_th_yl', width: 16 },
            { header: 'Ngày KQ', key: 'ngay_kq', width: 16 },
            { header: 'Ngày Vào Nội Trú', key: 'ngay_vao_noi_tru', width: 16 },
            { header: 'Mã DV/Thuốc', key: 'ma_dv', width: 15 },
            { header: 'Chi tiết lỗi', key: 'chi_tiet_loi', width: 60 },
            { header: 'Tên DV/Thuốc', key: 'ten_dv', width: 40 },
            { header: 'Đơn giá BH', key: 'don_gia_bh', width: 15 },
            { header: 'Mã LK', key: 'ma_lk', width: 14 },
            { header: 'Mã thẻ', key: 'ma_the', width: 20 },
            { header: 'Mã đối tượng KCB', key: 'ma_doituong_kcb', width: 15 },
        ];
        worksheet.getRow(1).font = { bold: true };

        // Recalculate STT for export
        filteredDataSource.forEach((row, idx) => {
            worksheet.addRow({
                ...row,
                stt: idx + 1,
                ten_khoa: departments[row.ma_khoa] || ''
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Bao_cao_${filterType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleSaveToServer = () => {
        if (filteredDataSource.length === 0) {
            message.warning("Không có dữ liệu để lưu");
            return;
        }
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}${now.getSeconds().toString().padStart(2,'0')}`;
        setSaveFileName(`Bao_cao_${filterType}_${timestamp}`);
        setSaveNote('');
        setIsSaveModalVisible(true);
    };

    const confirmSaveToServer = async () => {
        setIsSaveModalVisible(false);
        setIsSaving(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Báo cáo lỗi');
            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 5 },
                { header: 'Mã BN', key: 'ma_bn', width: 14 },
                { header: 'Mã Khoa', key: 'ma_khoa', width: 10 },
                { header: 'Tên Khoa', key: 'ten_khoa', width: 25 },
                { header: 'Họ tên', key: 'ho_ten', width: 25 },
                { header: 'Ngày vào', key: 'ngay_vao', width: 16 },
                { header: 'Ngày ra', key: 'ngay_ra', width: 16 },
                { header: 'Ngày YL', key: 'ngay_yl', width: 16 },
                { header: 'Ngày TH YL', key: 'ngay_th_yl', width: 16 },
                { header: 'Ngày KQ', key: 'ngay_kq', width: 16 },
                { header: 'Ngày Vào Nội Trú', key: 'ngay_vao_noi_tru', width: 16 },
                { header: 'Mã DV/Thuốc', key: 'ma_dv', width: 15 },
                { header: 'Chi tiết lỗi', key: 'chi_tiet_loi', width: 60 },
                { header: 'Tên DV/Thuốc', key: 'ten_dv', width: 40 },
                { header: 'Đơn giá BH', key: 'don_gia_bh', width: 15 },
                { header: 'Mã LK', key: 'ma_lk', width: 14 },
                { header: 'Mã thẻ', key: 'ma_the', width: 20 },
                { header: 'Mã đối tượng KCB', key: 'ma_doituong_kcb', width: 15 },
            ];
            worksheet.getRow(1).font = { bold: true };

            filteredDataSource.forEach((row, idx) => {
                worksheet.addRow({
                    ...row,
                    stt: idx + 1,
                    ten_khoa: departments[row.ma_khoa] || ''
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const safeName = (saveFileName || `Bao_cao_${filterType}`).replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const fileName = `${safeName}.xlsx`;

            const formData = new FormData();
            formData.append('file', blob, fileName);
            formData.append('note', saveNote);

            const res = await fetch('/api/saved-reports', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (res.ok) {
                message.success('Đã lưu file lên máy chủ thành công!');
            } else {
                message.error('Lỗi khi lưu file: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving to server:', error);
            message.error('Có lỗi xảy ra khi lưu file');
        } finally {
            setIsSaving(false);
        }
    };

    const renderCopyable = (text: string) => {
        if (!text) return text;
        return (
            <Tooltip title="Click để copy">
                <span
                    className="cursor-pointer hover:text-blue-600 hover:underline transition-colors block truncate"
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent row click
                        copyToClipboard(text);
                        message.success('Đã copy: ' + text);
                    }}
                >
                    {text}
                </span>
            </Tooltip>
        );
    };

    const createOnCell = (dataIndex: keyof ReportRow) => (record: ReportRow) => {
        return {
            onClick: (e: React.MouseEvent) => {
                const text = String(record[dataIndex] || '');
                if (text) {
                    copyToClipboard(text);
                    message.success('Đã copy: ' + text);
                }
                setSelectedRowKey(record.key);
            },
            style: { cursor: 'pointer' }
        };
    };

    const columns = [
        { title: 'STT', dataIndex: 'stt', key: 'stt', width: 50, fixed: 'left' as const, align: 'center' as const, render: (_: any, __: any, index: number) => index + 1 },
        { title: 'Mã BN', dataIndex: 'ma_bn', key: 'ma_bn', width: 120, onCell: createOnCell('ma_bn') },
        {
            title: 'Mã Khoa',
            dataIndex: 'ma_khoa',
            key: 'ma_khoa',
            width: 100,
            onCell: createOnCell('ma_khoa'),
            render: (text: string) => <span className="font-bold text-blue-700">{text}</span>
        },
        {
            title: 'Tên Khoa',
            dataIndex: 'ten_khoa',
            key: 'ten_khoa',
            width: 200,
            render: (_: any, record: ReportRow) => <span className="text-slate-600">{departments[record.ma_khoa] || ''}</span>
        },
        { title: 'Họ tên', dataIndex: 'ho_ten', key: 'ho_ten', width: 180, onCell: createOnCell('ho_ten') },
        { title: 'Ngày vào', dataIndex: 'ngay_vao', key: 'ngay_vao', width: 140, onCell: createOnCell('ngay_vao') },
        { title: 'Ngày ra', dataIndex: 'ngay_ra', key: 'ngay_ra', width: 140, onCell: createOnCell('ngay_ra') },
        { title: 'Ngày TH YL', dataIndex: 'ngay_th_yl', key: 'ngay_th_yl', width: 140, onCell: createOnCell('ngay_th_yl') },
        { title: 'Ngày KQ', dataIndex: 'ngay_kq', key: 'ngay_kq', width: 140, onCell: createOnCell('ngay_kq') },
        { title: 'Ngày Vào NT', dataIndex: 'ngay_vao_noi_tru', key: 'ngay_vao_noi_tru', width: 140, onCell: createOnCell('ngay_vao_noi_tru') },
        { title: 'Ngày YL', dataIndex: 'ngay_yl', key: 'ngay_yl', width: 140, onCell: createOnCell('ngay_yl') },
        { title: 'Mã DV/Thuốc', dataIndex: 'ma_dv', key: 'ma_dv', width: 120, onCell: createOnCell('ma_dv'), sorter: (a: ReportRow, b: ReportRow) => (a.ma_dv || '').localeCompare(b.ma_dv || '') },
        {
            title: 'Chi tiết lỗi',
            dataIndex: 'chi_tiet_loi',
            key: 'chi_tiet_loi',
            width: 300,
            onCell: createOnCell('chi_tiet_loi'),
            render: (text: string) => text ? (
                <Tooltip title={text}>
                    <div className="truncate text-red-600 font-medium">{text}</div>
                </Tooltip>
            ) : <Tag color="success">Hợp lệ</Tag>,
            filters: [
                { text: 'Chỉ có lỗi', value: 'hasError' },
                { text: 'Hợp lệ', value: 'valid' }
            ],
            onFilter: (value: any, record: ReportRow) => {
                if (value === 'hasError') return record.isError;
                if (value === 'valid') return !record.isError;
                return true;
            },
        },
        {
            title: 'Tên DV/Thuốc', dataIndex: 'ten_dv', key: 'ten_dv', width: 250, ellipsis: true, onCell: createOnCell('ten_dv'), render: (text: string) => (
                <Tooltip title={text}>
                    <div className="truncate">{text}</div>
                </Tooltip>
            )
        },
        { title: 'Đơn giá BH', dataIndex: 'don_gia_bh', key: 'don_gia_bh', width: 120, onCell: createOnCell('don_gia_bh') },
        { title: 'Mã LK', dataIndex: 'ma_lk', key: 'ma_lk', width: 120, onCell: createOnCell('ma_lk') },
        { title: 'Mã thẻ', dataIndex: 'ma_the', key: 'ma_the', width: 150, onCell: createOnCell('ma_the') },
        { title: 'Mã đối tượng', dataIndex: 'ma_doituong_kcb', key: 'ma_doituong_kcb', width: 120, onCell: createOnCell('ma_doituong_kcb') },
    ];

    const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

    const handleRowClick = (record: ReportRow) => {
        setSelectedRowKey(record.key);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 pt-12">
            <div className="max-w-[1800px] mx-auto space-y-6">
                <Breadcrumb
                    items={[
                        { title: <Link href="/">Trang chủ</Link> },
                        { title: 'Báo cáo chi tiết' },
                    ]}
                />

                <Card
                    title={
                        <div className="flex items-center gap-3">
                            <Link href="/">
                                <Button icon={<ArrowLeftOutlined />} type="text" shape="circle" />
                            </Link>
                            <span className="text-xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent">
                                Báo cáo chi tiết
                            </span>
                        </div>
                    }
                    extra={
                        <Space>
                            <Select
                                value={filterType}
                                onChange={handleFilterChange}
                                style={{ width: 160 }}
                                options={[
                                    { value: 'ALL', label: 'Tất cả hồ sơ' },
                                    { value: 'ERROR', label: 'Chỉ hồ sơ lỗi' },
                                    { value: 'VALID', label: 'Chỉ hồ sơ đúng' }
                                ]}
                            />
                            <Button
                                type="primary"
                                icon={<FileExcelOutlined />}
                                onClick={handleExportExcel}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                Xuất Excel
                            </Button>
                            <Button
                                type="primary"
                                icon={<CloudUploadOutlined />}
                                onClick={handleSaveToServer}
                                loading={isSaving}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                Lưu máy chủ
                            </Button>
                        </Space>
                    }
                    variant="borderless"
                    className="shadow-md rounded-2xl"
                >
                    <Table
                        dataSource={filteredDataSource}
                        columns={columns}
                        loading={loading}
                        scroll={{ x: 1800, y: 'calc(100vh - 250px)' }}
                        pagination={{
                            defaultPageSize: 20,
                            showSizeChanger: true,
                            pageSizeOptions: ['20', '50', '100', '500'],
                            showTotal: (total) => `Tổng ${total} bản ghi`
                        }}
                        size="small"
                        onRow={(record) => ({
                            onClick: () => setSelectedRowKey(record.key), // Only Select
                        })}
                        rowClassName={(record) => record.key === selectedRowKey
                            ? 'bg-yellow-100 font-medium'
                            : (record.isError ? "bg-red-50/50 hover:bg-red-50" : "")
                        }
                        bordered
                    />
                </Card>

                <Modal
                    title="Nhập thông tin cho báo cáo lưu"
                    open={isSaveModalVisible}
                    onOk={confirmSaveToServer}
                    onCancel={() => setIsSaveModalVisible(false)}
                    okText="Lưu"
                    cancelText="Hủy"
                >
                    <div className="space-y-4">
                        <div>
                            <div className="mb-1 font-medium text-slate-600">Tên file (không bao gồm .xlsx)</div>
                            <Input
                                placeholder="Nhập tên file"
                                value={saveFileName}
                                onChange={(e) => setSaveFileName(e.target.value)}
                            />
                        </div>
                        <div>
                            <div className="mb-1 font-medium text-slate-600">Ghi chú (tùy chọn)</div>
                            <Input.TextArea
                                rows={4}
                                placeholder="Nhập ghi chú (VD: số liệu từ ngày... đến ngày...)"
                                value={saveNote}
                                onChange={(e) => setSaveNote(e.target.value)}
                            />
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
}

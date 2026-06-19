'use client';

import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Modal, Form, Input, Select, message, Segmented, Card, Space } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FileExcelOutlined } from '@ant-design/icons';

export default function XmlErrorManager() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'CNTT';

    const [errors, setErrors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [sourceType, setSourceType] = useState('XML'); // XML or CHUYEN_DE
    const [departments, setDepartments] = useState<Record<string, string>>({});
    
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedError, setSelectedError] = useState<any>(null);
    const [form] = Form.useForm();

    useEffect(() => {
        const fetchDepts = async () => {
            try {
                const res = await fetch('/api/departments');
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
    }, []);

    const fetchErrors = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/error-management/xml-errors?sourceType=${sourceType}`);
            if (res.ok) {
                let data = await res.json();
                
                // Nhóm màu cho các lỗi chuyên đề (cùng mã BN)
                if (sourceType === 'CHUYEN_DE') {
                    let groupIndex = 0;
                    data.forEach((row: any, i: number) => {
                        if (i > 0 && row.ma_bn !== data[i - 1].ma_bn) {
                            groupIndex++;
                        }
                        // Gán 2 màu nền so le cho các cặp trùng nhau (Bỏ qua màu mặc định)
                        row.groupColor = groupIndex % 2 === 0 ? 'bg-orange-50/70 hover:bg-orange-100/70' : 'bg-cyan-50/70 hover:bg-cyan-100/70';
                    });
                }
                
                setErrors(data);
            } else {
                message.error('Lỗi khi tải dữ liệu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchErrors();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, sourceType]);

    const handleUpdate = async (values: any) => {
        if (!selectedError) return;
        try {
            const res = await fetch('/api/error-management/xml-errors', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedError.id,
                    ...values
                })
            });

            if (res.ok) {
                message.success('Cập nhật thành công');
                setIsModalVisible(false);
                fetchErrors();
            } else {
                message.error('Cập nhật thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleExportExcel = async () => {
        if (errors.length === 0) {
            message.warning("Không có dữ liệu để xuất");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Danh sách Lỗi');
        
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 5 },
            { header: 'Mã LK', key: 'ma_lk', width: 14 },
            { header: 'Mã BN', key: 'ma_bn', width: 14 },
            { header: 'Mã Khoa', key: 'ma_khoa', width: 10 },
            { header: 'Tên Khoa', key: 'ten_khoa', width: 25 },
            { header: 'Họ tên', key: 'ho_ten', width: 25 },
            { header: 'Ngày vào', key: 'ngay_vao', width: 16 },
            { header: 'Ngày ra', key: 'ngay_ra', width: 16 },
            { header: 'Ngày YL', key: 'ngay_yl', width: 16 },
            { header: 'Ngày TH YL', key: 'ngay_th_yl', width: 16 },
            { header: 'Ngày KQ', key: 'ngay_kq', width: 16 },
            { header: 'Ngày Vào NT', key: 'ngay_vao_noi_tru', width: 16 },
            { header: 'Mã DV/Thuốc', key: 'ma_dv', width: 15 },
            { header: 'Tên DV/Thuốc', key: 'ten_dv', width: 40 },
            { header: 'Đơn giá BH', key: 'don_gia_bh', width: 15 },
            { header: 'Chi tiết lỗi', key: 'chi_tiet_loi', width: 60 },
            { header: 'Trạng thái', key: 'status', width: 15 },
            { header: 'Giải trình khoa', key: 'departmentNote', width: 30 },
            { header: 'Ghi chú Admin', key: 'adminNote', width: 30 },
        ];
        
        worksheet.getRow(1).font = { bold: true };

        const safeDateStr = (date: any) => date ? dayjs(date).format('DD/MM/YYYY HH:mm') : '';

        errors.forEach((row, idx) => {
            worksheet.addRow({
                stt: idx + 1,
                ma_lk: row.ma_lk,
                ma_bn: row.ma_bn,
                ma_khoa: row.ma_khoa,
                ten_khoa: row.ten_khoa || departments[row.ma_khoa] || '',
                ho_ten: row.ho_ten,
                ngay_vao: safeDateStr(row.ngay_vao),
                ngay_ra: safeDateStr(row.ngay_ra),
                ngay_yl: safeDateStr(row.ngay_yl),
                ngay_th_yl: safeDateStr(row.ngay_th_yl),
                ngay_kq: safeDateStr(row.ngay_kq),
                ngay_vao_noi_tru: safeDateStr(row.ngay_vao_noi_tru),
                ma_dv: row.ma_dv,
                ten_dv: row.ten_dv,
                don_gia_bh: row.don_gia_bh,
                chi_tiet_loi: row.chi_tiet_loi,
                status: row.status === 'PENDING' ? 'Chờ xử lý' : 'Đã giải trình',
                departmentNote: row.departmentNote || '',
                adminNote: row.adminNote || '',
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Danh_sach_loi_${sourceType}_${dayjs().format('YYYYMMDD_HHmm')}.xlsx`);
    };

    const columns = [
        {
            title: 'Thao tác',
            width: 80,
            fixed: 'left' as const,
            render: (_: any, record: any) => (
                <Button size="small" type="primary" onClick={() => {
                    setSelectedError(record);
                    form.setFieldsValue({
                        status: record.status,
                        departmentNote: record.departmentNote,
                        adminNote: record.adminNote
                    });
                    setIsModalVisible(true);
                }}>Xử lý</Button>
            )
        },
        {
            title: 'Mã LK / BN',
            key: 'ma',
            width: 150,
            render: (_: any, record: any) => (
                <div>
                    <div className="font-bold text-blue-600">{record.ma_lk}</div>
                    <div className="text-xs text-slate-500">BN: {record.ma_bn}</div>
                </div>
            )
        },
        { title: 'Khoa', dataIndex: 'ma_khoa', width: 100 },
        { 
            title: 'Tên Khoa', 
            dataIndex: 'ten_khoa', 
            width: 200,
            render: (text: string, record: any) => text || departments[record.ma_khoa] || ''
        },
        { title: 'Họ tên', dataIndex: 'ho_ten', width: 180 },
        { title: 'Ngày vào', dataIndex: 'ngay_vao', width: 150, render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '' },
        { title: 'Ngày ra', dataIndex: 'ngay_ra', width: 150, render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '' },
        { title: 'Ngày YL', dataIndex: 'ngay_yl', width: 150, render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '' },
        { title: 'Ngày TH YL', dataIndex: 'ngay_th_yl', width: 150, render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '' },
        { title: 'Ngày KQ', dataIndex: 'ngay_kq', width: 150, render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '' },
        { title: 'Ngày Vào NT', dataIndex: 'ngay_vao_noi_tru', width: 150, render: (d: string) => d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '' },
        { title: 'Mã DV', dataIndex: 'ma_dv', width: 120 },
        { title: 'Tên DV', dataIndex: 'ten_dv', width: 200, ellipsis: true },
        { title: 'Đơn giá BH', dataIndex: 'don_gia_bh', width: 120 },
        {
            title: 'Chi tiết lỗi',
            dataIndex: 'chi_tiet_loi',
            width: 250,
            render: (text: string) => <div className="text-red-600 font-medium whitespace-pre-wrap">{text}</div>
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 120,
            render: (status: string) => (
                <Tag color={status === 'PENDING' ? 'warning' : 'success'}>
                    {status === 'PENDING' ? 'Chờ xử lý' : 'Đã giải trình'}
                </Tag>
            )
        },
        {
            title: 'Giải trình của Khoa',
            dataIndex: 'departmentNote',
            width: 200,
            render: (text: string) => <div className="text-slate-600 italic whitespace-pre-wrap">{text || '-'}</div>
        },
        {
            title: 'Ghi chú CNTT',
            dataIndex: 'adminNote',
            width: 200,
            render: (text: string) => <div className="text-slate-600 italic whitespace-pre-wrap">{text || '-'}</div>
        },
        {
            title: 'Ngày lưu',
            dataIndex: 'createdAt',
            width: 150,
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm')
        }
    ];

    return (
        <div className="w-full px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1 leading-tight">Danh sách Lỗi Hồ sơ</h1>
                    <p className="text-sm sm:text-base text-slate-500 m-0">Quản lý và giải trình các lỗi quét từ XML / Chuyên đề</p>
                </div>
                
                <Space>
                    <Segmented
                        options={[
                            { label: 'Lỗi XML', value: 'XML' },
                            { label: 'Lỗi Chuyên đề', value: 'CHUYEN_DE' }
                        ]}
                        value={sourceType}
                        onChange={(val: any) => setSourceType(val)}
                    />
                    <Button 
                        type="primary" 
                        icon={<FileExcelOutlined />} 
                        onClick={handleExportExcel}
                        className="bg-green-600 hover:bg-green-700"
                    >
                        Xuất Excel
                    </Button>
                </Space>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={errors}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ defaultPageSize: 15 }}
                    scroll={{ x: 1200 }}
                    rowClassName={(record: any) => record.groupColor || ''}
                />
            </Card>

            <Modal
                title="Xử lý Lỗi"
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onOk={() => form.submit()}
                okText="Lưu lại"
                cancelText="Hủy"
            >
                <Form form={form} layout="vertical" onFinish={handleUpdate}>
                    <Form.Item name="status" label="Trạng thái">
                        <Select>
                            <Select.Option value="PENDING">Chờ xử lý</Select.Option>
                            <Select.Option value="EXPLAINED">Đã giải trình</Select.Option>
                        </Select>
                    </Form.Item>
                    
                    <Form.Item name="departmentNote" label="Giải trình của khoa">
                        <Input.TextArea rows={4} placeholder="Nhập lý do hoặc giải trình..." />
                    </Form.Item>

                    {isAdmin && (
                        <Form.Item name="adminNote" label="Ghi chú của CNTT/Admin">
                            <Input.TextArea rows={4} placeholder="Ghi chú nội bộ..." />
                        </Form.Item>
                    )}
                </Form>
            </Modal>
        </div>
    );
}

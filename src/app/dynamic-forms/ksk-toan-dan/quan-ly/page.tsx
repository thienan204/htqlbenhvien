'use client';
import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Space, message, Popconfirm, Tabs, Input, Tag } from 'antd';
import { DownloadOutlined, DeleteOutlined, EditOutlined, PlusOutlined, CopyOutlined, EyeOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import Link from 'next/link';

export default function KskQuanLyPage() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<any>({});

    useEffect(() => {
        fetchData();
        fetchCategories();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/ksk-toan-dan');
            const json = await res.json();
            setData(json);
        } catch (error) {
            message.error('Lỗi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const types = ['PROVINCE', 'WARD', 'GENDER', 'DAN_TOC', 'QUOC_GIA', 'NGHE_NGHIEP', 'CO_QUAN'];
            const catMap: any = {};
            for (const type of types) {
                const res = await fetch(`/api/system-categories?type=${type}`);
                if (res.ok) {
                    const list = await res.json();
                    catMap[type] = list;
                }
            }
            setCategories(catMap);
        } catch (error) {
            console.error('Lỗi tải danh mục', error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/ksk-toan-dan?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Xóa thành công');
                fetchData();
            } else {
                message.error('Lỗi xóa dữ liệu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const getCatName = (type: string, code: string) => {
        if (!categories[type]) return code;
        const item = categories[type].find((x: any) => x.code === code);
        return item ? `${item.code}-${item.name}` : code;
    };

    const handleExport = () => {
        if (data.length === 0) {
            message.warning('Không có dữ liệu để xuất');
            return;
        }

        const exportData = data.map((item, index) => {
            return {
                'STT': index + 1,
                'TENBENHNHAN (Bắt buộc)': item.tenBenhNhan,
                'NGAYSINH (Bắt buộc)': item.ngaySinh,
                'GIOITINH (Bắt buộc)': getCatName('GENDER', item.gioiTinh),
                'NGHENGHIEP (Bắt buộc)': getCatName('NGHE_NGHIEP', item.ngheNghiep),
                'DANTOC (Bắt buộc)': getCatName('DAN_TOC', item.danToc),
                'QUOCGIA (Bắt buộc)': getCatName('QUOC_GIA', item.quocGia),
                'TÊN CƠ QUAN': item.tenCoQuan || '',
                'CCCD (Bắt buộc)': item.cccd,
                'NGAYCAPCCCD': item.ngayCapCccd || '',
                'NOICAPCCCD': item.noiCapCccd || '',
                'TINH (Bắt buộc)': getCatName('PROVINCE', item.tinh),
                'XA (Bắt buộc)': getCatName('WARD', item.xa),
                'DIACHI (Bắt buộc)': item.diaChi,
                'DOTKHAM': item.dotKham || '',
                'SDTBENHNHAN (Bắt buộc)': item.sdtBenhNhan,
                'TENNGUOITHAN': item.tenNguoiThan || '',
                'MA_BHYT': item.maBHYT || '',
                'BHYT_BD': item.bhytBd || '',
                'BHYT_KT': item.bhytKt || '',
                'MA_KCBBD': item.maKcbbd || '',
                'DIACHI_BHYT': item.diaChiBhyt || '',
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws['!cols'] = [
            { wch: 5 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
            { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 },
            { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
            { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DANHSACH");

        XLSX.writeFile(wb, `DanhSach_KSK_${new Date().getTime()}.xlsx`);
    };

    // Columns cho Tab 2 (Tất cả hồ sơ)
    const columnsAll = [
        { title: 'Họ tên', dataIndex: 'tenBenhNhan', key: 'tenBenhNhan' },
        { title: 'SĐT', dataIndex: 'sdtBenhNhan', key: 'sdtBenhNhan' },
        { title: 'CCCD', dataIndex: 'cccd', key: 'cccd' },
        { title: 'Ngày sinh', dataIndex: 'ngaySinh', key: 'ngaySinh' },
        { title: 'Địa chỉ', dataIndex: 'diaChi', key: 'diaChi' },
        { title: 'Tên Cơ quan', dataIndex: 'tenCoQuan', key: 'tenCoQuan' },
        { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt', render: (val: any) => new Date(val).toLocaleString() },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Space size="middle">
                    <Link href={`/dynamic-forms/ksk-toan-dan/tra-cuu?sdt=${record.sdtBenhNhan}`}>
                        <Button type="primary" size="small" icon={<EditOutlined />}>Sửa</Button>
                    </Link>
                    <Popconfirm title="Chắc chắn xóa?" onConfirm={() => handleDelete(record.id)}>
                        <Button danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // Tạo dữ liệu cho Bảng Cơ quan (Tab 1)
    const agencyData = (categories['CO_QUAN'] || []).map((agency: any) => {
        // Đếm số lượng hồ sơ
        const count = data.filter(d => d.maCoQuan === agency.code).length;
        const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/htqlbenhvien/dynamic-forms/ksk-toan-dan/portal/${agency.code}`;
        return {
            ...agency,
            count,
            link
        };
    });

    const columnsAgency = [
        { title: 'Mã Cơ quan', dataIndex: 'code', key: 'code', render: (val: string) => <Tag color="blue">{val}</Tag> },
        { title: 'Tên Cơ quan / Doanh nghiệp', dataIndex: 'name', key: 'name', render: (val: string) => <strong>{val}</strong> },
        { title: 'Số lượng hồ sơ', dataIndex: 'count', key: 'count', render: (val: number) => <span className="font-semibold text-green-600">{val} hồ sơ</span> },
        { 
            title: 'Đường Link (Gửi cho cơ quan)', 
            key: 'link', 
            render: (_: any, record: any) => (
                <div className="flex gap-2 items-center">
                    <Input value={record.link} readOnly size="small" style={{ width: 250 }} />
                    <Button 
                        size="small"
                        icon={<CopyOutlined />} 
                        onClick={() => {
                            navigator.clipboard.writeText(record.link);
                            message.success('Đã copy link!');
                        }}
                    >
                        Copy
                    </Button>
                </div>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            render: (_: any, record: any) => (
                <Link href={`/dynamic-forms/ksk-toan-dan/portal/${record.code}`}>
                    <Button type="primary" size="small" icon={<EyeOutlined />}>Xem danh sách</Button>
                </Link>
            )
        }
    ];

    const tabItems = [
        {
            key: '1',
            label: '1. Quản lý theo Cơ quan',
            children: (
                <Table 
                    columns={columnsAgency} 
                    dataSource={agencyData} 
                    rowKey="code" 
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            )
        },
        {
            key: '2',
            label: '2. Tất cả hồ sơ chi tiết',
            children: (
                <Table 
                    columns={columnsAll} 
                    dataSource={data} 
                    rowKey="id" 
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            )
        }
    ];

    return (
        <div className="p-6">
            <Card 
                title="Quản lý Hồ sơ Khám Sức Khỏe Toàn Dân" 
                extra={
                    <Space>
                        <Link href="/dynamic-forms/ksk-toan-dan/nhap-lieu">
                            <Button type="primary" icon={<PlusOutlined />}>Thêm mới lẻ</Button>
                        </Link>
                        <Button type="dashed" icon={<DownloadOutlined />} onClick={handleExport}>Xuất Excel Toàn Bộ</Button>
                    </Space>
                }
            >
                <Tabs type="card" items={tabItems} />
            </Card>
        </div>
    );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, message, Card } from 'antd';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FileExcelOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function XmlErrorSummaryClient() {
    const { user } = useAuth();
    const router = useRouter();

    const [errors, setErrors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState<Record<string, string>>({});

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
            // Không truyền sourceType để lấy toàn bộ XML và CHUYEN_DE
            const res = await fetch(`/api/error-management/xml-errors`);
            if (res.ok) {
                let data = await res.json();
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
    }, [user]);

    const summaryData = useMemo(() => {
        // Gom nhóm lỗi
        // Key: ma_khoa + "_" + danh_sach_loi
        const groups: Record<string, any> = {};

        errors.forEach(e => {
            let danhSach = 'Lỗi xml';
            let detailParam = '';
            
            if (e.sourceType === 'CHUYEN_DE') {
                // Thử cắt chuỗi từ chi tiết lỗi: "[CHUYEN_DE] Trùng mã máy..." -> "Trùng mã máy"
                const match = e.chi_tiet_loi?.match(/\[.*?\]\s*(.*?)\s*-/);
                if (match) {
                    detailParam = match[1].trim();
                    danhSach = `Lỗi chuyên đề ${detailParam.toLowerCase()}`;
                } else {
                    detailParam = 'CHUYEN_DE';
                    danhSach = 'Lỗi chuyên đề khác';
                }
            }

            const khoa = e.ma_khoa || 'KHONG_XAC_DINH';
            const key = `${khoa}_${danhSach}`;

            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    danhSach: danhSach,
                    detailParam: detailParam,
                    sourceType: e.sourceType || 'XML',
                    ma_khoa: khoa,
                    ten_khoa: e.ten_khoa || departments[khoa] || '',
                    count: 0,
                    latestDate: e.createdAt
                };
            }

            groups[key].count += 1;
            if (dayjs(e.createdAt).isAfter(dayjs(groups[key].latestDate))) {
                groups[key].latestDate = e.createdAt;
            }
        });

        // Convert object to array and sort by khoa then count
        return Object.values(groups).sort((a, b) => {
            if (a.ma_khoa !== b.ma_khoa) return a.ma_khoa.localeCompare(b.ma_khoa);
            return b.count - a.count;
        }).map((item, idx) => ({ ...item, stt: idx + 1 }));
    }, [errors, departments]);

    const handleExportExcel = async () => {
        if (summaryData.length === 0) {
            message.warning("Không có dữ liệu để xuất");
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Tổng hợp Lỗi');
        
        worksheet.columns = [
            { header: 'STT', key: 'stt', width: 5 },
            { header: 'Danh sách', key: 'danhSach', width: 40 },
            { header: 'Mã khoa', key: 'ma_khoa', width: 15 },
            { header: 'Khoa phòng', key: 'ten_khoa', width: 30 },
            { header: 'Số lượng', key: 'count', width: 10 },
            { header: 'Ngày Lưu', key: 'latestDate', width: 20 }
        ];
        
        worksheet.getRow(1).font = { bold: true };

        summaryData.forEach((row) => {
            worksheet.addRow({
                stt: row.stt,
                danhSach: row.danhSach,
                ma_khoa: row.ma_khoa,
                ten_khoa: row.ten_khoa,
                count: row.count,
                latestDate: dayjs(row.latestDate).format('DD/MM/YYYY HH:mm')
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Bao_Cao_Tong_Hop_Loi_${dayjs().format('YYYYMMDD')}.xlsx`);
    };

    const columns = [
        {
            title: 'STT',
            dataIndex: 'stt',
            width: 60,
            align: 'center' as const
        },
        {
            title: 'Danh sách',
            dataIndex: 'danhSach',
            width: 250,
            render: (text: string) => <span className="font-medium text-slate-700">{text}</span>
        },
        {
            title: 'Mã khoa',
            dataIndex: 'ma_khoa',
            width: 100,
            render: (text: string) => <span className="text-slate-500">{text}</span>
        },
        {
            title: 'Khoa phòng',
            dataIndex: 'ten_khoa',
            width: 200
        },
        {
            title: 'Số lượng',
            dataIndex: 'count',
            width: 100,
            align: 'center' as const,
            render: (count: number, record: any) => {
                // Link tới trang chi tiết kèm theo điều kiện lọc
                const query = new URLSearchParams({
                    sourceType: record.sourceType,
                    ma_khoa: record.ma_khoa,
                });
                if (record.detailParam) {
                    query.append('detail', record.detailParam);
                }
                
                return (
                    <Link href={`/error-management/xml-errors?${query.toString()}`} className="text-blue-600 font-bold hover:underline cursor-pointer">
                        {count}
                    </Link>
                );
            }
        },
        {
            title: 'Ngày Lưu Gần Nhất',
            dataIndex: 'latestDate',
            width: 150,
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm')
        }
    ];

    return (
        <div className="w-full px-4 sm:px-6 py-4 sm:py-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                    <Button 
                        icon={<ArrowLeftOutlined />} 
                        onClick={() => router.push('/error-management/xml-errors')}
                        className="border-slate-200"
                    >
                        Quay lại
                    </Button>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1 leading-tight">Báo cáo Tổng hợp Lỗi</h1>
                        <p className="text-sm sm:text-base text-slate-500 m-0">Thống kê số lượng lỗi theo từng khoa phòng và từng nhóm lỗi</p>
                    </div>
                </div>
                
                <Button 
                    type="primary" 
                    icon={<FileExcelOutlined />} 
                    onClick={handleExportExcel}
                    className="bg-green-600 hover:bg-green-700"
                >
                    Xuất Excel
                </Button>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={summaryData}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        defaultPageSize: 20,
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50', '100'],
                        showTotal: (total) => `Tổng: ${total} nhóm lỗi`
                    }}
                    scroll={{ x: 800 }}
                    size="middle"
                />
            </Card>
        </div>
    );
}

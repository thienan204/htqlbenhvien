'use client';
import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Upload, message, Table, Alert, Spin, Space, Popconfirm } from 'antd';
import { UploadOutlined, BuildOutlined, PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const { Title, Paragraph } = Typography;
const { Dragger } = Upload;

export default function AgencyPortalPage() {
    const params = useParams();
    const maCoQuan = params.maCoQuan as string;

    const [tenCoQuan, setTenCoQuan] = useState('');
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [result, setResult] = useState<any>(null);
    const [fileList, setFileList] = useState<any[]>([]);
    
    // Bảng dữ liệu
    const [data, setData] = useState<any[]>([]);
    const [tableLoading, setTableLoading] = useState(false);
    
    // System categories để map ID ra Tên
    const [cats, setCats] = useState<any[]>([]);

    useEffect(() => {
        // Fetch tenCoQuan and cats
        const init = async () => {
            try {
                // Lấy tất cả danh mục
                const catRes = await fetch('/api/system-categories');
                const catData = await catRes.json();
                setCats(catData);
                
                // Lọc ra tên cơ quan
                const coQuanObj = catData.find((c: any) => c.type === 'CO_QUAN' && c.code === maCoQuan);
                if (coQuanObj) {
                    setTenCoQuan(coQuanObj.name);
                } else {
                    message.error('Không tìm thấy Cơ quan này trong hệ thống!');
                }
            } catch (err) {
                console.error(err);
            } finally {
                setPageLoading(false);
            }
        };
        init();
        fetchData();
    }, [maCoQuan]);

    const fetchData = async () => {
        setTableLoading(true);
        try {
            const res = await fetch(`/api/ksk-toan-dan?maCoQuan=${maCoQuan}`);
            if (res.ok) {
                const list = await res.json();
                setData(list);
            }
        } catch (error) {
            console.error('Lỗi lấy danh sách hồ sơ', error);
        } finally {
            setTableLoading(false);
        }
    };

    const parseExcelVal = (val: any) => {
        if (!val) return '';
        const str = String(val).trim();
        const parts = str.split('-');
        if (parts.length > 1) {
            return parts[0].trim();
        }
        return str;
    };

    const handleUpload = async (file: File) => {
        if (!tenCoQuan) {
            message.error('Lỗi xác định Cơ quan. Vui lòng liên hệ Admin!');
            return false;
        }

        setLoading(true);
        setResult(null);

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    
                    const sheetName = workbook.SheetNames.includes('DANHSACH') ? 'DANHSACH' : workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    if (jsonData.length < 2) {
                        message.error('File Excel không có dữ liệu (hoặc không đúng cấu trúc)');
                        setLoading(false);
                        return;
                    }

                    const parsedData = [];
                    // Row 0 is header, start from Row 1
                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        if (!row || row.length === 0 || !row[1]) continue; 

                        parsedData.push({
                            tenBenhNhan: String(row[1] || ''),
                            ngaySinh: String(row[2] || ''),
                            gioiTinh: parseExcelVal(row[3]),
                            ngheNghiep: parseExcelVal(row[4]),
                            danToc: parseExcelVal(row[5]),
                            quocGia: parseExcelVal(row[6]),
                            cccd: String(row[7] || ''),
                            ngayCapCccd: String(row[8] || ''),
                            noiCapCccd: String(row[9] || ''),
                            tinh: parseExcelVal(row[10]),
                            xa: parseExcelVal(row[11]),
                            diaChi: String(row[12] || ''),
                            dotKham: String(row[13] || ''),
                            sdtBenhNhan: String(row[14] || ''),
                            tenNguoiThan: String(row[15] || ''),
                            maBHYT: String(row[16] || ''),
                            bhytBd: String(row[17] || ''),
                            bhytKt: String(row[18] || ''),
                            maKcbbd: String(row[19] || ''),
                            diaChiBhyt: String(row[20] || '')
                        });
                    }

                    if (parsedData.length === 0) {
                        message.error('Không tìm thấy dữ liệu hợp lệ trong file');
                        setLoading(false);
                        return;
                    }

                    // Gửi lên server
                    const res = await fetch('/api/ksk-toan-dan/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            maCoQuan: maCoQuan,
                            tenCoQuan: tenCoQuan,
                            data: parsedData
                        })
                    });

                    if (res.ok) {
                        const resultData = await res.json();
                        setResult(resultData);
                        if (resultData.success) {
                            message.success(`Đã import thành công ${resultData.successCount} hồ sơ!`);
                            fetchData(); // Load lại bảng
                        }
                    } else {
                        const err = await res.json();
                        message.error(err.error || 'Lỗi xử lý import');
                    }
                } catch (error) {
                    message.error('Lỗi đọc file Excel');
                    console.error(error);
                } finally {
                    setLoading(false);
                }
            };
            reader.readAsBinaryString(file);
        } catch (err) {
            setLoading(false);
            message.error('Lỗi khi tải file');
        }

        return false; // Chặn upload mặc định của antd
    };



    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/ksk-toan-dan/${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Xóa hồ sơ thành công!');
                fetchData();
            } else {
                message.error('Lỗi khi xóa hồ sơ');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi xóa hồ sơ');
        }
    };

    const getCatName = (type: string, code: string) => {
        if (!code) return '';
        const found = cats.find(c => c.type === type && c.code === code);
        return found ? found.name : code;
    };

    const columns = [
        { title: 'Họ tên', dataIndex: 'tenBenhNhan', key: 'tenBenhNhan', render: (text: string) => <strong className="text-blue-600">{text}</strong> },
        { title: 'SĐT', dataIndex: 'sdtBenhNhan', key: 'sdtBenhNhan' },
        { title: 'Giới tính', dataIndex: 'gioiTinh', key: 'gioiTinh', render: (val: string) => getCatName('GENDER', val) },
        { title: 'CCCD', dataIndex: 'cccd', key: 'cccd' },
        { title: 'Ngày sinh', dataIndex: 'ngaySinh', key: 'ngaySinh' },
        { title: 'Thao tác', key: 'action', render: (_: any, record: any) => (
            <Space size="middle">
                <Link href={`/dynamic-forms/ksk-toan-dan/tra-cuu?sdt=${record.sdtBenhNhan}`}>
                    <Button type="primary" size="small" icon={<EditOutlined />}>Sửa</Button>
                </Link>
                <Popconfirm title="Chắc chắn xóa?" onConfirm={() => handleDelete(record.id)}>
                    <Button danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
            </Space>
        )}
    ];

    if (pageLoading) return <div className="p-10 text-center"><Spin size="large" /></div>;

    if (!tenCoQuan) {
        return (
            <div className="p-10 text-center">
                <Alert type="error" message="LỖI LIÊN KẾT" description="Không tìm thấy cơ quan này trong hệ thống. Link có thể đã sai hoặc bị xóa." showIcon />
            </div>
        );
    }

    const handleDownloadSample = async () => {
        try {
            message.loading({ content: 'Đang tạo file mẫu (có danh sách chọn)...', key: 'export' });
            
            const res = await fetch('/api/ksk-toan-dan/export-template');
            if (!res.ok) throw new Error('Failed to generate template');
            
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'MauFileImportBenhNhan_ksktoandan.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            message.success({ content: 'Tải file mẫu thành công!', key: 'export', duration: 3 });
        } catch (error) {
            console.error(error);
            message.error({ content: 'Lỗi tải file mẫu', key: 'export' });
        }
    };

    return (
        <div className="p-6">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <Title level={2} className="!mb-0"><BuildOutlined className="mr-2 text-blue-500" /> Portal: {tenCoQuan}</Title>
                    <Paragraph className="text-gray-500 mt-2">
                        Quản lý danh sách nhân viên tham gia Khám Sức Khỏe Toàn Dân của đơn vị.
                    </Paragraph>
                </div>
            </div>

            <Card 
                className="shadow-sm border-t-4 border-t-green-500 mb-6" 
                title="1. Tải lên danh sách nhân viên hàng loạt (Từ File Excel)"
                extra={<Button type="dashed" icon={<DownloadOutlined />} onClick={handleDownloadSample}>Tải File Mẫu (Kèm Danh Mục)</Button>}
            >
                <Dragger
                    disabled={loading}
                    fileList={fileList}
                    beforeUpload={handleUpload}
                    onRemove={() => setFileList([])}
                    maxCount={1}
                    accept=".xlsx, .xls"
                >
                    <p className="ant-upload-drag-icon">
                        <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">Nhấn hoặc Kéo thả file Excel vào khu vực này để Import</p>
                    <p className="ant-upload-hint">
                        File Excel cần giữ nguyên cấu trúc mẫu. Tất cả hồ sơ sẽ tự động được gán vào <strong>{tenCoQuan}</strong>.
                    </p>
                </Dragger>

                {loading && (
                    <div className="text-center mt-4">
                        <Spin tip="Đang xử lý dữ liệu import, vui lòng chờ..." />
                    </div>
                )}

                {result && (
                    <div className="mt-4">
                        <Alert
                            message={`Thành công: ${result.successCount} hồ sơ`}
                            type={result.successCount > 0 ? "success" : "info"}
                            showIcon
                            className="mb-2"
                        />
                        {result.errorCount > 0 && (
                            <Alert
                                message={`Lỗi: ${result.errorCount} hồ sơ`}
                                description={
                                    <ul className="pl-4 mt-2">
                                        {result.errors.map((err: string, idx: number) => (
                                            <li key={idx}>{err}</li>
                                        ))}
                                    </ul>
                                }
                                type="error"
                                showIcon
                            />
                        )}
                    </div>
                )}
            </Card>

            <Card 
                title="2. Danh sách nhân sự đã đăng ký" 
                extra={
                    <Space>
                        <Link href={`/dynamic-forms/ksk-toan-dan/nhap-lieu?maCoQuan=${maCoQuan}&tenCoQuan=${encodeURIComponent(tenCoQuan)}`}>
                            <Button type="primary" icon={<PlusOutlined />}>Thêm mới 1 người</Button>
                        </Link>
                    </Space>
                }
            >
                <Table 
                    columns={columns} 
                    dataSource={data} 
                    rowKey="id" 
                    loading={tableLoading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>
        </div>
    );
}

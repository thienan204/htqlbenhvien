'use client';

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, message, Spin, Typography, Upload, Popconfirm, Image } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, ReloadOutlined, SearchOutlined, UploadOutlined, PrinterOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { Input, Switch, Tag } from 'antd';
import { useAuth } from '@/contexts/AuthContext';

const { Title } = Typography;

export default function DataFormClient({ formId }: { formId: string }) {
    const id = formId;
    const router = useRouter();
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const [loading, setLoading] = useState(true);
    const [formConfig, setFormConfig] = useState<any>(null);
    const [dataRows, setDataRows] = useState<any[]>([]);
    const [searchText, setSearchText] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const basePath = window.location.pathname.split('/dynamic-forms')[0];
            // Fetch config to know columns
            const resConfig = await fetch(`${basePath}/api/dynamic-forms/${id}`);
            if (resConfig.ok) {
                setFormConfig(await resConfig.json());
            }

            // Fetch data
            const resData = await fetch(`${basePath}/api/dynamic-forms/${id}/data`);
            if (resData.ok) {
                setDataRows(await resData.json());
            }
        } catch (error) {
            message.error('Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleToggleStatus = async (rowId: string, isDone: boolean) => {
        try {
            const basePath = window.location.pathname.split('/dynamic-forms')[0];
            const res = await fetch(`${basePath}/api/dynamic-forms/${id}/data/${rowId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isDone })
            });

            if (res.ok) {
                message.success('Cập nhật trạng thái thành công');
                // Cập nhật lại state mà không cần tải lại toàn bộ bảng
                setDataRows(prev => prev.map(row => 
                    row.id === rowId ? { ...row, isDone } : row
                ));
            } else {
                message.error('Lỗi khi cập nhật trạng thái');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi cập nhật trạng thái');
        }
    };

    const handleDeleteRow = async (rowId: string) => {
        try {
            const basePath = window.location.pathname.split('/dynamic-forms')[0];
            const res = await fetch(`${basePath}/api/dynamic-forms/${id}/data/${rowId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                message.success('Đã xóa dữ liệu thành công');
                setDataRows(prev => prev.filter(row => row.id !== rowId));
            } else {
                message.error('Lỗi khi xóa dữ liệu');
            }
        } catch (error) {
            message.error('Lỗi kết nối khi xóa dữ liệu');
        }
    };

    const handlePrintImages = (printData: { name: string, cccd: string, images: string[] }[]) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            message.error('Vui lòng cho phép mở popup để in ảnh');
            return;
        }

        const totalImages = printData.reduce((acc, curr) => acc + curr.images.length, 0);

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>In ảnh hàng loạt</title>
                <style>
                    body {
                        margin: 0;
                        padding: 20px;
                        font-family: Arial, sans-serif;
                    }
                    .page {
                        page-break-after: always;
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .page:last-child {
                        page-break-after: auto;
                    }
                    .header-info {
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                        border-bottom: 2px solid #ccc;
                    }
                    h2 {
                        margin: 5px 0;
                        color: #333;
                        text-transform: uppercase;
                    }
                    p {
                        margin: 5px 0;
                        font-size: 18px;
                        font-weight: bold;
                        color: #555;
                    }
                    img {
                        max-width: 100%;
                        max-height: 40vh;
                        object-fit: contain;
                        margin: 10px;
                        page-break-inside: avoid;
                        display: inline-block;
                        border: 1px solid #eee;
                    }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                ${printData.map(item => `
                    <div class="page">
                        <div class="header-info">
                            <h2>${item.name}</h2>
                            <p>SỐ CCCD: ${item.cccd}</p>
                        </div>
                        <div class="images-container">
                            ${item.images.map(url => `<img src="${url}" />`).join('')}
                        </div>
                    </div>
                `).join('')}
                <script>
                    let loadedCount = 0;
                    const totalImages = ${totalImages};
                    const images = document.querySelectorAll('img');
                    
                    if (totalImages === 0) {
                        window.print();
                        window.close();
                    } else {
                        images.forEach(img => {
                            img.onload = checkDone;
                            img.onerror = checkDone;
                        });
                    }

                    function checkDone() {
                        loadedCount++;
                        if (loadedCount === totalImages) {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        }
                    }
                </script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrintAllImages = () => {
        let printData: { name: string, cccd: string, images: string[] }[] = [];
        
        filteredData.forEach((row: any) => {
            let urls: string[] = [];
            
            formConfig?.config?.forEach((f: any) => {
                if (f.type === 'image' && row.data[f.name]) {
                    const rowUrls = row.data[f.name].split(',').map((u: string) => u.trim()).filter(Boolean);
                    urls = [...urls, ...rowUrls];
                }
            });

            if (urls.length > 0) {
                // Tự động tìm cột chứa tên và CCCD dựa vào label (bỏ chữ id để tránh nhầm với LOAIGT_ID)
                const nameField = formConfig?.config?.find((f: any) => /tên|name|nhân viên|cán bộ|họ/i.test(f.label))?.name;
                const cccdField = formConfig?.config?.find((f: any) => /cccd|cmnd|căn cước|định danh/i.test(f.label))?.name;
                
                printData.push({
                    name: nameField ? row.data[nameField] || 'Không rõ tên' : 'Không rõ tên',
                    cccd: cccdField ? row.data[cccdField] || 'Không có CCCD' : 'Không có CCCD',
                    images: urls
                });
            }
        });

        if (printData.length === 0) {
            message.warning('Không có ảnh nào trong danh sách hiện tại');
            return;
        }
        
        handlePrintImages(printData);
    };


    // Hàm lấy chữ cái đầu của mọi từ (VD: "Hà Mạnh Chí" -> "hmc")
    const getInitials = (name: string) => {
        if (!name) return '';
        return name.trim().split(/\s+/).map(word => word.charAt(0)).join('').toLowerCase();
    };

    // Lọc dữ liệu theo ô tìm kiếm
    const filteredData = dataRows.filter((row: any) => {
        if (!searchText) return true;
        const searchLower = searchText.toLowerCase().trim();
        
        // Tìm trong tất cả các cột dữ liệu
        return Object.values(row.data).some((val: any) => {
            if (typeof val !== 'string') return false;
            // Khớp nguyên văn hoặc khớp chữ cái đầu
            if (val.toLowerCase().includes(searchLower)) return true;
            if (getInitials(val).includes(searchLower)) return true;
            return false;
        });
    });

    const handleExportExcel = () => {
        if (!formConfig || dataRows.length === 0) {
            message.warning('Không có dữ liệu để xuất');
            return;
        }

        const exportData = dataRows.map(row => {
            const flatRow: any = {};
            formConfig.config.forEach((field: any) => {
                flatRow[field.label] = row.data[field.name] || '';
            });
            flatRow['Trạng thái'] = row.isDone ? 'Đã xong' : 'Chưa xử lý';
            flatRow['Cập nhật lần cuối bởi'] = row.lastUpdatedBy || '';
            flatRow['Thời gian cập nhật'] = new Date(row.updatedAt).toLocaleString('vi-VN');
            return flatRow;
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, `${formConfig.slug}_export.xlsx`);
    };

    const handleImportExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                setLoading(true);
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                
                const basePath = window.location.pathname.split('/dynamic-forms')[0];
                const res = await fetch(`${basePath}/api/dynamic-forms/${id}/data/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: jsonData })
                });
                
                const result = await res.json();
                if (res.ok) {
                    message.success(result.message || 'Import dữ liệu thành công!');
                    fetchData(); // reload table
                } else {
                    message.error(result.error || 'Lỗi khi import dữ liệu');
                    setLoading(false);
                }
            } catch (error) {
                console.error(error);
                message.error('Lỗi phân tích file Excel');
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
        return false; // Prevent default upload behavior
    };

    const handleImportStatusExcel = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                setLoading(true);
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                
                const basePath = window.location.pathname.split('/dynamic-forms')[0];
                const res = await fetch(`${basePath}/api/dynamic-forms/${id}/data/import-status`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: jsonData })
                });
                
                const result = await res.json();
                if (res.ok) {
                    message.success(result.message || 'Cập nhật trạng thái thành công!');
                    fetchData(); // reload table
                } else {
                    message.error(result.error || 'Lỗi khi cập nhật trạng thái');
                    setLoading(false);
                }
            } catch (error) {
                console.error(error);
                message.error('Lỗi phân tích file Excel');
                setLoading(false);
            }
        };
        reader.readAsArrayBuffer(file);
        return false; // Prevent default upload behavior
    };

    if (loading && !formConfig) return <div className="p-10 flex justify-center"><Spin size="large" /></div>;

    // Build columns dynamically based on config
    const tableColumns: any[] = formConfig?.config?.map((field: any) => ({
        title: field.label,
        dataIndex: ['data', field.name],
        key: field.name,
        render: (text: any) => {
            if (field.type === 'image' && text) {
                const urls = text.split(',');
                return (
                    <div className="flex flex-wrap gap-2 items-center">
                        <Image.PreviewGroup>
                            {urls.map((url: string, idx: number) => (
                                <Image
                                    key={idx}
                                    width={40}
                                    height={40}
                                    src={url.trim()}
                                    className="object-cover rounded-md border border-slate-200 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                                    alt={`Ảnh ${idx + 1}`}
                                />
                            ))}
                        </Image.PreviewGroup>
                    </div>
                );
            }
            if (field.isVerificationKey) {
                return <span className="text-gray-400 italic">*** (Bảo mật)</span>;
            }
            return text;
        }
    })) || [];

    tableColumns.push({
        title: 'Người cập nhật',
        dataIndex: 'lastUpdatedBy',
        key: 'lastUpdatedBy',
        render: (text: string) => <span className="text-gray-500">{text || '-'}</span>
    });

    tableColumns.push({
        title: 'Lần cập nhật cuối',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (text: string) => new Date(text).toLocaleString('vi-VN')
    });

    tableColumns.push({
        title: 'Trạng thái / Thao tác',
        dataIndex: 'isDone',
        key: 'isDone',
        fixed: 'right' as any,
        width: 120,
        render: (isDone: boolean, record: any) => {
            let allImages: string[] = [];
            formConfig?.config?.forEach((f: any) => {
                if (f.type === 'image' && record.data[f.name]) {
                    const urls = record.data[f.name].split(',').map((u: string) => u.trim()).filter(Boolean);
                    allImages = [...allImages, ...urls];
                }
            });
            const hasImages = allImages.length > 0;

            return (
                <div className="flex flex-col gap-2 items-start">
                    <Tag color={isDone ? 'green' : 'orange'} className="mr-0">
                        {isDone ? 'Đã xong' : 'Chưa xử lý'}
                    </Tag>
                    <Switch 
                        checked={isDone} 
                        onChange={(checked) => handleToggleStatus(record.id, checked)} 
                        size="small"
                    />
                    {hasImages && (
                        <Button 
                            size="small" 
                            icon={<PrinterOutlined />} 
                            onClick={() => {
                                const nameField = formConfig?.config?.find((f: any) => /tên|name|nhân viên|cán bộ|họ/i.test(f.label))?.name;
                                const cccdField = formConfig?.config?.find((f: any) => /cccd|cmnd|căn cước|định danh/i.test(f.label))?.name;
                                handlePrintImages([{
                                    name: nameField ? record.data[nameField] || 'Không rõ tên' : 'Không rõ tên',
                                    cccd: cccdField ? record.data[cccdField] || 'Không có CCCD' : 'Không có CCCD',
                                    images: allImages
                                }]);
                            }}
                            className="text-xs w-full mb-1"
                        >
                            In ảnh
                        </Button>
                    )}
                    {isAdmin && (
                        <Popconfirm
                            title="Bạn có chắc chắn muốn xóa dòng dữ liệu này không?"
                            onConfirm={() => handleDeleteRow(record.id)}
                            okText="Có, xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                            placement="left"
                        >
                            <Button 
                                size="small" 
                                danger 
                                icon={<DeleteOutlined />} 
                                className="text-xs w-full"
                            >
                                Xóa
                            </Button>
                        </Popconfirm>
                    )}
                </div>
            );
        }
    });

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <Space>
                    <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/dynamic-forms')}>
                        Quay lại
                    </Button>
                    <div>
                        <Title level={4} className="mb-0">Dữ liệu Form: {formConfig?.name}</Title>
                        <p className="text-gray-500 mb-0">{formConfig?.description}</p>
                    </div>
                </Space>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
                    <Button icon={<PrinterOutlined />} onClick={handlePrintAllImages} className="bg-purple-600 text-white hover:bg-purple-700 hover:text-white border-none">
                        In tất cả ảnh
                    </Button>
                    <Upload 
                        accept=".xlsx, .xls"
                        showUploadList={false}
                        beforeUpload={handleImportStatusExcel}
                    >
                        <Button type="primary" icon={<UploadOutlined />} className="bg-orange-500 hover:bg-orange-600 border-none">
                            Cập nhật trạng thái
                        </Button>
                    </Upload>
                    <Upload 
                        accept=".xlsx, .xls"
                        showUploadList={false}
                        beforeUpload={handleImportExcel}
                    >
                        <Button type="primary" icon={<UploadOutlined />} className="bg-blue-600 hover:bg-blue-700">
                            Import Excel
                        </Button>
                    </Upload>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700">
                        Xuất Excel
                    </Button>
                </Space>
            </div>

            <Card className="shadow-sm">
                <div className="mb-4">
                    <Input 
                        placeholder="Tìm kiếm theo họ tên, viết tắt (VD: hmc), email, SDT..." 
                        prefix={<SearchOutlined className="text-gray-400" />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        allowClear
                        size="large"
                        className="max-w-md border-blue-200 hover:border-blue-400 focus:border-blue-500"
                    />
                </div>
                <Table
                    columns={tableColumns}
                    dataSource={filteredData}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 'max-content' }}
                    size="small"
                />
            </Card>
        </div>
    );
}

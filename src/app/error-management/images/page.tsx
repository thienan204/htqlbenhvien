'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, message, Spin, Popconfirm, Image, Statistic, Row, Col, Typography, DatePicker, Checkbox, Tabs, Tag, Tooltip } from 'antd';
import { 
    DeleteOutlined, 
    PictureOutlined, 
    ArrowLeftOutlined, 
    FileTextOutlined, 
    FilePdfOutlined, 
    FileWordOutlined, 
    FileExcelOutlined, 
    FileZipOutlined, 
    DownloadOutlined, 
    EyeOutlined,
    FolderOpenOutlined 
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import Link from 'next/link';
import { getBasePath } from '@/utils/config';

dayjs.extend(isBetween);

interface TicketFile {
    name: string;
    url: string;
    size: number;
    ext?: string;
    createdAt: string;
}

export default function ImageManagementPage() {
    const { hasPermission } = useAuth();
    const canManageImage = hasPermission('MENU_IMAGE_MANAGEMENT');
    
    const [files, setFiles] = useState<TicketFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<any>(null);
    const [fileTypeFilter, setFileTypeFilter] = useState<string>('ALL');
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [deletingBatch, setDeletingBatch] = useState(false);

    useEffect(() => {
        if (canManageImage) {
            fetchFiles();
        }
    }, [canManageImage]);

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/error-management/images');
            if (res.ok) {
                const data = await res.json();
                setFiles(data);
            }
        } catch (error) {
            message.error('Lỗi tải danh sách tệp đính kèm');
        } finally {
            setLoading(false);
        }
    };

    const getFileCategory = (ext?: string, name?: string): 'IMAGE' | 'DOC' | 'ARCHIVE' | 'OTHER' => {
        const extension = (ext || (name ? name.split('.').pop() : '') || '').toLowerCase().replace('.', '');
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) return 'IMAGE';
        if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv'].includes(extension)) return 'DOC';
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'ARCHIVE';
        return 'OTHER';
    };

    const filteredFiles = useMemo(() => {
        let result = files;

        // Lọc theo loại tệp
        if (fileTypeFilter !== 'ALL') {
            result = result.filter(f => getFileCategory(f.ext, f.name) === fileTypeFilter);
        }

        // Lọc theo ngày tạo
        if (dateRange && dateRange[0] && dateRange[1]) {
            const start = dateRange[0].startOf('day');
            const end = dateRange[1].endOf('day');
            result = result.filter(f => dayjs(f.createdAt).isBetween(start, end, null, '[]'));
        }

        return result;
    }, [files, fileTypeFilter, dateRange]);

    const handleDelete = async (name: string) => {
        try {
            const res = await fetch(`/api/error-management/images?name=${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                message.success('Đã xóa tệp thành công');
                setFiles(prev => prev.filter(f => f.name !== name));
                setSelectedFiles(prev => prev.filter(n => n !== name));
            } else {
                const errorData = await res.json().catch(() => null);
                message.error(errorData?.error || 'Lỗi khi xóa tệp');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleSelectAll = (e: any) => {
        if (e.target.checked) {
            setSelectedFiles(filteredFiles.map(f => f.name));
        } else {
            setSelectedFiles([]);
        }
    };

    const handleSelectFile = (name: string, checked: boolean) => {
        if (checked) {
            setSelectedFiles(prev => [...prev, name]);
        } else {
            setSelectedFiles(prev => prev.filter(n => n !== name));
        }
    };

    const handleBatchDelete = async () => {
        if (selectedFiles.length === 0) return;
        setDeletingBatch(true);
        let successCount = 0;
        let successNames: string[] = [];
        
        for (const name of selectedFiles) {
            try {
                const res = await fetch(`/api/error-management/images?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
                if (res.ok) {
                    successCount++;
                    successNames.push(name);
                } else {
                    const errorData = await res.json().catch(() => null);
                    if (errorData?.error) message.error(`Lỗi xóa ${name}: ${errorData.error}`);
                }
            } catch (e) {
                console.error('Lỗi xóa', name);
            }
        }
        
        if (successCount > 0) {
            message.success(`Đã xóa thành công ${successCount} tệp`);
            setFiles(prev => prev.filter(f => !successNames.includes(f.name)));
            setSelectedFiles(prev => prev.filter(n => !successNames.includes(n)));
        } else if (selectedFiles.length > 0) {
            message.error('Không thể xóa tệp nào');
        }
        setDeletingBatch(false);
    };

    const totalSize = filteredFiles.reduce((acc, curr) => acc + curr.size, 0);
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const renderFileIcon = (fileName: string) => {
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        if (ext === 'pdf') return <FilePdfOutlined className="text-4xl text-red-500" />;
        if (['doc', 'docx'].includes(ext)) return <FileWordOutlined className="text-4xl text-blue-500" />;
        if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileExcelOutlined className="text-4xl text-emerald-500" />;
        if (['zip', 'rar', '7z'].includes(ext)) return <FileZipOutlined className="text-4xl text-amber-500" />;
        return <FileTextOutlined className="text-4xl text-slate-400" />;
    };

    if (!canManageImage) {
        return <div className="p-8 text-center text-red-500 font-medium">Bạn không có quyền truy cập trang này.</div>;
    }

    const typeTabs = [
        { key: 'ALL', label: `Tất cả (${files.length})` },
        { key: 'IMAGE', label: `Hình ảnh (${files.filter(f => getFileCategory(f.ext, f.name) === 'IMAGE').length})` },
        { key: 'DOC', label: `Tài liệu (${files.filter(f => getFileCategory(f.ext, f.name) === 'DOC').length})` },
        { key: 'ARCHIVE', label: `File nén (${files.filter(f => getFileCategory(f.ext, f.name) === 'ARCHIVE').length})` }
    ];

    return (
        <div className="w-full max-w-[98%] mx-auto px-4 sm:px-[30px] py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                        <FolderOpenOutlined />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1 leading-tight">Quản lý Tệp & Hình ảnh Đính kèm</h1>
                        <p className="text-sm sm:text-base text-slate-500 m-0">Quản lý, rà soát và dọn dẹp các tệp tài liệu, hình ảnh được tải lên từ phiếu yêu cầu</p>
                    </div>
                </div>
                <div className="flex gap-2 sm:gap-3 w-full sm:w-auto items-center">
                    <Link href="/error-management/it-requests">
                        <Button size="large" icon={<ArrowLeftOutlined />} className="w-full sm:w-auto">Quay lại</Button>
                    </Link>
                </div>
            </div>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                    <Card className="shadow-sm rounded-xl border-slate-100">
                        <Statistic title="Số lượng tệp đang hiển thị" value={filteredFiles.length} suffix="tệp" />
                    </Card>
                </Col>
                <Col xs={24} sm={12}>
                    <Card className="shadow-sm rounded-xl border-slate-100">
                        <Statistic title="Tổng dung lượng tiêu thụ" value={formatBytes(totalSize)} styles={{ content: { color: totalSize > 100 * 1024 * 1024 ? '#cf1322' : '#3f8600' } }} />
                    </Card>
                </Col>
            </Row>

            <Card className="shadow-sm rounded-2xl border-slate-100 min-h-[400px]">
                {/* Ant Design Tabs with type="card" */}
                <div className="mb-4">
                    <Tabs 
                        type="card"
                        activeKey={fileTypeFilter}
                        onChange={(k) => {
                            setFileTypeFilter(k);
                            setSelectedFiles([]);
                        }}
                        items={typeTabs}
                    />
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 font-medium">Lọc theo ngày:</span>
                        <DatePicker.RangePicker 
                            onChange={(dates) => {
                                setDateRange(dates);
                                setSelectedFiles([]);
                            }} 
                            format="DD/MM/YYYY"
                            placeholder={['Từ ngày', 'Đến ngày']}
                        />
                    </div>
                    {filteredFiles.length > 0 && (
                        <div className="flex items-center gap-4 bg-blue-50/50 px-4 py-2 rounded-lg border border-blue-100">
                            <Checkbox 
                                checked={selectedFiles.length > 0 && selectedFiles.length === filteredFiles.length}
                                indeterminate={selectedFiles.length > 0 && selectedFiles.length < filteredFiles.length}
                                onChange={handleSelectAll}
                            >
                                <span className="text-blue-700 font-medium">Chọn tất cả</span>
                            </Checkbox>
                            {selectedFiles.length > 0 && (
                                <Popconfirm 
                                    title={`Xóa vĩnh viễn ${selectedFiles.length} tệp đã chọn?`} 
                                    description="Tệp sẽ bị xóa khỏi máy chủ để giải phóng dung lượng."
                                    onConfirm={handleBatchDelete} 
                                    okText="Xóa vĩnh viễn" 
                                    cancelText="Hủy" 
                                    placement="bottomRight"
                                >
                                    <Button danger type="primary" loading={deletingBatch} icon={<DeleteOutlined />}>
                                        Xóa {selectedFiles.length} tệp
                                    </Button>
                                </Popconfirm>
                            )}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-40"><Spin size="large" /></div>
                ) : filteredFiles.length === 0 ? (
                    <div className="text-center text-slate-400 py-10">
                        <FolderOpenOutlined className="text-4xl mb-3 text-slate-300" />
                        <p>Không tìm thấy tệp nào phù hợp với bộ lọc</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        <Image.PreviewGroup>
                            {filteredFiles.map(file => {
                                const isImage = getFileCategory(file.ext, file.name) === 'IMAGE';
                                const fileExt = (file.name.split('.').pop() || '').toUpperCase();
                                const fileFullUrl = file.url.startsWith('http') ? file.url : `${getBasePath()}${file.url}`;

                                return (
                                    <div 
                                        key={file.name} 
                                        className={`relative group rounded-xl overflow-hidden border transition-all flex flex-col justify-between ${
                                            selectedFiles.includes(file.name) ? 'border-blue-500 ring-2 ring-blue-400 bg-blue-50/30' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                                        }`}
                                    >
                                        {/* Checkbox chọn tệp */}
                                        <div className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur-xs rounded shadow-xs">
                                            <Checkbox 
                                                className="m-0 p-1"
                                                checked={selectedFiles.includes(file.name)} 
                                                onChange={(e) => handleSelectFile(file.name, e.target.checked)} 
                                            />
                                        </div>

                                        {/* Nút xóa nhanh từng tệp */}
                                        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Popconfirm 
                                                title="Xóa tệp này?" 
                                                onConfirm={() => handleDelete(file.name)}
                                                okText="Xóa"
                                                cancelText="Hủy"
                                            >
                                                <button 
                                                    type="button" 
                                                    className="w-6 h-6 rounded-full bg-white/90 text-red-500 hover:text-red-700 shadow-sm flex items-center justify-center text-xs"
                                                    title="Xóa tệp này"
                                                >
                                                    <DeleteOutlined />
                                                </button>
                                            </Popconfirm>
                                        </div>

                                        {/* Nội dung xem trước */}
                                        <div className="aspect-square flex items-center justify-center overflow-hidden p-2 relative bg-slate-50/60">
                                            {isImage ? (
                                                <Image
                                                    src={fileFullUrl}
                                                    alt={file.name}
                                                    className="object-cover rounded-lg w-full h-full"
                                                    fallback="https://via.placeholder.com/150?text=Lỗi+Ảnh"
                                                />
                                            ) : (
                                                <a 
                                                    href={fileFullUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="flex flex-col items-center justify-center p-2 text-center hover:opacity-80 transition-opacity w-full h-full"
                                                >
                                                    {renderFileIcon(file.name)}
                                                    <span className="text-[11px] font-semibold text-slate-700 mt-2 line-clamp-2 px-1 break-all">
                                                        {file.name}
                                                    </span>
                                                </a>
                                            )}
                                        </div>

                                        {/* Footer thông tin file */}
                                        <div className={`p-2.5 border-t text-xs ${selectedFiles.includes(file.name) ? 'bg-blue-50/60 border-blue-100' : 'bg-white border-slate-100'}`}>
                                            <div className="flex items-center gap-1 mb-1" title={file.name}>
                                                <span className="truncate text-slate-700 font-medium flex-1">
                                                    {file.name.substring(0, file.name.lastIndexOf('.')) || file.name}
                                                </span>
                                                <Tag color={isImage ? 'blue' : 'purple'} className="m-0 text-[10px] px-1 py-0 leading-tight">
                                                    {fileExt}
                                                </Tag>
                                            </div>
                                            <div className="flex justify-between items-center text-slate-400 text-[11px]">
                                                <span>{formatBytes(file.size)}</span>
                                                <span>{dayjs(file.createdAt).format('DD/MM/YYYY')}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </Image.PreviewGroup>
                    </div>
                )}
            </Card>
        </div>
    );
}

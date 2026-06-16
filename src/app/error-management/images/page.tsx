'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, message, Spin, Popconfirm, Image, Statistic, Row, Col, Typography, DatePicker, Checkbox } from 'antd';
import { DeleteOutlined, PictureOutlined, ArrowLeftOutlined, DeleteFilled } from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import Link from 'next/link';
import { getBasePath } from '@/utils/config';

dayjs.extend(isBetween);

const { Title, Text } = Typography;

interface ImageFile {
    name: string;
    url: string;
    size: number;
    createdAt: string;
}

export default function ImageManagementPage() {
    const { hasPermission } = useAuth();
    const canManageImage = hasPermission('MENU_IMAGE_MANAGEMENT');
    
    const [images, setImages] = useState<ImageFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<any>(null);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [deletingBatch, setDeletingBatch] = useState(false);

    const filteredImages = useMemo(() => {
        if (!dateRange || !dateRange[0] || !dateRange[1]) return images;
        const start = dateRange[0].startOf('day');
        const end = dateRange[1].endOf('day');
        return images.filter(img => dayjs(img.createdAt).isBetween(start, end, null, '[]'));
    }, [images, dateRange]);

    useEffect(() => {
        if (canManageImage) {
            fetchImages();
        }
    }, [canManageImage]);

    const fetchImages = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/error-management/images');
            if (res.ok) {
                const data = await res.json();
                setImages(data);
            }
        } catch (error) {
            message.error('Lỗi tải danh sách ảnh');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (name: string) => {
        try {
            const res = await fetch(`/api/error-management/images?name=${encodeURIComponent(name)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                message.success('Đã xóa ảnh');
                setImages(prev => prev.filter(img => img.name !== name));
            } else {
                const errorData = await res.json().catch(() => null);
                message.error(errorData?.error || 'Lỗi xóa ảnh');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleSelectAll = (e: any) => {
        if (e.target.checked) {
            setSelectedImages(filteredImages.map(img => img.name));
        } else {
            setSelectedImages([]);
        }
    };

    const handleSelectImage = (name: string, checked: boolean) => {
        if (checked) {
            setSelectedImages(prev => [...prev, name]);
        } else {
            setSelectedImages(prev => prev.filter(n => n !== name));
        }
    };

    const handleBatchDelete = async () => {
        if (selectedImages.length === 0) return;
        setDeletingBatch(true);
        let successCount = 0;
        let successNames: string[] = [];
        
        for (const name of selectedImages) {
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
            message.success(`Đã xóa thành công ${successCount} ảnh`);
            setImages(prev => prev.filter(img => !successNames.includes(img.name)));
            setSelectedImages(prev => prev.filter(n => !successNames.includes(n)));
        } else if (selectedImages.length > 0) {
            message.error('Không thể xóa ảnh nào');
        }
        setDeletingBatch(false);
    };

    const totalSize = filteredImages.reduce((acc, curr) => acc + curr.size, 0);
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!canManageImage) {
        return <div className="p-8 text-center text-red-500 font-medium">Bạn không có quyền truy cập trang này.</div>;
    }

    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-[30px] py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                        <PictureOutlined />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1 leading-tight">Quản lý Ảnh đính kèm</h1>
                        <p className="text-sm sm:text-base text-slate-500 m-0">Quản lý và dọn dẹp các ảnh được tải lên từ phiếu yêu cầu</p>
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
                        <Statistic title="Số file đang hiển thị" value={filteredImages.length} suffix="file" />
                    </Card>
                </Col>
                <Col xs={24} sm={12}>
                    <Card className="shadow-sm rounded-xl border-slate-100">
                        <Statistic title="Tổng dung lượng tiêu thụ" value={formatBytes(totalSize)} styles={{ content: { color: totalSize > 50 * 1024 * 1024 ? '#cf1322' : '#3f8600' } }} />
                    </Card>
                </Col>
            </Row>

            <Card className="shadow-sm rounded-2xl border-slate-100 min-h-[400px]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-500 font-medium">Lọc theo ngày:</span>
                        <DatePicker.RangePicker 
                            onChange={(dates) => {
                                setDateRange(dates);
                                setSelectedImages([]);
                            }} 
                            format="DD/MM/YYYY"
                            placeholder={['Từ ngày', 'Đến ngày']}
                        />
                    </div>
                    {filteredImages.length > 0 && (
                        <div className="flex items-center gap-4 bg-blue-50/50 px-4 py-2 rounded-lg border border-blue-100">
                            <Checkbox 
                                checked={selectedImages.length > 0 && selectedImages.length === filteredImages.length}
                                indeterminate={selectedImages.length > 0 && selectedImages.length < filteredImages.length}
                                onChange={handleSelectAll}
                            >
                                <span className="text-blue-700 font-medium">Chọn tất cả</span>
                            </Checkbox>
                            {selectedImages.length > 0 && (
                                <Popconfirm title={`Xóa vĩnh viễn ${selectedImages.length} ảnh đã chọn?`} onConfirm={handleBatchDelete} okText="Xóa" cancelText="Hủy" placement="bottomRight">
                                    <Button danger type="primary" loading={deletingBatch} icon={<DeleteOutlined />}>Xóa {selectedImages.length} mục</Button>
                                </Popconfirm>
                            )}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-40"><Spin size="large" /></div>
                ) : filteredImages.length === 0 ? (
                    <div className="text-center text-slate-400 py-10">
                        <PictureOutlined className="text-4xl mb-3" />
                        <p>Không tìm thấy hình ảnh nào</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        <Image.PreviewGroup>
                            {filteredImages.map(img => (
                                <div key={img.name} className={`relative group rounded-lg overflow-hidden border transition-colors ${selectedImages.includes(img.name) ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 bg-slate-50'}`}>
                                    <div className="absolute top-2 left-2 z-10 bg-white/80 rounded shadow-sm">
                                        <Checkbox 
                                            className="m-0 p-1"
                                            checked={selectedImages.includes(img.name)} 
                                            onChange={(e) => handleSelectImage(img.name, e.target.checked)} 
                                        />
                                    </div>
                                    <div className="aspect-square flex items-center justify-center overflow-hidden p-1 relative">
                                        <Image
                                            src={img.url.startsWith('http') ? img.url : `${getBasePath()}${img.url}`}
                                            alt={img.name}
                                            className="object-cover rounded w-full h-full"
                                            fallback="https://via.placeholder.com/150?text=Lỗi+Ảnh"
                                        />
                                    </div>
                                    <div className={`p-2 border-t text-xs ${selectedImages.includes(img.name) ? 'bg-blue-50 border-blue-100' : 'bg-white border-slate-100'}`}>
                                        <div className="flex items-center gap-1 mb-1" title={img.name}>
                                            <span className="truncate text-slate-600 flex-1">{img.name.substring(0, img.name.lastIndexOf('.')) || img.name}</span>
                                            <span className="bg-slate-100 text-slate-500 px-1 rounded uppercase text-[10px] font-bold border border-slate-200">
                                                {img.name.split('.').pop()}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-slate-400">
                                            <span>{formatBytes(img.size)}</span>
                                            <span>{dayjs(img.createdAt).format('DD/MM/YY')}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </Image.PreviewGroup>
                    </div>
                )}
            </Card>
        </div>
    );
}

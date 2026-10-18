import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, DatePicker, Card, Tag, Button, message } from 'antd';
import { ShopOutlined, CalendarOutlined, FileTextOutlined, LinkOutlined, PhoneOutlined, ShareAltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Link from 'next/link';
import { Ticket, ITUser, VendorItem } from '../types';
import { PasteImageTextArea, AttachmentItem } from './PasteImageTextArea';
import { getBasePath } from '@/utils/config';
import { copyTicketShareLink, copyTicketZaloMessage } from '../utils/shareUtils';

interface TicketActionModalProps {
    visible: boolean;
    onCancel: () => void;
    onOk: (values: any) => void;
    ticket: Ticket | null;
    itUsers: ITUser[];
    user?: any;
    targetDepartment?: string;
}

export const TicketActionModal: React.FC<TicketActionModalProps> = ({
    visible,
    onCancel,
    onOk,
    ticket,
    itUsers,
    user,
    targetDepartment = 'CNTT'
}) => {
    const [actionForm] = Form.useForm();
    const [vendors, setVendors] = useState<VendorItem[]>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [attachedImages, setAttachedImages] = useState<AttachmentItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<string>('IN_PROGRESS');
    const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

    const isManager = user?.isManager || user?.role === 'ADMIN';
    const isMyTicket = ticket?.assigneeId === user?.id;
    const isUnassigned = !ticket?.assigneeId;

    const canChangeAssignee = isManager || isMyTicket || isUnassigned;

    let availableUsers = itUsers;
    if (!isManager && isUnassigned) {
        availableUsers = itUsers.filter(u => u.id === user?.id);
    }

    const resizeImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas conversion failed'));
                    }, 'image/jpeg', 0.75);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    // Tải danh mục đối tác từ /system-categories
    useEffect(() => {
        if (visible) {
            setLoadingVendors(true);
            fetch(`${getBasePath()}/api/system-categories?type=DOI_TAC_NGOAI`)
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setVendors(data.filter((v: any) => v.isActive !== false));
                    }
                })
                .catch(err => console.warn('Lỗi tải danh mục đối tác:', err))
                .finally(() => setLoadingVendors(false));
        }
    }, [visible]);

    useEffect(() => {
        if (visible && ticket) {
            setSelectedStatus(ticket.status || 'IN_PROGRESS');
            setSelectedVendorId(ticket.vendorId || null);
            
            const existing = Array.isArray(ticket.it_images) 
                ? ticket.it_images.map((url: string, index: number) => ({
                    id: `existing-${index}-${url}`,
                    url: url,
                    name: url.split('/').pop() || `Tệp ${index + 1}`,
                    isPending: false
                }))
                : [];
            setAttachedImages(existing);

            setTimeout(() => {
                actionForm.setFieldsValue({
                    status: ticket.status,
                    it_note: ticket.it_note,
                    assigneeId: ticket.assigneeId,
                    vendorId: ticket.vendorId,
                    vendorTicketCode: ticket.vendorTicketCode,
                    vendorExpectedReturnAt: ticket.vendorExpectedReturnAt ? dayjs(ticket.vendorExpectedReturnAt) : null,
                });
            }, 0);
        }
    }, [visible, ticket, actionForm]);

    const handleCancel = () => {
        attachedImages.forEach(item => {
            if (item.url && item.url.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(item.url);
                } catch (e) {}
            }
        });
        setAttachedImages([]);
        onCancel();
    };

    const handleFormSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            const selectedVendor = vendors.find(v => v.id === values.vendorId);
            const finalUrls: string[] = [];

            for (const item of attachedImages) {
                // Nếu đã là link server có sẵn
                if (!item.isPending && item.url && !item.url.startsWith('blob:')) {
                    finalUrls.push(item.url);
                    continue;
                }

                const file: File | undefined = item.file;
                if (!file) {
                    if (item.url && !item.url.startsWith('blob:')) finalUrls.push(item.url);
                    continue;
                }

                const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                let fileToUpload: Blob = file;
                if (isImage) {
                    try {
                        fileToUpload = await resizeImage(file);
                    } catch (e) {
                        fileToUpload = file;
                    }
                }

                const formData = new FormData();
                formData.append('file', fileToUpload, file.name || (isImage ? 'upload.jpg' : 'file'));

                const res = await fetch(`${getBasePath()}/api/upload`, {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();
                if (res.ok && data.url) {
                    finalUrls.push(data.url);
                    if (item.url && item.url.startsWith('blob:')) {
                        try {
                            URL.revokeObjectURL(item.url);
                        } catch (e) {}
                    }
                } else {
                    message.error(data.error || `Lỗi tải tệp: ${file.name}`);
                    throw new Error(data.error || 'Upload error');
                }
            }

            const payload: any = {
                ...values,
                it_images: finalUrls,
                vendorName: selectedVendor ? selectedVendor.name : (ticket?.vendorName || null),
                vendorExpectedReturnAt: values.vendorExpectedReturnAt ? values.vendorExpectedReturnAt.toISOString() : null,
            };
            await onOk(payload);
        } catch (error: any) {
            console.error('Lỗi khi lưu xử lý phiếu:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const selectedVendor = vendors.find(v => v.id === selectedVendorId);

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 font-bold text-slate-800 text-lg">
                    <span>⚡ Xử lý Yêu cầu</span>
                    {ticket?.category === 'HARDWARE' ? (
                        <Tag color="cyan">Phần cứng / Thiết bị</Tag>
                    ) : (
                        <Tag color="blue">Phần mềm / Bệnh án</Tag>
                    )}
                </div>
            }
            open={visible}
            onCancel={handleCancel}
            onOk={() => actionForm.submit()}
            confirmLoading={submitting}
            okText="Lưu cập nhật"
            cancelText="Hủy"
            destroyOnHidden
            width={640}
        >
            <Form form={actionForm} preserve={false} layout="vertical" onFinish={handleFormSubmit} className="mt-3 space-y-3">
                <Form.Item name="status" label={<span className="font-semibold text-slate-700">Trạng thái xử lý</span>} className="mb-3">
                    <Select 
                        size="large" 
                        className="!rounded-xl"
                        onChange={(val) => setSelectedStatus(val)}
                    >
                        <Select.Option value="PENDING">Chờ xử lý</Select.Option>
                        <Select.Option value="IN_PROGRESS">Đang xử lý</Select.Option>
                        <Select.Option value="WAITING_VENDOR">
                            <span className="font-medium text-amber-600 flex items-center gap-1.5">
                                <ShopOutlined /> Chờ đơn vị ngoài xử lý (Gửi đối tác)
                            </span>
                        </Select.Option>
                        <Select.Option value="TRANSFERRING">Chờ chuyển giao</Select.Option>
                        <Select.Option value="RESOLVED">Hoàn thành</Select.Option>
                    </Select>
                </Form.Item>

                {/* KHU VỰC THÔNG TIN GỬI ĐỐI TÁC NGOÀI (Chỉ hiện khi chọn WAITING_VENDOR) */}
                {selectedStatus === 'WAITING_VENDOR' && (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50/80 to-orange-50/60 border border-amber-200/90 shadow-2xs space-y-3.5 my-3">
                        <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                            <div className="font-bold text-amber-950 text-sm flex items-center gap-1.5">
                                <ShopOutlined className="text-amber-600 text-base" />
                                <span>Thông tin Đơn vị / Đối tác xử lý</span>
                            </div>
                            <Link 
                                href="/system-categories?type=DOI_TAC_NGOAI" 
                                target="_blank"
                                className="text-xs text-amber-800 hover:text-blue-600 flex items-center gap-1 font-medium underline"
                                title="Mở trang Quản lý danh mục đối tác"
                            >
                                <LinkOutlined /> Quản lý danh mục đối tác
                            </Link>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <Form.Item 
                                name="vendorId" 
                                label={<span className="text-xs font-semibold text-amber-900">Công ty / Đối tác phụ trách</span>}
                                rules={[{ required: true, message: 'Vui lòng chọn đối tác ngoài' }]}
                                className="mb-0 sm:col-span-2"
                            >
                                <Select
                                    placeholder="Chọn đối tác (VNPT, Viettel, Minh Khang...)"
                                    showSearch
                                    filterOption={(input, option: any) => 
                                        (option?.label || '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={vendors.map(v => ({
                                        value: v.id,
                                        label: `${v.name}${v.bhyt_code ? ` [${v.bhyt_code}]` : ''}`
                                    }))}
                                    onChange={(val) => setSelectedVendorId(val)}
                                    size="middle"
                                    className="!rounded-lg"
                                    loading={loadingVendors}
                                />
                            </Form.Item>

                            {/* Thẻ thông tin liên hệ của Đối tác */}
                            {selectedVendor && selectedVendor.description && (
                                <div className="sm:col-span-2 px-3 py-2 bg-white/90 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2 shadow-2xs">
                                    <PhoneOutlined className="text-amber-600 mt-0.5 text-sm" />
                                    <div>
                                        <span className="font-semibold text-amber-950">Thông tin liên hệ: </span>
                                        <span>{selectedVendor.description}</span>
                                    </div>
                                </div>
                            )}

                            <Form.Item 
                                name="vendorExpectedReturnAt" 
                                label={<span className="text-xs font-semibold text-amber-900">Ngày hẹn trả / Dự kiến xong</span>}
                                className="mb-0"
                                extra={<span className="text-[11px] text-amber-700">Để trống nếu đối tác chưa có ngày hẹn cụ thể</span>}
                            >
                                <DatePicker 
                                    format="DD/MM/YYYY" 
                                    placeholder="Chọn ngày hẹn (Tùy chọn)"
                                    className="w-full !rounded-lg"
                                    disabledDate={(current) => current && current.isBefore(dayjs().subtract(1, 'day'))}
                                />
                            </Form.Item>

                            <Form.Item 
                                name="vendorTicketCode" 
                                label={<span className="text-xs font-semibold text-amber-900">Mã biên nhận / Mã ticket hãng</span>}
                                className="mb-0"
                                extra={<span className="text-[11px] text-amber-700">Ví dụ: BN-2026-092 hoặc Ticket #18239</span>}
                            >
                                <Input placeholder="Nhập mã phiếu nếu có..." className="!rounded-lg" />
                            </Form.Item>
                        </div>

                        {ticket?.id && (
                            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white/95 border border-amber-300/80 rounded-xl text-xs shadow-2xs mt-1">
                                <span className="font-semibold text-amber-950 flex items-center gap-1.5">
                                    📢 Gửi cho công ty đối tác:
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        size="small"
                                        icon={<LinkOutlined />}
                                        onClick={() => copyTicketShareLink(ticket.id)}
                                        className="text-xs rounded-lg text-slate-700 hover:text-blue-600"
                                    >
                                        Sao chép Link
                                    </Button>
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<ShareAltOutlined />}
                                        onClick={() => {
                                            const currentValues = actionForm.getFieldsValue();
                                            const mergedTicket = {
                                                ...ticket,
                                                vendorName: selectedVendor ? selectedVendor.name : (ticket.vendorName || ''),
                                                vendorExpectedReturnAt: currentValues.vendorExpectedReturnAt ? currentValues.vendorExpectedReturnAt.toISOString() : ticket.vendorExpectedReturnAt,
                                                vendorTicketCode: currentValues.vendorTicketCode || ticket.vendorTicketCode,
                                                it_note: currentValues.it_note || ticket.it_note
                                            };
                                            copyTicketZaloMessage(mergedTicket);
                                        }}
                                        className="text-xs bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
                                    >
                                        Sao chép tin nhắn Zalo
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Phân quyền chọn Người xử lý */}
                <Form.Item 
                    name="assigneeId" 
                    label={<span className="font-semibold text-slate-700">Người xử lý / Đôn đốc</span>} 
                    extra="Nếu bạn chọn người khác, phiếu sẽ vào trạng thái Chờ chuyển giao cho đến khi người đó xác nhận."
                    className="mb-3"
                >
                    <Select allowClear disabled={!canChangeAssignee} className="!rounded-xl">
                        {availableUsers.map(u => (
                            <Select.Option key={u.id} value={u.id}>
                                {u.name || u.username} {u.autoAssignDisabled ? `(🎯 Đang tập trung: ${u.focusReason || 'Nhiệm vụ riêng'})` : ''}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                
                {/* Ô Ghi chú kỹ thuật & Phản hồi - Hỗ trợ Dán ảnh Ctrl + V */}
                <Form.Item 
                    name="it_note" 
                    label={
                        <div className="flex items-center justify-between w-full">
                            <span className="font-semibold text-slate-800">
                                {selectedStatus === 'WAITING_VENDOR' 
                                    ? 'Yêu cầu kỹ thuật của CNTT & Nội dung gửi đối tác' 
                                    : 'Ghi chú / Phản hồi (Cách xử lý)'
                                }
                            </span>
                            <span className="text-xs text-blue-600 font-normal">
                                📋 Hỗ trợ phím tắt <b>Ctrl + V</b> để dán ảnh
                            </span>
                        </div>
                    }
                    className="mb-2"
                >
                    <PasteImageTextArea
                        images={attachedImages}
                        onImagesChange={setAttachedImages}
                        placeholder={
                            selectedStatus === 'WAITING_VENDOR'
                                ? 'Nhập chi tiết chẩn đoán lỗi của CNTT sau khi kiểm tra để gửi đối tác xử lý và thông báo cho khoa phòng (Có thể bấm Ctrl + V dán ảnh biên nhận / ảnh lỗi vào đây)...'
                                : 'Nhập phản hồi kết quả xử lý lại cho khoa phòng (Có thể bấm Ctrl + V dán ảnh trực tiếp vào đây)...'
                        }
                        rows={4}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

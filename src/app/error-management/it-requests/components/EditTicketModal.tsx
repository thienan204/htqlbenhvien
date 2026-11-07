import React, { useEffect, useState, useRef } from 'react';
import { Modal, Form, Input, Segmented, message, Button } from 'antd';
import { Ticket } from '../types';
import { useImageUpload } from '../create/hooks/useImageUpload';
import { 
    CameraOutlined, 
    PictureOutlined, 
    UserOutlined, 
    PhoneOutlined, 
    EditOutlined, 
    PaperClipOutlined, 
    FileTextOutlined 
} from '@ant-design/icons';

interface EditTicketModalProps {
    visible: boolean;
    ticket: Ticket | null;
    onCancel: () => void;
    onSuccess: () => void;
    targetDepartment?: string;
}

export const EditTicketModal: React.FC<EditTicketModalProps> = ({
    visible,
    ticket,
    onCancel,
    onSuccess,
    targetDepartment = 'CNTT'
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const lastPasteTimeRef = useRef<number>(0);

    const {
        fileList,
        setFileList,
        uploadProps,
        previewOpen,
        previewImage,
        setPreviewOpen,
        handleFileChange,
        uploadPendingFiles,
        clearFiles
    } = useImageUpload(10); // 10MB tối đa cho mỗi tệp

    useEffect(() => {
        if (visible && ticket) {
            // Đợi Form trong Modal render xong
            setTimeout(() => {
                form.setFieldsValue({
                    category: ticket.category || 'SOFTWARE',
                    ten_loi: ticket.ten_loi,
                    nguoi_bao: ticket.dynamicFields?.['Người báo'] || ticket.dynamicFields?.['nguoi_bao'] || ticket.nguoi_bao || '',
                    sdt: ticket.dynamicFields?.['SĐT'] || ticket.dynamicFields?.['sdt'] || ticket.sdt || '',
                    ghi_chu: ticket.dynamicFields?.['Ghi chú'] || ticket.dynamicFields?.['ghi_chu'] || ''
                });
            }, 0);

            // Tải danh sách tệp đính kèm đã có
            const existingUrls = ticket.dynamicFields?.['Tệp đính kèm'] || ticket.dynamicFields?.['Hình ảnh đính kèm'];
            if (existingUrls && Array.isArray(existingUrls)) {
                const existingFiles = existingUrls.map((url: string, index: number) => {
                    const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                    const fileName = url.split('/').pop() || `file-${index + 1}`;
                    return {
                        uid: `existing-${index}`,
                        name: fileName,
                        status: 'done',
                        url: url,
                        thumbUrl: isImg ? url : undefined,
                        isDoc: !isImg,
                        isPending: false
                    };
                });
                setFileList(existingFiles);
            } else {
                setFileList([]);
            }
        } else {
            setFileList([]);
        }
    }, [visible, ticket, form, setFileList]);

    // Hỗ trợ dán ảnh màn hình trực tiếp từ Clipboard (Ctrl + V)
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items || items.length === 0) return;

        const imageFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    const isDup = imageFiles.some(f => f.size === file.size);
                    if (!isDup) imageFiles.push(file);
                }
            }
        }

        if (imageFiles.length === 0) return;

        e.stopPropagation();
        e.preventDefault();

        const now = Date.now();
        if (now - lastPasteTimeRef.current < 500) return;
        lastPasteTimeRef.current = now;

        const pad = (n: number) => String(n).padStart(2, '0');
        const d = new Date();
        const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

        imageFiles.forEach((file, index) => {
            const ext = (file.type.split('/')[1] || 'png').replace('+xml', '');
            const customFileName = `anh_dan_${timeStr}_${index + 1}.${ext}`;
            const renamedFile = new File([file], customFileName, { type: file.type });
            if (uploadProps && uploadProps.customRequest) {
                uploadProps.customRequest({ file: renamedFile });
            }
        });

        message.success(`Đã dán và đính kèm ${imageFiles.length} ảnh chụp màn hình!`);
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            if (!ticket) return;

            setLoading(true);
            const uploadedUrls = await uploadPendingFiles();

            const dynamicFieldsUpdate = {
                'Người báo': values.nguoi_bao,
                'SĐT': values.sdt,
                'Ghi chú': values.ghi_chu,
                'Hình ảnh đính kèm': uploadedUrls,
                'Tệp đính kèm': uploadedUrls
            };

            const res = await fetch('/api/error-management/it-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: ticket.id,
                    action: 'EDIT_REQUEST',
                    category: values.category,
                    ten_loi: values.ten_loi,
                    dynamicFields: dynamicFieldsUpdate
                })
            });

            if (res.ok) {
                message.success('Đã cập nhật yêu cầu thành công!');
                clearFiles();
                onSuccess();
            } else {
                const data = await res.json();
                message.error(data.error || 'Cập nhật thất bại');
            }
        } catch (error: any) {
            console.error(error);
            message.error(error.message || 'Lỗi cập nhật');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Modal
                title={
                    <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center text-lg font-bold shadow-2xs shrink-0">
                            <EditOutlined />
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-base text-slate-800 leading-tight">
                                Sửa Nội Dung Yêu Cầu
                            </div>
                            <div className="text-xs text-slate-500 font-normal mt-0.5 truncate">
                                {ticket?.id ? `Phiếu #${ticket.id.slice(-6).toUpperCase()} • ` : ''}Chỉ người gửi mới có thể chỉnh sửa
                            </div>
                        </div>
                    </div>
                }
                open={visible}
                onCancel={onCancel}
                width={580}
                centered
                className="max-w-[95vw] sm:max-w-[580px]"
                styles={{
                    body: {
                        maxHeight: 'calc(85vh - 120px)',
                        overflowY: 'auto',
                        paddingRight: '4px'
                    }
                }}
                footer={
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <Button 
                            onClick={onCancel} 
                            disabled={loading}
                            className="h-10 px-5 rounded-xl text-slate-600 font-medium hover:bg-slate-50 flex-1 sm:flex-initial"
                        >
                            Hủy
                        </Button>
                        <Button 
                            type="primary" 
                            onClick={handleOk} 
                            loading={loading}
                            className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold shadow-sm flex-1 sm:flex-initial"
                        >
                            Lưu thay đổi
                        </Button>
                    </div>
                }
                destroyOnHidden
            >
                <div onPaste={handlePaste} className="outline-none">
                    <Form form={form} preserve={false} layout="vertical" className="mt-4 space-y-1">
                        {/* Hiển thị Mã Bệnh Án / Mã LK nếu có (Chỉ đọc) */}
                        {ticket?.ma_ba && (
                            <div className="mb-3.5 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                                <div className="flex items-center gap-1.5 font-medium">
                                    <FileTextOutlined className="text-blue-600" />
                                    <span>Hồ sơ bệnh án liên quan:</span>
                                </div>
                                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded-lg border border-blue-200 text-blue-700">
                                    {ticket.ma_ba}
                                </span>
                            </div>
                        )}

                        {targetDepartment === 'CNTT' && (
                            <Form.Item
                                name="category"
                                label={<span className="font-semibold text-slate-700 text-xs sm:text-sm">Loại sự cố</span>}
                                rules={[{ required: true, message: 'Vui lòng chọn loại sự cố' }]}
                                className="mb-3.5"
                            >
                                <Segmented 
                                    block 
                                    size="large"
                                    className="w-full !h-11 p-1 bg-slate-100/90 rounded-xl font-medium text-xs sm:text-sm border border-slate-200"
                                    options={[
                                        { label: '💻 Phần mềm (BAĐT)', value: 'SOFTWARE' },
                                        { label: '🖨️ Thiết bị / Sửa chữa', value: 'HARDWARE' }
                                    ]}
                                />
                            </Form.Item>
                        )}

                        <Form.Item
                            name="ten_loi"
                            label={<span className="font-semibold text-slate-700 text-xs sm:text-sm">Mô tả sự cố / Lỗi cần báo <span className="text-red-500">*</span></span>}
                            rules={[{ required: true, message: 'Vui lòng nhập mô tả sự cố' }]}
                            className="mb-3.5"
                        >
                            <Input.TextArea 
                                rows={3} 
                                placeholder="Mô tả chi tiết sự cố đang gặp phải..." 
                                className="rounded-xl! text-sm py-2"
                            />
                        </Form.Item>

                        {/* Responsive: 1 cột trên mobile, 2 cột trên tablet/desktop */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1">
                            <Form.Item
                                name="nguoi_bao"
                                label={<span className="font-semibold text-slate-700 text-xs sm:text-sm">Người báo</span>}
                                className="mb-2 sm:mb-3.5"
                            >
                                <Input 
                                    prefix={<UserOutlined className="text-slate-400 mr-1" />}
                                    placeholder="Tên người báo" 
                                    className="rounded-xl! h-10 text-sm"
                                />
                            </Form.Item>

                            <Form.Item
                                name="sdt"
                                label={<span className="font-semibold text-slate-700 text-xs sm:text-sm">Số điện thoại liên hệ</span>}
                                className="mb-2 sm:mb-3.5"
                            >
                                <Input 
                                    prefix={<PhoneOutlined className="text-slate-400 mr-1" />}
                                    placeholder="Số điện thoại liên hệ" 
                                    className="rounded-xl! h-10 text-sm"
                                />
                            </Form.Item>
                        </div>

                        <Form.Item
                            name="ghi_chu"
                            label={<span className="font-semibold text-slate-700 text-xs sm:text-sm">Ghi chú thêm</span>}
                            className="mb-3.5"
                        >
                            <Input.TextArea 
                                rows={2} 
                                placeholder="Các ghi chú bổ sung nếu có..." 
                                className="rounded-xl! text-sm py-2"
                            />
                        </Form.Item>
                        
                        {/* Khu vực đính kèm tệp & chụp ảnh (Tuyệt đối không dùng Antd Upload wrapper để không sinh ô vuông rỗng) */}
                        <div className="pt-1 mb-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-slate-700 text-xs sm:text-sm flex items-center gap-1.5">
                                    <PaperClipOutlined className="text-blue-600" />
                                    Hình ảnh & Tệp đính kèm (Tuỳ chọn)
                                </span>
                                {fileList.length > 0 && (
                                    <span className="text-[11px] text-blue-600 font-semibold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                        {fileList.length} tệp
                                    </span>
                                )}
                            </div>

                            {/* 2 Nút bấm thuần chuẩn Mobile & Desktop - 100% không còn ô vuông nét đứt */}
                            <div className="flex flex-col sm:flex-row gap-2.5 mb-2.5">
                                <input 
                                    id="file-input-edit" 
                                    type="file" 
                                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" 
                                    multiple 
                                    style={{ display: 'none' }} 
                                    onChange={(e) => {
                                        handleFileChange(e);
                                        e.target.value = '';
                                    }} 
                                />
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('file-input-edit')?.click()}
                                    className="flex-1 h-11 px-4 rounded-xl bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-98"
                                >
                                    <PictureOutlined className="text-base text-blue-600" />
                                    <span>Chọn ảnh / tệp từ máy</span>
                                </button>

                                <input 
                                    id="camera-input-edit" 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment" 
                                    style={{ display: 'none' }} 
                                    onChange={(e) => {
                                        handleFileChange(e);
                                        e.target.value = '';
                                    }} 
                                />
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('camera-input-edit')?.click()}
                                    className="flex-1 h-11 px-4 rounded-xl bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs active:scale-98"
                                >
                                    <CameraOutlined className="text-base text-emerald-600" />
                                    <span>Chụp ảnh (Điện thoại)</span>
                                </button>
                            </div>

                            <div className="text-[11px] text-slate-400 italic mb-2.5">
                                💡 Mẹo: Bạn có thể nhấn <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] text-slate-700 font-mono font-bold">Ctrl + V</kbd> để dán ảnh chụp màn hình nhanh vào đây.
                            </div>

                            {/* Lưới xem trước ảnh tự tạo (Custom Grid) - Rõ nét, có nút xóa đỏ ✕ */}
                            {fileList.length > 0 && (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50/80 rounded-2xl border border-slate-200">
                                    {fileList.map((file, idx) => {
                                        const isImg = file.url || file.thumbUrl;
                                        return (
                                            <div 
                                                key={file.uid || idx} 
                                                className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square flex flex-col items-center justify-center shadow-2xs"
                                            >
                                                {isImg ? (
                                                    <img 
                                                        src={file.url || file.thumbUrl} 
                                                        alt={file.name} 
                                                        className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                                        onClick={() => {
                                                            uploadProps.onPreview(file);
                                                        }}
                                                    />
                                                ) : (
                                                    <div 
                                                        className="p-2 text-center cursor-pointer flex flex-col items-center justify-center h-full w-full"
                                                        onClick={() => {
                                                            if (file.url && !file.url.startsWith('blob:')) window.open(file.url, '_blank');
                                                        }}
                                                    >
                                                        <FileTextOutlined className="text-2xl text-blue-500 mb-1" />
                                                        <span className="text-[10px] text-slate-600 font-medium line-clamp-2 px-1 break-all">
                                                            {file.name}
                                                        </span>
                                                    </div>
                                                )}
                                                {/* Nút xóa đỏ nổi bật */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        uploadProps.onRemove(file);
                                                    }}
                                                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-xs shadow-md cursor-pointer transition-transform active:scale-90 z-10 font-bold"
                                                    title="Xóa tệp này"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </Form>
                </div>
            </Modal>
            
            <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} centered>
                <img alt="Preview" style={{ width: '100%', marginTop: '20px', borderRadius: '8px' }} src={previewImage} />
            </Modal>
        </>
    );
};

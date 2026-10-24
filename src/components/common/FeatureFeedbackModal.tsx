'use client';

import React, { useState, useEffect } from 'react';
import { 
    Modal, Form, Input, Radio, Rate, Button, Select, message, 
    Alert, Space, Typography, Tag, Divider, Upload 
} from 'antd';
import { 
    MessageOutlined, StarFilled, SendOutlined, 
    BulbOutlined, BugOutlined, LayoutOutlined, FileProtectOutlined, CheckCircleOutlined,
    UploadOutlined, PaperClipOutlined
} from '@ant-design/icons';
import { useAuth } from '@/contexts/AuthContext';
import { getBasePath } from '@/utils/config';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

interface FeatureFeedbackModalProps {
    open: boolean;
    onClose: () => void;
    currentTitle?: string;
    pagePath?: string;
    defaultScope?: 'FEATURE' | 'POLICY';
    onSuccess?: () => void;
}

export default function FeatureFeedbackModal({
    open,
    onClose,
    currentTitle,
    pagePath,
    defaultScope = 'FEATURE',
    onSuccess
}: FeatureFeedbackModalProps) {
    const { user } = useAuth();
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [scope, setScope] = useState<'FEATURE' | 'POLICY'>(defaultScope);
    const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
    const [attachmentName, setAttachmentName] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (open) {
            form.resetFields();
            setScope(defaultScope);
            setAttachmentUrl(null);
            setAttachmentName(null);
            form.setFieldsValue({
                targetScope: defaultScope,
                featureName: currentTitle || 'Chức năng hệ thống',
                pagePath: pagePath || (typeof window !== 'undefined' ? window.location.pathname.replace('/htqlbenhvien', '') : ''),
                feedbackType: defaultScope === 'FEATURE' ? 'SUGGESTION' : 'POLICY_CHANGE',
                rating: 5,
                userName: (user as any)?.name || user?.username || '',
                department: user?.ten_khoa || ''
            });
        }
    }, [open, defaultScope, currentTitle, pagePath, user, form]);

    const handleUpload = async (file: File) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/upload`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                setAttachmentUrl(data.url);
                setAttachmentName(file.name);
                message.success('Đã đính kèm tệp thành công!');
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi tải tệp');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi tải tệp');
        } finally {
            setUploading(false);
        }
        return false;
    };

    const handleSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/feature-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...values,
                    attachmentUrl,
                    attachmentName
                })
            });

            if (res.ok) {
                message.success('Đã gửi ý kiến đóng góp thành công! Cảm ơn sự đóng góp của bạn.');
                form.resetFields();
                if (onSuccess) onSuccess();
                onClose();
            } else {
                const data = await res.json();
                message.error(data.error || 'Lỗi khi gửi ý kiến');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi gửi ý kiến đóng góp');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            centered
            width={580}
            destroyOnHidden
            title={
                <div className="flex items-center gap-2.5 text-slate-800 text-base font-bold">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                        <MessageOutlined />
                    </div>
                    <div>
                        <div>Hòm Thư Đóng Góp Ý Kiến & Phản Hồi</div>
                        <div className="text-xs font-normal text-slate-500">Bệnh viện Đa khoa Lạng Sơn</div>
                    </div>
                </div>
            }
        >
            <div className="py-2">
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    {/* Phạm vi góp ý */}
                    <Form.Item name="targetScope" label="Phạm vi đóng góp ý kiến">
                        <Radio.Group 
                            buttonStyle="solid" 
                            className="w-full grid grid-cols-2 text-center"
                            onChange={(e) => {
                                setScope(e.target.value);
                                form.setFieldsValue({
                                    feedbackType: e.target.value === 'FEATURE' ? 'SUGGESTION' : 'POLICY_CHANGE'
                                });
                            }}
                        >
                            <Radio.Button value="FEATURE" className="text-xs font-semibold py-1">
                                💻 Chức năng Thử nghiệm này
                            </Radio.Button>
                            <Radio.Button value="POLICY" className="text-xs font-semibold py-1">
                                📜 Quy định / Chính sách BV
                            </Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    {scope === 'FEATURE' ? (
                        <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 mb-3 text-xs text-blue-900">
                            <strong>Đang góp ý cho chức năng:</strong> {currentTitle || 'Trang hiện tại'}
                            <div className="text-[11px] text-blue-700 mt-0.5">
                                Ý kiến của bạn sẽ được chuyển thẳng đến <strong>Phòng Công nghệ Thông tin</strong> để hoàn thiện phần mềm trước khi nghiệm thu chính thức.
                            </div>
                        </div>
                    ) : (
                        <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 mb-3 text-xs text-amber-900">
                            <Form.Item 
                                name="policyTitle" 
                                label="Tên Quy định / Chính sách / Quy chế đang góp ý" 
                                rules={[{ required: true, message: 'Nhập tên hoặc số văn bản quy định' }]}
                                className="mb-0"
                            >
                                <Input placeholder="Ví dụ: Quy chế chi tiêu nội bộ, Quy định chấm công trực, Quy trình kê đơn..." />
                            </Form.Item>
                            <div className="text-[11px] text-amber-700 mt-1.5">
                                Ý kiến sẽ được tổng hợp báo cáo <strong>Ban Giám đốc & Phòng chức năng liên quan</strong> (TCCB, KHTH...).
                            </div>
                        </div>
                    )}

                    {/* Hidden system fields */}
                    <Form.Item name="featureName" hidden><Input /></Form.Item>
                    <Form.Item name="pagePath" hidden><Input /></Form.Item>

                    {/* Phân loại & Đánh giá */}
                    <div className="grid grid-cols-2 gap-3">
                        <Form.Item name="feedbackType" label="Loại ý kiến" rules={[{ required: true }]}>
                            {scope === 'FEATURE' ? (
                                <Select>
                                    <Select.Option value="BUG">🐞 Báo lỗi phần mềm</Select.Option>
                                    <Select.Option value="SUGGESTION">💡 Đề xuất thêm tính năng/trường</Select.Option>
                                    <Select.Option value="UI">🎨 Góp ý giao diện/nút bấm</Select.Option>
                                    <Select.Option value="OTHER">Khác</Select.Option>
                                </Select>
                            ) : (
                                <Select>
                                    <Select.Option value="POLICY_CHANGE">📝 Đề xuất sửa đổi điều khoản</Select.Option>
                                    <Select.Option value="OBSTACLE">⚠️ Báo cáo vướng mắc thực tế</Select.Option>
                                    <Select.Option value="INNOVATION">💡 Đề xuất sáng kiến cải tiến</Select.Option>
                                    <Select.Option value="OTHER">Ý kiến khác</Select.Option>
                                </Select>
                            )}
                        </Form.Item>

                        <Form.Item name="rating" label="Đánh giá mức độ hài lòng" initialValue={5}>
                            <Rate />
                        </Form.Item>
                    </div>

                    {/* Nội dung góp ý */}
                    <Form.Item 
                        name="content" 
                        label="Nội dung ý kiến đóng góp chi tiết" 
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung góp ý' }]}
                    >
                        <TextArea 
                            rows={4} 
                            placeholder={scope === 'FEATURE' 
                                ? "Mô tả chi tiết lỗi phát sinh hoặc ý kiến bạn muốn hệ thống bổ sung, điều chỉnh..." 
                                : "Nêu rõ điều khoản, điểm bất cập hoặc đề xuất phương án cải tiến cụ thể..."} 
                        />
                    </Form.Item>

                    {/* Tệp văn bản / hình ảnh đính kèm */}
                    <div className="mb-4 bg-slate-50 p-2.5 rounded-xl border border-dashed border-slate-300 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <PaperClipOutlined className="text-slate-400 text-base" />
                            <div>
                                <div className="text-xs font-semibold text-slate-700">Tệp văn bản / Hình ảnh đính kèm (nếu có)</div>
                                <div className="text-[10px] text-slate-400">Hỗ trợ PDF, Word, Excel, Ảnh chụp (tối đa 15MB)</div>
                            </div>
                        </div>
                        <Upload 
                            beforeUpload={handleUpload}
                            maxCount={1}
                            showUploadList={false}
                        >
                            <Button 
                                icon={<UploadOutlined />} 
                                loading={uploading} 
                                size="small"
                                className="rounded-lg text-xs"
                            >
                                {attachmentName ? `✓ ${attachmentName.slice(0, 15)}...` : 'Chọn tệp đính kèm'}
                            </Button>
                        </Upload>
                    </div>

                    {/* Thông tin người gửi */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4">
                        <Form.Item name="userName" label="Người gửi ý kiến" className="mb-0">
                            <Input placeholder="Họ và tên cán bộ" />
                        </Form.Item>
                        <Form.Item name="department" label="Khoa / Phòng" className="mb-0">
                            <Input placeholder="Tên khoa phòng" />
                        </Form.Item>
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                        <Button onClick={onClose} className="rounded-xl px-4">
                            Đóng
                        </Button>
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            loading={submitting}
                            icon={<SendOutlined />}
                            className="bg-amber-600 hover:bg-amber-700 font-bold px-6 rounded-xl border-none"
                        >
                            Gửi Ý Kiến Đóng Góp
                        </Button>
                    </div>
                </Form>
            </div>
        </Modal>
    );
}

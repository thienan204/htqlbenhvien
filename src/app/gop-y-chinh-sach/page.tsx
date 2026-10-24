'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
    Card, Button, Form, Input, Select, Upload, message, 
    Typography, Tag, Space, Spin, Alert, Divider, Empty, Row, Col 
} from 'antd';
import { 
    FileTextOutlined, DownloadOutlined, SendOutlined, 
    UploadOutlined, CheckCircleFilled, ClockCircleOutlined, 
    SafetyCertificateOutlined, UserOutlined, ApartmentOutlined, 
    FileProtectOutlined, EyeOutlined 
} from '@ant-design/icons';
import { getBasePath } from '@/utils/config';
import { useAuth } from '@/contexts/AuthContext';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

function PolicyFeedbackContent() {
    const searchParams = useSearchParams();
    const policyKey = searchParams.get('key');
    const policyId = searchParams.get('id');
    const { user } = useAuth();

    const [form] = Form.useForm();
    const [policies, setPolicies] = useState<any[]>([]);
    const [selectedPolicy, setSelectedPolicy] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
    const [attachmentName, setAttachmentName] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const bPath = getBasePath();

    useEffect(() => {
        fetchPolicies();
    }, [policyKey, policyId]);

    const fetchPolicies = async () => {
        setLoading(true);
        try {
            if (policyKey || policyId) {
                const url = policyKey 
                    ? `${bPath}/api/hospital-policies?key=${encodeURIComponent(policyKey)}`
                    : `${bPath}/api/hospital-policies?id=${encodeURIComponent(policyId!)}`;
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) {
                        setSelectedPolicy(data.data);
                        setPolicies([data.data]);
                    }
                }
            } else {
                // Fetch all active policies
                const res = await fetch(`${bPath}/api/hospital-policies?onlyActive=true`);
                if (res.ok) {
                    const data = await res.json();
                    const list = data.data || [];
                    setPolicies(list);
                    if (list.length > 0) {
                        setSelectedPolicy(list[0]);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching policies:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (file: File) => {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${bPath}/api/upload`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                setAttachmentUrl(data.url);
                setAttachmentName(file.name);
                message.success('Đã tải lên tệp văn bản góp ý!');
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi tải tệp');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi tải tệp');
        } finally {
            setUploading(false);
        }
        return false;
    };

    const handleSubmit = async (values: any) => {
        if (!selectedPolicy) {
            message.warning('Vui lòng chọn văn bản chính sách cần góp ý');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                targetScope: 'POLICY',
                policyId: selectedPolicy.id,
                policyTitle: selectedPolicy.title,
                userName: values.userName || user?.name || user?.username || 'Cán bộ khoa phòng',
                department: values.department || user?.ten_khoa || 'Khoa phòng',
                feedbackType: values.feedbackType || 'POLICY_CHANGE',
                rating: 5,
                content: values.content,
                attachmentUrl: attachmentUrl,
                attachmentName: attachmentName,
                status: 'PENDING'
            };

            const res = await fetch(`${bPath}/api/feature-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsSubmitted(true);
                message.success('Đã gửi ý kiến đóng góp dự thảo thành công!');
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi gửi ý kiến');
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setSubmitting(false);
        }
    };

    const isPolicyActive = (p: any) => {
        if (!p) return false;
        if (!p.isActive) return false;
        if (p.endDate && new Date(p.endDate) < new Date()) return false;
        return true;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Spin size="large" />
                <p className="mt-3 text-slate-500 text-sm">Đang tải danh mục văn bản chính sách...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 pb-16">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center text-2xl shadow-md">
                        <FileProtectOutlined />
                    </div>
                    <div>
                        <div className="text-[11px] font-bold tracking-widest text-amber-700 uppercase">
                            Bệnh Viện Đa Khoa Lạng Sơn
                        </div>
                        <h1 className="text-xl font-black text-slate-800 mb-0.5">
                            CỔNG LẤY Ý KIẾN QUY CHẾ & CHÍNH SÁCH BỆNH VIỆN
                        </h1>
                        <p className="text-xs text-slate-500 mb-0">
                            Khoa/Phòng xem văn bản dự thảo và tham gia đóng góp hoàn thiện cơ chế, chính sách
                        </p>
                    </div>
                </div>
            </div>

            {policies.length === 0 ? (
                <Card className="rounded-3xl border-slate-200 text-center py-12">
                    <Empty description="Hiện tại không có văn bản dự thảo nào đang trong giai đoạn lấy ý kiến." />
                </Card>
            ) : (
                <Row gutter={[20, 20]}>
                    {/* Cột trái: Danh sách văn bản */}
                    <Col xs={24} md={10}>
                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Văn bản đang lấy ý kiến ({policies.filter(isPolicyActive).length} hiệu lực)
                            </div>

                            {policies.map((p) => {
                                const active = isPolicyActive(p);
                                const isSelected = selectedPolicy?.id === p.id;
                                return (
                                    <div 
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedPolicy(p);
                                            setIsSubmitted(false);
                                        }}
                                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                                            isSelected 
                                                ? 'bg-amber-50/70 border-amber-400 shadow-md ring-2 ring-amber-400/20' 
                                                : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="font-bold text-slate-800 text-xs leading-snug">
                                                {p.title}
                                            </div>
                                            {active ? (
                                                <Tag color="success" className="text-[10px]">Đang lấy ý kiến</Tag>
                                            ) : (
                                                <Tag color="default" className="text-[10px]">Đã kết thúc</Tag>
                                            )}
                                        </div>

                                        {p.code && (
                                            <div className="text-[11px] text-amber-800 font-medium mt-1">
                                                Số hiệu: {p.code}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-2">
                                            <ClockCircleOutlined />
                                            Hạn chót: {p.endDate ? new Date(p.endDate).toLocaleDateString('vi-VN') : 'Không giới hạn'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Col>

                    {/* Cột phải: Xem chi tiết & Form góp ý */}
                    <Col xs={24} md={14}>
                        {selectedPolicy && (
                            <Card className="rounded-3xl border-slate-200 shadow-sm">
                                {/* Chi tiết văn bản */}
                                <div className="border-b pb-4 mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Tag color="orange" className="text-xs font-semibold">
                                            {selectedPolicy.category === 'INTERNAL_EXPENSE' ? 'Chi tiêu nội bộ' 
                                                : selectedPolicy.category === 'REGULATION' ? 'Quy trình chuyên môn' : 'Chính sách BV'}
                                        </Tag>
                                        {isPolicyActive(selectedPolicy) ? (
                                            <Tag color="success">🟢 Đang có hiệu lực góp ý</Tag>
                                        ) : (
                                            <Tag color="default">⚪ Đã kết thúc thời gian lấy ý kiến</Tag>
                                        )}
                                    </div>

                                    <h2 className="text-base font-bold text-slate-800 mb-2">
                                        {selectedPolicy.title}
                                    </h2>

                                    {selectedPolicy.code && (
                                        <div className="text-xs text-slate-500 mb-2">
                                            Số hiệu văn bản: <span className="font-semibold text-slate-700">{selectedPolicy.code}</span>
                                        </div>
                                    )}

                                    {selectedPolicy.summary && (
                                        <div className="bg-slate-50 p-3 rounded-xl border text-xs text-slate-700 leading-relaxed mb-3">
                                            <strong>Tóm tắt nội dung:</strong> {selectedPolicy.summary}
                                        </div>
                                    )}

                                    {/* Nút tải/xem file */}
                                    {selectedPolicy.fileUrl ? (
                                        <div className="flex items-center gap-3 bg-blue-50/60 p-3 rounded-xl border border-blue-200">
                                            <FileTextOutlined className="text-2xl text-blue-600" />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-800 truncate">
                                                    {selectedPolicy.fileName || 'Tài liệu văn bản đính kèm'}
                                                </div>
                                                <div className="text-[11px] text-blue-600">
                                                    Bấm để mở xem hoặc tải về máy
                                                </div>
                                            </div>
                                            <Button 
                                                type="primary" 
                                                icon={<DownloadOutlined />}
                                                href={selectedPolicy.fileUrl}
                                                target="_blank"
                                                download
                                                className="bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-semibold"
                                            >
                                                Tải Văn Bản
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-400 italic">
                                            Chưa đính kèm tệp văn bản
                                        </div>
                                    )}
                                </div>

                                {/* Kiểm tra hiệu lực */}
                                {!isPolicyActive(selectedPolicy) ? (
                                    <Alert 
                                        type="warning"
                                        showIcon
                                        title="Đợt lấy ý kiến đã kết thúc"
                                        description="Văn bản này hiện đã hết hạn lấy ý kiến hoặc tạm thời đóng để Ban Giám đốc và các phòng chức năng tổng hợp ban hành chính thức."
                                        className="rounded-2xl text-xs"
                                    />
                                ) : isSubmitted ? (
                                    <div className="text-center py-8">
                                        <CheckCircleFilled className="text-4xl text-emerald-500 mb-2" />
                                        <div className="text-sm font-bold text-slate-800">
                                            Đã gửi ý kiến đóng góp thành công!
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">
                                            Ý kiến của khoa/phòng đã được ghi nhận vào hệ thống để báo cáo Ban Giám đốc.
                                        </p>
                                        <Button 
                                            type="default" 
                                            onClick={() => {
                                                setIsSubmitted(false);
                                                form.resetFields();
                                                setAttachmentUrl(null);
                                            }}
                                            className="mt-2 rounded-xl text-xs"
                                        >
                                            Góp ý thêm điều khoản khác
                                        </Button>
                                    </div>
                                ) : (
                                    /* Form góp ý */
                                    <Form form={form} layout="vertical" onFinish={handleSubmit}>
                                        <div className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                            <span>✍️ Phiếu đóng góp ý kiến Khoa / Phòng</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-2">
                                            <Form.Item 
                                                name="userName" 
                                                label={<span className="text-xs font-semibold">Cán bộ đại diện</span>}
                                                initialValue={user?.name || user?.username || ''}
                                                rules={[{ required: true, message: 'Nhập tên cán bộ' }]}
                                                className="mb-2"
                                            >
                                                <Input placeholder="Họ và tên" className="rounded-xl text-xs" />
                                            </Form.Item>

                                            <Form.Item 
                                                name="department" 
                                                label={<span className="text-xs font-semibold">Khoa / Phòng</span>}
                                                initialValue={user?.ten_khoa || ''}
                                                rules={[{ required: true, message: 'Nhập tên khoa phòng' }]}
                                                className="mb-2"
                                            >
                                                <Input placeholder="Tên khoa phòng" className="rounded-xl text-xs" />
                                            </Form.Item>
                                        </div>

                                        <Form.Item 
                                            name="feedbackType" 
                                            label={<span className="text-xs font-semibold">Loại góp ý</span>}
                                            initialValue="POLICY_CHANGE"
                                            className="mb-3"
                                        >
                                            <Select className="text-xs">
                                                <Select.Option value="POLICY_CHANGE">📝 Đề xuất sửa đổi, bổ sung điều khoản</Select.Option>
                                                <Select.Option value="OBSTACLE">⚠️ Báo cáo điểm vướng mắc trong thực tế</Select.Option>
                                                <Select.Option value="INNOVATION">💡 Đề xuất phương án cải tiến mới</Select.Option>
                                                <Select.Option value="AGREE">✓ Thống nhất toàn bộ dự thảo</Select.Option>
                                            </Select>
                                        </Form.Item>

                                        <Form.Item 
                                            name="content" 
                                            label={<span className="text-xs font-semibold">Nội dung đóng góp chi tiết (ghi rõ điều, khoản, điểm)</span>}
                                            rules={[{ required: true, message: 'Vui lòng nhập nội dung góp ý' }]}
                                            className="mb-3"
                                        >
                                            <TextArea 
                                                rows={4} 
                                                placeholder="Ví dụ: Tại Điều 5, Khoản 2 đề nghị điều chỉnh mức chi... vì lý do thực tế tại khoa..."
                                                className="rounded-2xl text-xs p-3"
                                            />
                                        </Form.Item>

                                        {/* Đính kèm văn bản phản hồi của khoa */}
                                        <div className="mb-4">
                                            <div className="text-xs font-semibold text-slate-700 mb-1.5">
                                                Văn bản / Công văn phản hồi của Khoa (nếu có):
                                            </div>
                                            <Upload 
                                                beforeUpload={handleUpload}
                                                maxCount={1}
                                                showUploadList={false}
                                            >
                                                <Button 
                                                    icon={<UploadOutlined />} 
                                                    loading={uploading}
                                                    className="rounded-xl text-xs"
                                                >
                                                    {attachmentName ? `✓ ${attachmentName}` : 'Đính kèm file Word / PDF / Excel'}
                                                </Button>
                                            </Upload>
                                        </div>

                                        <Button 
                                            type="primary"
                                            htmlType="submit"
                                            loading={submitting}
                                            icon={<SendOutlined />}
                                            className="w-full bg-amber-600 hover:bg-amber-700 font-bold rounded-2xl h-11 border-none shadow-md text-xs"
                                        >
                                            Gửi Ý Kiến Đóng Góp Đến Ban Giám Đốc
                                        </Button>
                                    </Form>
                                )}
                            </Card>
                        )}
                    </Col>
                </Row>
            )}
        </div>
    );
}

export default function PolicyFeedbackPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-20 gap-2.5">
                <Spin size="large" />
                <span className="text-xs text-slate-500 font-medium">Đang tải...</span>
            </div>
        }>
            <PolicyFeedbackContent />
        </Suspense>
    );
}

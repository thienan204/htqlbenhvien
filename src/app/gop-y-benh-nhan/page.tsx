'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
    Form, Input, Button, Rate, Select, Switch, Upload, message, 
    Card, Result, Spin, Alert, Typography, Tag, Space 
} from 'antd';
import { 
    HeartFilled, StarFilled, SendOutlined, 
    UploadOutlined, CheckCircleFilled, MedicineBoxFilled, 
    SafetyCertificateFilled, PhoneOutlined, UserOutlined, 
    EnvironmentOutlined, WarningOutlined, ClockCircleOutlined 
} from '@ant-design/icons';
import { getBasePath } from '@/utils/config';

const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;

const DEPARTMENTS = [
    'Khoa Khám bệnh',
    'Khoa Cấp cứu',
    'Khoa Hồi sức tích cực - Chống độc',
    'Khoa Nội tổng hợp',
    'Khoa Nội Tim mạch',
    'Khoa Ngoại tổng hợp',
    'Khoa Ngoại Chấn thương',
    'Khoa Phụ sản',
    'Khoa Nhi',
    'Khoa Truyền nhiễm',
    'Khoa Y học cổ truyền',
    'Khoa Răng Hàm Mặt - Mắt - TMH',
    'Khoa Xét nghiệm',
    'Khoa Chẩn đoán hình ảnh',
    'Khoa Dược & Nhà thuốc BV',
    'Quầy Tiếp đón & Thu viện phí',
    'Khu vực khác / Toàn viện'
];

function PatientFeedbackContent() {
    const searchParams = useSearchParams();
    const campaignKey = searchParams.get('key');
    const campaignId = searchParams.get('campaignId');

    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [campaignLoading, setCampaignLoading] = useState(false);
    const [campaign, setCampaign] = useState<any>(null);
    const [isExpiredOrInactive, setIsExpiredOrInactive] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [rating, setRating] = useState<number>(5);
    const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const bPath = getBasePath();

    useEffect(() => {
        if (campaignKey || campaignId) {
            fetchCampaign();
        }
    }, [campaignKey, campaignId]);

    const fetchCampaign = async () => {
        setCampaignLoading(true);
        try {
            const url = campaignKey 
                ? `${bPath}/api/patient-campaigns?key=${encodeURIComponent(campaignKey)}`
                : `${bPath}/api/patient-campaigns?id=${encodeURIComponent(campaignId!)}`;
            
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    setCampaign(data.data);
                    // Check validity
                    if (!data.data.isActive) {
                        setIsExpiredOrInactive(true);
                    } else if (data.data.endDate && new Date(data.data.endDate) < new Date()) {
                        setIsExpiredOrInactive(true);
                    } else {
                        if (data.data.department) {
                            form.setFieldsValue({ department: data.data.department });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching campaign:', error);
        } finally {
            setCampaignLoading(false);
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
                message.success('Đã tải ảnh đính kèm!');
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi tải ảnh');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi tải ảnh');
        } finally {
            setUploading(false);
        }
        return false; // Prevent default upload
    };

    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            const payload = {
                targetScope: 'PATIENT',
                isPatientFeedback: true,
                campaignId: campaign?.id || null,
                userName: isAnonymous ? 'Người bệnh ẩn danh' : values.userName,
                patientPhone: isAnonymous ? null : values.patientPhone,
                isAnonymous: Boolean(isAnonymous),
                department: values.department,
                treatmentArea: values.treatmentArea || campaign?.location || null,
                feedbackType: values.feedbackType || 'SUGGESTION',
                rating: rating,
                content: values.content,
                attachmentUrl: attachmentUrl,
                status: 'PENDING'
            };

            const res = await fetch(`${bPath}/api/feature-feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsSubmitted(true);
            } else {
                const err = await res.json();
                message.error(err.error || 'Có lỗi xảy ra khi gửi ý kiến');
            }
        } catch (error) {
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setLoading(false);
        }
    };

    const getRatingDesc = (val: number) => {
        switch (val) {
            case 1: return 'Rất không hài lòng';
            case 2: return 'Chưa hài lòng';
            case 3: return 'Bình thường';
            case 4: return 'Hài lòng';
            case 5: return 'Rất hài lòng & Khen ngợi';
            default: return '';
        }
    };

    if (campaignLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Spin size="large" />
                <p className="mt-3 text-slate-500 text-sm">Đang kết nối hòm thư góp ý...</p>
            </div>
        );
    }

    if (isExpiredOrInactive) {
        return (
            <div className="max-w-md mx-auto p-4 pt-12">
                <Card className="rounded-3xl border-slate-200 shadow-lg text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mx-auto mb-4">
                        <ClockCircleOutlined />
                    </div>
                    <Title level={4} className="text-slate-800 mb-2">
                        Đợt Góp Ý Đã Kết Thúc
                    </Title>
                    <Paragraph className="text-slate-600 text-sm leading-relaxed mb-6">
                        Điểm tiếp nhận ý kiến này hiện đang tạm dừng hoặc đã hoàn tất thời gian khảo sát.
                        <br />
                        Bệnh viện Đa khoa Lạng Sơn xin chân thành cảm ơn sự đồng hành và những ý kiến quý báu của Quý bệnh nhân!
                    </Paragraph>
                    <div className="bg-slate-50 p-3 rounded-2xl border text-xs text-slate-500">
                        Đường dây nóng Bệnh viện: <strong>0205.3870.115</strong>
                    </div>
                </Card>
            </div>
        );
    }

    if (isSubmitted) {
        return (
            <div className="max-w-md mx-auto p-4 pt-12">
                <Card className="rounded-3xl border-slate-200 shadow-xl text-center p-6 bg-gradient-to-b from-white to-emerald-50/40">
                    <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-4xl mx-auto mb-4 animate-bounce">
                        <CheckCircleFilled />
                    </div>
                    <Title level={3} className="text-emerald-900 mb-2 font-black">
                        Gửi Ý Kiến Thành Công!
                    </Title>
                    <Paragraph className="text-slate-700 text-sm leading-relaxed mb-6">
                        Bệnh viện Đa khoa Lạng Sơn xin trân trọng cảm ơn những ý kiến đóng góp quý báu của Quý vị.
                        <br /><br />
                        Mọi phản ánh đều được <strong>Ban Giám đốc</strong> và <strong>Phòng Quản lý Chất lượng</strong> tiếp thu nghiêm túc nhằm không ngừng nâng cao chất lượng phục vụ và tinh thần y đức!
                    </Paragraph>
                    <Button 
                        type="primary"
                        onClick={() => {
                            setIsSubmitted(false);
                            form.resetFields();
                            setAttachmentUrl(null);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold px-6 h-11"
                    >
                        Gửi thêm ý kiến khác
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto p-4 pb-12">
            {/* Header Brand */}
            <div className="text-center mb-6 pt-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-3xl shadow-lg mb-3">
                    🏥
                </div>
                <div className="text-[11px] font-bold tracking-widest text-blue-700 uppercase">
                    Bệnh Viện Đa Khoa Lạng Sơn
                </div>
                <h1 className="text-xl font-black text-slate-800 mt-1 mb-1">
                    HÒM THƯ GÓP Ý ĐIỆN TỬ
                </h1>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-0">
                    Lắng nghe ý kiến Người bệnh & Thân nhân vì sự hài lòng và sức khỏe của nhân dân
                </p>
                {campaign && (
                    <div className="mt-2.5 inline-block bg-blue-50 text-blue-800 font-semibold text-xs px-3 py-1 rounded-full border border-blue-200">
                        📍 {campaign.name} {campaign.location ? `(${campaign.location})` : ''}
                    </div>
                )}
            </div>

            {/* Form Card */}
            <Card className="rounded-3xl border-slate-200 shadow-lg">
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    {/* Tùy chọn Ẩn danh */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-4 flex items-center justify-between">
                        <div>
                            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <SafetyCertificateFilled className="text-emerald-600" />
                                Gửi ý kiến Ẩn danh
                            </div>
                            <div className="text-[11px] text-slate-500">
                                Tuyệt đối bảo mật thông tin cá nhân của bạn
                            </div>
                        </div>
                        <Switch 
                            checked={isAnonymous} 
                            onChange={(checked) => setIsAnonymous(checked)} 
                            className="bg-slate-300"
                        />
                    </div>

                    {/* Thông tin liên hệ (nếu không ẩn danh) */}
                    {!isAnonymous && (
                        <div className="space-y-3 mb-4 p-3.5 rounded-2xl bg-blue-50/40 border border-blue-100">
                            <Form.Item 
                                name="userName" 
                                label={<span className="text-xs font-semibold text-slate-700">Họ và tên người bệnh / thân nhân</span>}
                                rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                                className="mb-2"
                            >
                                <Input placeholder="Ví dụ: Nguyễn Văn A" prefix={<UserOutlined className="text-slate-400" />} className="rounded-xl text-xs h-10" />
                            </Form.Item>

                            <Form.Item 
                                name="patientPhone" 
                                label={<span className="text-xs font-semibold text-slate-700">Số điện thoại liên hệ (để bệnh viện gọi lại thăm hỏi)</span>}
                                rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
                                className="mb-0"
                            >
                                <Input placeholder="Ví dụ: 0912 345 678" prefix={<PhoneOutlined className="text-slate-400" />} className="rounded-xl text-xs h-10" />
                            </Form.Item>
                        </div>
                    )}

                    {/* Chọn Khoa / Phòng */}
                    <Form.Item 
                        name="department" 
                        label={<span className="text-xs font-semibold text-slate-700">Khoa / Phòng / Khu vực tiếp nhận dịch vụ</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn khoa phòng' }]}
                    >
                        <Select 
                            placeholder="Chọn khoa phòng điều trị..." 
                            className="w-full text-xs h-10"
                            showSearch
                        >
                            {DEPARTMENTS.map((dept) => (
                                <Select.Option key={dept} value={dept}>{dept}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {/* Buồng bệnh / Số giường (tùy chọn) */}
                    <Form.Item 
                        name="treatmentArea" 
                        label={<span className="text-xs font-semibold text-slate-700">Số buồng bệnh / Phòng khám (nếu có)</span>}
                    >
                        <Input placeholder="Ví dụ: Buồng 204, Phòng khám số 3..." className="rounded-xl text-xs h-10" />
                    </Form.Item>

                    {/* Phân loại phản ánh */}
                    <Form.Item 
                        name="feedbackType" 
                        label={<span className="text-xs font-semibold text-slate-700">Phân loại nội dung góp ý</span>}
                        rules={[{ required: true, message: 'Vui lòng chọn loại góp ý' }]}
                        initialValue="SUGGESTION"
                    >
                        <Select className="w-full text-xs h-10">
                            <Select.Option value="PRAISE">🌟 Khen ngợi tinh thần y đức & thái độ phục vụ</Select.Option>
                            <Select.Option value="ATTITUDE">⚠️ Phản ánh thái độ giao tiếp, giải thích của NVYT</Select.Option>
                            <Select.Option value="WAITING_TIME">⏱️ Phản ánh thời gian chờ đợi (khám, xét nghiệm, thuốc)</Select.Option>
                            <Select.Option value="FACILITY">🏥 Cơ sở vật chất, vệ sinh buồng bệnh, nhà vệ sinh</Select.Option>
                            <Select.Option value="BILLING">💰 Thủ tục viện phí, viện trợ, bảo hiểm y tế</Select.Option>
                            <Select.Option value="SUGGESTION">💡 Đề xuất sáng kiến cải tiến dịch vụ</Select.Option>
                            <Select.Option value="OTHER">Ý kiến khác</Select.Option>
                        </Select>
                    </Form.Item>

                    {/* Đánh giá sao */}
                    <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-200 mb-4 text-center">
                        <div className="text-xs font-bold text-slate-800 mb-1">
                            Đánh giá mức độ hài lòng chung:
                        </div>
                        <Rate 
                            value={rating} 
                            onChange={(val) => setRating(val)} 
                            className="text-2xl text-amber-500 my-1" 
                        />
                        <div className="text-xs font-bold text-amber-700 mt-1">
                            {getRatingDesc(rating)}
                        </div>
                    </div>

                    {/* Nội dung chi tiết */}
                    <Form.Item 
                        name="content" 
                        label={<span className="text-xs font-semibold text-slate-700">Nội dung ý kiến phản ánh chi tiết</span>}
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung góp ý' }]}
                    >
                        <TextArea 
                            rows={4} 
                            placeholder="Xin quý vị nêu rõ vụ việc, thời gian xảy ra, tên cán bộ hoặc nội dung khen ngợi / phản ánh để bệnh viện xác minh và cải tiến..." 
                            className="rounded-2xl text-xs p-3"
                        />
                    </Form.Item>

                    {/* Tải ảnh chụp đính kèm */}
                    <div className="mb-6">
                        <div className="text-xs font-semibold text-slate-700 mb-1.5">
                            Hình ảnh minh chứng đính kèm (nếu có):
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
                                {attachmentUrl ? '✓ Đã đính kèm ảnh (Bấm để đổi)' : 'Tải ảnh chụp từ điện thoại'}
                            </Button>
                        </Upload>
                        {attachmentUrl && (
                            <div className="mt-2 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircleFilled /> Ảnh đã được tải lên thành công
                            </div>
                        )}
                    </div>

                    {/* Nút gửi */}
                    <Button 
                        type="primary" 
                        htmlType="submit" 
                        loading={loading}
                        icon={<SendOutlined />}
                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-sm shadow-md border-none"
                    >
                        Gửi Ý Kiến Đóng Góp
                    </Button>
                </Form>
            </Card>

            {/* Footer */}
            <div className="text-center mt-6 text-xs text-slate-400">
                © Bệnh viện Đa khoa Lạng Sơn • Đường dây nóng: <strong>0205.3870.115</strong>
            </div>
        </div>
    );
}

export default function PatientFeedbackPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-20 gap-2.5">
                <Spin size="large" />
                <span className="text-xs text-slate-500 font-medium">Đang tải...</span>
            </div>
        }>
            <PatientFeedbackContent />
        </Suspense>
    );
}

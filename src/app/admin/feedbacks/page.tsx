'use client';

import React, { useState, useEffect } from 'react';
import { 
    Table, Button, Input, Select, Tag, Rate, Card, Space, 
    Modal, Radio, Form, message, Popconfirm, Tooltip, Badge, Tabs, 
    Typography, Row, Col, Empty, Switch, Upload, QRCode, Divider, DatePicker 
} from 'antd';
import { 
    MessageOutlined, SearchOutlined, ReloadOutlined, 
    DownloadOutlined, CheckCircleOutlined, ClockCircleOutlined, 
    SyncOutlined, CloseOutlined, DeleteOutlined, StarFilled, 
    SendOutlined, EyeOutlined, FilterOutlined, InfoCircleOutlined,
    BookOutlined, BulbOutlined, FileProtectOutlined, CompassOutlined,
    QrcodeOutlined, PrinterOutlined, PlusOutlined, UploadOutlined,
    PaperClipOutlined, UserOutlined, PhoneOutlined, MedicineBoxFilled,
    HeartFilled, FilePdfOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { getBasePath } from '@/utils/config';
import { useAuth } from '@/contexts/AuthContext';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

interface FeatureFeedbackItem {
    id: string;
    targetScope: string;
    pagePath?: string | null;
    featureName?: string | null;
    policyTitle?: string | null;
    policyId?: string | null;
    campaignId?: string | null;
    isPatientFeedback?: boolean;
    patientPhone?: string | null;
    isAnonymous?: boolean;
    treatmentArea?: string | null;
    userId?: string | null;
    userName?: string | null;
    department?: string | null;
    feedbackType: string;
    rating?: number | null;
    content: string;
    imageUrl?: string | null;
    attachmentUrl?: string | null;
    attachmentName?: string | null;
    status: 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REJECTED' | string;
    adminNote?: string | null;
    respondedBy?: string | null;
    respondedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

interface HospitalPolicyItem {
    id: string;
    code?: string | null;
    title: string;
    category: string;
    summary?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    startDate: string;
    endDate?: string | null;
    isActive: boolean;
    status: string;
    targetDepartments?: string | null;
    qrCodeKey: string;
    createdBy?: string | null;
    createdAt: string;
}

interface PatientCampaignItem {
    id: string;
    name: string;
    department?: string | null;
    location?: string | null;
    description?: string | null;
    startDate: string;
    endDate?: string | null;
    isActive: boolean;
    qrCodeKey: string;
    createdBy?: string | null;
    createdAt: string;
}

export default function AdminFeedbacksPage() {
    const { user } = useAuth();
    const bPath = getBasePath();

    // Active Top-level Tab
    const [mainTab, setMainTab] = useState<string>('FEATURE');

    // Data states
    const [feedbacks, setFeedbacks] = useState<FeatureFeedbackItem[]>([]);
    const [policies, setPolicies] = useState<HospitalPolicyItem[]>([]);
    const [campaigns, setCampaigns] = useState<PatientCampaignItem[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Filters for feedbacks
    const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
    const [selectedType, setSelectedType] = useState<string>('ALL');
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // Modal: Reply / Action
    const [selectedItem, setSelectedItem] = useState<FeatureFeedbackItem | null>(null);
    const [replyStatus, setReplyStatus] = useState<string>('RESOLVED');
    const [replyNote, setReplyNote] = useState<string>('');
    const [submittingReply, setSubmittingReply] = useState(false);

    // Modal: Create Policy
    const [isCreatePolicyOpen, setIsCreatePolicyOpen] = useState(false);
    const [policyForm] = Form.useForm();
    const [policyFileUrl, setPolicyFileUrl] = useState<string | null>(null);
    const [policyFileName, setPolicyFileName] = useState<string | null>(null);
    const [uploadingPolicyFile, setUploadingPolicyFile] = useState(false);
    const [creatingPolicy, setCreatingPolicy] = useState(false);

    // Modal: Create Patient Campaign
    const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
    const [campaignForm] = Form.useForm();
    const [creatingCampaign, setCreatingCampaign] = useState(false);

    // Modal: QR Code Poster
    const [qrModalData, setQrModalData] = useState<{ title: string; url: string; subtitle?: string; location?: string } | null>(null);

    useEffect(() => {
        fetchFeedbacks();
        fetchPolicies();
        fetchCampaigns();
    }, [mainTab, selectedStatus, selectedType]);

    const fetchFeedbacks = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (mainTab === 'FEATURE') {
                params.set('targetScope', 'FEATURE');
            } else if (mainTab === 'POLICY') {
                params.set('targetScope', 'POLICY');
            } else if (mainTab === 'PATIENT') {
                params.set('targetScope', 'PATIENT');
            }

            if (selectedStatus !== 'ALL') params.set('status', selectedStatus);
            if (selectedType !== 'ALL') params.set('feedbackType', selectedType);
            if (searchKeyword.trim()) params.set('search', searchKeyword.trim());
            params.set('withStats', 'true');

            const res = await fetch(`${bPath}/api/feature-feedback?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setFeedbacks(data.data || []);
                if (data.stats) setStats(data.stats);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPolicies = async () => {
        try {
            const res = await fetch(`${bPath}/api/hospital-policies`);
            if (res.ok) {
                const data = await res.json();
                setPolicies(data.data || []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const fetchCampaigns = async () => {
        try {
            const res = await fetch(`${bPath}/api/patient-campaigns`);
            if (res.ok) {
                const data = await res.json();
                setCampaigns(data.data || []);
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Toggle Policy Active Switch
    const handleTogglePolicyActive = async (policy: HospitalPolicyItem, checked: boolean) => {
        try {
            const res = await fetch(`${bPath}/api/hospital-policies`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: policy.id, isActive: checked })
            });
            if (res.ok) {
                message.success(`Đã ${checked ? 'bật hiệu lực' : 'tạm dừng'} lấy ý kiến: ${policy.title}`);
                fetchPolicies();
            } else {
                message.error('Lỗi khi cập nhật trạng thái');
            }
        } catch (e) {
            message.error('Lỗi kết nối');
        }
    };

    // Toggle Campaign Active Switch
    const handleToggleCampaignActive = async (camp: PatientCampaignItem, checked: boolean) => {
        try {
            const res = await fetch(`${bPath}/api/patient-campaigns`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: camp.id, isActive: checked })
            });
            if (res.ok) {
                message.success(`Đã ${checked ? 'bật hoạt động' : 'tạm dừng'} điểm góp ý: ${camp.name}`);
                fetchCampaigns();
            } else {
                message.error('Lỗi khi cập nhật trạng thái');
            }
        } catch (e) {
            message.error('Lỗi kết nối');
        }
    };

    // Create Policy Handler
    const handleCreatePolicy = async (values: any) => {
        setCreatingPolicy(true);
        try {
            const res = await fetch(`${bPath}/api/hospital-policies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: values.code,
                    title: values.title,
                    category: values.category || 'POLICY',
                    summary: values.summary,
                    fileUrl: policyFileUrl,
                    fileName: policyFileName,
                    startDate: values.dateRange ? values.dateRange[0].toISOString() : new Date().toISOString(),
                    endDate: values.dateRange && values.dateRange[1] ? values.dateRange[1].toISOString() : null,
                    isActive: values.isActive !== undefined ? values.isActive : true
                })
            });

            if (res.ok) {
                message.success('Đã tạo đợt lấy ý kiến chính sách thành công!');
                setIsCreatePolicyOpen(false);
                policyForm.resetFields();
                setPolicyFileUrl(null);
                setPolicyFileName(null);
                fetchPolicies();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi tạo chính sách');
            }
        } catch (e) {
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setCreatingPolicy(false);
        }
    };

    // Create Campaign Handler
    const handleCreateCampaign = async (values: any) => {
        setCreatingCampaign(true);
        try {
            const res = await fetch(`${bPath}/api/patient-campaigns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: values.name,
                    department: values.department,
                    location: values.location,
                    description: values.description,
                    startDate: values.dateRange ? values.dateRange[0].toISOString() : new Date().toISOString(),
                    endDate: values.dateRange && values.dateRange[1] ? values.dateRange[1].toISOString() : null,
                    isActive: values.isActive !== undefined ? values.isActive : true
                })
            });

            if (res.ok) {
                message.success('Đã tạo điểm góp ý bệnh nhân thành công!');
                setIsCreateCampaignOpen(false);
                campaignForm.resetFields();
                fetchCampaigns();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi tạo điểm góp ý');
            }
        } catch (e) {
            message.error('Lỗi kết nối máy chủ');
        } finally {
            setCreatingCampaign(false);
        }
    };

    // Delete Policy
    const handleDeletePolicy = async (id: string) => {
        try {
            const res = await fetch(`${bPath}/api/hospital-policies?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa văn bản chính sách');
                fetchPolicies();
            }
        } catch (e) {
            message.error('Lỗi kết nối');
        }
    };

    // Delete Campaign
    const handleDeleteCampaign = async (id: string) => {
        try {
            const res = await fetch(`${bPath}/api/patient-campaigns?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa điểm góp ý');
                fetchCampaigns();
            }
        } catch (e) {
            message.error('Lỗi kết nối');
        }
    };

    // Update Feedback Status & Reply
    const handleUpdateStatus = async (id: string, newStatus: string, note?: string) => {
        setSubmittingReply(true);
        try {
            const res = await fetch(`${bPath}/api/feature-feedback`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus, adminNote: note })
            });

            if (res.ok) {
                message.success('Đã cập nhật trạng thái và lưu phản hồi thành công!');
                setSelectedItem(null);
                setReplyNote('');
                fetchFeedbacks();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi cập nhật');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi cập nhật');
        } finally {
            setSubmittingReply(false);
        }
    };

    // Delete Feedback
    const handleDeleteFeedback = async (id: string) => {
        try {
            const res = await fetch(`${bPath}/api/feature-feedback?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                message.success('Đã xóa ý kiến đóng góp');
                fetchFeedbacks();
            }
        } catch (e) {
            message.error('Lỗi kết nối');
        }
    };

    // Export Excel
    const handleExportExcel = () => {
        if (!feedbacks || feedbacks.length === 0) {
            message.warning('Không có dữ liệu để xuất Excel');
            return;
        }

        const dataToExport = feedbacks.map((item, index) => ({
            'STT': index + 1,
            'Ngày gửi': new Date(item.createdAt).toLocaleString('vi-VN'),
            'Phân loại': item.targetScope === 'FEATURE' ? 'Phần mềm' : item.targetScope === 'PATIENT' ? 'Bệnh nhân' : 'Chính sách BV',
            'Người gửi': item.userName || 'N/A',
            'Số điện thoại': item.patientPhone || '',
            'Khoa / Phòng': item.department || 'N/A',
            'Khu vực / Buồng bệnh': item.treatmentArea || '',
            'Đối tượng góp ý': item.featureName || item.policyTitle || item.pagePath || 'N/A',
            'Loại ý kiến': item.feedbackType,
            'Đánh giá sao': item.rating ? `${item.rating}/5 sao` : '5/5 sao',
            'Nội dung góp ý': item.content,
            'File đính kèm': item.attachmentUrl || '',
            'Trạng thái': item.status === 'PENDING' ? 'Chờ tiếp nhận' : item.status === 'PROCESSING' ? 'Đang xử lý' : item.status === 'RESOLVED' ? 'Đã giải quyết' : 'Không áp dụng',
            'Cán bộ phản hồi': item.respondedBy || '',
            'Ngày phản hồi': item.respondedAt ? new Date(item.respondedAt).toLocaleString('vi-VN') : '',
            'Nội dung giải trình / Phản hồi': item.adminNote || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Gop_Y');
        XLSX.writeFile(workbook, `Bao_Cao_Gop_Y_BVDKLS_${mainTab}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        message.success('Đã xuất file Excel thành công!');
    };

    // Columns for Feedback Table
    const feedbackColumns = [
        {
            title: 'Thời gian & Người gửi',
            key: 'author',
            width: 200,
            render: (_: any, r: FeatureFeedbackItem) => (
                <div>
                    <div className="font-bold text-slate-800 text-xs">
                        {r.isAnonymous ? '👤 Người bệnh ẩn danh' : r.userName || 'Cán bộ'}
                    </div>
                    {r.patientPhone && (
                        <div className="text-[11px] text-emerald-700 font-medium">
                            📞 {r.patientPhone}
                        </div>
                    )}
                    <div className="text-[11px] text-blue-600 font-medium">{r.department || 'Khoa/Phòng'}</div>
                    {r.treatmentArea && (
                        <div className="text-[10px] text-slate-500">📍 {r.treatmentArea}</div>
                    )}
                    <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(r.createdAt).toLocaleString('vi-VN')}
                    </div>
                </div>
            )
        },
        {
            title: 'Đối tượng & Phân loại',
            key: 'target',
            width: 200,
            render: (_: any, r: FeatureFeedbackItem) => (
                <div className="space-y-1">
                    {r.policyTitle ? (
                        <div className="font-semibold text-slate-800 text-xs text-amber-800">
                            📜 {r.policyTitle}
                        </div>
                    ) : r.featureName ? (
                        <div>
                            <div className="font-semibold text-slate-800 text-xs">
                                💻 {r.featureName}
                            </div>
                            {r.pagePath && (
                                <div className="text-[10px] text-slate-400 font-mono">{r.pagePath}</div>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs font-semibold text-slate-700">🏥 Dịch vụ khám chữa bệnh</div>
                    )}

                    <div>
                        {r.feedbackType === 'BUG' && <Tag color="error" className="text-[10px]">🐞 Báo lỗi</Tag>}
                        {r.feedbackType === 'SUGGESTION' && <Tag color="processing" className="text-[10px]">💡 Đề xuất</Tag>}
                        {r.feedbackType === 'UI' && <Tag color="geekblue" className="text-[10px]">🎨 Giao diện</Tag>}
                        {r.feedbackType === 'POLICY_CHANGE' && <Tag color="volcano" className="text-[10px]">📝 Sửa quy định</Tag>}
                        {r.feedbackType === 'PRAISE' && <Tag color="success" className="text-[10px]">🌟 Khen ngợi</Tag>}
                        {r.feedbackType === 'ATTITUDE' && <Tag color="warning" className="text-[10px]">⚠️ Giao tiếp ứng xử</Tag>}
                        {r.feedbackType === 'WAITING_TIME' && <Tag color="magenta" className="text-[10px]">⏱️ Thời gian chờ</Tag>}
                        {r.feedbackType === 'FACILITY' && <Tag color="cyan" className="text-[10px]">🏥 Buồng bệnh/Vệ sinh</Tag>}
                        {r.feedbackType === 'BILLING' && <Tag color="purple" className="text-[10px]">💰 Viện phí / BHYT</Tag>}
                    </div>
                </div>
            )
        },
        {
            title: 'Đánh giá & Nội dung',
            key: 'content',
            render: (_: any, r: FeatureFeedbackItem) => (
                <div>
                    <div className="flex items-center gap-1.5 mb-1">
                        <Rate disabled value={r.rating || 5} className="text-xs" />
                        <span className="text-[11px] text-amber-600 font-bold">{r.rating || 5}/5 sao</span>
                    </div>

                    <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed max-h-24 overflow-y-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        {r.content}
                    </div>

                    {/* Attachment file */}
                    {r.attachmentUrl && (
                        <div className="mt-2 text-xs">
                            <a 
                                href={r.attachmentUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 hover:underline"
                            >
                                <PaperClipOutlined /> {r.attachmentName || 'Xem tệp đính kèm'}
                            </a>
                        </div>
                    )}

                    {/* Admin note */}
                    {r.adminNote && (
                        <div className="mt-2 p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
                            <span className="font-bold text-emerald-900 flex items-center gap-1">
                                <CheckCircleOutlined className="text-emerald-600" />
                                Phản hồi ({r.respondedBy || 'CNTT / BGD'} - {r.respondedAt ? new Date(r.respondedAt).toLocaleDateString('vi-VN') : ''}):
                            </span>
                            <span className="text-slate-700 mt-0.5 block">{r.adminNote}</span>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 140,
            render: (_: any, r: FeatureFeedbackItem) => {
                if (r.status === 'PENDING') return <Tag color="warning" icon={<ClockCircleOutlined />}>Chờ tiếp nhận</Tag>;
                if (r.status === 'PROCESSING') return <Tag color="processing" icon={<SyncOutlined spin />}>Đang xử lý</Tag>;
                if (r.status === 'RESOLVED') return <Tag color="success" icon={<CheckCircleOutlined />}>Đã giải quyết</Tag>;
                return <Tag color="default" icon={<CloseOutlined />}>Không áp dụng</Tag>;
            }
        },
        {
            title: 'Thao tác',
            key: 'actions',
            width: 140,
            fixed: 'right' as const,
            render: (_: any, r: FeatureFeedbackItem) => (
                <Space size="small" orientation="vertical" className="w-full">
                    {r.status === 'PENDING' && (
                        <Button 
                            size="small" 
                            type="default"
                            className="w-full text-xs border-blue-400 text-blue-600"
                            onClick={() => handleUpdateStatus(r.id, 'PROCESSING')}
                        >
                            Tiếp nhận
                        </Button>
                    )}
                    <Button 
                        size="small" 
                        type="primary"
                        className="w-full text-xs bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => {
                            setSelectedItem(r);
                            setReplyStatus(r.status === 'PENDING' ? 'RESOLVED' : r.status);
                            setReplyNote(r.adminNote || '');
                        }}
                    >
                        Phản hồi
                    </Button>
                    <Popconfirm
                        title="Bạn có chắc chắn muốn xóa ý kiến này?"
                        onConfirm={() => handleDeleteFeedback(r.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                    >
                        <Button size="small" danger icon={<DeleteOutlined />} className="w-full text-xs">
                            Xóa
                        </Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // Columns for Policy Table
    const policyColumns = [
        {
            title: 'Số hiệu & Tên văn bản chính sách',
            key: 'title',
            render: (_: any, p: HospitalPolicyItem) => (
                <div>
                    <div className="font-bold text-slate-800 text-xs">{p.title}</div>
                    {p.code && <div className="text-[11px] text-amber-800 font-semibold mt-0.5">Số: {p.code}</div>}
                    <div className="text-[10px] text-slate-400 mt-1">
                        Tạo ngày: {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                </div>
            )
        },
        {
            title: 'Lĩnh vực',
            key: 'category',
            width: 150,
            render: (_: any, p: HospitalPolicyItem) => (
                <Tag color="orange" className="text-xs">
                    {p.category === 'INTERNAL_EXPENSE' ? 'Chi tiêu nội bộ' 
                        : p.category === 'REGULATION' ? 'Quy trình chuyên môn' : 'Chính sách BV'}
                </Tag>
            )
        },
        {
            title: 'Tệp văn bản',
            key: 'file',
            width: 130,
            render: (_: any, p: HospitalPolicyItem) => p.fileUrl ? (
                <Button 
                    size="small" 
                    icon={<FilePdfOutlined />} 
                    href={p.fileUrl} 
                    target="_blank"
                    className="text-xs text-blue-600 border-blue-300"
                >
                    Tải văn bản
                </Button>
            ) : <span className="text-slate-400 text-xs">Chưa có tệp</span>
        },
        {
            title: 'Thời hạn lấy ý kiến',
            key: 'time',
            width: 160,
            render: (_: any, p: HospitalPolicyItem) => (
                <div className="text-xs text-slate-600">
                    <div>Bắt đầu: {new Date(p.startDate).toLocaleDateString('vi-VN')}</div>
                    <div>Hạn chót: {p.endDate ? new Date(p.endDate).toLocaleDateString('vi-VN') : 'Không giới hạn'}</div>
                </div>
            )
        },
        {
            title: 'Hiệu lực lấy ý kiến',
            key: 'isActive',
            width: 160,
            render: (_: any, p: HospitalPolicyItem) => {
                const isExpired = p.endDate && new Date(p.endDate) < new Date();
                return (
                    <div className="space-y-1">
                        <Switch 
                            checked={p.isActive}
                            onChange={(checked) => handleTogglePolicyActive(p, checked)}
                            checkedChildren="Đang mở"
                            unCheckedChildren="Tạm dừng"
                        />
                        <div>
                            {isExpired ? (
                                <Tag color="default" className="text-[10px]">Đã hết hạn</Tag>
                            ) : p.isActive ? (
                                <Tag color="success" className="text-[10px]">🟢 Đang hiệu lực</Tag>
                            ) : (
                                <Tag color="error" className="text-[10px]">🔴 Tạm dừng</Tag>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Mã QR & Thao tác',
            key: 'actions',
            width: 140,
            render: (_: any, p: HospitalPolicyItem) => {
                const qrUrl = typeof window !== 'undefined' 
                    ? `${window.location.origin}${bPath}/gop-y-chinh-sach?key=${p.qrCodeKey}`
                    : '';
                return (
                    <Space size="small" orientation="vertical" className="w-full">
                        <Button 
                            size="small"
                            icon={<QrcodeOutlined />}
                            className="w-full text-xs text-indigo-600 border-indigo-300"
                            onClick={() => setQrModalData({
                                title: p.title,
                                subtitle: `Số hiệu: ${p.code || 'Văn bản dự thảo'}`,
                                url: qrUrl
                            })}
                        >
                            Mã QR Code
                        </Button>
                        <Popconfirm 
                            title="Xóa văn bản chính sách này?" 
                            onConfirm={() => handleDeletePolicy(p.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                        >
                            <Button size="small" danger icon={<DeleteOutlined />} className="w-full text-xs">
                                Xóa
                            </Button>
                        </Popconfirm>
                    </Space>
                );
            }
        }
    ];

    // Columns for Patient Campaigns Table
    const campaignColumns = [
        {
            title: 'Tên Điểm / Đợt Góp Ý Bệnh Nhân',
            key: 'name',
            render: (_: any, c: PatientCampaignItem) => (
                <div>
                    <div className="font-bold text-slate-800 text-xs">{c.name}</div>
                    {c.department && <div className="text-[11px] text-blue-700 font-medium">Khoa: {c.department}</div>}
                    {c.location && <div className="text-[10px] text-slate-500">Vị trí: {c.location}</div>}
                </div>
            )
        },
        {
            title: 'Thời gian khảo sát',
            key: 'time',
            width: 160,
            render: (_: any, c: PatientCampaignItem) => (
                <div className="text-xs text-slate-600">
                    <div>Bắt đầu: {new Date(c.startDate).toLocaleDateString('vi-VN')}</div>
                    <div>Hạn chót: {c.endDate ? new Date(c.endDate).toLocaleDateString('vi-VN') : 'Không giới hạn'}</div>
                </div>
            )
        },
        {
            title: 'Trạng thái hoạt động',
            key: 'isActive',
            width: 160,
            render: (_: any, c: PatientCampaignItem) => {
                const isExpired = c.endDate && new Date(c.endDate) < new Date();
                return (
                    <div className="space-y-1">
                        <Switch 
                            checked={c.isActive}
                            onChange={(checked) => handleToggleCampaignActive(c, checked)}
                            checkedChildren="Đang mở"
                            unCheckedChildren="Tạm dừng"
                        />
                        <div>
                            {isExpired ? (
                                <Tag color="default" className="text-[10px]">Đã hết hạn</Tag>
                            ) : c.isActive ? (
                                <Tag color="success" className="text-[10px]">🟢 Đang tiếp nhận</Tag>
                            ) : (
                                <Tag color="error" className="text-[10px]">🔴 Tạm dừng</Tag>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Poster QR & Thao tác',
            key: 'actions',
            width: 150,
            render: (_: any, c: PatientCampaignItem) => {
                const qrUrl = typeof window !== 'undefined' 
                    ? `${window.location.origin}${bPath}/gop-y-benh-nhan?key=${c.qrCodeKey}`
                    : '';
                return (
                    <Space size="small" orientation="vertical" className="w-full">
                        <Button 
                            size="small"
                            type="primary"
                            icon={<PrinterOutlined />}
                            className="w-full text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => setQrModalData({
                                title: 'HÒM THƯ GÓP Ý ĐIỆN TỬ',
                                subtitle: c.name,
                                location: c.location || c.department || 'Bệnh viện Đa khoa Lạng Sơn',
                                url: qrUrl
                            })}
                        >
                            In Poster QR Code
                        </Button>
                        <Popconfirm 
                            title="Xóa điểm khảo sát này?" 
                            onConfirm={() => handleDeleteCampaign(c.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                        >
                            <Button size="small" danger icon={<DeleteOutlined />} className="w-full text-xs">
                                Xóa
                            </Button>
                        </Popconfirm>
                    </Space>
                );
            }
        }
    ];

    // Tabs type="card" (MANDATORY RULE)
    const mainTabItems = [
        {
            key: 'FEATURE',
            label: (
                <span className="flex items-center gap-1.5 font-bold text-blue-700">
                    💻 1. Góp ý Chức năng Phần mềm
                    {stats && <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{stats.totalFeature}</span>}
                </span>
            ),
            children: (
                <div className="space-y-4">
                    {/* Filter bar */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
                            <Input 
                                placeholder="Tìm kiếm cán bộ, khoa phòng, lỗi..." 
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                onPressEnter={fetchFeedbacks}
                                prefix={<SearchOutlined className="text-slate-400" />}
                                className="rounded-xl w-full md:w-64 text-xs"
                                allowClear
                            />

                            <Select 
                                value={selectedStatus}
                                onChange={(val) => setSelectedStatus(val)}
                                className="w-full md:w-40 text-xs"
                            >
                                <Select.Option value="ALL">Tất cả trạng thái</Select.Option>
                                <Select.Option value="PENDING">🟡 Chờ tiếp nhận</Select.Option>
                                <Select.Option value="PROCESSING">🔵 Đang xử lý</Select.Option>
                                <Select.Option value="RESOLVED">🟢 Đã giải quyết</Select.Option>
                                <Select.Option value="REJECTED">⚪ Không áp dụng</Select.Option>
                            </Select>

                            <Select 
                                value={selectedType}
                                onChange={(val) => setSelectedType(val)}
                                className="w-full md:w-44 text-xs"
                            >
                                <Select.Option value="ALL">Tất cả loại ý kiến</Select.Option>
                                <Select.Option value="BUG">🐞 Báo lỗi phần mềm</Select.Option>
                                <Select.Option value="SUGGESTION">💡 Đề xuất tính năng</Select.Option>
                                <Select.Option value="UI">🎨 Góp ý giao diện</Select.Option>
                            </Select>

                            <Button 
                                type="primary" 
                                icon={<SearchOutlined />} 
                                onClick={fetchFeedbacks}
                                className="bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-semibold"
                            >
                                Tìm
                            </Button>
                        </div>

                        <Button 
                            icon={<DownloadOutlined />} 
                            onClick={handleExportExcel}
                            className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl text-xs font-semibold border-none"
                        >
                            Xuất Excel
                        </Button>
                    </div>

                    <Table 
                        columns={feedbackColumns}
                        dataSource={feedbacks}
                        rowKey="id"
                        loading={loading}
                        pagination={{ pageSize: 10, showTotal: (t) => `Tổng cộng ${t} ý kiến phần mềm` }}
                        scroll={{ x: 1000 }}
                    />
                </div>
            )
        },
        {
            key: 'POLICY',
            label: (
                <span className="flex items-center gap-1.5 font-bold text-amber-700">
                    📜 2. Góp ý Chính sách, Quy chế BV
                    {stats && <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{stats.totalPolicy}</span>}
                </span>
            ),
            children: (
                <div className="space-y-6">
                    {/* Policy Management Card */}
                    <div className="bg-gradient-to-r from-amber-50/60 to-orange-50/40 p-5 rounded-2xl border border-amber-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-amber-900 mb-0.5">
                                    Danh Mục Văn Bản & Dự Thảo Chính Sách Đang Lấy Ý Kiến
                                </h3>
                                <p className="text-xs text-amber-700 mb-0">
                                    Ban Giám đốc và Phòng chức năng đăng tải văn bản, bật/tắt trạng thái và sinh mã QR lấy ý kiến
                                </p>
                            </div>
                            <Button 
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setIsCreatePolicyOpen(true)}
                                className="bg-amber-600 hover:bg-amber-700 font-bold rounded-xl text-xs border-none"
                            >
                                Tạo Đợt Lấy Ý Kiến Mới
                            </Button>
                        </div>

                        <Table 
                            columns={policyColumns}
                            dataSource={policies}
                            rowKey="id"
                            pagination={{ pageSize: 5 }}
                            className="bg-white rounded-xl shadow-xs"
                            scroll={{ x: 900 }}
                        />
                    </div>

                    {/* Policy Feedbacks Received */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-800 mb-0">
                                Ý Kiến Đóng Góp Từ Các Khoa / Phòng ({feedbacks.length} ý kiến)
                            </h3>
                            <Button 
                                icon={<DownloadOutlined />} 
                                onClick={handleExportExcel}
                                size="small"
                                className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs border-none"
                            >
                                Xuất Excel
                            </Button>
                        </div>
                        <Table 
                            columns={feedbackColumns}
                            dataSource={feedbacks}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: 1000 }}
                        />
                    </div>
                </div>
            )
        },
        {
            key: 'PATIENT',
            label: (
                <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                    🏥 3. Hòm thư Góp ý Bệnh nhân
                    {stats && <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{stats.totalPatient}</span>}
                </span>
            ),
            children: (
                <div className="space-y-6">
                    {/* Patient Campaigns Management Card */}
                    <div className="bg-gradient-to-r from-emerald-50/60 to-teal-50/40 p-5 rounded-2xl border border-emerald-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-emerald-900 mb-0.5">
                                    Quản Lý Điểm Dán Mã QR & Đợt Khảo Sát Ý Kiến Bệnh Nhân
                                </h3>
                                <p className="text-xs text-emerald-700 mb-0">
                                    Tạo điểm dán mã QR tại buồng bệnh, bàn khám, in poster A4 chuẩn và kiểm soát hiệu lực
                                </p>
                            </div>
                            <Button 
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setIsCreateCampaignOpen(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl text-xs border-none"
                            >
                                Tạo Điểm / Đợt Khảo Sát Mới
                            </Button>
                        </div>

                        <Table 
                            columns={campaignColumns}
                            dataSource={campaigns}
                            rowKey="id"
                            pagination={{ pageSize: 5 }}
                            className="bg-white rounded-xl shadow-xs"
                            scroll={{ x: 800 }}
                        />
                    </div>

                    {/* Patient Feedbacks Table */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-slate-800 mb-0">
                                Danh Sách Ý Kiến Người Bệnh & Thân Nhân Gửi Về ({feedbacks.length} ý kiến)
                            </h3>
                            <Button 
                                icon={<DownloadOutlined />} 
                                onClick={handleExportExcel}
                                size="small"
                                className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs border-none"
                            >
                                Xuất Excel Khảo Sát
                            </Button>
                        </div>
                        <Table 
                            columns={feedbackColumns}
                            dataSource={feedbacks}
                            rowKey="id"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                            scroll={{ x: 1000 }}
                        />
                    </div>
                </div>
            )
        }
    ];

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-md">
                        <MessageOutlined />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tight mb-1">
                            Hòm Thư Đóng Góp Ý Kiến & Phản Hồi Bệnh Viện
                        </h1>
                        <p className="text-xs text-slate-500 mb-0">
                            Quy hoạch 3 kênh: <strong>(1) Chức năng phần mềm</strong> • <strong>(2) Dự thảo Chính sách BV</strong> • <strong>(3) Ý kiến Bệnh nhân</strong>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <Button 
                        icon={<ReloadOutlined />}
                        onClick={() => { fetchFeedbacks(); fetchPolicies(); fetchCampaigns(); }}
                        loading={loading}
                        className="rounded-xl text-xs"
                    >
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* KPI Stat Cards */}
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6} lg={4.8 as any}>
                    <Card className="rounded-2xl border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-slate-400 font-medium">Tổng ý kiến</div>
                                <div className="text-2xl font-black text-slate-800 mt-1">{stats?.total ?? feedbacks.length}</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
                                <MessageOutlined />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} md={6} lg={4.8 as any}>
                    <Card className="rounded-2xl border-amber-200 bg-amber-50/30 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-amber-700 font-semibold">Chờ tiếp nhận</div>
                                <div className="text-2xl font-black text-amber-600 mt-1">{stats?.pending ?? 0}</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl">
                                <ClockCircleOutlined />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} md={6} lg={4.8 as any}>
                    <Card className="rounded-2xl border-blue-200 bg-blue-50/30 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-blue-700 font-semibold">Đang xử lý</div>
                                <div className="text-2xl font-black text-blue-600 mt-1">{stats?.processing ?? 0}</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-xl">
                                <SyncOutlined spin />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} md={6} lg={4.8 as any}>
                    <Card className="rounded-2xl border-emerald-200 bg-emerald-50/30 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-emerald-700 font-semibold">Đã giải quyết</div>
                                <div className="text-2xl font-black text-emerald-600 mt-1">{stats?.resolved ?? 0}</div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl">
                                <CheckCircleOutlined />
                            </div>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} sm={12} md={6} lg={4.8 as any}>
                    <Card className="rounded-2xl border-amber-200 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs text-slate-500 font-medium">Hài lòng trung bình</div>
                                <div className="text-2xl font-black text-amber-500 mt-1 flex items-center gap-1">
                                    {stats?.avgRating ?? '5.0'} ⭐
                                </div>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl">
                                <StarFilled />
                            </div>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Main Tabs (TYPE="CARD" MANDATORY) */}
            <Card className="rounded-3xl border-slate-200 shadow-sm">
                <Tabs 
                    type="card" 
                    activeKey={mainTab} 
                    onChange={(k) => setMainTab(k)}
                    items={mainTabItems}
                    className="custom-card-tabs"
                />
            </Card>

            {/* Modal: Phản hồi & Kết luận */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 text-base font-bold">
                        <MessageOutlined className="text-indigo-600" />
                        Phản Hồi & Kết Luận Ý Kiến
                    </div>
                }
                open={!!selectedItem}
                onCancel={() => setSelectedItem(null)}
                footer={null}
                centered
                width={620}
                destroyOnHidden
            >
                {selectedItem && (
                    <div className="py-2 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border text-xs text-slate-700 space-y-1.5">
                            <div>
                                <strong>Người gửi:</strong> {selectedItem.isAnonymous ? '👤 Người bệnh ẩn danh' : selectedItem.userName}
                                {selectedItem.patientPhone && <span className="text-emerald-700 ml-2">📞 {selectedItem.patientPhone}</span>}
                            </div>
                            <div><strong>Khoa / Phòng:</strong> {selectedItem.department} {selectedItem.treatmentArea ? `(${selectedItem.treatmentArea})` : ''}</div>
                            <div><strong>Nội dung:</strong> {selectedItem.content}</div>
                            {selectedItem.attachmentUrl && (
                                <div>
                                    <a href={selectedItem.attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                        📎 Xem tệp văn bản đính kèm
                                    </a>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3 pt-2 border-t">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Trạng thái xử lý:</label>
                                <Radio.Group 
                                    value={replyStatus} 
                                    onChange={(e) => setReplyStatus(e.target.value)}
                                    buttonStyle="solid"
                                    className="w-full grid grid-cols-3 text-center"
                                >
                                    <Radio.Button value="PROCESSING">🔵 Đang xử lý</Radio.Button>
                                    <Radio.Button value="RESOLVED">🟢 Đã tiếp thu/Xong</Radio.Button>
                                    <Radio.Button value="REJECTED">⚪ Không áp dụng</Radio.Button>
                                </Radio.Group>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Nội dung giải trình / Thông báo kết quả xử lý:
                                </label>
                                <TextArea 
                                    rows={4}
                                    value={replyNote}
                                    onChange={(e) => setReplyNote(e.target.value)}
                                    placeholder="Nhập nội dung giải trình, phương án khắc phục hoặc thông báo đã sửa đổi quy trình..."
                                    className="text-xs"
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-2 border-t">
                                <Button onClick={() => setSelectedItem(null)} className="rounded-xl px-4">Đóng</Button>
                                <Button 
                                    type="primary"
                                    loading={submittingReply}
                                    onClick={() => handleUpdateStatus(selectedItem.id, replyStatus, replyNote)}
                                    className="bg-indigo-600 hover:bg-indigo-700 font-bold px-6 rounded-xl border-none"
                                >
                                    Lưu Phản Hồi
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal: Tạo đợt lấy ý kiến Chính sách mới */}
            <Modal
                title="Tạo Đợt Lấy Ý Kiến Chính Sách, Nghị Định BV"
                open={isCreatePolicyOpen}
                onCancel={() => setIsCreatePolicyOpen(false)}
                footer={null}
                centered
                width={560}
                destroyOnHidden
            >
                <Form form={policyForm} layout="vertical" onFinish={handleCreatePolicy} className="py-2">
                    <Form.Item name="title" label="Tên văn bản / chính sách dự thảo" rules={[{ required: true, message: 'Nhập tên văn bản' }]}>
                        <Input placeholder="Ví dụ: Dự thảo Quy chế chi tiêu nội bộ năm 2026..." />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-3">
                        <Form.Item name="code" label="Số hiệu văn bản (nếu có)">
                            <Input placeholder="Ví dụ: 125/DTH-BVĐKLS" />
                        </Form.Item>

                        <Form.Item name="category" label="Lĩnh vực" initialValue="POLICY">
                            <Select>
                                <Select.Option value="POLICY">Chính sách chung BV</Select.Option>
                                <Select.Option value="INTERNAL_EXPENSE">Chi tiêu nội bộ</Select.Option>
                                <Select.Option value="REGULATION">Quy trình chuyên môn</Select.Option>
                                <Select.Option value="OTHER">Lĩnh vực khác</Select.Option>
                            </Select>
                        </Form.Item>
                    </div>

                    <Form.Item name="summary" label="Tóm tắt nội dung văn bản">
                        <TextArea rows={3} placeholder="Nêu các điểm mới, điều khoản trọng tâm cần khoa phòng đóng góp ý kiến..." />
                    </Form.Item>

                    {/* Tải tệp văn bản đính kèm */}
                    <div className="mb-4 bg-slate-50 p-3 rounded-xl border">
                        <div className="text-xs font-semibold text-slate-700 mb-1.5">
                            Tệp văn bản dự thảo (PDF / Word):
                        </div>
                        <Upload 
                            beforeUpload={async (file) => {
                                setUploadingPolicyFile(true);
                                const fd = new FormData();
                                fd.append('file', file);
                                try {
                                    const res = await fetch(`${bPath}/api/upload`, { method: 'POST', body: fd });
                                    if (res.ok) {
                                        const d = await res.json();
                                        setPolicyFileUrl(d.url);
                                        setPolicyFileName(file.name);
                                        message.success('Đã tải lên tệp văn bản thành công!');
                                    }
                                } catch (e) { message.error('Lỗi tải tệp'); }
                                finally { setUploadingPolicyFile(false); }
                                return false;
                            }}
                            maxCount={1}
                            showUploadList={false}
                        >
                            <Button icon={<UploadOutlined />} loading={uploadingPolicyFile} size="small" className="rounded-xl">
                                {policyFileName ? `✓ ${policyFileName}` : 'Tải lên file PDF / Word'}
                            </Button>
                        </Upload>
                    </div>

                    <Form.Item name="dateRange" label="Thời gian lấy ý kiến">
                        <DatePicker.RangePicker className="w-full text-xs" format="DD/MM/YYYY" />
                    </Form.Item>

                    <Form.Item name="isActive" label="Trạng thái hiệu lực ban đầu" valuePropName="checked" initialValue={true}>
                        <Switch checkedChildren="Đang có hiệu lực" unCheckedChildren="Tạm dừng" />
                    </Form.Item>

                    <div className="flex justify-end gap-2.5 pt-3 border-t">
                        <Button onClick={() => setIsCreatePolicyOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={creatingPolicy} className="bg-amber-600 hover:bg-amber-700 font-bold border-none">
                            Tạo Đợt Lấy Ý Kiến
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Modal: Tạo điểm góp ý Bệnh nhân mới */}
            <Modal
                title="Tạo Điểm / Đợt Góp Ý Bệnh Nhân & Thân Nhân"
                open={isCreateCampaignOpen}
                onCancel={() => setIsCreateCampaignOpen(false)}
                footer={null}
                centered
                width={520}
                destroyOnHidden
            >
                <Form form={campaignForm} layout="vertical" onFinish={handleCreateCampaign} className="py-2">
                    <Form.Item name="name" label="Tên điểm / Đợt góp ý" rules={[{ required: true, message: 'Nhập tên điểm' }]}>
                        <Input placeholder="Ví dụ: Hòm thư góp ý Khoa Khám bệnh, Buồng bệnh số 5..." />
                    </Form.Item>

                    <div className="grid grid-cols-2 gap-3">
                        <Form.Item name="department" label="Khoa / Phòng phụ trách">
                            <Input placeholder="Ví dụ: Khoa Cấp cứu" />
                        </Form.Item>
                        <Form.Item name="location" label="Vị trí dán mã QR">
                            <Input placeholder="Ví dụ: Cửa phòng khám số 3" />
                        </Form.Item>
                    </div>

                    <Form.Item name="description" label="Ghi chú / Mục tiêu khảo sát">
                        <TextArea rows={2} placeholder="Ghi chú nội bộ..." />
                    </Form.Item>

                    <Form.Item name="dateRange" label="Thời gian khảo sát (để trống nếu liên tục)">
                        <DatePicker.RangePicker className="w-full text-xs" format="DD/MM/YYYY" />
                    </Form.Item>

                    <Form.Item name="isActive" label="Trạng thái tiếp nhận ban đầu" valuePropName="checked" initialValue={true}>
                        <Switch checkedChildren="Đang tiếp nhận" unCheckedChildren="Tạm dừng" />
                    </Form.Item>

                    <div className="flex justify-end gap-2.5 pt-3 border-t">
                        <Button onClick={() => setIsCreateCampaignOpen(false)}>Hủy</Button>
                        <Button type="primary" htmlType="submit" loading={creatingCampaign} className="bg-emerald-600 hover:bg-emerald-700 font-bold border-none">
                            Tạo Điểm Khảo Sát & Sinh Mã QR
                        </Button>
                    </div>
                </Form>
            </Modal>

            {/* Modal: In Poster QR Code */}
            <Modal
                title={null}
                open={!!qrModalData}
                onCancel={() => setQrModalData(null)}
                footer={null}
                centered
                width={480}
                destroyOnHidden
            >
                {qrModalData && (
                    <div className="p-4 text-center">
                        <div className="border-4 border-indigo-900 rounded-3xl p-6 bg-white shadow-xl relative overflow-hidden">
                            {/* Hospital Header */}
                            <div className="text-[11px] font-bold tracking-widest text-indigo-900 uppercase">
                                Bệnh Viện Đa Khoa Lạng Sơn
                            </div>
                            <div className="text-lg font-black text-slate-900 mt-1 mb-1">
                                {qrModalData.title}
                            </div>
                            {qrModalData.subtitle && (
                                <div className="text-xs text-blue-700 font-bold mb-1">
                                    {qrModalData.subtitle}
                                </div>
                            )}
                            {qrModalData.location && (
                                <div className="text-[11px] text-slate-500 mb-4">
                                    📍 {qrModalData.location}
                                </div>
                            )}

                            {/* QR Code */}
                            <div className="my-4 p-4 bg-slate-50 rounded-2xl inline-block border-2 border-dashed border-slate-300">
                                <QRCode 
                                    value={qrModalData.url} 
                                    size={220} 
                                    bordered={false} 
                                    errorLevel="H"
                                />
                            </div>

                            {/* Instructions */}
                            <div className="text-xs font-bold text-slate-800 mt-2">
                                📱 DÙNG CAMERA HOẶC ZALO QUÉT MÃ ĐỂ GÓP Ý
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                                Ý kiến của bạn giúp Bệnh viện không ngừng nâng cao chất lượng khám chữa bệnh
                            </div>

                            <Divider className="my-3" />
                            <div className="text-[10px] text-slate-400">
                                Đường dây nóng BVĐK Lạng Sơn: <strong>0205.3870.115</strong>
                            </div>
                        </div>

                        <div className="flex justify-center gap-3 mt-4">
                            <Button onClick={() => setQrModalData(null)} className="rounded-xl">
                                Đóng
                            </Button>
                            <Button 
                                type="primary"
                                icon={<PrinterOutlined />}
                                onClick={() => {
                                    window.print();
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl"
                            >
                                In Poster Dán (Ctrl + P)
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

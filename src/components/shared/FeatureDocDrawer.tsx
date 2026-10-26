'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { 
    Drawer, Button, Tabs, Tag, Timeline, Card, Typography, 
    Space, Form, Input, Select, Radio, message, Spin, Empty, Alert, Tooltip, Divider, Popconfirm, Modal, Rate, Badge 
} from 'antd';
import { 
    BookOutlined, HistoryOutlined, FormOutlined, EditOutlined, 
    SaveOutlined, PlusOutlined, CheckCircleOutlined, ClockCircleOutlined, 
    FileTextOutlined, WarningOutlined, CloseOutlined, ReloadOutlined, SafetyCertificateOutlined,
    MessageOutlined, StarFilled, SendOutlined, CheckOutlined, SyncOutlined,
    ApartmentOutlined, ExportOutlined, ShareAltOutlined, CopyOutlined
} from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { getBasePath } from '@/utils/config';
import FeatureFeedbackModal from '../common/FeatureFeedbackModal';
import MermaidViewer from '../common/MermaidViewer';
import { IT_REQUEST_GUIDE_HTML, getItRequestZaloText } from '@/config/itRequestGuideContent';

const DRAWER_DIAGRAMS: Record<string, { title: string; chart: string; desc: string }> = {
    overview: {
        title: 'Sơ đồ Tổng thể Kiến trúc HTQLBV',
        desc: 'Luồng tương tác giữa Cổng Đăng nhập/RBAC, 8 phân hệ cốt lõi và Cơ sở dữ liệu tập trung PostgreSQL.',
        chart: `flowchart TD
    classDef auth fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef staff fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef xml fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef it fill:#f3e8ff,stroke:#9333ea,stroke-width:2px;
    classDef feedback fill:#ffe4e6,stroke:#e11d48,stroke-width:2px;
    classDef core fill:#ffffff,stroke:#0f172a,stroke-width:2px;

    User["👥 Cán bộ Bệnh viện / Bác sĩ"] --> Gateway["🔐 CỔNG ĐĂNG NHẬP & PHÂN QUYỀN RBAC"]:::core
    Gateway --> S1["1. Xác thực & Quyền hạn"]:::auth
    Gateway --> S2["2. Nhân sự & Khoa phòng"]:::staff
    Gateway --> S3["3. Kiểm tra XML 1-5 (QĐ 130)"]:::xml
    Gateway --> S4["4. Hỗ trợ Kỹ thuật CNTT"]:::it
    Gateway --> S5["5. Hòm thư Góp ý 3 Kênh"]:::feedback

    S1 --> DB[("🗄️ CSDL POSTGRESQL (PRISMA)")]:::core
    S2 --> DB
    S3 --> DB
    S4 --> DB
    S5 --> DB`
    },
    hrm: {
        title: 'Phân hệ Quản trị Nhân sự HRM (1.500 NV)',
        desc: 'Hồ sơ 360°, Phạm vi hành nghề CCHN chống xuất toán BHYT, Đào tạo CME, Chấm công 24/24, Nghỉ phép online, Lương & QĐ 73.',
        chart: `sequenceDiagram
    autonumber
    actor NV as Cán bộ / Bác sĩ
    participant HRM as Module Nhân sự (HRM)
    participant BHYT as Cổng Giám định BHYT / HIS
    participant DB as CSDL Hồ sơ & CCHN

    NV->>HRM: Cập nhật CCHN & Chứng chỉ đào tạo CME
    HRM->>DB: Lưu hồ sơ, ngày hiệu lực, phạm vi hành nghề
    BHYT->>HRM: Tra cứu danh mục bác sĩ chỉ định dịch vụ kỹ thuật
    HRM-->>BHYT: Xác nhận BS đủ điều kiện hành nghề (Không bị xuất toán)`
    },
    it: {
        title: 'Quy trình Yêu cầu Hỗ trợ CNTT & Tiếp nhận 1 việc',
        desc: 'Khoa phòng gửi phiếu hỗ trợ, phân bổ KTV phụ trách, chat trao đổi trực tiếp kèm cảnh báo chuông/popup thời gian thực.',
        chart: `sequenceDiagram
    autonumber
    actor KP as Điều dưỡng / Khoa phòng
    participant Hub as Hệ thống Tiếp nhận 1 Việc
    actor KTV as Kỹ thuật viên CNTT
    participant DB as CSDL Yêu cầu & Chat

    KP->>Hub: Gửi yêu cầu hỗ trợ (Phần mềm/Mạng/Máy in)
    Hub->>KTV: Bắn thông báo âm thanh + Popup tức thì
    KTV->>Hub: Tiếp nhận xử lý & Chat mẫu nhanh (Quick Replies)
    Hub-->>KP: Cập nhật tiến độ & hoàn thành nghiệm thu`
    },
    feedback: {
        title: 'Quy trình Hòm thư Góp ý & Quản lý Thay đổi',
        desc: 'Góp ý 3 kênh (Khoa phòng, BN quét QR Mobile, Dự thảo Chính sách) chuyển tới Ban Giám đốc và Phòng CNTT xử lý.',
        chart: `sequenceDiagram
    autonumber
    actor User as Cán bộ / Bệnh nhân QR
    participant API as API Góp ý (/api/feature-feedback)
    actor Admin as Lãnh đạo / Phòng CNTT
    participant DB as Bảng FeatureFeedback & SOP

    User->>API: Gửi ý kiến góp ý / Báo lỗi / Đề xuất
    API->>DB: Lưu trạng thái PENDING
    Admin->>API: Tiếp nhận xử lý & Phản hồi kết luận
    API-->>User: Hiển thị kết quả trả lời công khai, minh bạch`
    }
};

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;
const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

interface FeatureChangeLogItem {
    id: string;
    pagePath: string;
    version: string;
    title: string;
    changeType: string;
    status: 'TESTING' | 'OFFICIAL' | string;
    content: string;
    reason?: string | null;
    author?: string | null;
    documentUrl?: string | null;
    appliedAt: string;
    createdAt: string;
}

interface FeatureFeedbackItem {
    id: string;
    targetScope: string;
    pagePath?: string | null;
    featureName?: string | null;
    policyTitle?: string | null;
    userId?: string | null;
    userName?: string | null;
    department?: string | null;
    feedbackType: string;
    rating?: number | null;
    content: string;
    imageUrl?: string | null;
    status: 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REJECTED' | string;
    adminNote?: string | null;
    respondedBy?: string | null;
    respondedAt?: string | null;
    createdAt: string;
}

interface FeatureDocDrawerProps {
    open?: boolean;
    onClose?: () => void;
    currentTitle?: string;
    pagePathOverride?: string;
}

export default function FeatureDocDrawer({ open: openProp, onClose: onCloseProp, currentTitle, pagePathOverride }: FeatureDocDrawerProps) {
    const pathname = usePathname();
    const { user } = useAuth();
    const [internalOpen, setInternalOpen] = useState(false);
    
    // Controlled vs uncontrolled
    const isOpen = openProp !== undefined ? openProp : internalOpen;
    const handleClose = onCloseProp || (() => setInternalOpen(false));

    // Calculate current clean path
    const rawPath = pagePathOverride || pathname || '';
    const cleanPath = rawPath.replace('/htqlbenhvien', '') || '/';

    // State for User Guide (Tab 1)
    const [instruction, setInstruction] = useState<{ title?: string; content?: string } | null>(null);
    const [loadingGuide, setLoadingGuide] = useState(false);
    const [isEditingGuide, setIsEditingGuide] = useState(false);
    const [guideContent, setGuideContent] = useState('');
    const [savingGuide, setSavingGuide] = useState(false);

    // State for Change Logs (Tab 2)
    const [changeLogs, setChangeLogs] = useState<FeatureChangeLogItem[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);

    // State for Feedbacks (Tab 3)
    const [feedbacks, setFeedbacks] = useState<FeatureFeedbackItem[]>([]);
    const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
    const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

    // State for Admin Response Modal
    const [selectedFeedbackForReply, setSelectedFeedbackForReply] = useState<FeatureFeedbackItem | null>(null);
    const [replyStatus, setReplyStatus] = useState<string>('RESOLVED');
    const [replyNote, setReplyNote] = useState<string>('');
    const [submittingReply, setSubmittingReply] = useState(false);

    // State for New Change Log (Tab 4)
    const [formNewChange] = Form.useForm();
    const [creatingChange, setCreatingChange] = useState(false);

    // State for Sequence Diagram Tab
    const [selectedDiagram, setSelectedDiagram] = useState<string>('overview');

    // State for Zalo Share Modal
    const [isZaloModalOpen, setIsZaloModalOpen] = useState(false);
    const [customZaloMessage, setCustomZaloMessage] = useState('');

    const isAdmin = user?.role === 'ADMIN';

    const generateZaloMessage = () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const fullUrl = `${origin}${getBasePath()}${cleanPath}`;
        
        if (cleanPath.includes('it-requests')) {
            return getItRequestZaloText(fullUrl);
        }

        return [
            `🏥 BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN`,
            `📢 THÔNG BÁO TÍNH NĂNG MỚI: ${(currentTitle || cleanPath).toUpperCase()}`,
            `--------------------------------------------------`,
            `Kính gửi các Khoa/Phòng và Cán bộ nhân viên bệnh viện,`,
            ``,
            `Hệ thống Quản lý Bệnh viện đã cập nhật tính năng: "${currentTitle || cleanPath}".`,
            `🔗 Đường dẫn truy cập: ${fullUrl}`,
            `🔐 Đăng nhập: Số CCCD | Mật khẩu mặc định: 123456`,
            ``,
            `Trân trọng cảm ơn!`
        ].join('\n');
    };

    const handleOpenZaloModal = () => {
        setCustomZaloMessage(generateZaloMessage());
        setIsZaloModalOpen(true);
    };

    const handleCopyZalo = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(customZaloMessage)
                .then(() => message.success('Đã sao chép nội dung thông báo Zalo vào bộ nhớ tạm!'))
                .catch(() => message.error('Không thể sao chép tin nhắn'));
        }
    };

    // Load data when opened or path changed
    useEffect(() => {
        if (isOpen && cleanPath) {
            fetchGuide();
            fetchChangeLogs();
            fetchFeedbacks();
        }
    }, [isOpen, cleanPath]);

    const fetchGuide = async () => {
        setLoadingGuide(true);
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/page-instructions?pageId=${encodeURIComponent(cleanPath)}`);
            const isItRequest = cleanPath.includes('it-requests');
            if (res.ok) {
                const data = await res.json();
                let guideData = data.data;
                if (guideData) {
                    let content = guideData.content || '';
                    if (isItRequest && (!content || !content.includes('Thông Tin Đăng Nhập Mặc Định Cho Nhân Viên'))) {
                        content = IT_REQUEST_GUIDE_HTML;
                        guideData = { ...guideData, title: 'Hướng dẫn Tạo Yêu Cầu Hỗ Trợ Kỹ Thuật CNTT', content };
                    }
                    setInstruction(guideData);
                    setGuideContent(content);
                } else if (isItRequest) {
                    const fallbackObj = {
                        title: 'Hướng dẫn Tạo Yêu Cầu Hỗ Trợ Kỹ Thuật CNTT',
                        content: IT_REQUEST_GUIDE_HTML
                    };
                    setInstruction(fallbackObj);
                    setGuideContent(IT_REQUEST_GUIDE_HTML);
                } else {
                    setInstruction(null);
                    setGuideContent('');
                }
            } else if (isItRequest) {
                const fallbackObj = {
                    title: 'Hướng dẫn Tạo Yêu Cầu Hỗ Trợ Kỹ Thuật CNTT',
                    content: IT_REQUEST_GUIDE_HTML
                };
                setInstruction(fallbackObj);
                setGuideContent(IT_REQUEST_GUIDE_HTML);
            }
        } catch (e) {
            console.error('Error fetching guide:', e);
            if (cleanPath.includes('it-requests')) {
                const fallbackObj = {
                    title: 'Hướng dẫn Tạo Yêu Cầu Hỗ Trợ Kỹ Thuật CNTT',
                    content: IT_REQUEST_GUIDE_HTML
                };
                setInstruction(fallbackObj);
                setGuideContent(IT_REQUEST_GUIDE_HTML);
            }
        } finally {
            setLoadingGuide(false);
        }
    };

    const fetchChangeLogs = async () => {
        setLoadingLogs(true);
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/feature-changelogs?pagePath=${encodeURIComponent(cleanPath)}`);
            if (res.ok) {
                const data = await res.json();
                setChangeLogs(data.data || []);
            }
        } catch (e) {
            console.error('Error fetching change logs:', e);
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchFeedbacks = async () => {
        setLoadingFeedbacks(true);
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/feature-feedback?pagePath=${encodeURIComponent(cleanPath)}`);
            if (res.ok) {
                const data = await res.json();
                setFeedbacks(data.data || []);
            }
        } catch (e) {
            console.error('Error fetching feedbacks:', e);
        } finally {
            setLoadingFeedbacks(false);
        }
    };

    const handleUpdateFeedbackStatus = async (id: string, newStatus: string, note?: string) => {
        setSubmittingReply(true);
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/feature-feedback`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    status: newStatus,
                    adminNote: note
                })
            });

            if (res.ok) {
                message.success('Đã cập nhật trạng thái ý kiến góp ý thành công!');
                setSelectedFeedbackForReply(null);
                setReplyNote('');
                fetchFeedbacks();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi cập nhật ý kiến');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi cập nhật ý kiến');
        } finally {
            setSubmittingReply(false);
        }
    };

    const handleSaveGuide = async () => {
        setSavingGuide(true);
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/page-instructions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: cleanPath,
                    content: guideContent,
                    title: `Hướng dẫn: ${currentTitle || cleanPath}`,
                    showOnPage: true
                })
            });

            if (res.ok) {
                message.success('Đã lưu tài liệu hướng dẫn thành công!');
                setIsEditingGuide(false);
                fetchGuide();
            } else {
                message.error('Lỗi khi lưu tài liệu hướng dẫn');
            }
        } catch (e) {
            message.error('Có lỗi xảy ra khi lưu');
        } finally {
            setSavingGuide(false);
        }
    };

    const handleGenerateTemplate = () => {
        const featureName = currentTitle || cleanPath;
        const template = `<h2>TÀI LIỆU & HƯỚNG DẪN SỬ DỤNG: ${featureName.toUpperCase()}</h2>
<p><em>(Quy trình vận hành chuẩn SOP - Bệnh viện Đa khoa Lạng Sơn)</em></p>

<h3>I. Mục đích & Phạm vi áp dụng</h3>
<p>Chức năng <strong>${featureName}</strong> được xây dựng nhằm hỗ trợ cán bộ y tế, nhân viên các khoa phòng thực hiện công tác quản lý và chuyên môn hiệu quả, chuẩn xác.</p>

<h3>II. Đối tượng sử dụng</h3>
<ul>
  <li>Cán bộ, Bác sĩ, Điều dưỡng tại các Khoa/Phòng lâm sàng và cận lâm sàng.</li>
  <li>Kỹ thuật viên phòng Công nghệ Thông tin và các bộ phận hỗ trợ liên quan.</li>
</ul>

<h3>III. Quy trình thao tác từng bước</h3>
<ol>
  <li><strong>Bước 1:</strong> Đăng nhập hệ thống bằng tài khoản được cấp và truy cập vào mục <strong>${featureName}</strong>.</li>
  <li><strong>Bước 2:</strong> Kiểm tra các thông tin/bộ lọc cần xử lý trên màn hình làm việc.</li>
  <li><strong>Bước 3:</strong> Nhập dữ liệu theo đúng các trường thông tin quy định, đính kèm hình ảnh/tài liệu (nếu có).</li>
  <li><strong>Bước 4:</strong> Bấm nút <strong>Lưu / Xác nhận</strong> để hoàn tất quy trình.</li>
</ol>

<h3>IV. Các lưu ý quan trọng & Xử lý sự cố</h3>
<ul>
  <li>Không tự ý chia sẻ tài khoản làm việc của cá nhân.</li>
  <li>Nếu gặp thông báo lỗi kết nối hoặc phiên đăng nhập hết hạn, vui lòng đăng nhập lại để tiếp tục làm việc mà không bị mất dữ liệu.</li>
</ul>

<h3>V. Đầu mối liên hệ hỗ trợ</h3>
<p>Mọi vướng mắc về mặt kỹ thuật, xin vui lòng liên hệ <strong>Phòng Công nghệ Thông tin</strong> qua số máy nội bộ: <strong>Ext 115</strong>.</p>`;

        setGuideContent(template);
        message.info('Đã tạo khung tài liệu mẫu bệnh viện, bạn có thể chỉnh sửa thêm và bấm Lưu!');
    };

    const handleCreateChangeLog = async (values: any) => {
        setCreatingChange(true);
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/feature-changelogs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pagePath: cleanPath,
                    ...values
                })
            });

            if (res.ok) {
                message.success('Đã ghi nhận tài liệu thay đổi thành công!');
                formNewChange.resetFields();
                fetchChangeLogs();
            } else {
                const err = await res.json();
                message.error(err.error || 'Lỗi khi tạo bản ghi thay đổi');
            }
        } catch (e) {
            message.error('Lỗi kết nối khi lưu tài liệu thay đổi');
        } finally {
            setCreatingChange(false);
        }
    };

    const handleToggleStatus = async (logId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'TESTING' ? 'OFFICIAL' : 'TESTING';
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/feature-changelogs`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: logId,
                    status: newStatus
                })
            });

            if (res.ok) {
                message.success(`Đã chuyển trạng thái sang: ${newStatus === 'OFFICIAL' ? 'Chính thức nghiệm thu' : 'Thử nghiệm'}`);
                fetchChangeLogs();
            } else {
                message.error('Không thể cập nhật trạng thái');
            }
        } catch (e) {
            message.error('Lỗi kết nối');
        }
    };

    // Tabs content with type="card"
    const tabItems = [
        {
            key: 'guide',
            label: (
                <span className="flex items-center gap-1.5 font-medium">
                    <BookOutlined className="text-blue-500" />
                    Hướng dẫn sử dụng
                </span>
            ),
            children: (
                <div className="py-2">
                    {/* Header Action */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 flex-wrap gap-2">
                        <div>
                            <div className="text-sm font-bold text-slate-800">
                                {instruction?.title || `Tài liệu hướng dẫn: ${currentTitle || cleanPath}`}
                            </div>
                            <div className="text-xs text-slate-500">Đường dẫn: <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-600">{cleanPath}</code></div>
                        </div>
                        <Space wrap>
                            <Button 
                                icon={<ShareAltOutlined />}
                                onClick={handleOpenZaloModal}
                                className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-semibold shadow-2xs"
                            >
                                📢 Chia sẻ Zalo
                            </Button>
                            {isAdmin && !isEditingGuide && (
                                <Button 
                                    type="primary" 
                                    icon={<EditOutlined />} 
                                    onClick={() => setIsEditingGuide(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs"
                                >
                                    Sửa tài liệu
                                </Button>
                            )}
                            {isAdmin && isEditingGuide && (
                                <Space>
                                    <Button 
                                        onClick={() => handleGenerateTemplate()} 
                                        className="text-xs border-blue-300 text-blue-600"
                                    >
                                        Tạo mẫu chuẩn SOP
                                    </Button>
                                    <Button 
                                        onClick={() => setIsEditingGuide(false)} 
                                        className="text-xs"
                                    >
                                        Hủy
                                    </Button>
                                    <Button 
                                        type="primary" 
                                        icon={<SaveOutlined />} 
                                        loading={savingGuide} 
                                        onClick={handleSaveGuide}
                                        className="bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs"
                                    >
                                        Lưu tài liệu
                                    </Button>
                                </Space>
                            )}
                        </Space>
                    </div>

                    {loadingGuide ? (
                        <div className="flex flex-col justify-center items-center py-20 gap-2.5">
                            <Spin size="large" />
                            <span className="text-xs text-slate-500 font-medium">Đang tải tài liệu...</span>
                        </div>
                    ) : isEditingGuide ? (
                        <div>
                            <JoditEditor
                                value={guideContent}
                                onBlur={(newContent) => setGuideContent(newContent)}
                                config={{
                                    readonly: false,
                                    height: 500,
                                    language: 'vi',
                                    placeholder: 'Soạn thảo hướng dẫn sử dụng và quy trình nghiệp vụ...',
                                    uploader: { url: `${getBasePath()}/api/upload-image`, format: 'json' }
                                }}
                            />
                        </div>
                    ) : (
                        <div>
                            {instruction?.content ? (
                                <div 
                                    className="prose max-w-none text-slate-700 text-sm leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: instruction.content }} 
                                />
                            ) : (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
                                    <BookOutlined className="text-4xl text-slate-300 mb-2" />
                                    <div className="text-sm font-semibold text-slate-700">Chưa có tài liệu hướng dẫn cho chức năng này</div>
                                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                        Chức năng đang trong giai đoạn khởi tạo. Quản trị viên có thể bấm nút bên dưới để tạo ngay tài liệu mẫu chuẩn bệnh viện.
                                    </p>
                                    {isAdmin && (
                                        <Button 
                                            type="primary" 
                                            icon={<FormOutlined />} 
                                            onClick={() => { setIsEditingGuide(true); handleGenerateTemplate(); }}
                                            className="mt-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs"
                                        >
                                            Tạo tài liệu hướng dẫn ngay
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'feedback',
            label: (
                <span className="flex items-center gap-1.5 font-medium">
                    <MessageOutlined className="text-emerald-500" />
                    Ý kiến & Góp ý Khoa phòng
                    {feedbacks.length > 0 && (
                        <span className="ml-1 bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                            {feedbacks.length}
                        </span>
                    )}
                </span>
            ),
            children: (
                <div className="py-2">
                    {/* Header Action */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <div>
                            <div className="text-sm font-bold text-slate-800">Ý kiến đóng góp từ các Khoa / Phòng</div>
                            <div className="text-xs text-slate-500">Tiếp nhận báo lỗi, đề xuất cải tiến hoặc phản hồi quy định bệnh viện</div>
                        </div>
                        <Space>
                            <Button 
                                type="primary"
                                icon={<MessageOutlined />}
                                onClick={() => setIsFeedbackModalOpen(true)}
                                className="bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold"
                            >
                                Gửi ý kiến mới
                            </Button>
                            <Button 
                                icon={<ReloadOutlined />} 
                                onClick={fetchFeedbacks} 
                                loading={loadingFeedbacks}
                                size="small"
                            />
                        </Space>
                    </div>

                    {loadingFeedbacks ? (
                        <div className="flex flex-col justify-center items-center py-16 gap-2.5">
                            <Spin size="large" />
                            <span className="text-xs text-slate-500 font-medium">Đang tải danh sách ý kiến...</span>
                        </div>
                    ) : feedbacks.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
                            <MessageOutlined className="text-4xl text-slate-300 mb-2" />
                            <div className="text-sm font-semibold text-slate-700">Chưa có ý kiến đóng góp nào cho chức năng này</div>
                            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                Cán bộ y tế và các khoa phòng khi sử dụng có thể gửi ý kiến, báo lỗi hoặc đề xuất cải tiến tại đây.
                            </p>
                            <Button 
                                type="primary"
                                icon={<MessageOutlined />}
                                onClick={() => setIsFeedbackModalOpen(true)}
                                className="mt-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs"
                            >
                                Gửi ý kiến đóng góp đầu tiên
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {feedbacks.map((fb) => {
                                const isPending = fb.status === 'PENDING';
                                const isProcessing = fb.status === 'PROCESSING';
                                const isResolved = fb.status === 'RESOLVED';
                                
                                return (
                                    <div 
                                        key={fb.id} 
                                        className="p-4 rounded-xl border bg-white border-slate-200 shadow-sm transition-all"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-slate-800 text-sm">
                                                        {fb.userName || 'Cán bộ'} ({fb.department || 'Khoa/Phòng'})
                                                    </span>
                                                    {fb.feedbackType === 'BUG' && <Tag color="error">🐞 Báo lỗi phần mềm</Tag>}
                                                    {fb.feedbackType === 'SUGGESTION' && <Tag color="blue">💡 Đề xuất tính năng</Tag>}
                                                    {fb.feedbackType === 'UI' && <Tag color="purple">🎨 Góp ý giao diện</Tag>}
                                                    {fb.feedbackType === 'POLICY_CHANGE' && <Tag color="orange">📜 Đề xuất sửa quy định</Tag>}
                                                    {fb.feedbackType === 'OBSTACLE' && <Tag color="magenta">⚠️ Vướng mắc thực tế</Tag>}
                                                    {fb.feedbackType === 'INNOVATION' && <Tag color="cyan">✨ Sáng kiến cải tiến</Tag>}
                                                    
                                                    {isPending && <Tag color="warning" icon={<ClockCircleOutlined />}>Chờ tiếp nhận</Tag>}
                                                    {isProcessing && <Tag color="processing" icon={<SyncOutlined spin />}>Đang xử lý / Điều chỉnh</Tag>}
                                                    {isResolved && <Tag color="success" icon={<CheckCircleOutlined />}>Đã tiếp thu / Giải quyết</Tag>}
                                                    {fb.status === 'REJECTED' && <Tag color="default" icon={<CloseOutlined />}>Không áp dụng</Tag>}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                                    <span>Thời gian: {new Date(fb.createdAt).toLocaleString('vi-VN')}</span>
                                                    <span>•</span>
                                                    <Rate disabled value={fb.rating || 5} className="text-xs" />
                                                </div>
                                            </div>

                                            {/* Admin Quick Action */}
                                            {isAdmin && (
                                                <Space size="small">
                                                    {isPending && (
                                                        <Button 
                                                            size="small" 
                                                            type="default"
                                                            className="text-xs border-blue-400 text-blue-600"
                                                            onClick={() => handleUpdateFeedbackStatus(fb.id, 'PROCESSING')}
                                                        >
                                                            Tiếp nhận
                                                        </Button>
                                                    )}
                                                    <Button 
                                                        size="small" 
                                                        type="primary"
                                                        className="text-xs bg-indigo-600 hover:bg-indigo-700"
                                                        onClick={() => {
                                                            setSelectedFeedbackForReply(fb);
                                                            setReplyStatus('RESOLVED');
                                                            setReplyNote(fb.adminNote || '');
                                                        }}
                                                    >
                                                        Phản hồi
                                                    </Button>
                                                </Space>
                                            )}
                                        </div>

                                        {fb.policyTitle && (
                                            <div className="mt-2 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                                                📜 Quy định / Chính sách góp ý: {fb.policyTitle}
                                            </div>
                                        )}

                                        <div className="mt-2.5 text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            {fb.content}
                                        </div>

                                        {fb.adminNote && (
                                            <div className="mt-3 p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs">
                                                <div className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
                                                    <CheckCircleOutlined className="text-emerald-600" />
                                                    Phản hồi từ {fb.respondedBy || 'Phòng CNTT / Ban Giám đốc'}
                                                    {fb.respondedAt && (
                                                        <span className="text-[11px] font-normal text-emerald-700">
                                                            ({new Date(fb.respondedAt).toLocaleDateString('vi-VN')})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-slate-700 leading-relaxed whitespace-pre-line">
                                                    {fb.adminNote}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'diagram',
            label: (
                <span className="flex items-center gap-1.5 font-medium">
                    <ApartmentOutlined className="text-cyan-600" />
                    Sơ đồ Quy trình
                </span>
            ),
            children: (
                <div className="py-2 space-y-4">
                    <div className="flex items-center justify-between bg-gradient-to-r from-cyan-50 to-blue-50 p-3.5 rounded-xl border border-cyan-200">
                        <div>
                            <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <ApartmentOutlined className="text-cyan-600" />
                                Sequence & Flowchart Hệ thống
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                Xem trực tiếp luồng nghiệp vụ tương tác giữa các phân hệ
                            </div>
                        </div>
                        <Button 
                            type="primary"
                            icon={<ExportOutlined />}
                            href={`${getBasePath()}/he-thong/so-do-kien-truc`}
                            target="_blank"
                            className="bg-cyan-600 hover:bg-cyan-700 text-xs font-semibold rounded-lg shadow-sm"
                        >
                            Mở Trang Toàn Màn Hình
                        </Button>
                    </div>

                    <div>
                        <div className="text-xs font-semibold text-slate-600 mb-1.5">Chọn sơ đồ quy trình nghiệp vụ:</div>
                        <Select 
                            value={selectedDiagram} 
                            onChange={setSelectedDiagram}
                            className="w-full"
                            options={[
                                { value: 'overview', label: '🌐 1. Sơ đồ Tổng thể Kiến trúc HTQLBV' },
                                { value: 'hrm', label: '👥 2. Phân hệ Quản trị Nhân sự HRM (1.500 NV & CCHN)' },
                                { value: 'it', label: '🛠️ 3. Quy trình Yêu cầu CNTT & Tiếp nhận 1 việc' },
                                { value: 'feedback', label: '📬 4. Quy trình Hòm thư Góp ý & Quản lý Thay đổi' },
                            ]}
                        />
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                        <strong>Mô tả:</strong> {DRAWER_DIAGRAMS[selectedDiagram]?.desc}
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm overflow-x-auto min-h-[300px]">
                        <MermaidViewer 
                            chart={DRAWER_DIAGRAMS[selectedDiagram]?.chart || ''} 
                            id={`drawer-diag-${selectedDiagram}`}
                        />
                    </div>
                </div>
            )
        },
        ...(isAdmin ? [{
            key: 'new-change',
            label: (
                <span className="flex items-center gap-1.5 font-medium text-emerald-600">
                    <PlusOutlined />
                    Ghi nhận thay đổi mới
                </span>
            ),
            children: (
                <div className="py-2">
                    <Alert
                        type="info"
                        showIcon
                        title="Quy trình quản lý thay đổi (Change Management)"
                        description="Khi chức năng đang chạy chính thức mà có thay đổi nghiệp vụ, sửa lỗi hoặc nâng cấp giao diện, vui lòng lập bản ghi tại đây để khoa phòng nắm được thông tin."
                        className="mb-4 text-xs"
                    />

                    <Form 
                        form={formNewChange} 
                        layout="vertical" 
                        onFinish={handleCreateChangeLog}
                        initialValues={{
                            version: 'v2.1',
                            changeType: 'UPDATE',
                            status: 'TESTING',
                            author: user?.name || user?.username || 'Phòng CNTT'
                        }}
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <Form.Item name="version" label="Phiên bản thay đổi" rules={[{ required: true, message: 'Nhập phiên bản (vd: v2.1)' }]}>
                                <Input placeholder="vd: v2.1, v3.0" />
                            </Form.Item>
                            <Form.Item name="changeType" label="Phân loại thay đổi">
                                <Select>
                                    <Select.Option value="UPDATE">Cập nhật quy trình</Select.Option>
                                    <Select.Option value="FEATURE">Tính năng mới bổ sung</Select.Option>
                                    <Select.Option value="BUGFIX">Sửa lỗi nghiệp vụ</Select.Option>
                                    <Select.Option value="POLICY">Điều chỉnh theo Thông tư/Quy định</Select.Option>
                                </Select>
                            </Form.Item>
                        </div>

                        <Form.Item name="title" label="Tiêu đề tóm tắt thay đổi" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
                            <Input placeholder="Ví dụ: Bổ sung bộ lọc trạng thái và tối ưu hiển thị trên điện thoại" />
                        </Form.Item>

                        <Form.Item name="status" label="Trạng thái triển khai đợt thay đổi này">
                            <Radio.Group buttonStyle="solid">
                                <Radio.Button value="TESTING">🟡 Đang Thử Nghiệm (Beta)</Radio.Button>
                                <Radio.Button value="OFFICIAL">🟢 Đã Nghiệm Thu Chính Thức</Radio.Button>
                            </Radio.Group>
                        </Form.Item>

                        <Form.Item name="reason" label="Lý do thay đổi / Khoa phòng đề xuất">
                            <Input placeholder="Ví dụ: Theo đề xuất của Khoa Cấp cứu nhằm rút ngắn thời gian xử lý..." />
                        </Form.Item>

                        <Form.Item name="content" label="Nội dung chi tiết thay đổi (Cũ vs Mới)" rules={[{ required: true, message: 'Nhập nội dung thay đổi' }]}>
                            <TextArea 
                                rows={5} 
                                placeholder="- Trước khi thay đổi: Chưa có tính năng...&#10;- Sau khi thay đổi: Bổ sung chức năng..., giao diện co giãn theo điện thoại..." 
                            />
                        </Form.Item>

                        <div className="grid grid-cols-2 gap-3">
                            <Form.Item name="author" label="Cán bộ phụ trách">
                                <Input placeholder="Tên cán bộ CNTT" />
                            </Form.Item>
                            <Form.Item name="documentUrl" label="Đường dẫn tài liệu đính kèm (nếu có)">
                                <Input placeholder="Link file PDF / Quyết định ban hành" />
                            </Form.Item>
                        </div>

                        <div className="flex justify-end pt-2 border-t">
                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                loading={creatingChange}
                                className="bg-emerald-600 hover:bg-emerald-700 font-bold px-6 rounded-lg"
                            >
                                Lưu và Công bố Thay đổi
                            </Button>
                        </div>
                    </Form>
                </div>
            )
        }] : []),
        {
            key: 'changelog',
            label: (
                <span className="flex items-center gap-1.5 font-medium">
                    <HistoryOutlined className="text-amber-500" />
                    Tài liệu & Lịch sử thay đổi
                    {changeLogs.length > 0 && (
                        <span className="ml-1 bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                            {changeLogs.length}
                        </span>
                    )}
                </span>
            ),
            children: (
                <div className="py-2">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <div>
                            <div className="text-sm font-bold text-slate-800">Nhật ký thay đổi chức năng (Change Log)</div>
                            <div className="text-xs text-slate-500">Ghi nhận các đợt cập nhật, điều chỉnh quy trình và nghiệm thu</div>
                        </div>
                        <Button 
                            icon={<ReloadOutlined />} 
                            onClick={fetchChangeLogs} 
                            loading={loadingLogs}
                            size="small"
                        />
                    </div>

                    {loadingLogs ? (
                        <div className="flex flex-col justify-center items-center py-16 gap-2.5">
                            <Spin size="large" />
                            <span className="text-xs text-slate-500 font-medium">Đang tải lịch sử thay đổi...</span>
                        </div>
                    ) : changeLogs.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 p-6">
                            <HistoryOutlined className="text-4xl text-slate-300 mb-2" />
                            <div className="text-sm font-semibold text-slate-700">Chưa có bản ghi thay đổi nào</div>
                            <p className="text-xs text-slate-500 mt-1">Khi chức năng có sửa đổi hoặc cập nhật mới, quản trị viên có thể ghi nhận tại tab "Tạo thay đổi mới".</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {changeLogs.map((log) => {
                                const isTesting = log.status === 'TESTING';
                                return (
                                    <div 
                                        key={log.id} 
                                        className={`p-4 rounded-xl border transition-all ${isTesting ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200 shadow-sm'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-slate-800 text-sm">{log.version} - {log.title}</span>
                                                    {isTesting ? (
                                                        <Tag color="warning" className="text-[11px] font-semibold border-amber-300">
                                                            ⚠️ Đang Thử Nghiệm (Beta)
                                                        </Tag>
                                                    ) : (
                                                        <Tag color="success" className="text-[11px] font-semibold border-emerald-300">
                                                            ✓ Chính thức Nghiệm thu
                                                        </Tag>
                                                    )}
                                                    <Tag color="blue" className="text-[10px]">{log.changeType}</Tag>
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1">
                                                    Ngày áp dụng: {new Date(log.appliedAt).toLocaleDateString('vi-VN')} | Người phụ trách: <span className="text-slate-600 font-medium">{log.author || 'Phòng CNTT'}</span>
                                                </div>
                                            </div>

                                            {isAdmin && (
                                                <Popconfirm 
                                                    title={`Bạn có chắc muốn chuyển trạng thái sang "${isTesting ? 'Chính thức nghiệm thu' : 'Thử nghiệm'}"?`}
                                                    onConfirm={() => handleToggleStatus(log.id, log.status)}
                                                    okText="Xác nhận"
                                                    cancelText="Hủy"
                                                >
                                                    <Button size="small" type={isTesting ? "primary" : "default"} className={isTesting ? "bg-emerald-600 text-xs" : "text-xs"}>
                                                        {isTesting ? 'Nghiệm thu chính thức' : 'Chuyển về Thử nghiệm'}
                                                    </Button>
                                                </Popconfirm>
                                            )}
                                        </div>

                                        {log.reason && (
                                            <div className="mt-2.5 p-2 bg-slate-100/70 rounded-lg text-xs text-slate-700">
                                                <strong>Lý do thay đổi:</strong> {log.reason}
                                            </div>
                                        )}

                                        <div className="mt-2 text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white/70 p-3 rounded-lg border border-slate-100">
                                            {log.content}
                                        </div>

                                        {log.documentUrl && (
                                            <div className="mt-2 text-xs">
                                                <a href={log.documentUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                                    <FileTextOutlined /> Xem tài liệu văn bản đính kèm
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )
        }
    ];

    return (
        <>
            {/* Floating Quick Action Button if uncontrolled */}
            {openProp === undefined && (
                <div 
                    className="hidden md:block"
                    style={{
                        position: 'fixed',
                        bottom: 20,
                        right: 20,
                        zIndex: 999
                    }}
                >
                    <Tooltip title="Tài liệu & Lịch sử thay đổi chức năng" placement="left">
                        <Button 
                            type="primary" 
                            shape="circle" 
                            icon={<BookOutlined style={{ fontSize: 16 }} />} 
                            onClick={() => setInternalOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 shadow-md border-none flex items-center justify-center w-9 h-9"
                        />
                    </Tooltip>
                </div>
            )}

            <Drawer
                title={
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                            <BookOutlined />
                        </div>
                        <div>
                            <div className="text-slate-800 font-bold text-base">
                                Tài liệu & Quản lý Thay đổi
                            </div>
                            <div className="text-xs text-slate-500 font-normal">
                                {currentTitle || cleanPath}
                            </div>
                        </div>
                    </div>
                }
                placement="right"
                size={760}
                onClose={handleClose}
                open={isOpen}
                destroyOnHidden
            >
                <Tabs type="card" items={tabItems} className="custom-card-tabs" />
            </Drawer>

            {/* Modal Admin Phản hồi ý kiến */}
            <Modal
                title="Phản hồi & Xử lý Ý kiến Đóng góp"
                open={!!selectedFeedbackForReply}
                onCancel={() => setSelectedFeedbackForReply(null)}
                footer={null}
                centered
                destroyOnHidden
            >
                {selectedFeedbackForReply && (
                    <div className="py-2 space-y-3">
                        <div className="bg-slate-50 p-3 rounded-xl border text-xs">
                            <div className="font-bold text-slate-800">
                                Ý kiến từ: {selectedFeedbackForReply.userName} ({selectedFeedbackForReply.department})
                            </div>
                            <div className="text-slate-600 mt-1 whitespace-pre-line">
                                {selectedFeedbackForReply.content}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-slate-700 mb-1">Kết quả giải quyết:</div>
                            <Radio.Group 
                                value={replyStatus} 
                                onChange={(e) => setReplyStatus(e.target.value)}
                                buttonStyle="solid"
                                className="w-full grid grid-cols-3 text-center"
                            >
                                <Radio.Button value="PROCESSING">Đang xử lý</Radio.Button>
                                <Radio.Button value="RESOLVED">Đã tiếp thu/Xong</Radio.Button>
                                <Radio.Button value="REJECTED">Không áp dụng</Radio.Button>
                            </Radio.Group>
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-slate-700 mb-1">Ý kiến giải trình / Thông báo gửi khoa phòng:</div>
                            <TextArea 
                                rows={4}
                                value={replyNote}
                                onChange={(e) => setReplyNote(e.target.value)}
                                placeholder="Nhập nội dung phản hồi, kết quả khắc phục hoặc giải trình lý do..."
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <Button onClick={() => setSelectedFeedbackForReply(null)}>Đóng</Button>
                            <Button 
                                type="primary"
                                loading={submittingReply}
                                onClick={() => handleUpdateFeedbackStatus(selectedFeedbackForReply.id, replyStatus, replyNote)}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                Lưu và Gửi phản hồi
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* FeatureFeedbackModal */}
            <FeatureFeedbackModal 
                open={isFeedbackModalOpen}
                onClose={() => setIsFeedbackModalOpen(false)}
                currentTitle={currentTitle}
                pagePath={cleanPath}
                onSuccess={fetchFeedbacks}
            />

            {/* Modal Xem trước & Sao chép Thông báo Zalo Toàn Viện */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                            <ShareAltOutlined />
                        </span>
                        <div>
                            <div>Nội Dung Thông Báo Gửi Zalo Toàn Viện</div>
                            <div className="text-xs text-slate-500 font-normal">
                                Sao chép nội dung dưới đây để gửi vào các nhóm Zalo Khoa/Phòng
                            </div>
                        </div>
                    </div>
                }
                open={isZaloModalOpen}
                onCancel={() => setIsZaloModalOpen(false)}
                width={650}
                footer={[
                    <Button key="close" onClick={() => setIsZaloModalOpen(false)} className="rounded-xl">
                        Đóng
                    </Button>,
                    <Button
                        key="zalo_web"
                        href="https://chat.zalo.me/"
                        target="_blank"
                        rel="noopener noreferrer"
                        icon={<ExportOutlined />}
                        className="rounded-xl border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                        Mở Zalo Web
                    </Button>,
                    <Button
                        key="copy"
                        type="primary"
                        icon={<CopyOutlined />}
                        onClick={handleCopyZalo}
                        className="bg-blue-600 hover:bg-blue-500 font-semibold rounded-xl"
                    >
                        Sao chép tin nhắn Zalo
                    </Button>
                ]}
            >
                <div className="py-2 space-y-2">
                    <Alert
                        message="Mẹo gửi nhanh"
                        description="Bấm nút 'Sao chép tin nhắn Zalo', sau đó mở nhóm Zalo Khoa/Phòng và nhấn phím Ctrl + V để dán và gửi đi."
                        type="info"
                        showIcon
                        className="rounded-xl text-xs mb-2"
                    />
                    <TextArea
                        rows={14}
                        value={customZaloMessage}
                        onChange={(e) => setCustomZaloMessage(e.target.value)}
                        className="font-mono text-xs p-3 leading-relaxed rounded-xl border-slate-300"
                    />
                </div>
            </Modal>
        </>
    );
}

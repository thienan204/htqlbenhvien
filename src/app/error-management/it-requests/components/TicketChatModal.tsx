'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Drawer, Input, Button, Spin, message, Tabs, Tag, AutoComplete, Tooltip, Badge, Modal, Switch, Popconfirm, Image as AntImage } from 'antd';
import { 
    SendOutlined, ShopOutlined, GlobalOutlined, UserOutlined, 
    ThunderboltOutlined, SettingOutlined, PlusOutlined, EditOutlined, 
    DeleteOutlined, ReloadOutlined, CloudUploadOutlined, CloudDownloadOutlined,
    PictureOutlined, CameraOutlined, CheckCircleOutlined, SyncOutlined, 
    ClockCircleOutlined, MedicineBoxOutlined, FileTextOutlined, LoadingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Ticket } from '../types';
import { getBasePath } from '@/utils/config';
import { renderTextWithLinks, DetectedLinkBar } from '@/components/common/LinkifiedText';

interface TicketChatModalProps {
    visible: boolean;
    ticket: Ticket | null;
    user: any;
    onClose: () => void;
    onMessageSent?: () => void;
}

interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string | null;
    content: string | null;
    imageUrl?: string | null;
    isSystem: boolean;
    channel?: string;
    vendorName?: string | null;
    senderDepartment?: string | null;
    senderRole?: string | null;
    createdAt: string;
}

export interface QuickReplyTemplate {
    id: string;
    text: string;
    isActive: boolean;
    isDefault?: boolean;
}

const DEFAULT_QUICK_REPLIES: QuickReplyTemplate[] = [
    { id: 'qr-1', text: '✅ Đã xử lý xong, Khoa kiểm tra lại giúp nhé!', isActive: true, isDefault: true },
    { id: 'qr-2', text: '🔄 CNTT đang kiểm tra và xử lý sự cố này...', isActive: true, isDefault: true },
    { id: 'qr-3', text: '🖥️ Khoa vui lòng khởi động lại máy tính / phần mềm giúp CNTT.', isActive: true, isDefault: true },
    { id: 'qr-4', text: '📸 Khoa vui lòng gửi thêm ảnh chụp màn hình lỗi hoặc mã bệnh án.', isActive: true, isDefault: true },
    { id: 'qr-5', text: '🏢 Đã liên hệ đối tác phần mềm (HIS/PACS) để phối hợp xử lý.', isActive: true, isDefault: true },
    { id: 'qr-6', text: '🚶 Kỹ thuật viên đang trực tiếp qua Khoa để hỗ trợ.', isActive: true, isDefault: true },
];

const COMMON_VENDORS = [
    { value: 'VNPT HIS' },
    { value: 'VNPT LIS / PACS' },
    { value: 'Viettel' },
    { value: 'FPT' },
    { value: 'Bảo trì Thiết bị Y tế' },
    { value: 'Hãng máy tính / Máy in' }
];

export const TicketChatModal: React.FC<TicketChatModalProps> = ({ visible, ticket, user, onClose, onMessageSent }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [activeChannel, setActiveChannel] = useState<'INTERNAL' | 'VENDOR'>('INTERNAL');
    const [vendorName, setVendorName] = useState<string>('');
    const [vendorContact, setVendorContact] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<any>(null);

    // Mẫu câu trả lời nhanh (Quick Replies)
    const [quickReplies, setQuickReplies] = useState<QuickReplyTemplate[]>([]);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [newReplyText, setNewReplyText] = useState('');
    const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
    const [editingReplyText, setEditingReplyText] = useState('');

    // Khóa lưu trữ mẫu câu theo từng tài khoản riêng biệt
    const storageKey = `it_request_quick_replies_${user?.username || user?.id || 'default'}`;
    const [savingGlobal, setSavingGlobal] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    // Tải mẫu câu: ưu tiên cấu hình cá nhân trong local, nếu chưa có thì lấy mẫu dùng chung từ hệ thống
    const loadQuickReplies = async () => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setQuickReplies(parsed);
                    return;
                }
            }

            // Nếu tài khoản chưa cấu hình riêng, lấy mẫu chung toàn viện từ API CSDL
            setLoadingTemplates(true);
            const res = await fetch(`${getBasePath()}/api/error-management/quick-replies`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.templates) && data.templates.length > 0) {
                    setQuickReplies(data.templates);
                    return;
                }
            }
            setQuickReplies(DEFAULT_QUICK_REPLIES);
        } catch {
            setQuickReplies(DEFAULT_QUICK_REPLIES);
        } finally {
            setLoadingTemplates(false);
        }
    };

    useEffect(() => {
        loadQuickReplies();
    }, [storageKey]);

    const saveQuickReplies = (list: QuickReplyTemplate[]) => {
        setQuickReplies(list);
        try {
            localStorage.setItem(storageKey, JSON.stringify(list));
        } catch (e) {
            console.error('Failed to save quick replies:', e);
        }
    };

    const handleToggleReplyActive = (id: string, checked: boolean) => {
        const updated = quickReplies.map(r => r.id === id ? { ...r, isActive: checked } : r);
        saveQuickReplies(updated);
    };

    const handleAddQuickReply = () => {
        if (!newReplyText.trim()) return;
        const newItem: QuickReplyTemplate = {
            id: 'qr-' + Date.now(),
            text: newReplyText.trim(),
            isActive: true,
            isDefault: false
        };
        saveQuickReplies([...quickReplies, newItem]);
        setNewReplyText('');
        message.success('Đã thêm mẫu câu mới!');
    };

    const handleDeleteQuickReply = (id: string) => {
        saveQuickReplies(quickReplies.filter(r => r.id !== id));
        message.success('Đã xóa mẫu câu!');
    };

    const handleUpdateQuickReply = (id: string) => {
        if (!editingReplyText.trim()) return;
        saveQuickReplies(quickReplies.map(r => r.id === id ? { ...r, text: editingReplyText.trim() } : r));
        setEditingReplyId(null);
        setEditingReplyText('');
        message.success('Đã cập nhật mẫu câu!');
    };

    const handleResetToAdminDefaults = async () => {
        try {
            setLoadingTemplates(true);
            // Xóa cấu hình cá nhân ở local để nhận lại mẫu chung từ server
            localStorage.removeItem(storageKey);
            const res = await fetch(`${getBasePath()}/api/error-management/quick-replies`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.templates) && data.templates.length > 0) {
                    setQuickReplies(data.templates);
                    message.success('Đã tải lại mẫu câu mặc định từ Admin!');
                    return;
                }
            }
            setQuickReplies(DEFAULT_QUICK_REPLIES);
            message.success('Đã khôi phục các mẫu câu mặc định!');
        } catch {
            setQuickReplies(DEFAULT_QUICK_REPLIES);
            message.success('Đã khôi phục các mẫu câu mặc định!');
        } finally {
            setLoadingTemplates(false);
        }
    };

    const handleSaveGlobalTemplates = async () => {
        try {
            setSavingGlobal(true);
            const res = await fetch(`${getBasePath()}/api/error-management/quick-replies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templates: quickReplies })
            });
            if (res.ok) {
                message.success('Đã lưu làm mẫu câu dùng chung cho toàn viện thành công!');
            } else {
                const err = await res.json();
                message.error(err.error || 'Không thể lưu mẫu câu dùng chung');
            }
        } catch (e) {
            console.error('Error saving global quick replies:', e);
            message.error('Lỗi kết nối khi lưu mẫu câu dùng chung');
        } finally {
            setSavingGlobal(false);
        }
    };

    const handleSelectQuickReply = (textToInsert: string) => {
        setText((prev) => (prev ? `${prev} ${textToInsert}` : textToInsert));
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    const fetchMessages = async () => {
        if (!ticket) return;
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests/${ticket.id}/messages`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
                setTimeout(scrollToBottom, 100);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const isITAdmin = user?.role === 'ADMIN' || user?.role === 'CNTT' || user?.role === 'VTYT' || user?.role === 'HCQT';
    const isVendor = user?.role === 'VENDOR';
    const isDepartment = !isITAdmin && !isVendor;

    useEffect(() => {
        if (visible && ticket) {
            setLoading(true);
            setVendorName(ticket.vendorName || '');
            setVendorContact('');
            if (isVendor) {
                setActiveChannel('VENDOR');
            } else if (isDepartment) {
                setActiveChannel('INTERNAL');
            }
            fetchMessages();
            // Polling tin nhắn 2 giây khi đang mở khung chat
            const interval = setInterval(fetchMessages, 2000); 
            return () => clearInterval(interval);
        } else {
            setMessages([]);
            setText('');
            if (isVendor) setActiveChannel('VENDOR');
            else setActiveChannel('INTERNAL');
        }
    }, [visible, ticket, isVendor, isDepartment]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if (!text.trim() || !ticket) return;
        try {
            setSending(true);
            const effectiveVendorName = ticket.vendorName || vendorName.trim() || 'Đối tác ngoài';
            const payload: any = {
                content: text.trim(),
                channel: activeChannel
            };

            if (activeChannel === 'VENDOR') {
                payload.vendorName = effectiveVendorName;
                if (vendorContact.trim()) {
                    payload.senderName = `${user?.name || user?.username} (➔ ${vendorContact.trim()})`;
                }
            }

            const res = await fetch(`${getBasePath()}/api/error-management/it-requests/${ticket.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const newMsg = await res.json();
                setMessages(prev => [...prev, newMsg]);
                setText('');
                setTimeout(scrollToBottom, 100);
                if (onMessageSent) onMessageSent();
            } else {
                message.error('Lỗi khi gửi tin nhắn');
            }
        } catch (error) {
            message.error('Lỗi khi gửi tin nhắn');
        } finally {
            setSending(false);
        }
    };

    const [uploadingImage, setUploadingImage] = useState(false);

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !ticket) return;

        try {
            setUploadingImage(true);
            const formData = new FormData();
            formData.append('file', file, file.name || 'chat_image.jpg');

            const resUpload = await fetch(`${getBasePath()}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const dataUpload = await resUpload.json();
            if (resUpload.ok && dataUpload.url) {
                const payload: any = {
                    content: text.trim() || 'Đã gửi ảnh chụp đính kèm 📷',
                    imageUrl: dataUpload.url,
                    channel: activeChannel
                };
                if (activeChannel === 'VENDOR') {
                    payload.vendorName = ticket.vendorName || vendorName.trim() || 'Đối tác ngoài';
                }

                const resMsg = await fetch(`${getBasePath()}/api/error-management/it-requests/${ticket.id}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (resMsg.ok) {
                    const newMsg = await resMsg.json();
                    setMessages(prev => [...prev, newMsg]);
                    setText('');
                    setTimeout(scrollToBottom, 100);
                    if (onMessageSent) onMessageSent();
                    message.success('Đã gửi ảnh thành công!');
                }
            } else {
                message.error(dataUpload.error || 'Lỗi khi tải ảnh lên');
            }
        } catch (err) {
            console.error('Error uploading chat image:', err);
            message.error('Lỗi khi tải ảnh');
        } finally {
            setUploadingImage(false);
            e.target.value = '';
        }
    };

    const handleChatPaste = async (e: React.ClipboardEvent) => {
        const clipboardData = e.clipboardData;
        if (!clipboardData) return;
        const items = clipboardData.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    try {
                        setUploadingImage(true);
                        const formData = new FormData();
                        formData.append('file', file, 'pasted_image.png');
                        const resUpload = await fetch(`${getBasePath()}/api/upload`, {
                            method: 'POST',
                            body: formData
                        });
                        const dataUpload = await resUpload.json();
                        if (resUpload.ok && dataUpload.url) {
                            const payload: any = {
                                content: text.trim() || 'Đã dán ảnh chụp màn hình 📷',
                                imageUrl: dataUpload.url,
                                channel: activeChannel
                            };
                            if (activeChannel === 'VENDOR') {
                                payload.vendorName = ticket?.vendorName || vendorName.trim() || 'Đối tác ngoài';
                            }
                            const resMsg = await fetch(`${getBasePath()}/api/error-management/it-requests/${ticket!.id}/messages`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(payload)
                            });
                            if (resMsg.ok) {
                                const newMsg = await resMsg.json();
                                setMessages(prev => [...prev, newMsg]);
                                setText('');
                                setTimeout(scrollToBottom, 100);
                                if (onMessageSent) onMessageSent();
                                message.success('Đã dán và gửi ảnh thành công!');
                            }
                        }
                    } catch (err) {
                        message.error('Lỗi khi gửi ảnh dán');
                    } finally {
                        setUploadingImage(false);
                    }
                    return;
                }
            }
        }
    };

    const getSenderRoleInfo = (msg: ChatMessage) => {
        // 1. Hệ thống tự động
        if (msg.isSystem || msg.content?.includes('[ĐI KHOA PHÒNG') || msg.content?.startsWith('⚡')) {
            return {
                isSystem: true,
                icon: '⚡',
                roleName: 'Hệ thống tự động',
                badgeText: 'Hệ thống',
                tagColor: 'amber',
                avatarBg: 'bg-amber-100 text-amber-700'
            };
        }

        const isMe = msg.senderId === user?.id;

        // 2. Đối tác bên ngoài (HIS / PACS / Thiết bị ...)
        if (msg.vendorName || (msg.channel === 'VENDOR' && !msg.senderName?.includes(user?.name))) {
            const vName = msg.vendorName || ticket?.vendorName;
            return {
                isSystem: false,
                icon: '🏢',
                roleName: vName ? `Đối tác ${vName}` : 'Đối tác ngoài',
                badgeText: vName ? `Đối tác ${vName}` : 'Đối tác',
                tagColor: 'orange',
                avatarBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
            };
        }

        // 3. Tin nhắn của chính người dùng hiện tại (Bạn)
        if (isMe) {
            const myRole = user?.role || '';
            if (['ADMIN', 'CNTT'].includes(myRole)) {
                return {
                    isSystem: false,
                    icon: '💻',
                    roleName: 'Phòng CNTT',
                    badgeText: 'Phòng CNTT',
                    tagColor: 'blue',
                    avatarBg: 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                };
            }
            if (myRole === 'VTYT') {
                return {
                    isSystem: false,
                    icon: '🩺',
                    roleName: 'Phòng Vật tư Y tế',
                    badgeText: 'Phòng VTYT',
                    tagColor: 'blue',
                    avatarBg: 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white'
                };
            }
            if (myRole === 'HCQT') {
                return {
                    isSystem: false,
                    icon: '🏢',
                    roleName: 'Phòng Hành chính Quản trị',
                    badgeText: 'Phòng HCQT',
                    tagColor: 'blue',
                    avatarBg: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white'
                };
            }
            // Khoa lâm sàng / Phòng ban khác
            const myDept = user?.ten_khoa || user?.ma_khoa || ticket?.ten_khoa || ticket?.ma_khoa || 'Khoa phòng';
            return {
                isSystem: false,
                icon: '🏥',
                roleName: myDept,
                badgeText: myDept,
                tagColor: 'emerald',
                avatarBg: 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white'
            };
        }

        // 4. Tin nhắn của người khác (có senderDepartment từ backend API hoặc fallback)
        if (msg.senderDepartment) {
            const dept = msg.senderDepartment;
            if (dept.includes('CNTT') || ['ADMIN', 'CNTT'].includes(msg.senderRole || '')) {
                return {
                    isSystem: false,
                    icon: '💻',
                    roleName: dept,
                    badgeText: dept,
                    tagColor: 'blue',
                    avatarBg: 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                };
            }
            if (dept.includes('Vật tư') || dept.includes('VTYT') || msg.senderRole === 'VTYT') {
                return {
                    isSystem: false,
                    icon: '🩺',
                    roleName: dept,
                    badgeText: dept,
                    tagColor: 'blue',
                    avatarBg: 'bg-gradient-to-br from-cyan-600 to-blue-600 text-white'
                };
            }
            if (dept.includes('Hành chính') || dept.includes('HCQT') || msg.senderRole === 'HCQT') {
                return {
                    isSystem: false,
                    icon: '🏢',
                    roleName: dept,
                    badgeText: dept,
                    tagColor: 'blue',
                    avatarBg: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white'
                };
            }
            if (dept.startsWith('Đối tác')) {
                return {
                    isSystem: false,
                    icon: '🏢',
                    roleName: dept,
                    badgeText: dept,
                    tagColor: 'orange',
                    avatarBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white'
                };
            }
            // Khoa lâm sàng
            return {
                isSystem: false,
                icon: '🏥',
                roleName: dept,
                badgeText: dept,
                tagColor: 'emerald',
                avatarBg: 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white'
            };
        }

        // 5. Fallback khi chưa có senderDepartment từ backend
        const name = (msg.senderName || '').toLowerCase();
        const role = (msg.senderRole || '').toUpperCase();
        const isIT = ['ADMIN', 'CNTT'].includes(role) || name.includes('admin') || name.includes('quản trị') || name.includes('cntt') || name.includes('kỹ thuật') || (ticket?.assigneeName && name.includes(ticket.assigneeName.toLowerCase()));

        if (isIT) {
            return {
                isSystem: false,
                icon: '💻',
                roleName: 'Phòng CNTT',
                badgeText: 'Phòng CNTT',
                tagColor: 'blue',
                avatarBg: 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
            };
        }

        const deptFallback = ticket?.ten_khoa || ticket?.ma_khoa || 'Khoa phòng';
        return {
            isSystem: false,
            icon: '🏥',
            roleName: deptFallback,
            badgeText: deptFallback,
            tagColor: 'emerald',
            avatarBg: 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white'
        };
    };

    const handleCloseDrawer = () => {
        onClose();
        if (onMessageSent) onMessageSent();
    };

    const internalMessages = messages.filter(m => (m.channel || 'INTERNAL') === 'INTERNAL');
    const vendorMessages = messages.filter(m => m.channel === 'VENDOR');
    const currentMessages = activeChannel === 'INTERNAL' ? internalMessages : vendorMessages;

    const tabItems = [
        {
            key: 'INTERNAL',
            label: (
                <span className="flex items-center gap-1.5 px-1 font-medium">
                    <ShopOutlined /> Khoa phòng & Kỹ thuật
                    {internalMessages.length > 0 && (
                        <span className="text-[11px] bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.2">
                            {internalMessages.length}
                        </span>
                    )}
                </span>
            )
        },
        {
            key: 'VENDOR',
            label: (
                <span className="flex items-center gap-1.5 px-1 font-medium">
                    <GlobalOutlined /> Công ty ngoài (Đối tác)
                    {vendorMessages.length > 0 && (
                        <span className="text-[11px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.2">
                            {vendorMessages.length}
                        </span>
                    )}
                </span>
            )
        }
    ];

    return (
        <Drawer
            title={
                <div className="flex items-center gap-3 w-full pr-6 py-0.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xl shrink-0 shadow-sm border border-white">
                        🏥
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 text-sm sm:text-base truncate">
                                {ticket?.ten_khoa || ticket?.ma_khoa || 'Khoa/Phòng'}
                            </span>
                            {ticket?.ma_ba && (
                                <span className="font-mono text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200 shrink-0">
                                    📄 {ticket.ma_ba}
                                </span>
                            )}
                            {ticket?.status && (
                                <Tag color={
                                    ticket.status === 'RESOLVED' ? 'success' :
                                    ticket.status === 'IN_PROGRESS' ? 'processing' :
                                    ticket.status === 'PAUSED' ? 'purple' :
                                    ticket.status === 'WAITING_VENDOR' ? 'orange' : 'warning'
                                } className="m-0 text-[11px] font-semibold shrink-0">
                                    {ticket.status === 'RESOLVED' ? '✓ Hoàn thành' :
                                     ticket.status === 'IN_PROGRESS' ? 'Đang xử lý' :
                                     ticket.status === 'PAUSED' ? '⏸️ Tạm dừng' :
                                     ticket.status === 'WAITING_VENDOR' ? '🏢 Chờ đối tác' : 'Chờ xử lý'}
                                </Tag>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5" title={ticket?.ten_loi || ''}>
                            Lỗi: <strong className="text-slate-700">{ticket?.ten_loi || 'Sự cố'}</strong>
                            {ticket?.nguoi_bao && <span className="ml-2 text-slate-400">| Báo bởi: {ticket.nguoi_bao}</span>}
                        </div>
                    </div>
                </div>
            }
            placement="right"
            onClose={handleCloseDrawer}
            open={visible}
            size={540}
            styles={{ body: { display: 'flex', flexDirection: 'column', padding: 0 } }}
        >
            {/* Header Tabs: Chỉ CNTT/ADMIN mới hiển thị chuyển tab, Khoa phòng hoặc Đối tác chỉ thấy kênh của mình */}
            {isITAdmin ? (
                <div className="bg-slate-100 px-3 pt-2 border-b border-slate-200">
                    <Tabs
                        type="card"
                        activeKey={activeChannel}
                        onChange={(k) => {
                            setActiveChannel(k as 'INTERNAL' | 'VENDOR');
                            setTimeout(scrollToBottom, 100);
                        }}
                        items={tabItems}
                        className="mb-0 custom-chat-tabs"
                    />
                </div>
            ) : isVendor ? (
                <div className="bg-amber-50/80 px-4 py-2 border-b border-amber-200 text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <GlobalOutlined className="text-amber-600" /> Kênh trao đổi trực tiếp với Phòng CNTT Bệnh viện
                </div>
            ) : (
                <div className="bg-blue-50/80 px-4 py-2 border-b border-blue-200 text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                    <ShopOutlined className="text-blue-600" /> Kênh trao đổi nội bộ với Phòng Kỹ thuật (CNTT)
                </div>
            )}

            {/* Sub-header cho kênh VENDOR: Nếu ticket đã có vendorName thì hiện thẻ cố định, chưa có thì hiện ô chọn */}
            {activeChannel === 'VENDOR' && (
                <div className="bg-gradient-to-r from-amber-50/90 to-orange-50/70 p-2.5 px-3 border-b border-amber-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-amber-950">🏢 Đối tác:</span>
                            {ticket?.vendorName ? (
                                <Tag color="orange" className="font-bold text-xs m-0 px-2 py-0.5">
                                    {ticket.vendorName}
                                </Tag>
                            ) : (
                                <AutoComplete
                                    value={vendorName}
                                    onChange={setVendorName}
                                    placeholder="Chọn hoặc nhập tên công ty ngoài..."
                                    options={COMMON_VENDORS}
                                    className="w-44 text-xs"
                                    size="small"
                                />
                            )}
                            {ticket?.vendorTicketCode && (
                                <span className="text-[11px] text-amber-800">
                                    Mã: <b>#{ticket.vendorTicketCode}</b>
                                </span>
                            )}
                            {ticket?.vendorExpectedReturnAt && (
                                <span className="text-[11px] text-amber-800">
                                    Hẹn: <b>{dayjs(ticket.vendorExpectedReturnAt).format('DD/MM/YYYY')}</b>
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Input 
                                size="small" 
                                placeholder="Người trao đổi (VD: Anh Nam HIS)" 
                                value={vendorContact} 
                                onChange={(e) => setVendorContact(e.target.value)} 
                                className="!text-xs w-44 !rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-3.5">
                {loading && currentMessages.length === 0 ? (
                    <div className="flex justify-center items-center h-full"><Spin /></div>
                ) : (
                    currentMessages.map((msg, index) => {
                        const isMe = msg.senderId === user?.id;
                        const roleInfo = getSenderRoleInfo(msg);

                        // 1. THÔNG BÁO SỰ KIỆN HỆ THỐNG (TIMELINE EVENT)
                        if (roleInfo.isSystem) {
                            return (
                                <div key={msg.id || index} className="flex justify-center my-2 w-full animate-in fade-in">
                                    <div className="bg-amber-50/95 border border-amber-200/90 rounded-2xl px-4 py-2.5 max-w-[92%] sm:max-w-[85%] text-xs text-amber-950 shadow-2xs flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs">
                                            ⚡
                                        </div>
                                        <div className="flex-1 leading-relaxed">
                                            <div className="font-semibold text-amber-900 mb-0.5">Sự kiện hệ thống</div>
                                            <div className="whitespace-pre-wrap text-slate-800">{renderTextWithLinks(msg.content)}</div>
                                            <div className="text-[10px] text-amber-800/70 mt-1 flex items-center gap-2">
                                                <span>{msg.senderName || 'Hệ thống'}</span>
                                                <span>• {dayjs(msg.createdAt).format('HH:mm DD/MM/YYYY')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        // 2. TIN NHẮN NGƯỜI DÙNG (CÓ AVATAR & HUY HIỆU VAI TRÒ Y TẾ)
                        return (
                            <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full items-start gap-2.5 group animate-in fade-in`}>
                                {!isMe && (
                                    <Tooltip title={`${msg.senderName} (${roleInfo.roleName})`}>
                                        <div className={`w-8 h-8 rounded-full ${roleInfo.avatarBg} flex items-center justify-center text-xs font-bold shadow-xs shrink-0 mt-1 border border-white`}>
                                            {roleInfo.icon}
                                        </div>
                                    </Tooltip>
                                )}

                                <div className={`flex flex-col max-w-[82%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-1 px-1">
                                        <span className="font-bold text-slate-700">
                                            {isMe ? 'Bạn' : (msg.senderName || 'Ẩn danh')}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold border ${
                                            roleInfo.tagColor === 'orange' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            roleInfo.tagColor === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        }`}>
                                            {roleInfo.icon} {roleInfo.badgeText || roleInfo.roleName}
                                        </span>
                                        <span className="text-slate-400">• {dayjs(msg.createdAt).format('HH:mm DD/MM')}</span>
                                    </div>

                                    <div className={`px-3.5 py-2.5 rounded-2xl shadow-xs text-sm leading-relaxed ${
                                        isMe 
                                            ? activeChannel === 'VENDOR'
                                                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-tr-xs'
                                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-xs'
                                            : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/90'
                                    }`}>
                                        {msg.content && (
                                            <div className="whitespace-pre-wrap">
                                                {renderTextWithLinks(
                                                    msg.content,
                                                    isMe 
                                                        ? "text-white underline font-semibold hover:text-blue-100 inline-flex items-center gap-0.5 break-all" 
                                                        : undefined
                                                )}
                                            </div>
                                        )}
                                        {msg.imageUrl && (
                                            <div className="mt-2 rounded-xl overflow-hidden border border-white/20">
                                                <AntImage 
                                                    src={msg.imageUrl.startsWith('http') || msg.imageUrl.startsWith('blob:') ? msg.imageUrl : `${getBasePath()}${msg.imageUrl}`} 
                                                    alt="Ảnh chụp đính kèm" 
                                                    className="max-h-60 rounded-xl object-contain bg-black/5"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {isMe && (
                                    <Tooltip title={`Bạn (${roleInfo.badgeText || roleInfo.roleName})`}>
                                        <div className={`w-8 h-8 rounded-full ${roleInfo.avatarBg} flex items-center justify-center text-xs font-bold shadow-xs shrink-0 mt-1 border border-white`}>
                                            {roleInfo.icon}
                                        </div>
                                    </Tooltip>
                                )}
                            </div>
                        );
                    })
                )}
                {currentMessages.length === 0 && !loading && (
                    <div className="text-center text-gray-400 mt-12 text-sm flex flex-col items-center gap-2.5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center text-2xl border border-blue-100 shadow-xs">
                            💬
                        </div>
                        <span className="font-semibold text-slate-600">Chưa có tin nhắn nào trong kênh này.</span>
                        <span className="text-xs text-slate-400 max-w-xs leading-relaxed">
                            {activeChannel === 'INTERNAL' 
                                ? 'Bác sĩ, Điều dưỡng và Kỹ thuật viên có thể trao đổi trực tiếp, gửi ảnh chụp lỗi màn hình tại đây.'
                                : 'Ghi nhận tiến độ và trao đổi trực tiếp với Công ty đối tác bên ngoài.'}
                        </span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t flex flex-col gap-2 shadow-sm">
                {/* Dải mẫu câu trả lời nhanh (Quick Replies) */}
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                    <Tooltip title="Mẫu câu trả lời nhanh (Bấm để điền nhanh)">
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 shrink-0 mr-0.5">
                            <ThunderboltOutlined className="text-amber-500" />
                            <span>Trả lời nhanh:</span>
                        </div>
                    </Tooltip>
                    
                    {quickReplies.filter(r => r.isActive).map(r => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => handleSelectQuickReply(r.text)}
                            className="text-xs px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-700 border border-slate-200 hover:border-blue-300 transition-all text-left shadow-2xs cursor-pointer flex items-center gap-1"
                            title={r.text}
                        >
                            <span>{r.text}</span>
                        </button>
                    ))}

                    {/* Nút Cấu hình / Quản lý Mẫu câu */}
                    <Tooltip title="Tùy chỉnh Mẫu câu của bạn (Thêm mới, Bật/Tắt, Sửa/Xóa)">
                        <Button
                            size="small"
                            type="text"
                            icon={<SettingOutlined />}
                            onClick={() => setIsManageModalOpen(true)}
                            className="text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-full h-6 w-6 flex items-center justify-center p-0 ml-auto"
                        />
                    </Tooltip>
                </div>

                <div className="flex gap-2 items-end">
                    {/* Nút đính kèm ảnh chụp lỗi */}
                    <Tooltip title="Đính kèm ảnh chụp màn hình / lỗi thiết bị (hoặc bấm Ctrl+V trong ô chat)">
                        <label className="p-2.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-all flex items-center justify-center shrink-0 border border-slate-200/90 shadow-2xs">
                            {uploadingImage ? (
                                <LoadingOutlined className="text-base text-blue-600" />
                            ) : (
                                <PictureOutlined className="text-base" />
                            )}
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                disabled={uploadingImage} 
                                onChange={handleUploadImage} 
                            />
                        </label>
                    </Tooltip>

                    <Input.TextArea
                        ref={inputRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onPaste={handleChatPaste}
                        placeholder={
                            activeChannel === 'INTERNAL' 
                                ? "Nhập nội dung trao đổi... (Enter để gửi, Ctrl+Enter để xuống dòng)" 
                                : `Nhập trao đổi với ${vendorName.trim() || 'Công ty ngoài'}... (Enter để gửi, Ctrl+Enter để xuống dòng)`
                        }
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (e.ctrlKey || e.metaKey) {
                                    e.preventDefault();
                                    const target = e.currentTarget;
                                    const start = target.selectionStart;
                                    const end = target.selectionEnd;
                                    const val = target.value;
                                    const updated = val.substring(0, start) + '\n' + val.substring(end);
                                    setText(updated);
                                    setTimeout(() => {
                                        target.selectionStart = target.selectionEnd = start + 1;
                                    }, 0);
                                } else if (!e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }
                        }}
                        className="!rounded-xl text-sm"
                    />
                    <Tooltip title="Gửi tin nhắn (Enter)">
                        <Button 
                            type="primary" 
                            icon={<SendOutlined />} 
                            onClick={handleSend} 
                            loading={sending}
                            disabled={!text.trim()}
                            className={`!h-[38px] !rounded-xl ${activeChannel === 'VENDOR' ? 'bg-amber-600 hover:bg-amber-500' : ''}`}
                        />
                    </Tooltip>
                </div>

                {/* Hiển thị các liên kết phát hiện được trong nội dung trao đổi để click mở ngay */}
                <DetectedLinkBar text={text} className="mt-1" />
            </div>

            {/* Modal Quản lý Mẫu câu Trả lời nhanh (Hỗ trợ Hiện/Ẩn, Thêm mới, Sửa, Xóa) */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-slate-800">
                        <ThunderboltOutlined className="text-amber-500 text-lg" />
                        <span>Quản lý Mẫu câu Trả lời nhanh</span>
                    </div>
                }
                open={isManageModalOpen}
                onCancel={() => {
                    setIsManageModalOpen(false);
                    setEditingReplyId(null);
                }}
                footer={[
                    <Button 
                        key="reset" 
                        icon={<CloudDownloadOutlined />} 
                        onClick={handleResetToAdminDefaults}
                        loading={loadingTemplates}
                        title="Xóa cấu hình cá nhân để tải lại mẫu chuẩn từ Admin"
                    >
                        Tải lại mẫu Admin
                    </Button>,
                    ...(isITAdmin ? [
                        <Popconfirm
                            key="save-global"
                            title="Lưu làm mẫu chung cho toàn viện?"
                            description="Tất cả các tài khoản chưa tự tạo mẫu riêng sẽ tự động thấy và dùng danh sách này."
                            onConfirm={handleSaveGlobalTemplates}
                            okText="Đồng ý lưu"
                            cancelText="Hủy"
                        >
                            <Button 
                                type="primary" 
                                ghost 
                                icon={<CloudUploadOutlined />} 
                                loading={savingGlobal}
                                className="border-blue-500 text-blue-600 hover:bg-blue-50"
                            >
                                Lưu mẫu chung toàn viện
                            </Button>
                        </Popconfirm>
                    ] : []),
                    <Button key="close" type="primary" onClick={() => setIsManageModalOpen(false)}>
                        Đóng
                    </Button>
                ]}
                width={620}
                destroyOnHidden
            >
                <div className="space-y-4 py-2">
                    <p className="text-xs text-slate-500 m-0 leading-relaxed">
                        Mỗi tài khoản có thể tự tạo và cấu hình mẫu câu riêng (lưu trữ trên trình duyệt này). Bạn có thể <strong>Bật / Tắt (Hiện / Ẩn)</strong> hoặc thêm các câu trả lời thường dùng. Chỉ những câu đang Bật mới xuất hiện trên thanh chat để điền nhanh.
                    </p>

                    {/* Thêm mới câu mẫu */}
                    <div className="flex gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <Input
                            placeholder="Nhập nội dung mẫu câu mới (ví dụ: Đã xử lý xong, Đang kiểm tra...)"
                            value={newReplyText}
                            onChange={(e) => setNewReplyText(e.target.value)}
                            onPressEnter={handleAddQuickReply}
                            className="rounded-lg text-xs sm:text-sm"
                        />
                        <Button 
                            type="primary" 
                            icon={<PlusOutlined />} 
                            onClick={handleAddQuickReply}
                            disabled={!newReplyText.trim()}
                            className="bg-blue-600 shrink-0"
                        >
                            Thêm
                        </Button>
                    </div>

                    {/* Danh sách mẫu câu */}
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {quickReplies.map((item, index) => (
                            <div 
                                key={item.id} 
                                className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-all ${
                                    item.isActive ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50/70 border-slate-200 opacity-60'
                                }`}
                            >
                                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                    <span className="text-xs font-semibold text-slate-400 w-4 text-center shrink-0">
                                        {index + 1}
                                    </span>
                                    {editingReplyId === item.id ? (
                                        <div className="flex items-center gap-1.5 flex-1">
                                            <Input
                                                size="small"
                                                value={editingReplyText}
                                                onChange={(e) => setEditingReplyText(e.target.value)}
                                                onPressEnter={() => handleUpdateQuickReply(item.id)}
                                                className="text-xs"
                                                autoFocus
                                            />
                                            <Button size="small" type="primary" onClick={() => handleUpdateQuickReply(item.id)}>
                                                Lưu
                                            </Button>
                                            <Button size="small" onClick={() => setEditingReplyId(null)}>
                                                Hủy
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs sm:text-sm m-0 break-words leading-snug ${item.isActive ? 'text-slate-800 font-medium' : 'text-slate-400 line-through'}`}>
                                                {item.text}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <Tooltip title={item.isActive ? "Đang Hiện trên thanh chat (Bấm để Ẩn)" : "Đang Ẩn (Bấm để Hiện)"}>
                                        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                            <span className="text-[11px] font-medium text-slate-600">
                                                {item.isActive ? 'Hiện' : 'Ẩn'}
                                            </span>
                                            <Switch
                                                size="small"
                                                checked={item.isActive}
                                                onChange={(checked) => handleToggleReplyActive(item.id, checked)}
                                            />
                                        </div>
                                    </Tooltip>

                                    {editingReplyId !== item.id && (
                                        <Button
                                            size="small"
                                            type="text"
                                            icon={<EditOutlined />}
                                            onClick={() => {
                                                setEditingReplyId(item.id);
                                                setEditingReplyText(item.text);
                                            }}
                                            className="text-slate-400 hover:text-blue-600"
                                            title="Sửa nội dung"
                                        />
                                    )}

                                    <Popconfirm
                                        title="Xóa mẫu câu này?"
                                        onConfirm={() => handleDeleteQuickReply(item.id)}
                                        okText="Xóa"
                                        cancelText="Hủy"
                                        okButtonProps={{ danger: true }}
                                    >
                                        <Button
                                            size="small"
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            className="text-slate-400 hover:text-red-500"
                                            title="Xóa mẫu câu"
                                        />
                                    </Popconfirm>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </Drawer>
    );
};

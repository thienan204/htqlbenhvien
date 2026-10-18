'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Drawer, Input, Button, Spin, message, Tabs, Tag, AutoComplete, Tooltip, Badge } from 'antd';
import { SendOutlined, ShopOutlined, GlobalOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Ticket } from '../types';
import { getBasePath } from '@/utils/config';

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
    isSystem: boolean;
    channel?: string;
    vendorName?: string | null;
    createdAt: string;
}

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
            const interval = setInterval(fetchMessages, 4000); 
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
                <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-base">
                        {ticket ? `Thảo luận: ${ticket.ma_ba || ticket.ten_loi}` : 'Thảo luận'}
                    </span>
                    {ticket && (
                        <span className="text-xs text-slate-400 font-normal">
                            {ticket.ten_khoa || ticket.ma_khoa} • {ticket.ten_loi}
                        </span>
                    )}
                </div>
            }
            placement="right"
            onClose={handleCloseDrawer}
            open={visible}
            size={520}
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
                        return (
                            <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
                                <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-1 px-1">
                                        {msg.vendorName && (
                                            <Tag color="orange" className="mr-0 text-[10px] py-0 px-1.5 leading-4">
                                                {msg.vendorName}
                                            </Tag>
                                        )}
                                        <span className="font-medium text-slate-700">{msg.senderName || 'Ẩn danh'}</span>
                                        <span>• {dayjs(msg.createdAt).format('HH:mm DD/MM')}</span>
                                    </div>
                                    <div className={`px-3.5 py-2.5 rounded-2xl shadow-sm text-sm whitespace-pre-wrap leading-relaxed ${
                                        isMe 
                                            ? activeChannel === 'VENDOR'
                                                ? 'bg-amber-600 text-white rounded-br-sm'
                                                : 'bg-blue-600 text-white rounded-br-sm'
                                            : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                {currentMessages.length === 0 && !loading && (
                    <div className="text-center text-gray-400 mt-12 text-sm flex flex-col items-center gap-2">
                        {activeChannel === 'INTERNAL' ? (
                            <>
                                <ShopOutlined className="text-3xl text-slate-300" />
                                <span>Chưa có trao đổi nào giữa Khoa phòng và Kỹ thuật.</span>
                            </>
                        ) : (
                            <>
                                <GlobalOutlined className="text-3xl text-amber-300" />
                                <span>Chưa có ghi nhận trao đổi với Công ty ngoài (Đối tác).</span>
                                <span className="text-xs text-slate-400">Nhập tên công ty và nội dung bên dưới để bắt đầu ghi nhận tiến độ.</span>
                            </>
                        )}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t flex flex-col gap-2 shadow-sm">
                <div className="flex gap-2 items-end">
                    <Input.TextArea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={
                            activeChannel === 'INTERNAL' 
                                ? "Nhập nội dung trao đổi với Khoa phòng..." 
                                : `Nhập nội dung trao đổi với ${vendorName.trim() || 'Công ty ngoài'}...`
                        }
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        onPressEnter={(e) => {
                            if (!e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <Button 
                        type="primary" 
                        icon={<SendOutlined />} 
                        onClick={handleSend} 
                        loading={sending}
                        disabled={!text.trim()}
                        className={activeChannel === 'VENDOR' ? 'bg-amber-600 hover:bg-amber-500' : ''}
                    />
                </div>
            </div>
        </Drawer>
    );
};

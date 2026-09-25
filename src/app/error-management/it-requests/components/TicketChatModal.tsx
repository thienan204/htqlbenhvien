import React, { useState, useEffect, useRef } from 'react';
import { Drawer, Input, Button, Spin, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Ticket } from '../types';

interface TicketChatModalProps {
    visible: boolean;
    ticket: Ticket | null;
    user: any;
    onClose: () => void;
}

interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string | null;
    content: string | null;
    isSystem: boolean;
    createdAt: string;
}

export const TicketChatModal: React.FC<TicketChatModalProps> = ({ visible, ticket, user, onClose }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async () => {
        if (!ticket) return;
        try {
            const res = await fetch(`/api/error-management/it-requests/${ticket.id}/messages`);
            if (res.ok) {
                const data = await res.json();
                setMessages(data);
                // only scroll to bottom if loading the first time or if already at bottom, but simple timeout works for now
                setTimeout(scrollToBottom, 100);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible && ticket) {
            setLoading(true);
            fetchMessages();
            // simple polling for new messages every 5 seconds
            const interval = setInterval(fetchMessages, 5000); 
            return () => clearInterval(interval);
        } else {
            setMessages([]);
            setText('');
        }
    }, [visible, ticket]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async () => {
        if (!text.trim() || !ticket) return;
        try {
            setSending(true);
            const res = await fetch(`/api/error-management/it-requests/${ticket.id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text.trim() })
            });
            if (res.ok) {
                const newMsg = await res.json();
                setMessages(prev => [...prev, newMsg]);
                setText('');
                setTimeout(scrollToBottom, 100);
            } else {
                message.error('Lỗi khi gửi tin nhắn');
            }
        } catch (error) {
            message.error('Lỗi khi gửi tin nhắn');
        } finally {
            setSending(false);
        }
    };

    return (
        <Drawer
            title={ticket ? `Thảo luận Yêu cầu: ${ticket.ma_ba}` : 'Thảo luận'}
            placement="right"
            onClose={onClose}
            open={visible}
            width={400}
            styles={{ body: { display: 'flex', flexDirection: 'column', padding: 0 } }}
        >
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-4">
                {loading && messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full"><Spin /></div>
                ) : (
                    messages.map((msg, index) => {
                        const isMe = msg.senderId === user?.id;
                        return (
                            <div key={msg.id || index} className={`flex ${isMe ? 'justify-end' : 'justify-start'} w-full`}>
                                <div className={`flex flex-col max-w-[85%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className="text-[11px] text-gray-500 mb-1 px-1">
                                        {msg.senderName || 'Ẩn danh'} • {dayjs(msg.createdAt).format('HH:mm DD/MM')}
                                    </div>
                                    <div className={`px-3 py-2 rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${
                                        isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
                                    }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                {messages.length === 0 && !loading && (
                    <div className="text-center text-gray-400 mt-10 text-sm">Chưa có thảo luận nào. Hãy bắt đầu!</div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-3 bg-white border-t flex gap-2 items-end shadow-sm">
                <Input.TextArea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Nhập nội dung trao đổi..."
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
                />
            </div>
        </Drawer>
    );
};

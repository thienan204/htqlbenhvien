'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Upload, message, Spin, Space, Modal, Alert } from 'antd';
import { EditOutlined, SaveOutlined, PictureOutlined, CloseOutlined, ShareAltOutlined, CopyOutlined, ExportOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { getBasePath } from '@/utils/config';
import { IT_REQUEST_GUIDE_HTML, getItRequestZaloText } from '@/config/itRequestGuideContent';

const { TextArea } = Input;
const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

interface PageInstructionProps {
    pageId: string;
}

export default function PageInstruction({ pageId }: PageInstructionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isZaloModalOpen, setIsZaloModalOpen] = useState(false);
    const [customZaloMessage, setCustomZaloMessage] = useState('');
    const { user } = useAuth();

    // Only Admin can edit
    const canEdit = user?.role === 'ADMIN';

    const isItRequest = pageId.includes('it-requests');

    useEffect(() => {
        const fetchInstruction = async () => {
            try {
                const bPath = getBasePath();
                const res = await fetch(`${bPath}/api/page-instructions?pageId=${pageId}`);
                if (res.ok) {
                    const data = await res.json();
                    let rawContent = data.content || '';
                    
                    // Nếu là trang Yêu cầu CNTT mà nội dung trong CSDL trống hoặc là template cũ chưa có thông tin CCCD
                    if (isItRequest && (!rawContent || !rawContent.includes('Thông Tin Đăng Nhập Mặc Định Cho Nhân Viên'))) {
                        rawContent = IT_REQUEST_GUIDE_HTML;
                    }
                    setContent(rawContent);
                } else if (isItRequest) {
                    setContent(IT_REQUEST_GUIDE_HTML);
                }
            } catch (error) {
                console.error('Failed to load instructions:', error);
                if (isItRequest) {
                    setContent(IT_REQUEST_GUIDE_HTML);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchInstruction();
    }, [pageId, isItRequest]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const bPath = getBasePath();
            const res = await fetch(`${bPath}/api/page-instructions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId, content }),
            });

            if (res.ok) {
                message.success('Đã lưu hướng dẫn thành công');
                setIsEditing(false);
            } else {
                message.error('Lỗi khi lưu hướng dẫn');
            }
        } catch (error) {
            console.error('Error saving instruction:', error);
            message.error('Có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenZaloModal = () => {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const targetUrl = `${origin}${getBasePath()}${pageId.startsWith('/') ? pageId : `/${pageId}`}`;
        const zaloText = isItRequest ? getItRequestZaloText(targetUrl) : `🏥 BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN\n📢 Hướng dẫn sử dụng: ${targetUrl}`;
        setCustomZaloMessage(zaloText);
        setIsZaloModalOpen(true);
    };

    const handleCopyZalo = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(customZaloMessage)
                .then(() => message.success('Đã sao chép nội dung thông báo Zalo vào bộ nhớ tạm!'))
                .catch(() => message.error('Không thể sao chép tin nhắn'));
        }
    };

    const editorConfig = React.useMemo(() => ({
        readonly: false,
        height: 600,
        language: 'vi',
        placeholder: 'Nhập nội dung hướng dẫn...',
        uploader: { 
            url: `${getBasePath()}/api/upload-image`,
            format: 'json',
        },
    }), []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Spin tip="Đang tải hướng dẫn...">
                    <div style={{ padding: 20 }} />
                </Spin>
            </div>
        );
    }

    return (
        <Card className="min-h-[400px] border-slate-200 shadow-sm" styles={{ body: { padding: '24px' } }}>
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-100 flex-wrap gap-2">
                <h2 className="text-xl font-semibold text-slate-700 m-0">Hướng dẫn sử dụng</h2>
                <Space wrap>
                    <Button 
                        icon={<ShareAltOutlined />} 
                        onClick={handleOpenZaloModal}
                        className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-semibold"
                    >
                        📢 Chia sẻ Zalo
                    </Button>

                    {canEdit && !isEditing && (
                        <Button 
                            type="primary" 
                            icon={<EditOutlined />} 
                            onClick={() => setIsEditing(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 font-medium"
                        >
                            Chỉnh sửa hướng dẫn
                        </Button>
                    )}

                    {isEditing && (
                        <Space>
                            <Button 
                                icon={<CloseOutlined />} 
                                onClick={() => setIsEditing(false)}
                            >
                                Hủy
                            </Button>
                            <Button 
                                type="primary" 
                                icon={<SaveOutlined />} 
                                onClick={handleSave}
                                loading={saving}
                                className="bg-green-600 hover:bg-green-700 font-medium"
                            >
                                Lưu lại
                            </Button>
                        </Space>
                    )}
                </Space>
            </div>

            <div className="w-full">
                {isEditing ? (
                    <div className="w-full">
                        <JoditEditor
                            value={content}
                            config={editorConfig}
                            onBlur={(newContent) => setContent(newContent)}
                        />
                    </div>
                ) : (
                    <div className="prose prose-slate max-w-none">
                        {content ? (
                            <div dangerouslySetInnerHTML={{ __html: content }} />
                        ) : (
                            <div className="text-center text-slate-400 py-10 italic">
                                Chưa có nội dung hướng dẫn cho chức năng này.
                            </div>
                        )}
                    </div>
                )}
            </div>

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
        </Card>
    );
}


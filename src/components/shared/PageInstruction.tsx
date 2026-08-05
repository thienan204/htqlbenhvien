'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Upload, message, Spin, Space } from 'antd';
import { EditOutlined, SaveOutlined, PictureOutlined, CloseOutlined } from '@ant-design/icons';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';

const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false });

interface PageInstructionProps {
    pageId: string;
}

export default function PageInstruction({ pageId }: PageInstructionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { user } = useAuth();
    
    const textareaRef = useRef<any>(null);

    // Only Admin can edit
    const canEdit = user?.role === 'ADMIN';

    useEffect(() => {
        const fetchInstruction = async () => {
            try {
                const res = await fetch(`/api/page-instructions?pageId=${pageId}`);
                if (res.ok) {
                    const data = await res.json();
                    setContent(data.content || '');
                }
            } catch (error) {
                console.error('Failed to load instructions:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInstruction();
    }, [pageId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/page-instructions', {
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

    const editorConfig = React.useMemo(() => ({
        readonly: false,
        height: 600,
        language: 'vi',
        placeholder: 'Nhập nội dung hướng dẫn...',
        uploader: { 
            url: '/htqlbenhvien/api/upload-image',
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
            <div className="flex justify-between items-center mb-6 border-b pb-4 border-slate-100">
                <h2 className="text-xl font-semibold text-slate-700 m-0">Hướng dẫn sử dụng</h2>
                {canEdit && !isEditing && (
                    <Button 
                        type="primary" 
                        icon={<EditOutlined />} 
                        onClick={() => setIsEditing(true)}
                        className="bg-indigo-600 hover:bg-indigo-700"
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
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Lưu lại
                        </Button>
                    </Space>
                )}
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
        </Card>
    );
}

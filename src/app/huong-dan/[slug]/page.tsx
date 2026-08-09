'use client';

import React, { useEffect, useState, use } from 'react';
import { Spin, Result, Button, Breadcrumb } from 'antd';
import { HomeOutlined, BookOutlined } from '@ant-design/icons';
import Link from 'next/link';

export default function InstructionViewer({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const [instruction, setInstruction] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInstruction = async () => {
            try {
                const res = await fetch(`/api/page-instructions?pageId=${slug}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.data) {
                        setInstruction(data.data);
                    }
                }
            } catch (error) {
                console.error('Error fetching instruction:', error);
            } finally {
                setLoading(false);
            }
        };

        if (slug) {
            fetchInstruction();
        }
    }, [slug]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Spin size="large" tip="Đang tải hướng dẫn...">
                    <div style={{ padding: 50 }} />
                </Spin>
            </div>
        );
    }

    if (!instruction) {
        return (
            <Result
                status="404"
                title="Không tìm thấy hướng dẫn"
                subTitle="Bài hướng dẫn này có thể đã bị xóa hoặc đường dẫn không chính xác."
                extra={<Link href="/"><Button type="primary">Về Trang chủ</Button></Link>}
            />
        );
    }

    return (
        <div className="max-w-[1000px] mx-auto p-[3px] md:py-6 md:px-4">
            <Breadcrumb style={{ marginBottom: 24 }} items={[
                {
                    href: '/',
                    title: <><HomeOutlined /> Trang chủ</>,
                },
                {
                    href: '/huong-dan',
                    title: <><BookOutlined /> Tủ sách Hướng dẫn</>,
                },
                {
                    title: instruction.title || 'Chi tiết',
                },
            ]} />

            <div className="bg-white rounded-lg shadow-sm p-[3px] md:py-8 md:px-10">
                {instruction.title && (
                    <h1 style={{ fontSize: 28, color: '#1f2937', marginBottom: 8, marginTop: 0 }}>
                        {instruction.title}
                    </h1>
                )}
                {instruction.description && (
                    <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 24, fontStyle: 'italic' }}>
                        {instruction.description}
                    </p>
                )}
                <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 24 }} />
                
                <div 
                    className="jodit-content-viewer"
                    dangerouslySetInnerHTML={{ __html: instruction.content }}
                    style={{ fontSize: 15, lineHeight: 1.6, color: '#374151' }}
                />
            </div>
        </div>
    );
}

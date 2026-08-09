'use client';

import React, { useEffect, useState } from 'react';
import { Card, Spin, Row, Col, Typography, Input, Empty } from 'antd';
import { SearchOutlined, BookOutlined } from '@ant-design/icons';
import Link from 'next/link';

const { Title, Text, Paragraph } = Typography;

export default function InstructionListPage() {
    const [instructions, setInstructions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        const fetchInstructions = async () => {
            try {
                const res = await fetch('/api/page-instructions');
                const data = await res.json();
                if (data.success && data.data) {
                    setInstructions(data.data);
                }
            } catch (error) {
                console.error('Error fetching instructions:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchInstructions();
    }, []);

    const filtered = instructions.filter(item => 
        (item.title || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <Title level={2} style={{ color: '#1f2937' }}>
                    <BookOutlined style={{ marginRight: 12, color: '#4f46e5' }} />
                    Tủ sách Hướng dẫn
                </Title>
                <Text type="secondary" style={{ fontSize: 16 }}>
                    Nơi lưu trữ các tài liệu, quy trình và hướng dẫn sử dụng hệ thống
                </Text>
            </div>

            <div style={{ maxWidth: 600, margin: '0 auto 32px' }}>
                <Input 
                    size="large"
                    placeholder="Tìm kiếm hướng dẫn..." 
                    prefix={<SearchOutlined style={{ color: '#9ca3af' }} />} 
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    allowClear
                    style={{ borderRadius: 8 }}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Spin size="large" />
                </div>
            ) : filtered.length === 0 ? (
                <Empty description="Không tìm thấy hướng dẫn nào phù hợp" />
            ) : (
                <Row gutter={[24, 24]}>
                    {filtered.map(item => (
                        <Col xs={24} sm={12} md={8} key={item.id}>
                            <Link href={`/huong-dan/${item.pageId}`}>
                                    <Card 
                                        hoverable
                                        style={{ height: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }}
                                        styles={{ body: { padding: 24, display: 'flex', flexDirection: 'column', height: '100%' } }}
                                    >
                                    <Title level={4} style={{ marginTop: 0, marginBottom: 12, color: '#111827', fontSize: 18 }}>
                                        {item.title || 'Bài hướng dẫn chưa có tiêu đề'}
                                    </Title>
                                    <Paragraph 
                                        type="secondary" 
                                        ellipsis={{ rows: 3 }}
                                        style={{ flex: 1, marginBottom: 16, color: '#4b5563' }}
                                    >
                                        {item.description || 'Không có mô tả'}
                                    </Paragraph>
                                    <Text type="secondary" style={{ fontSize: 13, marginTop: 'auto' }}>
                                        Cập nhật: {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                                    </Text>
                                </Card>
                            </Link>
                        </Col>
                    ))}
                </Row>
            )}
        </div>
    );
}

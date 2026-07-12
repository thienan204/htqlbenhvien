'use client';

import React, { useState } from 'react';
import { Card, Tag, Input, Typography, Collapse, Space, Badge } from 'antd';
import { SearchOutlined, ApiOutlined, LinkOutlined } from '@ant-design/icons';
import { ApiEndpoint } from '@/actions/api-discovery';

const { Title, Text } = Typography;

interface Props {
    groupedEndpoints: Record<string, ApiEndpoint[]>;
}

export function ApiManagementClient({ groupedEndpoints }: Props) {
    const [searchText, setSearchText] = useState('');

    const getMethodColor = (method: string) => {
        switch (method) {
            case 'GET': return 'green';
            case 'POST': return 'gold';
            case 'PUT': return 'blue';
            case 'PATCH': return 'purple';
            case 'DELETE': return 'red';
            default: return 'default';
        }
    };

    const renderMethodTags = (methods: string[]) => {
        return methods.map(method => (
            <Tag key={method} color={getMethodColor(method)} className="font-bold border-none">
                {method}
            </Tag>
        ));
    };

    const categories = Object.keys(groupedEndpoints).sort();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <Title level={2} className="!mb-1 text-slate-800 flex items-center gap-3">
                        <ApiOutlined className="text-blue-500" />
                        Tài liệu Hệ thống API
                    </Title>
                    <Text className="text-slate-500">
                        Danh sách này được tự động quét từ mã nguồn. Cập nhật theo thời gian thực.
                    </Text>
                </div>
                <Input
                    prefix={<SearchOutlined className="text-slate-400" />}
                    placeholder="Tìm kiếm API URL..."
                    className="max-w-xs rounded-full"
                    size="large"
                    allowClear
                    onChange={(e) => setSearchText(e.target.value.toLowerCase())}
                />
            </div>

            {categories.map(category => {
                const endpoints = groupedEndpoints[category].filter(e => 
                    e.path.toLowerCase().includes(searchText)
                );

                if (endpoints.length === 0) return null;

                return (
                    <Card 
                        key={category} 
                        title={<span className="font-black text-slate-700 uppercase">{category} APIs</span>} 
                        className="shadow-sm border-slate-200 rounded-2xl overflow-hidden"
                        styles={{ 
                            header: { backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
                            body: { padding: 0 }
                        }}
                    >
                        <Collapse 
                            ghost 
                            expandIconPlacement="end"
                            className="bg-white"
                            items={endpoints.map((endpoint, index) => ({
                                key: endpoint.path,
                                label: (
                                    <div className="flex items-center gap-3 py-1">
                                        <div className="flex-shrink-0 w-24">
                                            {renderMethodTags(endpoint.methods)}
                                        </div>
                                        <Text className="font-mono text-slate-700 font-semibold truncate flex-1 flex items-center gap-2">
                                            {endpoint.path}
                                            {endpoint.path.includes('/mobile/') && (
                                                <Badge count="Mobile App" style={{ backgroundColor: '#10b981' }} />
                                            )}
                                        </Text>
                                    </div>
                                ),
                                className: index < endpoints.length - 1 ? "border-b border-slate-100" : "",
                                children: (
                                    <div className="pl-28 py-2 pr-6">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                                            <div className="flex items-center gap-2">
                                                <LinkOutlined className="text-slate-400" />
                                                <Text copyable={{ text: `http://localhost:3000${endpoint.path}` }} className="font-mono text-blue-600">
                                                    http://localhost:3000{endpoint.path}
                                                </Text>
                                            </div>
                                            
                                            {/* Render Documentation if available */}
                                            {endpoint.docs ? (
                                                <div className="mt-4 space-y-4">
                                                    {Object.entries(endpoint.docs).map(([method, doc]: [string, any]) => (
                                                        <div key={method} className="bg-white p-4 rounded-lg border border-slate-200">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Tag color={getMethodColor(method)} className="m-0 font-bold">{method}</Tag>
                                                                <Text className="font-semibold text-slate-700">{doc.description}</Text>
                                                            </div>
                                                            
                                                            {doc.headers && (
                                                                <div className="mt-3">
                                                                    <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Headers bắt buộc:</Text>
                                                                    <pre className="bg-slate-800 text-green-400 p-3 rounded-md text-sm mt-1 overflow-x-auto">
                                                                        {JSON.stringify(doc.headers, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                            
                                                            {doc.body && (
                                                                <div className="mt-3">
                                                                    <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider">Body JSON mẫu:</Text>
                                                                    <pre className="bg-slate-800 text-green-400 p-3 rounded-md text-sm mt-1 overflow-x-auto">
                                                                        {JSON.stringify(doc.body, null, 2)}
                                                                    </pre>
                                                                </div>
                                                            )}
                                                            
                                                            {doc.postmanSnippet && (
                                                                <div className="mt-3 bg-blue-50 border border-blue-200 p-3 rounded-md">
                                                                    <Text className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1 block">🚀 Hướng dẫn dùng Postman:</Text>
                                                                    <Text className="text-sm text-blue-900 whitespace-pre-line">{doc.postmanSnippet}</Text>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <Text type="secondary" className="block text-sm">
                                                    * Tham số truyền vào tuỳ thuộc vào logic chi tiết bên trong mã nguồn. Hãy xem mã nguồn trực tiếp để biết chi tiết Body (JSON) cần gửi.
                                                </Text>
                                            )}
                                        </div>
                                    </div>
                                )
                            }))}
                        />
                    </Card>
                );
            })}

            {categories.every(cat => groupedEndpoints[cat].filter(e => e.path.toLowerCase().includes(searchText)).length === 0) && (
                <div className="text-center py-20 text-slate-400">
                    <ApiOutlined className="text-4xl mb-4 opacity-50" />
                    <p className="text-lg">Không tìm thấy API nào khớp với từ khóa "{searchText}"</p>
                </div>
            )}
        </div>
    );
}

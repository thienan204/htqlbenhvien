'use client';
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Layout, Menu, Spin, Alert } from 'antd';
import { BookOutlined, AppstoreOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Sider, Content } = Layout;

// Mapping icons dynamically
const getIcon = (iconName: string) => {
    switch (iconName) {
        case 'AppstoreOutlined': return <AppstoreOutlined />;
        case 'SafetyCertificateOutlined': return <SafetyCertificateOutlined />;
        default: return <BookOutlined />;
    }
}

export default function DocsPage() {
    const [docsList, setDocsList] = useState<any[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<any>(null);
    const [markdownContent, setMarkdownContent] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch index of docs
        fetch('/docs/index.json')
            .then(res => res.json())
            .then(data => {
                setDocsList(data);
                if (data.length > 0) {
                    setSelectedDoc(data[0]);
                } else {
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error('Failed to load docs index', err);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (selectedDoc) {
            setLoading(true);
            fetch(`/docs/${selectedDoc.file}`)
                .then(res => res.text())
                .then(text => setMarkdownContent(text))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [selectedDoc]);

    return (
        <Layout className="h-screen bg-slate-50 pt-20 px-8 pb-8">
            <Layout className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
                <Sider width={300} theme="light" className="border-r border-slate-200" style={{ background: '#f8fafc' }}>
                    <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-cyan-50">
                        <h2 className="text-xl font-black text-slate-800 m-0">📚 Sổ tay Hướng dẫn</h2>
                        <p className="text-sm text-slate-500 mt-1 mb-0">Tài liệu & Walkthroughs</p>
                    </div>
                    <Menu
                        mode="inline"
                        selectedKeys={selectedDoc ? [selectedDoc.id] : []}
                        className="bg-transparent border-none py-4"
                        items={docsList.map(doc => ({
                            key: doc.id,
                            icon: getIcon(doc.icon),
                            label: <span className="font-semibold text-[15px]">{doc.title}</span>,
                            onClick: () => setSelectedDoc(doc)
                        }))}
                    />
                </Sider>
                <Content className="p-10 overflow-y-auto bg-white relative">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <Spin size="large" />
                        </div>
                    ) : (
                        <div className="prose prose-slate prose-blue max-w-4xl mx-auto">
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    blockquote: ({node, ...props}) => {
                                        // Extract raw text deeply from AST
                                        let rawText = '';
                                        const extractText = (n: any) => {
                                            if (n.type === 'text') rawText += n.value;
                                            if (n.children) n.children.forEach(extractText);
                                        };
                                        if (node) extractText(node);

                                        // Custom alert handling based on GitHub syntax
                                        if (rawText.includes('[!TIP]')) {
                                            return <Alert title="Mẹo (Tip)" description={rawText.replace('[!TIP]', '').trim()} type="success" showIcon className="my-6 shadow-sm" />;
                                        }
                                        if (rawText.includes('[!IMPORTANT]')) {
                                            return <Alert title="Quan trọng" description={rawText.replace('[!IMPORTANT]', '').trim()} type="warning" showIcon className="my-6 shadow-sm" />;
                                        }
                                        if (rawText.includes('[!WARNING]')) {
                                            return <Alert title="Cảnh báo" description={rawText.replace('[!WARNING]', '').trim()} type="error" showIcon className="my-6 shadow-sm" />;
                                        }
                                        return <blockquote className="border-l-4 border-blue-400 pl-4 py-2 italic text-slate-600 bg-blue-50/50 rounded-r-lg my-6" {...props} />;
                                    },
                                    h1: ({node, ...props}) => <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-cyan-600 mb-8 pb-4 border-b border-slate-100" {...props} />,
                                    h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-slate-800 mt-10 mb-5 flex items-center gap-2" {...props}><span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block"></span>{props.children}</h2>,
                                    h3: ({node, ...props}) => <h3 className="text-xl font-semibold text-slate-800 mt-8 mb-4" {...props} />,
                                    a: ({node, ...props}) => <a className="text-blue-600 hover:text-blue-800 font-medium underline decoration-blue-200 underline-offset-4" {...props} />,
                                    code: ({node, className, children, ...props}: any) => {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return match ? (
                                            <div className="relative my-6 group">
                                                <div className="absolute -top-3 left-4 bg-slate-800 text-xs text-slate-400 px-2 py-0.5 rounded-md font-mono">{match[1]}</div>
                                                <pre className="bg-slate-900 text-slate-50 p-5 pt-6 rounded-xl overflow-x-auto shadow-inner text-[13px] font-mono leading-relaxed"><code className={className} {...props}>{children}</code></pre>
                                            </div>
                                        ) : (
                                            <code className="bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded border border-orange-100 font-mono text-[13px] whitespace-nowrap" {...props}>{children}</code>
                                        );
                                    },
                                    table: ({node, ...props}) => <div className="overflow-x-auto my-8 shadow-sm rounded-lg border border-slate-200"><table className="min-w-full divide-y divide-slate-200 m-0" {...props} /></div>,
                                    thead: ({node, ...props}) => <thead className="bg-slate-50" {...props} />,
                                    th: ({node, ...props}) => <th className="px-6 py-4 text-left text-xs font-bold text-slate-600 uppercase tracking-wider" {...props} />,
                                    td: ({node, ...props}) => <td className="px-6 py-4 text-sm text-slate-700 border-t border-slate-100" {...props} />,
                                    ul: ({node, ...props}) => <ul className="list-disc pl-6 space-y-2 my-4 text-slate-700" {...props} />,
                                    ol: ({node, ...props}) => <ol className="list-decimal pl-6 space-y-2 my-4 text-slate-700" {...props} />,
                                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                    p: ({node, ...props}) => <p className="leading-relaxed text-slate-700 my-4 text-[15px]" {...props} />
                                }}
                            >
                                {markdownContent}
                            </ReactMarkdown>
                        </div>
                    )}
                </Content>
            </Layout>
        </Layout>
    );
}

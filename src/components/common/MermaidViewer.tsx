'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Spin } from 'antd';

interface MermaidViewerProps {
    chart: string;
    id?: string;
    className?: string;
}

declare global {
    interface Window {
        mermaid?: any;
    }
}

export default function MermaidViewer({ chart, id, className = '' }: MermaidViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const uniqueId = useRef(id || `mermaid-${Math.random().toString(36).substring(2, 9)}`);

    useEffect(() => {
        let isMounted = true;

        const loadAndRender = async () => {
            try {
                setLoading(true);
                setError(null);

                // Nạp script mermaid nếu chưa có trên window
                if (!window.mermaid) {
                    await new Promise<void>((resolve, reject) => {
                        const existingScript = document.getElementById('mermaid-cdn-script');
                        if (existingScript) {
                            existingScript.addEventListener('load', () => resolve());
                            existingScript.addEventListener('error', () => reject(new Error('Lỗi nạp thư viện Mermaid')));
                            return;
                        }

                        const script = document.createElement('script');
                        script.id = 'mermaid-cdn-script';
                        script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Lỗi nạp thư viện Mermaid từ CDN'));
                        document.head.appendChild(script);
                    });
                }

                if (!window.mermaid) {
                    throw new Error('Thư viện Mermaid chưa sẵn sàng');
                }

                window.mermaid.initialize({
                    startOnLoad: false,
                    theme: 'default',
                    securityLevel: 'loose',
                    flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
                    sequence: { showSequenceNumbers: true, actorMargin: 45, mirrorActors: false }
                });

                // Render sơ đồ sang mã SVG
                const renderId = `render-${uniqueId.current}-${Date.now()}`;
                const { svg: renderedSvg } = await window.mermaid.render(renderId, chart);

                if (isMounted) {
                    setSvg(renderedSvg);
                    setLoading(false);
                }
            } catch (err: any) {
                console.error('Mermaid render error:', err);
                if (isMounted) {
                    setError(err?.message || 'Không thể hiển thị biểu đồ');
                    setLoading(false);
                }
            }
        };

        loadAndRender();

        return () => {
            isMounted = false;
        };
    }, [chart]);

    return (
        <div className={`w-full overflow-x-auto flex justify-center py-2 ${className}`}>
            {loading && (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Spin size="default" />
                    <span className="text-xs text-slate-400">Đang khởi tạo biểu đồ...</span>
                </div>
            )}
            {error && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    <p className="font-semibold m-0">Không thể kết xuất biểu đồ trực quan:</p>
                    <p className="mt-1 text-slate-500 font-mono text-[11px] whitespace-pre-wrap">{chart}</p>
                </div>
            )}
            {!loading && !error && svg && (
                <div 
                    ref={containerRef}
                    className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: svg }} 
                />
            )}
        </div>
    );
}

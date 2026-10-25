import React from 'react';
import { LinkOutlined, ExportOutlined } from '@ant-design/icons';

// Regex nhận diện các đường dẫn URL bắt đầu bằng http:// hoặc https://
export const URL_REGEX = /(https?:\/\/[^\s<>"'()]+)/gi;

/**
 * Trích xuất danh sách các URL hợp lệ từ chuỗi văn bản
 */
export function extractUrls(text?: string | null): string[] {
    if (!text || typeof text !== 'string') return [];
    const matches = text.match(URL_REGEX);
    if (!matches) return [];
    return Array.from(new Set(matches));
}

/**
 * Render chuỗi văn bản có chứa các đường link thành các thẻ <a> bấm được
 */
export function renderTextWithLinks(text?: string | null, linkClassName?: string): React.ReactNode {
    if (!text || typeof text !== 'string') return text ?? null;

    const parts = text.split(URL_REGEX);
    if (parts.length === 1) return text;

    const defaultClass = "text-blue-600 hover:text-blue-800 underline font-medium inline-flex items-center gap-0.5 break-all hover:bg-blue-50/80 px-1 py-0.5 rounded transition-colors";

    return parts.map((part, index) => {
        if (part.match(URL_REGEX)) {
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={linkClassName || defaultClass}
                    title={`Mở liên kết trong tab mới: ${part}`}
                >
                    <span className="truncate max-w-[220px] sm:max-w-[360px] inline-block align-bottom">{part}</span>
                    <ExportOutlined className="text-[10px] shrink-0" />
                </a>
            );
        }
        return part;
    });
}

/**
 * Component thanh hiển thị các liên kết phát hiện được trong ô nhập liệu (Textarea / Input)
 * Click vào là mở ngay liên kết trong tab mới
 */
interface DetectedLinkBarProps {
    text?: string | null;
    className?: string;
}

export const DetectedLinkBar: React.FC<DetectedLinkBarProps> = ({ text, className = '' }) => {
    const urls = extractUrls(text);
    if (urls.length === 0) return null;

    return (
        <div className={`flex flex-wrap items-center gap-1.5 p-2 bg-blue-50/90 border border-blue-200/90 rounded-xl text-xs shadow-2xs animate-in fade-in ${className}`}>
            <span className="font-semibold text-blue-900 flex items-center gap-1 shrink-0">
                <LinkOutlined className="text-blue-600" /> Mở liên kết ({urls.length}):
            </span>
            {urls.map((url, idx) => (
                <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-300 hover:border-blue-600 rounded-lg font-medium transition-all shadow-xs max-w-full group"
                    title={`Click để mở ngay liên kết trong tab mới: ${url}`}
                >
                    <span className="truncate max-w-[240px] sm:max-w-[420px]">{url}</span>
                    <ExportOutlined className="text-[11px] shrink-0 opacity-70 group-hover:opacity-100" />
                </a>
            ))}
        </div>
    );
};

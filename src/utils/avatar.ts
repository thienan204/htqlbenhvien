import { getBasePath } from './config';

/**
 * Chuẩn hóa URL ảnh đại diện với basePath của hệ thống Next.js
 */
export function formatAvatarUrl(url?: string | null): string | undefined {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
        return url;
    }
    const basePath = getBasePath();
    if (url.startsWith(basePath)) {
        return url;
    }
    return `${basePath}${url.startsWith('/') ? '' : '/'}${url}`;
}

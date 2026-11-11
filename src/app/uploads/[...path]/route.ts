import { NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
    const params = await context.params;
    const pathArray = params.path || [];
    
    // Ngăn chặn path traversal
    if (pathArray.some(p => p.includes('..'))) {
        return new NextResponse('Forbidden', { status: 403 });
    }

    const filePath = join(process.cwd(), 'public', 'uploads', ...pathArray);
    
    try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) {
            return new NextResponse('File not found', { status: 404 });
        }

        const fileBuffer = await readFile(filePath);
        
        // Xác định extension & MIME type chuẩn
        const ext = (filePath.split('.').pop() || '').toLowerCase();
        
        const mimeMap: Record<string, string> = {
            // Images
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'bmp': 'image/bmp',
            'ico': 'image/x-icon',
            // Office / Documents
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'pdf': 'application/pdf',
            'txt': 'text/plain; charset=utf-8',
            'csv': 'text/csv; charset=utf-8',
            // Archives
            'zip': 'application/zip',
            'rar': 'application/vnd.rar',
            '7z': 'application/x-7z-compressed',
            'tar': 'application/x-tar',
            'gz': 'application/gzip',
            // Others
            'json': 'application/json; charset=utf-8',
            'xml': 'application/xml; charset=utf-8',
        };

        const mimeType = mimeMap[ext] || 'application/octet-stream';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
        const isInlinePdf = ext === 'pdf';

        // Lấy tên file gốc (bỏ timestamp prefix dạng 17313...- nếu có)
        const rawFileName = pathArray[pathArray.length - 1] || 'download';
        const cleanFileName = rawFileName.replace(/^\d+-/, '') || rawFileName;
        const encodedFileName = encodeURIComponent(cleanFileName);

        // Kiểm tra query param ?download=1 hoặc file không phải là ảnh/pdf hiển thị được trên browser
        let forceDownload = !isImage && !isInlinePdf;
        try {
            const url = new URL(request.url);
            if (url.searchParams.get('download') === '1') {
                forceDownload = true;
            }
        } catch {
            // ignore URL parse error
        }

        const headers: Record<string, string> = {
            'Content-Type': mimeType,
            'Cache-Control': isImage ? 'public, max-age=31536000, immutable' : 'no-cache',
            'Content-Disposition': forceDownload
                ? `attachment; filename="${cleanFileName}"; filename*=UTF-8''${encodedFileName}`
                : `inline; filename="${cleanFileName}"; filename*=UTF-8''${encodedFileName}`
        };
        
        return new NextResponse(fileBuffer, { headers });
    } catch (e: any) {
        return new NextResponse('File not found: ' + filePath + ' | Error: ' + e.message, { status: 404 });
    }
}

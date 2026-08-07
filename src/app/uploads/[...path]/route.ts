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
        
        // Xác định mime type cơ bản
        const ext = filePath.split('.').pop()?.toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'svg') mimeType = 'image/svg+xml';
        
        return new NextResponse(fileBuffer, {
            headers: { 
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (e: any) {
        return new NextResponse('File not found: ' + filePath + ' | Error: ' + e.message, { status: 404 });
    }
}

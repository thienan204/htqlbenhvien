import { NextResponse } from 'next/server';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const fileUrl = url.searchParams.get('url'); // e.g. /reports/2026-08/filename.xlsx

        if (!fileUrl) {
            return NextResponse.json({ success: false, message: 'Missing URL' }, { status: 400 });
        }

        // Prevent directory traversal
        if (fileUrl.includes('..')) {
            return NextResponse.json({ success: false, message: 'Invalid URL' }, { status: 400 });
        }

        // The physical path is in the public directory
        // fileUrl usually starts with '/' like '/reports/...'
        const normalizedUrl = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
        const filePath = join(process.cwd(), 'public', normalizedUrl);

        if (!existsSync(filePath)) {
            return NextResponse.json({ success: false, message: 'File not found on server' }, { status: 404 });
        }

        const fileBuffer = await readFile(filePath);
        
        const fileName = fileUrl.split('/').pop() || 'download';
        
        let contentType = 'application/octet-stream';
        if (fileName.endsWith('.pdf')) contentType = 'application/pdf';
        else if (fileName.endsWith('.xlsx')) contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error: any) {
        console.error('Download error:', error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}

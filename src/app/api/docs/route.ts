import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const file = searchParams.get('file');

        const docsDir = join(process.cwd(), 'public', 'docs');

        if (!file || file === 'index.json') {
            const indexPath = join(docsDir, 'index.json');
            const data = await readFile(indexPath, 'utf-8');
            return new NextResponse(data, {
                status: 200,
                headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
        }

        // Sanitize file name to prevent directory traversal
        const safeFile = file.replace(/(\.\.[\/\\])+/g, '').replace(/[^a-zA-Z0-9_\-\.]/g, '');
        const filePath = join(docsDir, safeFile);
        const content = await readFile(filePath, 'utf-8');

        return new NextResponse(content, {
            status: 200,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    } catch (error: any) {
        console.error('Error serving docs:', error);
        return NextResponse.json({ error: 'Không tìm thấy tài liệu' }, { status: 404 });
    }
}

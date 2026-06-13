import { NextResponse } from 'next/server';
import { processExcelImport } from '@/services/excelImportService';
import { getCurrentUser } from '@/actions/auth';

export async function POST(request: Request) {
    try {
        const user = await getCurrentUser();
        // Cần quyền admin hoặc quyền import
        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const successCount = await processExcelImport(buffer);

        return NextResponse.json({ success: true, message: `Import thành công ${successCount} nhân viên.` });

    } catch (error: any) {
        console.error('Import Excel Error:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi import file' }, { status: 500 });
    }
}

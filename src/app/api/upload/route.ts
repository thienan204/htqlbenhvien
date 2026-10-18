import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'Không tìm thấy tệp tải lên' }, { status: 400 });
        }

        // Đọc cấu hình giới hạn dung lượng & đuôi file từ DB
        let maxFileSizeMB = 15;
        let allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.docx', '.xlsx', '.doc', '.xls', '.zip', '.rar'];

        try {
            const configRule = await prisma.specializedRule.findUnique({
                where: { slug: 'it-request-fields-config' }
            });
            if (configRule && configRule.logicConfig && typeof configRule.logicConfig === 'object') {
                const conf: any = configRule.logicConfig;
                if (conf.maxFileSizeMB) maxFileSizeMB = Number(conf.maxFileSizeMB);
                else if (conf.maxImageSizeMB) maxFileSizeMB = Number(conf.maxImageSizeMB);

                if (conf.allowedFileExtensions && typeof conf.allowedFileExtensions === 'string') {
                    allowedExtensions = conf.allowedFileExtensions
                        .split(',')
                        .map((ext: string) => ext.trim().toLowerCase())
                        .filter(Boolean)
                        .map((ext: string) => ext.startsWith('.') ? ext : `.${ext}`);
                }
            }
        } catch (e) {
            console.warn('Lỗi đọc cấu hình upload, dùng mặc định:', e);
        }

        // 1. Kiểm tra dung lượng
        const maxBytes = maxFileSizeMB * 1024 * 1024;
        if (file.size > maxBytes) {
            return NextResponse.json({ 
                error: `Dung lượng tệp vượt quá mức cho phép (${maxFileSizeMB}MB). Vui lòng chọn tệp nhỏ hơn.` 
            }, { status: 400 });
        }

        // 2. Kiểm tra đuôi file
        const fileExt = extname(file.name || '').toLowerCase();
        if (fileExt && !allowedExtensions.includes(fileExt)) {
            return NextResponse.json({ 
                error: `Định dạng tệp "${fileExt}" không được phép tải lên. Các định dạng cho phép: ${allowedExtensions.join(', ')}` 
            }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Sanitize filename
        const originalName = (file.name || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const filename = `${Date.now()}-${originalName}`;
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'tickets');

        // Create directory if it doesn't exist
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (err) {
            // Ignore if exists
        }

        const path = join(uploadDir, filename);
        await writeFile(path, buffer);

        // Return the relative URL
        const fileUrl = `/uploads/tickets/${filename}`;
        
        return NextResponse.json({ 
            url: fileUrl, 
            name: file.name,
            size: file.size,
            ext: fileExt,
            success: true 
        });
    } catch (error) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: 'Lỗi tải file lên máy chủ' }, { status: 500 });
    }
}

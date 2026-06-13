import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'saved-reports');
const METADATA_FILE = path.join(UPLOAD_DIR, 'metadata.json');

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Đọc metadata
const getMetadata = () => {
    if (fs.existsSync(METADATA_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
        } catch (e) {
            return {};
        }
    }
    return {};
};

// Ghi metadata
const saveMetadata = (data: any) => {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

export async function GET() {
    try {
        const metadata = getMetadata();
        const files = fs.readdirSync(UPLOAD_DIR).filter(f => f !== 'metadata.json');
        const fileList = files.map(fileName => {
            const filePath = path.join(UPLOAD_DIR, fileName);
            const stats = fs.statSync(filePath);
            return {
                fileName,
                fileSize: stats.size, // bytes
                createdAt: stats.mtime, // Lấy thời gian sửa đổi cuối cùng làm thời gian tạo/lưu
                url: `/saved-reports/${fileName}`,
                note: metadata[fileName]?.note || ''
            };
        });

        // Sắp xếp file mới nhất lên đầu
        fileList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        return NextResponse.json(fileList);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'Không tìm thấy file tải lên' }, { status: 400 });
        }

        const note = formData.get('note') as string || '';

        // Đảm bảo tên file an toàn (bỏ các ký tự không hợp lệ)
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const filePath = path.join(UPLOAD_DIR, safeFileName);

        // Chuyển File thành Buffer và lưu vào hệ thống
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        fs.writeFileSync(filePath, buffer);

        // Lưu ghi chú vào metadata.json
        const metadata = getMetadata();
        metadata[safeFileName] = { note };
        saveMetadata(metadata);

        return NextResponse.json({ success: true, fileName: safeFileName, url: `/saved-reports/${safeFileName}` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'saved-reports');
const METADATA_FILE = path.join(UPLOAD_DIR, 'metadata.json');

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

const saveMetadata = (data: any) => {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
};

export async function DELETE(req: Request, context: any) {
    const { params } = context;
    try {
        const resolvedParams = await params;
        const fileName = resolvedParams.filename;

        if (!fileName) {
             return NextResponse.json({ error: 'Tên file không hợp lệ' }, { status: 400 });
        }

        const safeFileName = path.basename(fileName); // Tránh directory traversal
        const filePath = path.join(UPLOAD_DIR, safeFileName);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);

            // Xóa metadata
            const metadata = getMetadata();
            if (metadata[safeFileName]) {
                delete metadata[safeFileName];
                saveMetadata(metadata);
            }

            return NextResponse.json({ success: true, message: 'Đã xóa file' });
        } else {
            return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

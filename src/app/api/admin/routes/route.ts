import { NextResponse } from 'next/server';
import systemRoutes from '@/config/systemRoutes.json';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const appDir = path.join(process.cwd(), 'src', 'app');
        // Nếu ở môi trường dev hoặc thư mục src/app tồn tại, có thể đọc trực tiếp nếu file json chưa có
        if (Array.isArray(systemRoutes) && systemRoutes.length > 0) {
            return NextResponse.json(systemRoutes);
        }

        // Fallback đọc file trực tiếp
        const jsonPath = path.join(process.cwd(), 'src', 'config', 'systemRoutes.json');
        if (fs.existsSync(jsonPath)) {
            const content = fs.readFileSync(jsonPath, 'utf-8');
            return NextResponse.json(JSON.parse(content));
        }

        return NextResponse.json([]);
    } catch (error) {
        console.error('Error fetching system routes:', error);
        return NextResponse.json(systemRoutes || []);
    }
}

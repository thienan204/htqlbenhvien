import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export async function GET() {
    try {
        let message = 'Database updated successfully!';
        
        // Cập nhật Phụ lục 1
        const sqlPath1 = path.join(process.cwd(), 'update_phuluc1.sql');
        if (fs.existsSync(sqlPath1)) {
            const sql1 = fs.readFileSync(sqlPath1, 'utf-8');
            const commands1 = sql1.split(';').filter(cmd => cmd.trim() !== '');
            for (const cmd of commands1) {
                await prisma.$executeRawUnsafe(cmd);
            }
            message += ' Phụ lục 1 đã đồng bộ.';
        }
        
        // Cập nhật Phụ lục 2
        const sqlPath2 = path.join(process.cwd(), 'update_phuluc2.sql');
        if (fs.existsSync(sqlPath2)) {
            const sql2 = fs.readFileSync(sqlPath2, 'utf-8');
            const commands2 = sql2.split(';').filter(cmd => cmd.trim() !== '');
            for (const cmd of commands2) {
                await prisma.$executeRawUnsafe(cmd);
            }
            message += ' Phụ lục 2 đã đồng bộ.';
        }

        return NextResponse.json({ success: true, message });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

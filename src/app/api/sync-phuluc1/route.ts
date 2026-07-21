import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

export async function GET() {
    try {
        const sqlPath = path.join(process.cwd(), 'update_phuluc1.sql');
        if (!fs.existsSync(sqlPath)) {
            return NextResponse.json({ error: 'SQL file not found' }, { status: 404 });
        }
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        const commands = sql.split(';').filter(cmd => cmd.trim() !== '');
        
        for (const cmd of commands) {
            await prisma.$executeRawUnsafe(cmd);
        }
        
        return NextResponse.json({ success: true, message: 'Database updated successfully!' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

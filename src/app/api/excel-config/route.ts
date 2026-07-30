import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ruleType = searchParams.get('ruleType') || 'default';
        const configPath = path.join(process.cwd(), 'data', `${ruleType}-excel-config.json`);

        const fileContent = await fs.readFile(configPath, 'utf-8');
        return NextResponse.json(JSON.parse(fileContent));
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ colConfigs: [], violationColName: 'Quy tắc vi phạm' });
        }
        return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ruleType = searchParams.get('ruleType') || 'default';
        const configPath = path.join(process.cwd(), 'data', `${ruleType}-excel-config.json`);

        const body = await request.json();
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(body, null, 2), 'utf-8');
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
    }
}

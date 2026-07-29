import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'data', 'admin-paths.json');

export async function GET() {
    try {
        const fileContent = await fs.readFile(configPath, 'utf-8');
        const paths = JSON.parse(fileContent);
        return NextResponse.json(paths);
    } catch (error) {
        console.error('Error reading admin-paths.json:', error);
        return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const paths = await request.json();
        
        if (!Array.isArray(paths)) {
            return NextResponse.json({ error: 'Invalid data format. Expected an array of strings.' }, { status: 400 });
        }

        await fs.writeFile(configPath, JSON.stringify(paths, null, 4), 'utf-8');
        
        return NextResponse.json({ success: true, message: 'Configuration saved successfully.' });
    } catch (error) {
        console.error('Error writing admin-paths.json:', error);
        return NextResponse.json({ error: 'Failed to write config' }, { status: 500 });
    }
}

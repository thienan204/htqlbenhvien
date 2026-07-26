import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const configPath = path.join(process.cwd(), 'data', 'excel-templates.json');

async function getTemplates() {
    try {
        const fileContent = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(fileContent) || [];
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

export async function GET() {
    try {
        const templates = await getTemplates();
        return NextResponse.json(templates);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to read templates' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const templates = await getTemplates();
        
        // Ensure ID and slug
        if (!body.id) {
            body.id = Date.now().toString();
        }
        if (!body.slug) {
            body.slug = body.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
        }
        body.createdAt = Date.now();
        body.updatedAt = Date.now();

        templates.push(body);

        await fs.mkdir(path.dirname(configPath), { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(templates, null, 2), 'utf-8');
        
        return NextResponse.json({ success: true, data: body });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
    }
}

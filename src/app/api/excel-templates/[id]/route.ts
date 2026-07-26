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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const templates = await getTemplates();
        // ID could be actual ID or slug
        const template = templates.find((t: any) => t.id === id || t.slug === id);
        
        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }
        
        return NextResponse.json(template);
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to read template' }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const templates = await getTemplates();
        
        const index = templates.findIndex((t: any) => t.id === id);
        if (index === -1) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }
        
        body.updatedAt = Date.now();
        templates[index] = { ...templates[index], ...body };

        await fs.writeFile(configPath, JSON.stringify(templates, null, 2), 'utf-8');
        
        return NextResponse.json({ success: true, data: templates[index] });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const templates = await getTemplates();
        
        const newTemplates = templates.filter((t: any) => t.id !== id);
        
        if (newTemplates.length === templates.length) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        await fs.writeFile(configPath, JSON.stringify(newTemplates, null, 2), 'utf-8');
        
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }
}

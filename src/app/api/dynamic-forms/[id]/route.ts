import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

// GET: Fetch a specific form by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const form = await prisma.dynamicForm.findUnique({
      where: { id }
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    return NextResponse.json(form);
  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json({ error: 'Failed to fetch form' }, { status: 500 });
  }
}

// PUT: Update a specific form
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, slug, config } = body;

    // Verify slug uniqueness if it changed
    if (slug) {
      const existing = await prisma.dynamicForm.findFirst({
        where: {
          slug,
          NOT: { id }
        }
      });
      if (existing) {
        return NextResponse.json({ error: 'Slug must be unique' }, { status: 400 });
      }
    }

    const updatedForm = await prisma.dynamicForm.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(slug && { slug }),
        ...(config && { config })
      }
    });

    return NextResponse.json(updatedForm);
  } catch (error) {
    console.error('Error updating form:', error);
    return NextResponse.json({ error: 'Failed to update form' }, { status: 500 });
  }
}

// DELETE: Delete a form and all its data/images
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // First, find the form to get its config
    const form = await prisma.dynamicForm.findUnique({
      where: { id },
      include: { data: true }
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Find which fields are image fields
    const config = form.config as any[];
    const imageFields = config ? config.filter(f => f.type === 'image').map(f => f.name) : [];

    // If there are image fields, extract all image URLs and delete files
    if (imageFields.length > 0 && form.data.length > 0) {
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'dynamic-forms');
      
      for (const row of form.data) {
        const data = row.data as any;
        for (const field of imageFields) {
          if (data[field] && typeof data[field] === 'string') {
            const urls = data[field].split(',').map((u: string) => u.trim()).filter(Boolean);
            for (const url of urls) {
              // Extract filename from URL (e.g. /htqlbenhvien/uploads/dynamic-forms/123.jpg -> 123.jpg)
              const match = url.match(/\/uploads\/dynamic-forms\/(.+)$/);
              if (match && match[1]) {
                const filename = match[1];
                const filePath = join(uploadDir, filename);
                try {
                  await unlink(filePath);
                } catch (e: any) {
                  // Ignore if file doesn't exist
                  if (e.code !== 'ENOENT') {
                    console.error(`Failed to delete image: ${filePath}`, e);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Due to onDelete: Cascade in prisma, deleting the form will also delete DynamicFormData
    await prisma.dynamicForm.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting form:', error);
    return NextResponse.json({ error: 'Failed to delete form' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Fetch all dynamic forms
export async function GET() {
  try {
    const forms = await prisma.dynamicForm.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { data: true }
        }
      }
    });
    return NextResponse.json(forms);
  } catch (error) {
    console.error('Error fetching forms:', error);
    return NextResponse.json({ error: 'Failed to fetch forms' }, { status: 500 });
  }
}

// POST: Create a new form
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, slug, config } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and Slug are required' }, { status: 400 });
    }

    // Check if slug already exists
    const existing = await prisma.dynamicForm.findUnique({
      where: { slug }
    });

    if (existing) {
      return NextResponse.json({ error: 'Slug must be unique' }, { status: 400 });
    }

    const form = await prisma.dynamicForm.create({
      data: {
        name,
        description,
        slug,
        config: config || []
      }
    });

    return NextResponse.json(form, { status: 201 });
  } catch (error) {
    console.error('Error creating form:', error);
    return NextResponse.json({ error: 'Failed to create form' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Fetch all data rows for a specific form (For Admin Grid View)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await prisma.dynamicFormData.findMany({
      where: { formId: id },
      orderBy: { createdAt: 'asc' }
    });
    
    return NextResponse.json(formData);
  } catch (error) {
    console.error('Error fetching form data:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

// POST: Add a new blank row or specific data (Admin only)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { data } = body;

    const newRow = await prisma.dynamicFormData.create({
      data: {
        formId: id,
        data: data || {},
      }
    });

    return NextResponse.json(newRow, { status: 201 });
  } catch (error) {
    console.error('Error adding form data row:', error);
    return NextResponse.json({ error: 'Failed to add row' }, { status: 500 });
  }
}

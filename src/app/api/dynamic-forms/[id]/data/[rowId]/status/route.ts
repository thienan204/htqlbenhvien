import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  try {
    const { rowId } = await params;
    const body = await request.json();
    const { isDone } = body;

    const updatedRow = await prisma.dynamicFormData.update({
      where: { id: rowId },
      data: { isDone },
    });

    return NextResponse.json({ success: true, row: updatedRow });
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: 'Failed to update status', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

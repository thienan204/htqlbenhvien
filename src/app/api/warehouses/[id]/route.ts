import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: params.id },
      include: {
        department: true,
        storekeeper: true
      }
    });

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    return NextResponse.json(warehouse);
  } catch (error) {
    console.error("Error fetching warehouse:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { code, name, department_id, warehouse_type, room, storekeeper_id, status } = body;

    const warehouse = await prisma.warehouse.update({
      where: { id: params.id },
      data: {
        code,
        name,
        department_id,
        warehouse_type,
        room,
        storekeeper_id,
        status
      }
    });

    return NextResponse.json(warehouse);
  } catch (error: any) {
    console.error("Error updating warehouse:", error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.warehouse.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ message: "Warehouse deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting warehouse:", error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

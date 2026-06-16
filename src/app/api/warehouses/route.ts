import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // Giả định đường dẫn tới thư viện prisma

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const department_id = searchParams.get('department_id');

    // Filter theo khoa phòng nếu có
    const whereClause = department_id ? { department_id } : {};

    const warehouses = await prisma.warehouse.findMany({
      where: whereClause,
      include: {
        department: true,
        storekeeper: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(warehouses);
  } catch (error) {
    console.error("Error fetching warehouses:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, department_id, warehouse_type, room, storekeeper_id, status } = body;

    const warehouse = await prisma.warehouse.create({
      data: {
        code,
        name,
        department_id,
        warehouse_type,
        room,
        storekeeper_id,
        status: status || "ACTIVE"
      }
    });

    return NextResponse.json(warehouse, { status: 201 });
  } catch (error: any) {
    console.error("Error creating warehouse:", error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Mã kho đã tồn tại" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

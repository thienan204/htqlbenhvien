import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const warehouse_id = searchParams.get('warehouse_id');
    const department_id = searchParams.get('department_id');
    const category_id = searchParams.get('category_id');
    const status = searchParams.get('status');

    // Xây dựng câu query linh hoạt
    const whereClause: any = {};
    if (warehouse_id) whereClause.warehouse_id = warehouse_id;
    if (category_id) whereClause.category_id = category_id;
    if (status) whereClause.status = status;
    
    // Lọc theo phòng ban nếu có yêu cầu (thông qua warehouse)
    if (department_id) {
      whereClause.warehouse = {
        department_id: department_id
      };
    }

    const equipments = await prisma.equipment.findMany({
      where: whereClause,
      include: {
        warehouse: {
          include: { department: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(equipments);
  } catch (error) {
    console.error("Error fetching equipments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      ma_vttb, 
      ten_vttb, 
      category_id, 
      warehouse_id, 
      status, 
      custom_fields,
      ...otherFields // Các trường còn lại như group_id, type_id, dongia...
    } = body;

    if (!ma_vttb || !ten_vttb || !warehouse_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Tự động sinh QR Code duy nhất (UUID)
    const qr_code = crypto.randomUUID();

    const equipment = await prisma.equipment.create({
      data: {
        ma_vttb,
        ten_vttb,
        qr_code,
        category_id,
        warehouse_id,
        status: status || "TRONG_KHO",
        custom_fields: custom_fields || {},
        ...otherFields
      }
    });

    return NextResponse.json(equipment, { status: 201 });
  } catch (error: any) {
    console.error("Error creating equipment:", error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Mã thiết bị hoặc QR Code đã tồn tại" }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

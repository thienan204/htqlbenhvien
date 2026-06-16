import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const warehouse_id = searchParams.get('warehouse_id');
    const search = searchParams.get('search'); // Tên thiết bị hoặc nhà cung cấp
    const reportType = searchParams.get('reportType') || 'summary'; // 'summary' or 'detail'

    const whereClause: any = {
      voucher: {
        type: 'NHAP_KHO',
        status: 'APPROVED'
      }
    };

    // Date filtering (by document_date)
    if (startDate || endDate) {
      whereClause.voucher.document_date = {};
      if (startDate) {
        whereClause.voucher.document_date.gte = new Date(startDate);
      }
      if (endDate) {
        // Cộng thêm 1 ngày để lấy hết ngày endDate
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        whereClause.voucher.document_date.lt = end;
      }
    }

    if (warehouse_id) {
      whereClause.voucher.to_warehouse_id = warehouse_id;
    }

    if (search) {
      whereClause.OR = [
        { ten_vttb: { contains: search, mode: 'insensitive' } },
        { voucher: { supplier_name: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (reportType === 'summary') {
      // Truy vấn từ InventoryVoucherDetail cho báo cáo tổng hợp
      const details = await prisma.inventoryVoucherDetail.findMany({
        where: whereClause,
        include: {
          voucher: {
            select: {
              voucher_code: true,
              document_date: true,
              supplier_name: true,
              to_warehouse: {
                select: { name: true }
              }
            }
          }
        },
        orderBy: {
          voucher: {
            document_date: 'desc'
          }
        }
      });

      const formattedData = details.map((d: any) => ({
        id: d.id,
        document_date: d.voucher?.document_date,
        voucher_code: d.voucher?.voucher_code,
        ten_vttb: d.ten_vttb,
        warehouse_name: d.voucher?.to_warehouse?.name || '',
        supplier_name: d.voucher?.supplier_name || '',
        quantity: d.quantity,
        dongia_vat: d.dongia_vat,
        thanh_tien: d.thanh_tien
      }));

      return NextResponse.json(formattedData);

    } else {
      // Truy vấn từ Equipment cho báo cáo chi tiết
      const equipments = await prisma.equipment.findMany({
        where: {
          voucher_id: { not: null },
          ...whereClause
        },
        include: {
          voucher: {
            select: {
              voucher_code: true,
              document_date: true,
              supplier_name: true,
              to_warehouse: {
                select: { name: true }
              }
            }
          }
        },
        orderBy: {
          voucher: {
            document_date: 'desc'
          }
        }
      });

      const formattedData = equipments.map((d: any) => ({
        id: d.id,
        document_date: d.voucher?.document_date,
        voucher_code: d.voucher?.voucher_code,
        ma_vttb: d.ma_vttb,
        ten_vttb: d.ten_vttb,
        serial: d.serial || '',
        warehouse_name: d.voucher?.to_warehouse?.name || '',
        supplier_name: d.voucher?.supplier_name || '',
        quantity: d.quantity,
        dongia_vat: d.dongia_vat,
        thanh_tien: (d.dongia_vat || 0) * (d.quantity || 1)
      }));

      return NextResponse.json(formattedData);
    }

  } catch (error) {
    console.error("Error fetching import report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

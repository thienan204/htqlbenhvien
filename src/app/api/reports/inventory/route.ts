import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: "Missing startDate or endDate" }, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);
    // Include the entire end date day
    endDate.setHours(23, 59, 59, 999);

    // Fetch all APPROVED vouchers
    const vouchers = await prisma.inventoryVoucher.findMany({
      where: {
        status: 'APPROVED',
      },
      include: {
        details: true
      }
    });

    // Grouping by ten_vttb (since ma_vttb can be auto-generated per item for THIET_BI)
    // We will aggregate by ten_vttb as the primary key for the report.
    const inventoryMap: Record<string, any> = {};

    vouchers.forEach(voucher => {
      const vDate = voucher.document_date ? new Date(voucher.document_date) : new Date(voucher.createdAt);
      
      const isBeforePeriod = vDate < startDate;
      const isDuringPeriod = vDate >= startDate && vDate <= endDate;

      voucher.details.forEach(detail => {
        const key = detail.ten_vttb || 'Unknown';
        if (!inventoryMap[key]) {
          inventoryMap[key] = {
            ten_vttb: key,
            ton_dau: 0,
            nhap_trong_ky: 0,
            xuat_trong_ky: 0,
            ton_cuoi: 0,
            don_vi: 'Cái', // Tạm mặc định, nếu có lấy từ SystemCategory
          };
        }

        const qty = detail.quantity || 1;

        if (voucher.type === 'NHAP_KHO') {
          if (isBeforePeriod) inventoryMap[key].ton_dau += qty;
          else if (isDuringPeriod) inventoryMap[key].nhap_trong_ky += qty;
        } else if (voucher.type === 'XUAT_KHO') {
          if (isBeforePeriod) inventoryMap[key].ton_dau -= qty;
          else if (isDuringPeriod) inventoryMap[key].xuat_trong_ky += qty;
        }
        // Xử lý LUAN_CHUYEN nếu tính tổng kho toàn BV thì Nhập và Xuất triệt tiêu nhau, không làm thay đổi tổng tồn BV.
        // Nếu làm theo Kho (warehouse_id), thì logic sẽ phải tính filter theo Kho.
        // Tạm thời báo cáo tổng hợp toàn viện.
      });
    });

    const reportData = Object.values(inventoryMap).map(item => {
      item.ton_cuoi = item.ton_dau + item.nhap_trong_ky - item.xuat_trong_ky;
      return item;
    });

    return NextResponse.json(reportData);
  } catch (error: any) {
    console.error("Error generating inventory report:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

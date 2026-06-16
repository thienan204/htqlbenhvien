import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix');

    if (!prefix) {
        return NextResponse.json({ error: 'Prefix is required' }, { status: 400 });
    }

    try {
        // Tìm thiết bị có mã bắt đầu bằng prefix, sắp xếp giảm dần để lấy mã lớn nhất
        const latestEquipment = await prisma.equipment.findFirst({
            where: {
                ma_vttb: {
                    startsWith: prefix,
                },
            },
            orderBy: {
                ma_vttb: 'desc',
            },
        });

        let nextNumber = 1;
        if (latestEquipment && latestEquipment.ma_vttb) {
            // Cắt phần chữ để lấy phần số ở cuối
            const currentCode = latestEquipment.ma_vttb;
            const numberPart = currentCode.slice(prefix.length); 
            const parsedNumber = parseInt(numberPart, 10);
            
            if (!isNaN(parsedNumber)) {
                nextNumber = parsedNumber + 1;
            }
        }

        // Format thành 4 chữ số (vd: 0001, 0002)
        const nextSequence = nextNumber.toString().padStart(4, '0');
        const nextCode = `${prefix}${nextSequence}`;

        return NextResponse.json({ nextCode });
    } catch (error) {
        console.error("Failed to generate next code", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

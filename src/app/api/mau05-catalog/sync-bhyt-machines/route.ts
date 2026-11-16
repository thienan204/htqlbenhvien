import { NextResponse } from 'next/server';
const { runImport } = require('@/../scripts/import_bhyt_machine_catalog');

export async function POST() {
    try {
        const result = await runImport();
        return NextResponse.json({
            success: true,
            message: 'Đồng bộ danh mục DVKT bắt buộc có mã máy từ Server thành công',
            data: result
        });
    } catch (error: any) {
        console.error('Lỗi khi đồng bộ danh mục DVKT bắt buộc có mã máy:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'Lỗi hệ thống'
        }, { status: 500 });
    }
}


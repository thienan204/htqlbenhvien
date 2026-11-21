import { buildAttendanceExcelBuffer } from '@/app/api/staff/attendance/export-excel/attendanceExcelBuilder';

export interface ExportedFileInfo {
    key: 'CHAM_CONG' | 'CHAM_TRUC' | 'SO_DOI_SOAT' | 'CHAM_THEM_GIO' | 'CHAM_DOC_HAI';
    fileName: string;
    title: string;
    buffer: Buffer;
    base64: string;
    mimeType: string;
}

/**
 * HÀM XUẤT TRỌN BỘ 5 FILE EXCEL CỦA THÁNG
 * Sử dụng chung 100% engine và quy chuẩn với nút "Xuất Excel" trên máy tính:
 * - Định dạng header, font chữ, kẻ bảng, công thức giống hệt file xuất máy tính.
 * - Tự động loại bỏ nhân sự đã nghỉ việc / chuyển công tác trước tháng (checkStaffAttendanceEligibility).
 * - Đảm bảo dữ liệu đồng bộ lên Google Drive giống hệt 100% file tải về máy.
 */
export async function generateAllAttendanceWorkbooks(
    monthYear: string,
    ma_khoa: string,
    creatorName: string = 'Người quản lý',
    fileNamingStyle: 'MONTHLY' | 'DAILY' = 'MONTHLY',
    targetDate?: string
): Promise<ExportedFileInfo[]> {
    const fileConfigs: Array<{
        key: 'CHAM_CONG' | 'CHAM_TRUC' | 'SO_DOI_SOAT' | 'CHAM_THEM_GIO' | 'CHAM_DOC_HAI';
        title: string;
    }> = [
        { key: 'CHAM_CONG', title: `Bảng Chấm Công Tháng ${monthYear}` },
        { key: 'CHAM_TRUC', title: `Bảng Chấm Trực Tháng ${monthYear}` },
        { key: 'SO_DOI_SOAT', title: `Sổ Đối Soát Nghỉ Bù Tháng ${monthYear}` },
        { key: 'CHAM_THEM_GIO', title: `Bảng Chấm Thêm Giờ Tháng ${monthYear}` },
        { key: 'CHAM_DOC_HAI', title: `Bảng Chấm Độc Hại Tháng ${monthYear}` }
    ];

    const results: ExportedFileInfo[] = [];

    for (const cfg of fileConfigs) {
        const { buffer, filename } = await buildAttendanceExcelBuffer({
            type: cfg.key,
            monthYear,
            ma_khoa,
            creatorName,
            fileNamingStyle,
            targetDate
        });

        results.push({
            key: cfg.key,
            fileName: filename,
            title: cfg.title,
            buffer,
            base64: buffer.toString('base64'),
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
    }

    return results;
}

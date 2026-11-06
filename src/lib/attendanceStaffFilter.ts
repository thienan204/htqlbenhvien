import dayjs from 'dayjs';

export interface StaffWorkingFilterInfo {
    shouldInclude: boolean; // Có hiển thị trên bảng chấm công tháng này không
    isResignedInMonth: boolean; // Có phải nghỉ / chuyển công tác trong tháng này không
    resignedDay?: number; // Ngày nghỉ trong tháng (ví dụ: ngày 15 thì từ ngày 15 không chấm công)
    resignedDateStr?: string; // Chuỗi ngày nghỉ YYYY-MM-DD
    resignedStatusName?: string; // Tên trạng thái (Đã nghỉ việc / Thuyên chuyển / Nghỉ hưu)
}

/**
 * Kiểm tra tính hợp lệ của nhân sự trên Bảng Chấm Công theo tháng
 * Quy tắc:
 * 1. Nghỉ trước tháng này -> Ẩn (trừ khi có dữ liệu công cũ)
 * 2. Nghỉ trong tháng này (VD: ngày 15) -> Vẫn hiển thị để chấm công trước ngày 15, từ ngày 15 khóa/không chấm
 * 3. Nghỉ sau tháng này -> Vẫn hiển thị và chấm công bình thường
 * 4. Trạng thái nghỉ việc/thuyên chuyển nhưng không có ngày cụ thể: nếu cả tháng không có công nào -> Ẩn
 */
export function checkStaffAttendanceEligibility(
    staff: any,
    year: number,
    month: number,
    hasRecordsInMonth: boolean = false
): StaffWorkingFilterInfo {
    const statusCode = (staff.trang_thai_ref?.code || '').toUpperCase();
    const statusName = staff.trang_thai_ref?.name || '';
    const isInactiveStatus = ['DA_NGHI_VIEC', 'NGHI_HUU', 'THUYEN_CHUYEN'].includes(statusCode) ||
        statusName.toLowerCase().includes('nghỉ việc') ||
        statusName.toLowerCase().includes('nghỉ hưu') ||
        statusName.toLowerCase().includes('thuyên chuyển') ||
        statusName.toLowerCase().includes('chuyển công tác');

    const daysInMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
    const startOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    if (staff.ngay_nghi_viec) {
        const resignedDate = dayjs(staff.ngay_nghi_viec).format('YYYY-MM-DD');

        // 1. Đã nghỉ/chuyển công tác TRƯỚC tháng đang xem
        if (resignedDate < startOfMonthStr) {
            return {
                shouldInclude: hasRecordsInMonth,
                isResignedInMonth: false,
                resignedDateStr: resignedDate,
                resignedStatusName: statusName || 'Đã nghỉ việc'
            };
        }

        // 2. Nghỉ/chuyển công tác TRONG tháng đang xem
        if (resignedDate >= startOfMonthStr && resignedDate <= endOfMonthStr) {
            const dayNum = parseInt(resignedDate.split('-')[2], 10);
            return {
                shouldInclude: true,
                isResignedInMonth: true,
                resignedDay: dayNum,
                resignedDateStr: resignedDate,
                resignedStatusName: statusName || (statusCode === 'THUYEN_CHUYEN' ? 'Chuyển công tác' : 'Nghỉ việc')
            };
        }

        // 3. Nghỉ SAU tháng đang xem
        return {
            shouldInclude: true,
            isResignedInMonth: false
        };
    }

    // Nếu không có ngày nghỉ việc cụ thể nhưng trạng thái là Đã nghỉ / Thuyên chuyển / Nghỉ hưu:
    if (isInactiveStatus) {
        return {
            shouldInclude: hasRecordsInMonth,
            isResignedInMonth: false,
            resignedStatusName: statusName || (statusCode === 'THUYEN_CHUYEN' ? 'Chuyển công tác' : 'Đã nghỉ việc')
        };
    }

    return {
        shouldInclude: true,
        isResignedInMonth: false
    };
}

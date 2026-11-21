import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { checkStaffAttendanceEligibility } from '@/lib/attendanceStaffFilter';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export function getSafeDeptName(ten_khoa?: string, ma_khoa?: string): string {
    const raw = ten_khoa || ma_khoa || 'KhoaPhong';
    return raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

export interface BuildAttendanceExcelOptions {
    type: string;
    monthYear: string;
    ma_khoa: string;
    creatorName?: string;
    startDate?: string;
    endDate?: string;
    fileNamingStyle?: 'MONTHLY' | 'DAILY';
    targetDate?: string;
}

export async function buildAttendanceExcelBuffer({
    type,
    monthYear,
    ma_khoa,
    creatorName = 'Người chấm công',
    startDate,
    endDate,
    fileNamingStyle = 'MONTHLY',
    targetDate
}: BuildAttendanceExcelOptions): Promise<{ buffer: Buffer; filename: string }> {
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

        // Lấy danh sách nhân viên phòng CNTT
        const staffList = await prisma.staff.findMany({
            where: { ma_khoa },
            include: {
                chuc_vu_ref: true,
                chuc_danh_ref: true,
                bac_luong_ref: true,
                he_so_luong_ref: true,
                trang_thai_ref: true
            },
            orderBy: { ma_nv: 'asc' }
        });

        // Lấy thông tin khoa phòng
        const department = await prisma.department.findUnique({
            where: { ma_khoa },
            select: { ten_khoa: true, ma_khoa: true }
        });
        const deptName = department?.ten_khoa ? department.ten_khoa.toUpperCase() : 'PHÒNG CÔNG NGHỆ THÔNG TIN';

        // Sắp xếp ưu tiên: Trưởng khoa/phòng, Phụ trách khoa -> Phó khoa/phòng -> Điều dưỡng trưởng -> Cán bộ
        staffList.sort((a, b) => {
            const getRank = (st: any) => {
                const cv = (st.chuc_vu_ref?.name || '').toLowerCase();
                if (cv.includes('trưởng phòng') || cv.includes('trưởng khoa') || cv.includes('phụ trách')) return 1;
                if (cv.includes('phó')) return 2;
                if (cv.includes('điều dưỡng trưởng') || cv.includes('kỹ thuật viên trưởng')) return 3;
                if (st.ho_ten.includes('Biên') || st.ho_ten.includes('Hướng')) return 1;
                return 4;
            };
            return getRank(a) - getRank(b);
        });

        // Tìm tên Trưởng khoa / Phụ trách khoa để ký
        const leaderStaff = staffList.find(st => {
            const cv = (st.chuc_vu_ref?.name || '').toLowerCase();
            return (cv.includes('trưởng phòng') || cv.includes('trưởng khoa') || cv.includes('phụ trách')) && !cv.includes('điều dưỡng');
        }) || staffList[0];
        const leaderName = leaderStaff?.ho_ten || '';

        const staffIds = staffList.map(s => s.id);
        const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Hệ Thống Quản Lý Bệnh Viện Đa Khoa Tỉnh Lạng Sơn';
        workbook.lastModifiedBy = creatorName;
        workbook.created = new Date();
        workbook.modified = new Date();

        const thinBorder: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        const nextMonth = month === 12 ? 1 : month + 1;
        const nextMonthYear = month === 12 ? year + 1 : year;
        const signDateStr = `Ngày 01 tháng ${String(nextMonth).padStart(2, '0')} năm ${nextMonthYear}`;

        // =========================================================================
        // TRƯỜNG HỢP 1: XUẤT BẢNG CHẤM CÔNG (Giống Bảng chấm công từ T6.2025.xlsx)
        // =========================================================================
        if (type === 'CHAM_CONG') {
            const sheet = workbook.addWorksheet(`T${month}`);
            sheet.views = [{ showGridLines: true }];

            // Lấy dữ liệu công
            const attendanceRecords = await prisma.staffAttendanceRecord.findMany({
                where: {
                    staffId: { in: staffIds },
                    workDate: { gte: startDateStr, lte: endDateStr }
                }
            });

            // Lấy ghi chú tháng của cán bộ
            const monthlyNotes = await prisma.staffMonthlyAttendanceNote.findMany({
                where: {
                    staffId: { in: staffIds },
                    monthYear
                }
            });
            const noteMap: Record<string, string> = {};
            monthlyNotes.forEach(mn => {
                noteMap[mn.staffId] = mn.note;
            });

            const attMap: Record<string, Record<number, any>> = {};
            attendanceRecords.forEach(att => {
                const day = parseInt(att.workDate.split('-')[2], 10);
                if (!attMap[att.staffId]) attMap[att.staffId] = {};
                attMap[att.staffId][day] = att;
            });

            // Tiêu đề
            sheet.getCell('A1').value = 'BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
            sheet.getCell('A1').font = { name: 'Times New Roman', size: 11, bold: true };

            sheet.getCell('A2').value = deptName;
            sheet.getCell('A2').font = { name: 'Times New Roman', size: 11, bold: true };

            sheet.mergeCells('A3:AK3');
            const cellTitle = sheet.getCell('A3');
            cellTitle.value = 'BẢNG CHẤM CÔNG';
            cellTitle.font = { name: 'Times New Roman', size: 16, bold: true };
            cellTitle.alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells('A4:AK4');
            const cellSubtitle = sheet.getCell('A4');
            cellSubtitle.value = `Tháng  ${month} năm ${year}`;
            cellSubtitle.font = { name: 'Times New Roman', size: 12, italic: true };
            cellSubtitle.alignment = { horizontal: 'center', vertical: 'middle' };

            // Header bảng
            sheet.mergeCells('A6:A7');
            sheet.getCell('A6').value = 'Số \r\nTT';
            sheet.getCell('A6').font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sheet.getCell('A6').border = thinBorder;
            sheet.getCell('A7').border = thinBorder;

            sheet.mergeCells('B6:B7');
            sheet.getCell('B6').value = 'Họ và Tên';
            sheet.getCell('B6').font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell('B6').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('B6').border = thinBorder;
            sheet.getCell('B7').border = thinBorder;

            sheet.mergeCells('C6:AG6');
            sheet.getCell('C6').value = 'Ngày trong tháng';
            sheet.getCell('C6').font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell('C6').alignment = { horizontal: 'center', vertical: 'middle' };
            for (let c = 3; c <= 33; c++) {
                sheet.getRow(6).getCell(c).border = thinBorder;
            }

            // Dòng ngày 1 đến 31 (Row 7)
            for (let d = 1; d <= 31; d++) {
                const cell = sheet.getRow(7).getCell(d + 2);
                cell.value = d;
                cell.font = { name: 'Times New Roman', size: 10, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = thinBorder;

                // Tô màu nhẹ cho Thứ Bảy / Chủ Nhật nếu ngày đó tồn tại trong tháng
                if (d <= daysInMonth) {
                    const dateObj = new Date(year, month - 1, d);
                    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF2F2F2' }
                        };
                    }
                }
            }

            sheet.mergeCells('AH6:AJ6');
            sheet.getCell('AH6').value = 'Quy ra công';
            sheet.getCell('AH6').font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell('AH6').alignment = { horizontal: 'center', vertical: 'middle' };
            for (let c = 34; c <= 36; c++) {
                sheet.getRow(6).getCell(c).border = thinBorder;
            }

            sheet.getCell('AH7').value = 'Số công hưởng lương thời gian';
            sheet.getCell('AH7').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('AH7').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sheet.getCell('AH7').border = thinBorder;

            sheet.getCell('AI7').value = 'Số công nghỉ không lương';
            sheet.getCell('AI7').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('AI7').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sheet.getCell('AI7').border = thinBorder;

            sheet.getCell('AJ7').value = 'Số công hưởng BHXH';
            sheet.getCell('AJ7').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('AJ7').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sheet.getCell('AJ7').border = thinBorder;

            // Dòng số thứ tự cột (Row 8)
            sheet.getCell('A8').value = 'A';
            sheet.getCell('B8').value = 'B';
            sheet.getCell('A8').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('B8').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('A8').border = thinBorder;
            sheet.getCell('B8').border = thinBorder;
            sheet.getCell('A8').font = { name: 'Times New Roman', size: 9 };
            sheet.getCell('B8').font = { name: 'Times New Roman', size: 9 };

            for (let d = 1; d <= 31; d++) {
                const cell = sheet.getRow(8).getCell(d + 2);
                cell.value = d;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.font = { name: 'Times New Roman', size: 9 };
                cell.border = thinBorder;
            }

            sheet.getCell('AH8').value = '32';
            sheet.getCell('AI8').value = '33';
            sheet.getCell('AJ8').value = '34';
            sheet.getCell('AH8').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AI8').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AJ8').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AH8').border = thinBorder;
            sheet.getCell('AI8').border = thinBorder;
            sheet.getCell('AJ8').border = thinBorder;
            sheet.getCell('AH8').font = { name: 'Times New Roman', size: 9 };
            sheet.getCell('AI8').font = { name: 'Times New Roman', size: 9 };
            sheet.getCell('AJ8').font = { name: 'Times New Roman', size: 9 };

            // Cột Ghi chú (Cột AK / 37)
            sheet.mergeCells('AK6:AK7');
            sheet.getCell('AK6').value = 'Ghi\r\nchú';
            sheet.getCell('AK6').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('AK6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sheet.getCell('AK6').border = thinBorder;
            sheet.getCell('AK7').border = thinBorder;

            sheet.getCell('AK8').value = '35';
            sheet.getCell('AK8').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AK8').border = thinBorder;
            sheet.getCell('AK8').font = { name: 'Times New Roman', size: 9 };

            // Lọc nhân sự hợp lệ theo trạng thái làm việc và mốc ngày chuyển công tác
            const eligibleStaffList = staffList.filter(st => {
                const hasAtt = Boolean(attMap && attMap[st.id] && Object.keys(attMap[st.id]).length > 0);
                return checkStaffAttendanceEligibility(st, year, month, hasAtt).shouldInclude;
            });

            // Đổ dữ liệu nhân sự (Row 9 trở đi)
            let currentRow = 9;
            eligibleStaffList.forEach((st, idx) => {
                const row = sheet.getRow(currentRow);
                row.getCell(1).value = idx + 1;
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(1).border = thinBorder;
                row.getCell(1).font = { name: 'Times New Roman', size: 11 };

                row.getCell(2).value = st.ho_ten;
                row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(2).border = thinBorder;
                row.getCell(2).font = { name: 'Times New Roman', size: 11, bold: idx === 0 };

                let luongThoiGian = 0;
                let nghiKhongLuong = 0;
                let huongBHXH = 0;

                const stAtt = attMap[st.id] || {};

                for (let d = 1; d <= 31; d++) {
                    const cell = row.getCell(d + 2);
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = thinBorder;
                    cell.font = { name: 'Times New Roman', size: 10 };

                    if (d <= daysInMonth) {
                        const dateObj = new Date(year, month - 1, d);
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                        if (isWeekend) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFF9F9F9' }
                            };
                        }

                        const att = stAtt[d];
                        if (att) {
                            const c = (att.code || '').trim();
                            const sec = (att.secondaryCode || '').trim();

                            // QUY TẮC PHƯƠNG ÁN 1: Ngày nghỉ không tính công hành chính ('+', 'x')
                            if (isWeekend && ['X', '+', 'X/2', '+/2'].includes(c.toUpperCase()) && !att.dutyRecordId) {
                                cell.value = '-';
                                continue;
                            }

                            if (c.toUpperCase() === 'NB/2' || (c.toUpperCase() === 'NB' && sec)) {
                                cell.value = 'Nb/2';
                                luongThoiGian += 1.0;
                            } else if (c.toUpperCase() === 'NB') {
                                cell.value = 'Nb';
                                luongThoiGian += (att.value || 1.0);
                            } else if (c.toUpperCase() === 'P/2') {
                                cell.value = 'P/2';
                                luongThoiGian += 1.0;
                            } else if (c.toUpperCase() === 'X/2' || c.toUpperCase() === '+/2') {
                                cell.value = c;
                                luongThoiGian += (att.value || 0.5);
                            } else if (c.toUpperCase() === 'X' || c === '+') {
                                cell.value = c;
                                luongThoiGian += (att.value || 1.0);
                            } else if (['P', 'L', 'H'].includes(c.toUpperCase())) {
                                cell.value = c;
                                luongThoiGian += (att.value || 1.0);
                            } else if (c.toUpperCase() === 'KL') {
                                cell.value = 'KL';
                                nghiKhongLuong += (att.value || 1.0);
                            } else if (['Ô', 'O', 'TS'].includes(c.toUpperCase())) {
                                cell.value = c;
                                huongBHXH += (att.value || 1.0);
                            } else {
                                cell.value = c;
                            }
                        }
                    }
                }

                // Cột quy ra công
                row.getCell(34).value = luongThoiGian > 0 ? luongThoiGian : '';
                row.getCell(34).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(34).border = thinBorder;
                row.getCell(34).font = { name: 'Times New Roman', size: 11, bold: true };

                row.getCell(35).value = nghiKhongLuong > 0 ? nghiKhongLuong : '';
                row.getCell(35).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(35).border = thinBorder;
                row.getCell(35).font = { name: 'Times New Roman', size: 11 };

                row.getCell(36).value = huongBHXH > 0 ? huongBHXH : '';
                row.getCell(36).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(36).border = thinBorder;
                row.getCell(36).font = { name: 'Times New Roman', size: 11 };

                // Cột Ghi chú (AK / 37)
                row.getCell(37).value = noteMap[st.id] || '';
                row.getCell(37).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(37).border = thinBorder;
                row.getCell(37).font = { name: 'Times New Roman', size: 10 };

                currentRow++;
            });

            // Dòng CỘNG
            const sumRow = sheet.getRow(currentRow);
            sumRow.getCell(2).value = 'CỘNG';
            sumRow.getCell(2).font = { name: 'Times New Roman', size: 11, bold: true };
            sumRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

            for (let c = 1; c <= 37; c++) {
                sumRow.getCell(c).border = thinBorder;
            }

            // Dùng công thức SUM cho 3 cột tổng kết
            const firstDataRow = 9;
            const lastDataRow = currentRow - 1;
            sumRow.getCell(34).value = { formula: `SUM(AH${firstDataRow}:AH${lastDataRow})` };
            sumRow.getCell(34).font = { name: 'Times New Roman', size: 11, bold: true };
            sumRow.getCell(34).alignment = { horizontal: 'center', vertical: 'middle' };

            sumRow.getCell(35).value = { formula: `SUM(AI${firstDataRow}:AI${lastDataRow})` };
            sumRow.getCell(35).font = { name: 'Times New Roman', size: 11, bold: true };
            sumRow.getCell(35).alignment = { horizontal: 'center', vertical: 'middle' };

            sumRow.getCell(36).value = { formula: `SUM(AJ${firstDataRow}:AJ${lastDataRow})` };
            sumRow.getCell(36).font = { name: 'Times New Roman', size: 11, bold: true };
            sumRow.getCell(36).alignment = { horizontal: 'center', vertical: 'middle' };

            currentRow += 2;

            // Ngày ký
            sheet.mergeCells(`AC${currentRow}:AJ${currentRow}`);
            const cellSignDate = sheet.getCell(`AC${currentRow}`);
            cellSignDate.value = signDateStr;
            cellSignDate.font = { name: 'Times New Roman', size: 11, italic: true };
            cellSignDate.alignment = { horizontal: 'center', vertical: 'middle' };

            currentRow++;

            // 4 Vị trí Chữ ký
            const signHeaderRow = currentRow;
            sheet.mergeCells(`A${signHeaderRow}:B${signHeaderRow}`);
            sheet.getCell(`A${signHeaderRow}`).value = 'Người chấm công';
            sheet.getCell(`A${signHeaderRow}`).font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell(`A${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`I${signHeaderRow}:M${signHeaderRow}`);
            sheet.getCell(`I${signHeaderRow}`).value = 'Phụ trách bộ phận';
            sheet.getCell(`I${signHeaderRow}`).font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell(`I${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`T${signHeaderRow}:X${signHeaderRow}`);
            sheet.getCell(`T${signHeaderRow}`).value = 'Phòng Tổ chức cán bộ';
            sheet.getCell(`T${signHeaderRow}`).font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell(`T${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`AD${signHeaderRow}:AI${signHeaderRow}`);
            sheet.getCell(`AD${signHeaderRow}`).value = 'Thủ trưởng đơn vị';
            sheet.getCell(`AD${signHeaderRow}`).font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell(`AD${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            // Tên người ký ở dưới
            const signNameRow = signHeaderRow + 6;
            sheet.mergeCells(`A${signNameRow}:B${signNameRow}`);
            sheet.getCell(`A${signNameRow}`).value = creatorName;
            sheet.getCell(`A${signNameRow}`).font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell(`A${signNameRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`I${signNameRow}:M${signNameRow}`);
            sheet.getCell(`I${signNameRow}`).value = leaderName;
            sheet.getCell(`I${signNameRow}`).font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell(`I${signNameRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            // Chỉnh độ rộng cột
            sheet.getColumn(1).width = 4.5;
            sheet.getColumn(2).width = 24;
            for (let c = 3; c <= 33; c++) {
                sheet.getColumn(c).width = 3.6;
            }
            sheet.getColumn(34).width = 11;
            sheet.getColumn(35).width = 9;
            sheet.getColumn(36).width = 9;
            sheet.getColumn(37).width = 16;

        } else if (type === 'CHAM_TRUC' || type === 'TRUC_KEM' || type === 'TRUC_THUONG_TRU') {
            // =========================================================================
            // TRƯỜNG HỢP 2: XUẤT BẢNG CHẤM TRỰC (Mẫu C01b - YT theo QĐ 144-BHYT/QĐ)
            // Hỗ trợ 3 bảng riêng biệt:
            // 1. CHAM_TRUC: Bảng chấm trực chính (T, C, L/Te)
            // 2. TRUC_KEM: Bảng chấm trực kèm (Tk)
            // 3. TRUC_THUONG_TRU: Bảng chấm trực thường trú (TT)
            // =========================================================================
            const isTrucKem = type === 'TRUC_KEM';
            const isThuongTru = type === 'TRUC_THUONG_TRU';
            const isTrucChinh = type === 'CHAM_TRUC';

            const sheetName = isTrucKem
                ? `Trực kèm T${month}`
                : isThuongTru
                ? `Thường trú T${month}`
                : `T${month},${year}`;

            const sheet = workbook.addWorksheet(sheetName);
            sheet.views = [{ showGridLines: true }];

            const dutyRecords = await prisma.staffDutyRecord.findMany({
                where: {
                    staffId: { in: staffIds },
                    dutyDate: { gte: startDateStr, lte: endDateStr }
                }
            });

            const dMap: Record<string, Record<number, any>> = {};
            dutyRecords.forEach(d => {
                const day = parseInt(d.dutyDate.split('-')[2], 10);
                if (!dMap[d.staffId]) dMap[d.staffId] = {};
                dMap[d.staffId][day] = d;
            });

            // Tiêu đề & Biểu mẫu QĐ 144
            const titleText = isTrucKem
                ? 'BẢNG CHẤM CÔNG TRỰC KÈM CHUYÊN MÔN Y TẾ ĐƯỢC HƯỞNG PHỤ CẤP'
                : isThuongTru
                ? 'BẢNG CHẤM CÔNG TRỰC THƯỜNG TRÚ CHUYÊN MÔN Y TẾ ĐƯỢC HƯỞNG PHỤ CẤP'
                : 'BẢNG CHẤM CÔNG THƯỜNG TRỰC CHUYÊN MÔN Y TẾ ĐƯỢC PHỤ CẤP';

            const partIText = isTrucKem
                ? 'PHẦN I - CHẤM CÔNG TRỰC KÈM'
                : isThuongTru
                ? 'PHẦN I - CHẤM CÔNG TRỰC THƯỜNG TRÚ'
                : 'PHẦN I - CHẤM CÔNG';

            sheet.getCell('A3').value = titleText;
            sheet.getCell('A3').font = { name: 'Times New Roman', size: 13, bold: true };

            sheet.getCell('C4').value = `Tháng  ${month} năm ${year}`;
            sheet.getCell('C4').font = { name: 'Times New Roman', size: 11, italic: true };

            sheet.getCell('AI4').value = 'Mẫu số C01b - YT';
            sheet.getCell('AI4').font = { name: 'Times New Roman', size: 9, bold: true };

            sheet.getCell('AG5').value = '(Ban hành theo QĐ 144-BHYT/QĐ';
            sheet.getCell('AG5').font = { name: 'Times New Roman', size: 9, italic: true };

            sheet.getCell('A6').value = 'BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
            sheet.getCell('A6').font = { name: 'Times New Roman', size: 10, bold: true };

            sheet.getCell('AI6').value = 'Ngày 31/07/1997)';
            sheet.getCell('AI6').font = { name: 'Times New Roman', size: 9, italic: true };

            sheet.getCell('A7').value = deptName;
            sheet.getCell('A7').font = { name: 'Times New Roman', size: 10, bold: true };

            sheet.getCell('I7').value = partIText;
            sheet.getCell('I7').font = { name: 'Times New Roman', size: 11, bold: true };

            // Header Bảng trực (Row 8 & 9)
            sheet.mergeCells('A8:A9');
            sheet.getCell('A8').value = 'Số  TT';
            sheet.getCell('A8').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('A8').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sheet.getCell('A8').border = thinBorder;
            sheet.getCell('A9').border = thinBorder;

            sheet.mergeCells('B8:B9');
            sheet.getCell('B8').value = 'HỌ VÀ TÊN';
            sheet.getCell('B8').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('B8').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('B8').border = thinBorder;
            sheet.getCell('B9').border = thinBorder;

            sheet.mergeCells('C8:C9');
            sheet.getCell('C8').value = 'Cộng bậc lương';
            sheet.getCell('C8').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('C8').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sheet.getCell('C8').border = thinBorder;
            sheet.getCell('C9').border = thinBorder;

            sheet.mergeCells('D8:AH8');
            sheet.getCell('D8').value = 'NGÀY TRONG THÁNG';
            sheet.getCell('D8').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('D8').alignment = { horizontal: 'center', vertical: 'middle' };
            for (let c = 4; c <= 34; c++) {
                sheet.getRow(8).getCell(c).border = thinBorder;
            }

            for (let d = 1; d <= 31; d++) {
                const cell = sheet.getRow(9).getCell(d + 3);
                cell.value = d;
                cell.font = { name: 'Times New Roman', size: 9, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = thinBorder;

                if (d <= daysInMonth) {
                    const dateObj = new Date(year, month - 1, d);
                    if (dateObj.getDay() === 0 || dateObj.getDay() === 6) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF2F2F2' }
                        };
                    }
                }
            }

            const lastCol = isTrucChinh ? 38 : 35;

            if (isTrucChinh) {
                sheet.mergeCells('AI8:AL8');
                sheet.getCell('AI8').value = 'CỘNG SỐ NGÀY TRỰC TRONG THÁNG';
                sheet.getCell('AI8').font = { name: 'Times New Roman', size: 9, bold: true };
                sheet.getCell('AI8').alignment = { horizontal: 'center', vertical: 'middle' };
                for (let c = 35; c <= 38; c++) {
                    sheet.getRow(8).getCell(c).border = thinBorder;
                }

                sheet.getCell('AI9').value = 'Ngày thường';
                sheet.getCell('AI9').font = { name: 'Times New Roman', size: 8, bold: true };
                sheet.getCell('AI9').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                sheet.getCell('AI9').border = thinBorder;

                sheet.getCell('AJ9').value = 'T7,CN';
                sheet.getCell('AJ9').font = { name: 'Times New Roman', size: 8, bold: true };
                sheet.getCell('AJ9').alignment = { horizontal: 'center', vertical: 'middle' };
                sheet.getCell('AJ9').border = thinBorder;

                sheet.getCell('AK9').value = 'Lễ tết';
                sheet.getCell('AK9').font = { name: 'Times New Roman', size: 8, bold: true };
                sheet.getCell('AK9').alignment = { horizontal: 'center', vertical: 'middle' };
                sheet.getCell('AK9').border = thinBorder;

                sheet.getCell('AL9').value = 'Tổng Số';
                sheet.getCell('AL9').font = { name: 'Times New Roman', size: 8, bold: true };
                sheet.getCell('AL9').alignment = { horizontal: 'center', vertical: 'middle' };
                sheet.getCell('AL9').border = thinBorder;
            } else if (isTrucKem) {
                sheet.mergeCells('AI8:AI9');
                sheet.getCell('AI8').value = 'Tổng Số\r\nTrực Kèm';
                sheet.getCell('AI8').font = { name: 'Times New Roman', size: 9, bold: true };
                sheet.getCell('AI8').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                sheet.getCell('AI8').border = thinBorder;
                sheet.getCell('AI9').border = thinBorder;
            } else {
                sheet.mergeCells('AI8:AI9');
                sheet.getCell('AI8').value = 'Tổng Số\r\nThường Trú';
                sheet.getCell('AI8').font = { name: 'Times New Roman', size: 9, bold: true };
                sheet.getCell('AI8').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                sheet.getCell('AI8').border = thinBorder;
                sheet.getCell('AI9').border = thinBorder;
            }

            // Lọc nhân sự hợp lệ (loại bỏ nhân sự đã nghỉ việc không có lịch trực)
            const eligibleDutyStaff = staffList.filter(st => {
                const hasDuty = Boolean(dMap && dMap[st.id] && Object.keys(dMap[st.id]).length > 0);
                return checkStaffAttendanceEligibility(st, year, month, hasDuty).shouldInclude;
            });

            // Đổ dữ liệu nhân sự (Row 10 trở đi)
            let currentRow = 10;
            eligibleDutyStaff.forEach((st, idx) => {
                const row = sheet.getRow(currentRow);
                row.getCell(1).value = idx + 1;
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(1).border = thinBorder;
                row.getCell(1).font = { name: 'Times New Roman', size: 10 };

                row.getCell(2).value = st.ho_ten;
                row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(2).border = thinBorder;
                row.getCell(2).font = { name: 'Times New Roman', size: 10, bold: idx === 0 };

                row.getCell(3).value = st.he_so_luong_ref?.name || '';
                row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(3).border = thinBorder;
                row.getCell(3).font = { name: 'Times New Roman', size: 10 };

                let dutyNgayThuong = 0;
                let dutyT7CN = 0;
                let dutyLeTet = 0;
                let dutyTrucKem = 0;
                let dutyThuongTru = 0;

                const stDuty = dMap[st.id] || {};

                for (let d = 1; d <= 31; d++) {
                    const cell = row.getCell(d + 3);
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = thinBorder;
                    cell.font = { name: 'Times New Roman', size: 10, bold: true };

                    if (d <= daysInMonth) {
                        const dateObj = new Date(year, month - 1, d);
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                        if (isWeekend) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFF9F9F9' }
                            };
                        }

                        const dt = stDuty[d];
                        if (dt) {
                            const c = (dt.dutyCode || '').trim().toUpperCase();
                            if (isTrucChinh) {
                                if (c === 'T') {
                                    cell.value = 'T';
                                    dutyNgayThuong++;
                                } else if (c === 'C') {
                                    cell.value = 'C';
                                    dutyT7CN++;
                                } else if (c === 'L' || c === 'TE') {
                                    cell.value = c === 'TE' ? 'Te' : 'L';
                                    dutyLeTet++;
                                }
                            } else if (isTrucKem) {
                                if (c === 'TK') {
                                    cell.value = 'Tk';
                                    dutyTrucKem++;
                                }
                            } else if (isThuongTru) {
                                if (c === 'TT') {
                                    cell.value = 'TT';
                                    dutyThuongTru++;
                                }
                            }
                        }
                    }
                }

                // Cột tổng kết
                if (isTrucChinh) {
                    row.getCell(35).value = dutyNgayThuong > 0 ? dutyNgayThuong : '';
                    row.getCell(35).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(35).border = thinBorder;
                    row.getCell(35).font = { name: 'Times New Roman', size: 10 };

                    row.getCell(36).value = dutyT7CN > 0 ? dutyT7CN : '';
                    row.getCell(36).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(36).border = thinBorder;
                    row.getCell(36).font = { name: 'Times New Roman', size: 10 };

                    row.getCell(37).value = dutyLeTet > 0 ? dutyLeTet : '';
                    row.getCell(37).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(37).border = thinBorder;
                    row.getCell(37).font = { name: 'Times New Roman', size: 10 };

                    const totalDuty = dutyNgayThuong + dutyT7CN + dutyLeTet;
                    row.getCell(38).value = totalDuty > 0 ? totalDuty : '';
                    row.getCell(38).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(38).border = thinBorder;
                    row.getCell(38).font = { name: 'Times New Roman', size: 10, bold: true };
                } else if (isTrucKem) {
                    row.getCell(35).value = dutyTrucKem > 0 ? dutyTrucKem : '';
                    row.getCell(35).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(35).border = thinBorder;
                    row.getCell(35).font = { name: 'Times New Roman', size: 10, bold: true };
                } else {
                    row.getCell(35).value = dutyThuongTru > 0 ? dutyThuongTru : '';
                    row.getCell(35).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(35).border = thinBorder;
                    row.getCell(35).font = { name: 'Times New Roman', size: 10, bold: true };
                }

                currentRow++;
            });

            // Dòng CỘNG
            const sumRow = sheet.getRow(currentRow);
            sumRow.getCell(2).value = 'CỘNG';
            sumRow.getCell(2).font = { name: 'Times New Roman', size: 10, bold: true };
            sumRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

            for (let c = 1; c <= lastCol; c++) {
                sumRow.getCell(c).border = thinBorder;
            }

            const firstRow = 10;
            const lastRow = currentRow - 1;

            if (isTrucChinh) {
                sumRow.getCell(35).value = { formula: `SUM(AI${firstRow}:AI${lastRow})` };
                sumRow.getCell(35).font = { name: 'Times New Roman', size: 10, bold: true };
                sumRow.getCell(35).alignment = { horizontal: 'center', vertical: 'middle' };

                sumRow.getCell(36).value = { formula: `SUM(AJ${firstRow}:AJ${lastRow})` };
                sumRow.getCell(36).font = { name: 'Times New Roman', size: 10, bold: true };
                sumRow.getCell(36).alignment = { horizontal: 'center', vertical: 'middle' };

                sumRow.getCell(37).value = { formula: `SUM(AK${firstRow}:AK${lastRow})` };
                sumRow.getCell(37).font = { name: 'Times New Roman', size: 10, bold: true };
                sumRow.getCell(37).alignment = { horizontal: 'center', vertical: 'middle' };

                sumRow.getCell(38).value = { formula: `SUM(AL${firstRow}:AL${lastRow})` };
                sumRow.getCell(38).font = { name: 'Times New Roman', size: 10, bold: true };
                sumRow.getCell(38).alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                sumRow.getCell(35).value = { formula: `SUM(AI${firstRow}:AI${lastRow})` };
                sumRow.getCell(35).font = { name: 'Times New Roman', size: 10, bold: true };
                sumRow.getCell(35).alignment = { horizontal: 'center', vertical: 'middle' };
            }

            currentRow += 2;

            // Bảng ghi chú các ký hiệu chấm công trực
            const noteText = isTrucKem
                ? 'Tk: Trực kèm chuyên môn kỹ thuật / học việc / hỗ trợ kíp trực'
                : isThuongTru
                ? 'TT: Trực thường trú chuyên môn y tế (On-call ngoại viện theo quy định)'
                : 'T: Trực thường | C: Trực T7, CN | L/Te: Trực lễ tết';
            sheet.getCell(`B${currentRow}`).value = noteText;
            sheet.getCell(`B${currentRow}`).font = { name: 'Times New Roman', size: 10, italic: true };

            currentRow += 2;

            // Dòng ngày ký
            const lastSignCol = isTrucChinh ? 'AL' : 'AI';
            const signDateRow = currentRow;
            sheet.mergeCells(`AC${signDateRow}:${lastSignCol}${signDateRow}`);
            sheet.getCell(`AC${signDateRow}`).value = `Lạng Sơn, ${signDateStr}`;
            sheet.getCell(`AC${signDateRow}`).font = { name: 'Times New Roman', size: 10, italic: true };
            sheet.getCell(`AC${signDateRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            currentRow++;

            // Tiêu đề chữ ký
            const signHeaderRow = currentRow;
            sheet.mergeCells(`B${signHeaderRow}:D${signHeaderRow}`);
            sheet.getCell(`B${signHeaderRow}`).value = 'Người chấm công';
            sheet.getCell(`B${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`B${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`I${signHeaderRow}:L${signHeaderRow}`);
            sheet.getCell(`I${signHeaderRow}`).value = 'Phụ trách bộ phận';
            sheet.getCell(`I${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`I${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`AC${signHeaderRow}:${lastSignCol}${signHeaderRow}`);
            sheet.getCell(`AC${signHeaderRow}`).value = 'Thủ trưởng đơn vị';
            sheet.getCell(`AC${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`AC${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            const signNameRow = signHeaderRow + 6;
            sheet.mergeCells(`B${signNameRow}:D${signNameRow}`);
            sheet.getCell(`B${signNameRow}`).value = creatorName;
            sheet.getCell(`B${signNameRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`B${signNameRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`I${signNameRow}:L${signNameRow}`);
            sheet.getCell(`I${signNameRow}`).value = leaderName;
            sheet.getCell(`I${signNameRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`I${signNameRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            // Chỉnh độ rộng cột
            sheet.getColumn(1).width = 4.5;
            sheet.getColumn(2).width = 24;
            sheet.getColumn(3).width = 8;
            for (let c = 4; c <= 34; c++) {
                sheet.getColumn(c).width = 3.6;
            }
            if (isTrucChinh) {
                sheet.getColumn(35).width = 9;
                sheet.getColumn(36).width = 8;
                sheet.getColumn(37).width = 8;
                sheet.getColumn(38).width = 9;
            } else {
                sheet.getColumn(35).width = 13;
            }

        } else if (type === 'CHAM_THEM_GIO') {
            const sheet = workbook.addWorksheet('Thêm giờ');
            sheet.views = [{ showGridLines: true }];

            // Lấy dữ liệu làm thêm giờ
            const overtimeRecords = await prisma.staffOvertimeRecord.findMany({
                where: {
                    staffId: { in: staffIds },
                    workDate: { gte: startDateStr, lte: endDateStr }
                }
            });

            const otMap: Record<string, Record<number, any>> = {};
            overtimeRecords.forEach(ot => {
                const day = parseInt(ot.workDate.split('-')[2], 10);
                if (!otMap[ot.staffId]) {
                    otMap[ot.staffId] = {};
                }
                otMap[ot.staffId][day] = ot;
            });

            // Tiêu đề đơn vị
            sheet.getCell('A1').value = 'ĐƠN VỊ: BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
            sheet.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };

            sheet.getCell('A2').value = `BỘ PHẬN: ${deptName}`;
            sheet.getCell('A2').font = { name: 'Times New Roman', size: 10, bold: true };

            sheet.getCell('A3').value = 'Mã QHNS:';
            sheet.getCell('A3').font = { name: 'Times New Roman', size: 10 };

            // Tiêu đề chính
            sheet.mergeCells('A4:AK4');
            sheet.getCell('A4').value = 'BẢNG CHẤM CÔNG LÀM THÊM GiỜ';
            sheet.getCell('A4').font = { name: 'Times New Roman', size: 15, bold: true };
            sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells('A5:AK5');
            sheet.getCell('A5').value = `Tháng ${month} năm ${year}`;
            sheet.getCell('A5').font = { name: 'Times New Roman', size: 11, italic: true };
            sheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };

            // Header bảng
            // Merge A6:A8 (Số TT), B6:B8 (Họ và tên), C6:C8 (Cấp bậc lương)
            sheet.mergeCells('A6:A8');
            sheet.getCell('A6').value = 'Số TT';
            sheet.getCell('A6').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

            sheet.mergeCells('B6:B8');
            sheet.getCell('B6').value = 'Họ và tên';
            sheet.getCell('B6').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('B6').alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells('C6:C8');
            sheet.getCell('C6').value = 'Cấp\n bậc lương';
            sheet.getCell('C6').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('C6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

            // Merge D6:AH6: "Ngày trong tháng"
            sheet.mergeCells('D6:AH6');
            sheet.getCell('D6').value = 'Ngày trong tháng';
            sheet.getCell('D6').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('D6').alignment = { horizontal: 'center', vertical: 'middle' };

            // Merge AI6:AI8, AJ6:AJ8, AK6:AK8
            sheet.mergeCells('AI6:AI8');
            sheet.getCell('AI6').value = 'Tổng ngày';
            sheet.getCell('AI6').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('AI6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

            sheet.mergeCells('AJ6:AJ8');
            sheet.getCell('AJ6').value = 'Tổng đêm';
            sheet.getCell('AJ6').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('AJ6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

            sheet.mergeCells('AK6:AK8');
            sheet.getCell('AK6').value = 'Tổng cộng';
            sheet.getCell('AK6').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('AK6').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

            const dayNames = ['CN', 'T.hai', 'T.ba', 'T.tư', 'T.năm', 'T.sáu', 'T7'];
            const weekendFill: ExcelJS.Fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF2CC' } // Màu vàng nhạt giống mẫu của Viện
            };

            for (let d = 1; d <= 31; d++) {
                const colIndex = 3 + d; // Cột 4 là D (ngày 1)
                const date = new Date(year, month - 1, d);
                const isValidDay = d <= daysInMonth;
                const dayOfWeek = isValidDay ? date.getDay() : -1;
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                // Dòng 7: Số ngày 1..31
                const cellD7 = sheet.getRow(7).getCell(colIndex);
                cellD7.value = d;
                cellD7.font = { name: 'Times New Roman', size: 9, bold: true };
                cellD7.alignment = { horizontal: 'center', vertical: 'middle' };

                // Dòng 8: Tên thứ (T.hai, T.ba... T7, CN)
                const cellD8 = sheet.getRow(8).getCell(colIndex);
                cellD8.value = isValidDay ? dayNames[dayOfWeek] : '';
                cellD8.font = { name: 'Times New Roman', size: 8, bold: isWeekend };
                cellD8.alignment = { horizontal: 'center', vertical: 'middle' };

                if (isWeekend) {
                    cellD7.fill = weekendFill;
                    cellD8.fill = weekendFill;
                }
            }

            // Dòng 9: Ký hiệu chỉ số (A, B, C, 1, 2, 3...)
            sheet.getCell('A9').value = 'A';
            sheet.getCell('B9').value = 'B';
            sheet.getCell('C9').value = 'C';
            sheet.getCell('A9').font = { name: 'Times New Roman', size: 9, italic: true };
            sheet.getCell('B9').font = { name: 'Times New Roman', size: 9, italic: true };
            sheet.getCell('C9').font = { name: 'Times New Roman', size: 9, italic: true };
            sheet.getCell('A9').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('B9').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('C9').alignment = { horizontal: 'center', vertical: 'middle' };

            for (let d = 1; d <= 31; d++) {
                const cellD9 = sheet.getRow(9).getCell(3 + d);
                cellD9.value = d;
                cellD9.font = { name: 'Times New Roman', size: 8, italic: true };
                cellD9.alignment = { horizontal: 'center', vertical: 'middle' };

                const date = new Date(year, month - 1, d);
                const isValidDay = d <= daysInMonth;
                const isWeekend = isValidDay && (date.getDay() === 0 || date.getDay() === 6);
                if (isWeekend) {
                    cellD9.fill = weekendFill;
                }
            }
            sheet.getCell('AI9').value = '1';
            sheet.getCell('AJ9').value = '2';
            sheet.getCell('AK9').value = '3';
            sheet.getCell('AI9').font = { name: 'Times New Roman', size: 8, italic: true };
            sheet.getCell('AJ9').font = { name: 'Times New Roman', size: 8, italic: true };
            sheet.getCell('AK9').font = { name: 'Times New Roman', size: 8, italic: true };
            sheet.getCell('AI9').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AJ9').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AK9').alignment = { horizontal: 'center', vertical: 'middle' };

            // Kẻ viền cho toàn bộ header từ Row 6 đến Row 9
            for (let r = 6; r <= 9; r++) {
                const row = sheet.getRow(r);
                row.height = 18;
                for (let c = 1; c <= 37; c++) {
                    const cell = row.getCell(c);
                    cell.border = thinBorder;
                }
            }

            // Lọc nhân sự hợp lệ
            const eligibleOtStaff = staffList.filter(st => {
                const hasOt = Boolean(otMap && otMap[st.id] && Object.keys(otMap[st.id]).length > 0);
                return checkStaffAttendanceEligibility(st, year, month, hasOt).shouldInclude;
            });

            // Điền dữ liệu cán bộ
            let currentRow = 10;
            let totalDeptDayHours = 0;
            let totalDeptNightHours = 0;
            let totalDeptOvertimeHours = 0;

            eligibleOtStaff.forEach((st, idx) => {
                const row = sheet.getRow(currentRow);
                row.height = 20;

                row.getCell(1).value = idx + 1;
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(1).font = { name: 'Times New Roman', size: 10 };

                row.getCell(2).value = st.ho_ten;
                row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(2).font = { name: 'Times New Roman', size: 10, bold: true };

                const capBac = st.bac_luong_ref?.name || st.chuc_danh_ref?.name || st.chuc_vu_ref?.name || '';
                row.getCell(3).value = capBac;
                row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(3).font = { name: 'Times New Roman', size: 9 };

                let staffDayHours = 0;
                let staffNightHours = 0;
                let staffTotalHours = 0;

                for (let d = 1; d <= 31; d++) {
                    const colIndex = 3 + d;
                    const cell = row.getCell(colIndex);
                    const date = new Date(year, month - 1, d);
                    const isValidDay = d <= daysInMonth;
                    const isWeekend = isValidDay && (date.getDay() === 0 || date.getDay() === 6);

                    if (isWeekend) {
                        cell.fill = weekendFill;
                    }

                    if (isValidDay) {
                        const ot = otMap[st.id]?.[d];
                        if (ot && ot.totalHours > 0) {
                            cell.value = ot.totalHours;
                            cell.font = { name: 'Times New Roman', size: 9.5, bold: true };
                            cell.alignment = { horizontal: 'center', vertical: 'middle' };

                            staffDayHours += Number(ot.dayHours) || 0;
                            staffNightHours += Number(ot.nightHours) || 0;
                            staffTotalHours += Number(ot.totalHours) || 0;
                        } else {
                            cell.value = '';
                        }
                    } else {
                        cell.value = '';
                    }
                }

                // Cột Tổng ngày, Tổng đêm, Tổng cộng
                row.getCell(35).value = staffDayHours > 0 ? staffDayHours : '';
                row.getCell(35).font = { name: 'Times New Roman', size: 10, bold: true };
                row.getCell(35).alignment = { horizontal: 'center', vertical: 'middle' };

                row.getCell(36).value = staffNightHours > 0 ? staffNightHours : '';
                row.getCell(36).font = { name: 'Times New Roman', size: 10, bold: true };
                row.getCell(36).alignment = { horizontal: 'center', vertical: 'middle' };

                row.getCell(37).value = staffTotalHours > 0 ? staffTotalHours : '';
                row.getCell(37).font = { name: 'Times New Roman', size: 10, bold: true };
                row.getCell(37).alignment = { horizontal: 'center', vertical: 'middle' };

                totalDeptDayHours += staffDayHours;
                totalDeptNightHours += staffNightHours;
                totalDeptOvertimeHours += staffTotalHours;

                for (let c = 1; c <= 37; c++) {
                    row.getCell(c).border = thinBorder;
                }

                currentRow++;
            });

            // Dòng Tổng cộng toàn đơn vị (giống dòng AI22, AJ22, AK22 trong file mẫu)
            const sumRow = sheet.getRow(currentRow);
            sumRow.height = 22;
            sheet.mergeCells(`A${currentRow}:C${currentRow}`);
            sumRow.getCell(1).value = 'Tổng cộng';
            sumRow.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
            sumRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

            for (let d = 1; d <= 31; d++) {
                const cell = sumRow.getCell(3 + d);
                cell.value = '';
                const date = new Date(year, month - 1, d);
                if (d <= daysInMonth && (date.getDay() === 0 || date.getDay() === 6)) {
                    cell.fill = weekendFill;
                }
            }

            sumRow.getCell(35).value = totalDeptDayHours;
            sumRow.getCell(35).font = { name: 'Times New Roman', size: 10, bold: true };
            sumRow.getCell(35).alignment = { horizontal: 'center', vertical: 'middle' };

            sumRow.getCell(36).value = totalDeptNightHours;
            sumRow.getCell(36).font = { name: 'Times New Roman', size: 10, bold: true };
            sumRow.getCell(36).alignment = { horizontal: 'center', vertical: 'middle' };

            sumRow.getCell(37).value = totalDeptOvertimeHours;
            sumRow.getCell(37).font = { name: 'Times New Roman', size: 10, bold: true };
            sumRow.getCell(37).alignment = { horizontal: 'center', vertical: 'middle' };

            for (let c = 1; c <= 37; c++) {
                sumRow.getCell(c).border = thinBorder;
            }

            currentRow += 2;

            // Ngày ký
            const signDateRow = currentRow;
            sheet.mergeCells(`AC${signDateRow}:AK${signDateRow}`);
            sheet.getCell(`AC${signDateRow}`).value = `Lạng Sơn, ${signDateStr}`;
            sheet.getCell(`AC${signDateRow}`).font = { name: 'Times New Roman', size: 10, italic: true };
            sheet.getCell(`AC${signDateRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            currentRow++;

            // Tiêu đề 3 chữ ký chân trang (Người chấm công, Phụ trách bộ phận, Thủ trưởng đơn vị)
            const signHeaderRow = currentRow;
            sheet.mergeCells(`A${signHeaderRow}:D${signHeaderRow}`);
            sheet.getCell(`A${signHeaderRow}`).value = 'Người chấm công';
            sheet.getCell(`A${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`A${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`I${signHeaderRow}:L${signHeaderRow}`);
            sheet.getCell(`I${signHeaderRow}`).value = 'Phụ trách bộ phận';
            sheet.getCell(`I${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`I${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`AC${signHeaderRow}:AK${signHeaderRow}`);
            sheet.getCell(`AC${signHeaderRow}`).value = 'Thủ trưởng đơn vị';
            sheet.getCell(`AC${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`AC${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            // Tên người ký
            const signNameRow = signHeaderRow + 5;
            sheet.mergeCells(`A${signNameRow}:D${signNameRow}`);
            sheet.getCell(`A${signNameRow}`).value = creatorName.toUpperCase();
            sheet.getCell(`A${signNameRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`A${signNameRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`I${signNameRow}:L${signNameRow}`);
            sheet.getCell(`I${signNameRow}`).value = leaderName.toUpperCase();
            sheet.getCell(`I${signNameRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`I${signNameRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            // Cột rộng chuẩn theo mẫu
            sheet.getColumn(1).width = 4.5; // STT
            sheet.getColumn(2).width = 22;  // Họ và tên
            sheet.getColumn(3).width = 8;   // Cấp bậc
            for (let c = 4; c <= 34; c++) {
                sheet.getColumn(c).width = 3.6; // Ngày 1..31
            }
            sheet.getColumn(35).width = 7.5; // Tổng ngày
            sheet.getColumn(36).width = 7.5; // Tổng đêm
            sheet.getColumn(37).width = 8.5; // Tổng cộng
        }

        // =========================================================================
        // TRƯỜNG HỢP 5: XUẤT BẢNG CHẤM CÔNG BỒI DƯỠNG BẰNG HIỆN VẬT (ĐỘC HẠI)
        // Chuẩn theo sheet "ĐỘC HẠI" trong file Copy of THÁNG 9.xls
        // =========================================================================
        if (type === 'CHAM_DOC_HAI') {
            const sheet = workbook.addWorksheet('ĐỘC HẠI');
            sheet.views = [{ showGridLines: true }];

            // Lấy dữ liệu chấm độc hại
            const hazardRecords = await prisma.staffHazardRecord.findMany({
                where: {
                    staffId: { in: staffIds },
                    workDate: { gte: startDateStr, lte: endDateStr }
                }
            });

            const hMap: Record<string, Record<number, any>> = {};
            hazardRecords.forEach(h => {
                const day = parseInt(h.workDate.split('-')[2], 10);
                if (!hMap[h.staffId]) hMap[h.staffId] = {};
                hMap[h.staffId][day] = h;
            });

            // Dòng 1: Tên đơn vị
            sheet.getCell('A1').value = 'BVĐK TỈNH LẠNG SƠN';
            sheet.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };

            // Dòng 2: Khoa phòng
            sheet.getCell('A2').value = `KHOA : ${deptName.toUpperCase()}`;
            sheet.getCell('A2').font = { name: 'Times New Roman', size: 10, bold: true };

            // Dòng 3: Tiêu đề bảng (Merge A3:AL3)
            sheet.mergeCells('A3:AL3');
            sheet.getCell('A3').value = 'BẢNG CHẤM CÔNG HƯỞNG CHẾ ĐỘ BỒI DƯỠNG BẰNG HIỆN VẬT';
            sheet.getCell('A3').font = { name: 'Times New Roman', size: 12, bold: true };
            sheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };

            // Dòng 4: Tháng năm (Merge A4:AL4)
            sheet.mergeCells('A4:AL4');
            sheet.getCell('A4').value = `Tháng ${month} năm ${year}`;
            sheet.getCell('A4').font = { name: 'Times New Roman', size: 11, bold: true };
            sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

            // Dòng 5 & 6: Header
            // Stt (Merge A5:A6)
            sheet.mergeCells('A5:A6');
            sheet.getCell('A5').value = 'Stt';
            sheet.getCell('A5').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('A5').border = thinBorder;
            sheet.getCell('A6').border = thinBorder;

            // Họ và tên (Merge B5:B6)
            sheet.mergeCells('B5:B6');
            sheet.getCell('B5').value = 'Họ và tên';
            sheet.getCell('B5').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('B5').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('B5').border = thinBorder;
            sheet.getCell('B6').border = thinBorder;

            // Chức vụ / VTVL (Merge C5:C6)
            sheet.mergeCells('C5:C6');
            sheet.getCell('C5').value = 'Chức vụ\n/VTVL';
            sheet.getCell('C5').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('C5').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sheet.getCell('C5').border = thinBorder;
            sheet.getCell('C6').border = thinBorder;

            // Ngày trong tháng (Merge D5:AH5)
            sheet.mergeCells('D5:AH5');
            sheet.getCell('D5').value = 'Ngày trong tháng';
            sheet.getCell('D5').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('D5').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('D5').border = thinBorder;

            // Ngày 1..31 (Dòng 6, cột D..AH)
            const weekendFill: ExcelJS.Fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFF2CC' } // Vàng nhạt giống mẫu Excel gốc
            };

            for (let d = 1; d <= 31; d++) {
                const colIdx = d + 3; // D là col 4
                const cell = sheet.getRow(6).getCell(colIdx);
                cell.value = d;
                cell.font = { name: 'Times New Roman', size: 9, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = thinBorder;

                if (d <= daysInMonth) {
                    const dateObj = new Date(year, month - 1, d);
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                    if (isWeekend) {
                        cell.fill = weekendFill;
                    }
                }
            }

            // Tổng số ngày được hưởng (Merge AI5:AL5)
            sheet.mergeCells('AI5:AL5');
            sheet.getCell('AI5').value = 'Tổng số ngày được hưởng';
            sheet.getCell('AI5').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('AI5').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AI5').border = thinBorder;

            // 4 mức đơn giá tại dòng 6: 13.000, 20.000, 26.000, 32.000
            const rates = [13000, 20000, 26000, 32000];
            const rateCols = ['AI', 'AJ', 'AK', 'AL'];
            rateCols.forEach((col, idx) => {
                const c = sheet.getCell(`${col}6`);
                c.value = rates[idx];
                c.font = { name: 'Times New Roman', size: 9, bold: true };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.numFmt = '#,##0';
                c.border = thinBorder;
            });

            // Tổng tiền (Merge AM5:AM6)
            sheet.mergeCells('AM5:AM6');
            sheet.getCell('AM5').value = 'Tổng tiền';
            sheet.getCell('AM5').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('AM5').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AM5').border = thinBorder;
            sheet.getCell('AM6').border = thinBorder;

            // Ký nhận (Merge AN5:AN6)
            sheet.mergeCells('AN5:AN6');
            sheet.getCell('AN5').value = 'Ký\n nhận';
            sheet.getCell('AN5').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('AN5').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            sheet.getCell('AN5').border = thinBorder;
            sheet.getCell('AN6').border = thinBorder;

            // Lọc nhân sự hợp lệ
            const eligibleHazStaff = staffList.filter(st => {
                const hasHaz = Boolean(hMap && hMap[st.id] && Object.keys(hMap[st.id]).length > 0);
                return checkStaffAttendanceEligibility(st, year, month, hasHaz).shouldInclude;
            });

            // Điền dữ liệu từng cán bộ
            let rowIdx = 7;
            const startStaffRow = 7;

            eligibleHazStaff.forEach((st, idx) => {
                const row = sheet.getRow(rowIdx);
                row.height = 20;

                row.getCell(1).value = idx + 1; // STT
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(1).border = thinBorder;
                row.getCell(1).font = { name: 'Times New Roman', size: 10 };

                row.getCell(2).value = st.ho_ten; // Họ tên
                row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(2).border = thinBorder;
                row.getCell(2).font = { name: 'Times New Roman', size: 10, bold: idx === 0 };

                row.getCell(3).value = st.chuc_vu_ref?.name || ''; // Chức vụ
                row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(3).border = thinBorder;
                row.getCell(3).font = { name: 'Times New Roman', size: 9 };

                const staffHazards = hMap[st.id] || {};
                let countX = 0;
                let countI = 0;
                let appliedRate = 20000;

                for (let d = 1; d <= 31; d++) {
                    const cell = row.getCell(d + 3);
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = thinBorder;
                    cell.font = { name: 'Times New Roman', size: 10, bold: true };

                    if (d <= daysInMonth) {
                        const dateObj = new Date(year, month - 1, d);
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                        if (isWeekend) {
                            cell.fill = weekendFill;
                        }

                        const rec = staffHazards[d];
                        if (rec && rec.code) {
                            cell.value = rec.code;
                            if (rec.code === 'X') countX++;
                            else if (rec.code === 'I') countI++;
                            if (rec.allowanceRate) appliedRate = rec.allowanceRate;
                        }
                    }
                }

                const totalStaffDays = countX * 1.0 + countI * 0.5;

                // Cột ngày hưởng (AI = M1, AJ = M2, AK = M3, AL = M4)
                rateCols.forEach((col, cIdx) => {
                    const cell = sheet.getCell(`${col}${rowIdx}`);
                    cell.border = thinBorder;
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.font = { name: 'Times New Roman', size: 10 };
                    cell.numFmt = '0.0';

                    if (rates[cIdx] === appliedRate && totalStaffDays > 0) {
                        cell.value = totalStaffDays;
                    }
                });

                // Cột Tổng tiền (AM)
                const moneyCell = sheet.getCell(`AM${rowIdx}`);
                moneyCell.border = thinBorder;
                moneyCell.alignment = { horizontal: 'right', vertical: 'middle' };
                moneyCell.font = { name: 'Times New Roman', size: 10, bold: true };
                moneyCell.numFmt = '#,##0';
                moneyCell.value = totalStaffDays * appliedRate;

                // Cột Ký nhận (AN)
                const signCell = sheet.getCell(`AN${rowIdx}`);
                signCell.border = thinBorder;

                rowIdx++;
            });

            const endStaffRow = rowIdx - 1;

            // Dòng Tổng cộng
            const totalRow = sheet.getRow(rowIdx);
            totalRow.height = 22;
            sheet.mergeCells(`A${rowIdx}:C${rowIdx}`);
            const totalLabelCell = totalRow.getCell(1);
            totalLabelCell.value = ' Tổng cộng:';
            totalLabelCell.font = { name: 'Times New Roman', size: 10, bold: true };
            totalLabelCell.alignment = { horizontal: 'left', vertical: 'middle' };
            totalLabelCell.border = thinBorder;
            totalRow.getCell(2).border = thinBorder;
            totalRow.getCell(3).border = thinBorder;

            for (let d = 1; d <= 31; d++) {
                const c = totalRow.getCell(d + 3);
                c.border = thinBorder;
            }

            rateCols.forEach((col) => {
                const c = sheet.getCell(`${col}${rowIdx}`);
                c.border = thinBorder;
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                c.font = { name: 'Times New Roman', size: 10, bold: true };
                c.numFmt = '0.0';
                c.value = {
                    formula: `SUM(${col}${startStaffRow}:${col}${endStaffRow})`
                };
            });

            const grandMoneyCell = sheet.getCell(`AM${rowIdx}`);
            grandMoneyCell.border = thinBorder;
            grandMoneyCell.alignment = { horizontal: 'right', vertical: 'middle' };
            grandMoneyCell.font = { name: 'Times New Roman', size: 10, bold: true };
            grandMoneyCell.numFmt = '#,##0';
            grandMoneyCell.value = {
                formula: `SUM(AM${startStaffRow}:AM${endStaffRow})`
            };

            const grandSignCell = sheet.getCell(`AN${rowIdx}`);
            grandSignCell.border = thinBorder;

            rowIdx += 2;

            // Chú thích ký hiệu chấm
            sheet.getCell(`A${rowIdx}`).value = 'Ký hiệu chấm :';
            sheet.getCell(`A${rowIdx}`).font = { name: 'Times New Roman', size: 10, italic: true };
            sheet.getCell(`C${rowIdx}`).value = 'Làm từ 4h trở lên/ngày         X';
            sheet.getCell(`C${rowIdx}`).font = { name: 'Times New Roman', size: 10 };
            rowIdx++;

            sheet.getCell(`C${rowIdx}`).value = 'Làm dưới 4/ngày                   I';
            sheet.getCell(`C${rowIdx}`).font = { name: 'Times New Roman', size: 10 };
            rowIdx++;

            sheet.getCell(`C${rowIdx}`).value = 'Ngày nào không có thì bỏ trống';
            sheet.getCell(`C${rowIdx}`).font = { name: 'Times New Roman', size: 10, italic: true };
            rowIdx += 2;

            // 3 chữ ký chân trang: NGƯỜI CHẤM, PHỤ TRÁCH KHOA PHÒNG, THỦ TRƯỞNG ĐƠN VỊ
            sheet.mergeCells(`A${rowIdx}:F${rowIdx}`);
            sheet.getCell(`A${rowIdx}`).value = 'NGƯỜI CHẤM';
            sheet.getCell(`A${rowIdx}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`A${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`N${rowIdx}:V${rowIdx}`);
            sheet.getCell(`N${rowIdx}`).value = 'PHỤ TRÁCH KHOA PHÒNG';
            sheet.getCell(`N${rowIdx}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`N${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`AC${rowIdx}:AL${rowIdx}`);
            sheet.getCell(`AC${rowIdx}`).value = 'THỦ TRƯỞNG ĐƠN VỊ';
            sheet.getCell(`AC${rowIdx}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`AC${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

            rowIdx += 5;

            // Tên người ký
            sheet.mergeCells(`A${rowIdx}:F${rowIdx}`);
            sheet.getCell(`A${rowIdx}`).value = creatorName.toUpperCase();
            sheet.getCell(`A${rowIdx}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`A${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`N${rowIdx}:V${rowIdx}`);
            sheet.getCell(`N${rowIdx}`).value = leaderName.toUpperCase();
            sheet.getCell(`N${rowIdx}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`N${rowIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

            // Cột rộng chuẩn theo mẫu
            sheet.getColumn(1).width = 4.5; // STT
            sheet.getColumn(2).width = 22;  // Họ và tên
            sheet.getColumn(3).width = 12;  // Chức vụ / VTVL
            for (let c = 4; c <= 34; c++) {
                sheet.getColumn(c).width = 3.6; // Ngày 1..31
            }
            sheet.getColumn(35).width = 7.5; // M1
            sheet.getColumn(36).width = 7.5; // M2
            sheet.getColumn(37).width = 7.5; // M3
            sheet.getColumn(38).width = 7.5; // M4
            sheet.getColumn(39).width = 13;  // Tổng tiền
            sheet.getColumn(40).width = 8;   // Ký nhận
        }

        // =========================================================================
        // TRƯỜNG HỢP: XUẤT SỔ THEO DÕI VÀ ĐỐI SOÁT NGHỈ BÙ TRỰC
        // =========================================================================
        if (type === 'SO_DOI_SOAT') {
            const sheet = workbook.addWorksheet(`Đối soát nghỉ bù T${month}`);
            sheet.views = [{ showGridLines: true }];

            // Lấy toàn bộ ca trực trong tháng
            const dutyRecords = await prisma.staffDutyRecord.findMany({
                where: { staffId: { in: staffIds }, dutyDate: { gte: startDateStr, lte: endDateStr } }
            });
            // Lấy toàn bộ công nghỉ bù trong tháng
            const attRecords = await prisma.staffAttendanceRecord.findMany({
                where: {
                    staffId: { in: staffIds },
                    workDate: { gte: startDateStr, lte: endDateStr },
                    code: { in: ['Nb', 'Nb/2'] }
                }
            });

            // Tiêu đề đơn vị
            sheet.getCell('A1').value = 'BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
            sheet.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell('A2').value = deptName;
            sheet.getCell('A2').font = { name: 'Times New Roman', size: 10, bold: true };

            sheet.mergeCells('A4:I4');
            const titleCell = sheet.getCell('A4');
            titleCell.value = 'SỔ THEO DÕI VÀ ĐỐI SOÁT NGHỈ BÙ TRỰC';
            titleCell.font = { name: 'Times New Roman', size: 15, bold: true };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells('A5:I5');
            const subTitleCell = sheet.getCell('A5');
            subTitleCell.value = `Tháng ${month} năm ${year}`;
            subTitleCell.font = { name: 'Times New Roman', size: 11, italic: true };
            subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            // Header bảng dòng 7
            const headers = [
                'STT',
                'Mã NV',
                'Họ và tên cán bộ',
                'Chức vụ',
                'Tổng ca trực',
                'Hạn mức được nghỉ bù',
                'Đã nghỉ bù (Thực tế)',
                'Số ngày trực còn dư',
                'Chi tiết các ca trực còn dư chưa bù'
            ];
            const headerRow = sheet.getRow(7);
            headerRow.height = 28;
            headers.forEach((h, i) => {
                const cell = headerRow.getCell(i + 1);
                cell.value = h;
                cell.font = { name: 'Times New Roman', size: 10, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = thinBorder;
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' }
                };
            });

            // Lọc cán bộ hợp lệ
            const eligibleCompStaff = staffList.filter(st => {
                const staffDuties = dutyRecords.filter(d => d.staffId === st.id);
                const staffAtts = attRecords.filter(a => a.staffId === st.id);
                const hasActivity = staffDuties.length > 0 || staffAtts.length > 0;
                return checkStaffAttendanceEligibility(st, year, month, hasActivity).shouldInclude;
            });

            // Đổ dữ liệu cán bộ
            let curRow = 8;
            eligibleCompStaff.forEach((st, idx) => {
                const staffDuties = dutyRecords.filter(d => d.staffId === st.id);
                const totalDuties = staffDuties.length;
                const eligibleDays = totalDuties;

                const staffAtts = attRecords.filter(a => a.staffId === st.id);
                let actualCompDays = 0;
                staffAtts.forEach(a => {
                    if (a.code === 'Nb') actualCompDays += 1;
                    else if (a.code === 'Nb/2') actualCompDays += 0.5;
                });

                const remainingDays = Math.max(0, eligibleDays - actualCompDays);

                // Lấy chi tiết các ca trực còn dư
                const usedDuties = new Set<string>();
                staffAtts.forEach(a => {
                    if (a.note && a.note.includes('bù')) {
                        const m = a.note.match(/\d{2}\/\d{2}/);
                        if (m) usedDuties.add(m[0]);
                    }
                });
                const availableDutyList = staffDuties
                    .filter(d => {
                        const dStr = dayjs(d.dutyDate).format('DD/MM');
                        return !usedDuties.has(dStr);
                    })
                    .map(d => dayjs(d.dutyDate).format('DD/MM'))
                    .join(', ');

                const row = sheet.getRow(curRow);
                row.height = 22;
                row.getCell(1).value = idx + 1;
                row.getCell(2).value = st.ma_nv;
                row.getCell(3).value = st.ho_ten;
                row.getCell(4).value = st.chuc_vu_ref?.name || '';
                row.getCell(5).value = totalDuties;
                row.getCell(6).value = `${eligibleDays} ngày`;
                row.getCell(7).value = `${actualCompDays} ngày`;
                row.getCell(8).value = `${remainingDays} ngày`;
                row.getCell(9).value = remainingDays > 0 ? (availableDutyList || 'Có ca chưa bù') : 'Đã bù hết';

                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
                row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle' };

                for (let c = 1; c <= 9; c++) {
                    row.getCell(c).font = { name: 'Times New Roman', size: 10 };
                    row.getCell(c).border = thinBorder;
                }
                curRow++;
            });

            // Chữ ký
            const signRow = curRow + 2;
            sheet.getCell(`B${signRow}`).value = 'NGƯỜI LẬP BIỂU';
            sheet.getCell(`B${signRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`B${signRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.getCell(`H${signRow}`).value = 'TRƯỞNG PHÒNG / KHOA';
            sheet.getCell(`H${signRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`H${signRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.getCell(`B${signRow + 4}`).value = creatorName;
            sheet.getCell(`B${signRow + 4}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`B${signRow + 4}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.getCell(`H${signRow + 4}`).value = leaderName;
            sheet.getCell(`H${signRow + 4}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`H${signRow + 4}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.getColumn(1).width = 6;
            sheet.getColumn(2).width = 12;
            sheet.getColumn(3).width = 24;
            sheet.getColumn(4).width = 18;
            sheet.getColumn(5).width = 16;
            sheet.getColumn(6).width = 18;
            sheet.getColumn(7).width = 18;
            sheet.getColumn(8).width = 18;
            sheet.getColumn(9).width = 30;
        }

        // =========================================================================
        // TRƯỜNG HỢP 6: XUẤT DANH SÁCH LỊCH TRỰC TUẦN (KẾ HOẠCH BỆNH VIỆN)
        // =========================================================================
        if (type === 'LICH_TRUC_TUAN') {
            let start = startDate;
            let end = endDate;
            if (!start || !end) {
                start = dayjs().startOf('isoWeek').format('YYYY-MM-DD');
                end = dayjs().endOf('isoWeek').format('YYYY-MM-DD');
            }

            const sheet = workbook.addWorksheet('LỊCH TRỰC TUẦN');
            sheet.views = [{ showGridLines: true }];

            const filterDept = ma_khoa;
            const whereDept: any = {};
            if (filterDept && filterDept !== 'ALL') {
                whereDept.ma_khoa = filterDept;
            }

            const allDepts = await prisma.department.findMany({
                where: whereDept,
                select: { ma_khoa: true, ten_khoa: true },
                orderBy: { ma_khoa: 'asc' }
            });

            // Lấy danh sách ca trực trong tuần
            const whereDuties: any = {
                dutyDate: { gte: start, lte: end }
            };
            if (filterDept && filterDept !== 'ALL') {
                whereDuties.ma_khoa = filterDept;
            }

            const duties = await prisma.staffDutyRecord.findMany({
                where: whereDuties,
                include: {
                    staff: {
                        select: {
                            ho_ten: true,
                            so_dien_thoai: true,
                            chuc_vu_ref: { select: { name: true } }
                        }
                    }
                },
                orderBy: [{ dutyDate: 'asc' }, { createdAt: 'asc' }]
            });

            // Gom nhóm ca trực theo khoa và ngày
            const deptDutyCount: Record<string, number> = {};
            const dutyMap: Record<string, Record<string, { trucChinh: string[]; trucKem: string[]; thuongTru: string[] }>> = {};

            duties.forEach(d => {
                if (!dutyMap[d.ma_khoa]) dutyMap[d.ma_khoa] = {};
                if (!dutyMap[d.ma_khoa][d.dutyDate]) {
                    dutyMap[d.ma_khoa][d.dutyDate] = { trucChinh: [], trucKem: [], thuongTru: [] };
                }

                deptDutyCount[d.ma_khoa] = (deptDutyCount[d.ma_khoa] || 0) + 1;

                const name = d.staff?.ho_ten || 'Cán bộ';
                const phone = d.staff?.so_dien_thoai ? ` (${d.staff.so_dien_thoai})` : '';
                const entry = `${name}${phone}`;

                const codeUpper = (d.dutyCode || '').trim().toUpperCase();
                const typeUpper = (d.dutyType || '').trim().toUpperCase();

                if (typeUpper === 'TRUC_KEM' || codeUpper === 'TK') {
                    dutyMap[d.ma_khoa][d.dutyDate].trucKem.push(entry);
                } else if (typeUpper === 'TRUC_THUONG_TRU' || codeUpper === 'TT') {
                    dutyMap[d.ma_khoa][d.dutyDate].thuongTru.push(entry);
                } else {
                    dutyMap[d.ma_khoa][d.dutyDate].trucChinh.push(entry);
                }
            });

            // YÊU CẦU: Chỉ hiển thị các khoa có lịch trực
            const activeDepts = allDepts.filter(dept => (deptDutyCount[dept.ma_khoa] || 0) > 0);

            // Tạo danh sách 7 ngày
            const startD = dayjs(start);
            const weekDates: string[] = [];
            const dayHeaders: string[] = [];
            const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

            for (let i = 0; i < 7; i++) {
                const curr = startD.add(i, 'day');
                const dStr = curr.format('YYYY-MM-DD');
                weekDates.push(dStr);
                const dw = curr.day();
                dayHeaders.push(`${dayNames[dw]}\n(${curr.format('DD/MM')})`);
            }

            // Dòng 1: Tên đơn vị
            sheet.getCell('A1').value = 'BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
            sheet.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };

            // Dòng 2: Tiêu đề bảng (Merge A2:I2)
            sheet.mergeCells('A2:I2');
            sheet.getCell('A2').value = `DANH SÁCH LỊCH TRỰC TUẦN (Từ ngày ${startD.format('DD/MM/YYYY')} đến ngày ${dayjs(end).format('DD/MM/YYYY')})`;
            sheet.getCell('A2').font = { name: 'Times New Roman', size: 12, bold: true };
            sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

            // Header hàng 4: STT, Tên khoa/phòng, Thứ 2 -> Chủ nhật
            const headerRow = sheet.getRow(4);
            headerRow.height = 28;

            headerRow.getCell(1).value = 'STT';
            headerRow.getCell(1).font = { name: 'Times New Roman', size: 10, bold: true };
            headerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow.getCell(1).border = thinBorder;

            headerRow.getCell(2).value = 'Tên khoa/phòng';
            headerRow.getCell(2).font = { name: 'Times New Roman', size: 10, bold: true };
            headerRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
            headerRow.getCell(2).border = thinBorder;

            for (let i = 0; i < 7; i++) {
                const cell = headerRow.getCell(i + 3);
                cell.value = dayHeaders[i];
                cell.font = { name: 'Times New Roman', size: 10, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = thinBorder;
                if (i >= 5) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFF2CC' }
                    };
                }
            }

            let currentRowIdx = 5;
            activeDepts.forEach((dept, index) => {
                const row = sheet.getRow(currentRowIdx);
                row.getCell(1).value = index + 1;
                row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(1).border = thinBorder;
                row.getCell(1).font = { name: 'Times New Roman', size: 10 };

                row.getCell(2).value = dept.ten_khoa;
                row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                row.getCell(2).border = thinBorder;
                row.getCell(2).font = { name: 'Times New Roman', size: 10, bold: true };

                let maxLinesInRow = 1;

                weekDates.forEach((dStr, dIdx) => {
                    const cell = row.getCell(dIdx + 3);
                    cell.border = thinBorder;
                    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                    cell.font = { name: 'Times New Roman', size: 9 };

                    const dayDuty = dutyMap[dept.ma_khoa]?.[dStr];
                    if (!dayDuty || (dayDuty.trucChinh.length === 0 && dayDuty.trucKem.length === 0 && dayDuty.thuongTru.length === 0)) {
                        cell.value = '-';
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else {
                        const lines: string[] = [];
                        if (dayDuty.trucChinh.length > 0 && dayDuty.trucKem.length === 0 && dayDuty.thuongTru.length === 0) {
                            // Chỉ có trực chính: 1 dòng duy nhất
                            lines.push(dayDuty.trucChinh.join(', '));
                        } else {
                            if (dayDuty.trucChinh.length > 0) lines.push(`Chính: ${dayDuty.trucChinh.join(', ')}`);
                            if (dayDuty.trucKem.length > 0) lines.push(`Kèm: ${dayDuty.trucKem.join(', ')}`);
                            if (dayDuty.thuongTru.length > 0) lines.push(`T.Trú: ${dayDuty.thuongTru.join(', ')}`);
                        }
                        cell.value = lines.join('\n');
                        maxLinesInRow = Math.max(maxLinesInRow, lines.length);
                    }
                });

                row.height = Math.max(22, maxLinesInRow * 16 + 6);
                currentRowIdx++;
            });

            // Chân trang ký duyệt
            currentRowIdx += 2;
            const signHeaderRow = currentRowIdx;
            sheet.mergeCells(`A${signHeaderRow}:C${signHeaderRow}`);
            sheet.getCell(`A${signHeaderRow}`).value = 'NGƯỜI LẬP LỊCH';
            sheet.getCell(`A${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`A${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`D${signHeaderRow}:F${signHeaderRow}`);
            sheet.getCell(`D${signHeaderRow}`).value = 'TRƯỞNG PHÒNG KHTH';
            sheet.getCell(`D${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`D${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`G${signHeaderRow}:I${signHeaderRow}`);
            sheet.getCell(`G${signHeaderRow}`).value = 'GIÁM ĐỐC BỆNH VIỆN';
            sheet.getCell(`G${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`G${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            // Column widths
            sheet.getColumn(1).width = 5;
            sheet.getColumn(2).width = 24;
            for (let c = 3; c <= 9; c++) {
                sheet.getColumn(c).width = 18;
            }
        }

        const rawBuffer = await workbook.xlsx.writeBuffer();
        const buffer = Buffer.from(rawBuffer);
        const safeDept = getSafeDeptName(department?.ten_khoa, ma_khoa);
        const dateSuffix = fileNamingStyle === 'DAILY' ? `_${targetDate || dayjs().format('YYYY-MM-DD')}` : '';
        const filename = type === 'CHAM_CONG'
            ? `Bang_cham_cong_T${month}_${year}_${safeDept}${dateSuffix}.xlsx`
            : type === 'CHAM_THEM_GIO'
            ? `Bang_cham_them_gio_T${month}_${year}_${safeDept}${dateSuffix}.xlsx`
            : type === 'CHAM_DOC_HAI'
            ? `Bang_cham_doc_hai_T${month}_${year}_${safeDept}${dateSuffix}.xlsx`
            : type === 'SO_DOI_SOAT'
            ? `Bang_doi_soat_nghi_bu_T${month}_${year}_${safeDept}${dateSuffix}.xlsx`
            : type === 'LICH_TRUC_TUAN'
            ? `Lich_truc_tuan_${startDate || 'current'}_${endDate || 'current'}.xlsx`
            : type === 'TRUC_KEM'
            ? `Bang_cham_truc_kem_T${month}_${year}_${safeDept}${dateSuffix}.xlsx`
            : type === 'TRUC_THUONG_TRU'
            ? `Bang_cham_truc_thuong_tru_T${month}_${year}_${safeDept}${dateSuffix}.xlsx`
            : `Bang_cham_truc_T${month}_${year}_${safeDept}${dateSuffix}.xlsx`;

        return { buffer, filename };
}

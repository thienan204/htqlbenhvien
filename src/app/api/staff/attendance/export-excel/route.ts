import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';

export async function GET(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const monthYear = searchParams.get('monthYear') || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const type = searchParams.get('type') || 'CHAM_CONG'; // 'CHAM_CONG' | 'CHAM_TRUC'
        const ma_khoa = searchParams.get('ma_khoa') || 'KP046';

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
                he_so_luong_ref: true
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
        const creatorName = user.name || user.username || 'Người chấm công';

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

            // Đổ dữ liệu nhân sự (Row 9 trở đi)
            let currentRow = 9;
            staffList.forEach((st, idx) => {
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

                            if (c.toUpperCase() === 'NB/2' || (c.toUpperCase() === 'NB' && sec)) {
                                cell.value = 'Nb/2';
                                luongThoiGian += 1.0;
                            } else if (c.toUpperCase() === 'NB') {
                                cell.value = 'Nb';
                                luongThoiGian += (att.value || 1.0);
                            } else if (c.toUpperCase() === 'P/2') {
                                cell.value = 'P/2';
                                luongThoiGian += 1.0;
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

        } else {
            // =========================================================================
            // TRƯỜNG HỢP 2: XUẤT BẢNG CHẤM TRỰC (Mẫu C01b - YT theo QĐ 144-BHYT/QĐ)
            // =========================================================================
            const sheet = workbook.addWorksheet(`T${month},${year}`);
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
            sheet.getCell('A3').value = 'BẢNG CHẤM CÔNG THƯỜNG TRỰC CHUYÊN MÔN Y TẾ ĐƯỢC PHỤ CẤP';
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

            sheet.getCell('I7').value = 'PHẦN I - CHẤM CÔNG';
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

            sheet.mergeCells('AI8:AN8');
            sheet.getCell('AI8').value = 'CỘNG SỐ NGÀY TRỰC TRONG THÁNG';
            sheet.getCell('AI8').font = { name: 'Times New Roman', size: 9, bold: true };
            sheet.getCell('AI8').alignment = { horizontal: 'center', vertical: 'middle' };
            for (let c = 35; c <= 40; c++) {
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

            sheet.getCell('AL9').value = 'Trực kèm';
            sheet.getCell('AL9').font = { name: 'Times New Roman', size: 8, bold: true };
            sheet.getCell('AL9').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AL9').border = thinBorder;

            sheet.getCell('AM9').value = 'Thường trú';
            sheet.getCell('AM9').font = { name: 'Times New Roman', size: 8, bold: true };
            sheet.getCell('AM9').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AM9').border = thinBorder;

            sheet.getCell('AN9').value = 'Tổng Số';
            sheet.getCell('AN9').font = { name: 'Times New Roman', size: 8, bold: true };
            sheet.getCell('AN9').alignment = { horizontal: 'center', vertical: 'middle' };
            sheet.getCell('AN9').border = thinBorder;

            // Đổ dữ liệu nhân sự (Row 10 trở đi)
            let currentRow = 10;
            staffList.forEach((st, idx) => {
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
                            cell.value = c;
                            if (c === 'T') dutyNgayThuong++;
                            else if (c === 'C') dutyT7CN++;
                            else if (c === 'L' || c === 'TE') dutyLeTet++;
                            else if (c === 'TK') dutyTrucKem++;
                            else if (c === 'TT') dutyThuongTru++;
                        }
                    }
                }

                // Cột tổng kết trực
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

                row.getCell(38).value = dutyTrucKem > 0 ? dutyTrucKem : '';
                row.getCell(38).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(38).border = thinBorder;
                row.getCell(38).font = { name: 'Times New Roman', size: 10 };

                row.getCell(39).value = dutyThuongTru > 0 ? dutyThuongTru : '';
                row.getCell(39).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(39).border = thinBorder;
                row.getCell(39).font = { name: 'Times New Roman', size: 10 };

                const totalDuty = dutyNgayThuong + dutyT7CN + dutyLeTet + dutyTrucKem + dutyThuongTru;
                row.getCell(40).value = totalDuty > 0 ? totalDuty : '';
                row.getCell(40).alignment = { horizontal: 'center', vertical: 'middle' };
                row.getCell(40).border = thinBorder;
                row.getCell(40).font = { name: 'Times New Roman', size: 10, bold: true };

                currentRow++;
            });

            // Dòng CỘNG
            const sumRow = sheet.getRow(currentRow);
            sumRow.getCell(2).value = 'CỘNG';
            sumRow.getCell(2).font = { name: 'Times New Roman', size: 10, bold: true };
            sumRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

            for (let c = 1; c <= 40; c++) {
                sumRow.getCell(c).border = thinBorder;
            }

            const firstRow = 10;
            const lastRow = currentRow - 1;
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

            sumRow.getCell(39).value = { formula: `SUM(AM${firstRow}:AM${lastRow})` };
            sumRow.getCell(39).font = { name: 'Times New Roman', size: 10, bold: true };
            sumRow.getCell(39).alignment = { horizontal: 'center', vertical: 'middle' };

            sumRow.getCell(40).value = { formula: `SUM(AN${firstRow}:AN${lastRow})` };
            sumRow.getCell(40).font = { name: 'Times New Roman', size: 10, bold: true };
            sumRow.getCell(40).alignment = { horizontal: 'center', vertical: 'middle' };

            currentRow += 2;

            // Bảng ghi chú các ký hiệu chấm công trực
            sheet.getCell(`B${currentRow}`).value = 'T: Trực thường | C: Trực T7, CN | L/Te: Trực lễ tết | Tk: Trực kèm | TT: Trực thường trú';
            sheet.getCell(`B${currentRow}`).font = { name: 'Times New Roman', size: 10, italic: true };

            currentRow += 2;

            // Chữ ký
            const signHeaderRow = currentRow;
            sheet.mergeCells(`B${signHeaderRow}:D${signHeaderRow}`);
            sheet.getCell(`B${signHeaderRow}`).value = 'Người chấm công';
            sheet.getCell(`B${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`B${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`I${signHeaderRow}:L${signHeaderRow}`);
            sheet.getCell(`I${signHeaderRow}`).value = 'Phụ trách bộ phận';
            sheet.getCell(`I${signHeaderRow}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`I${signHeaderRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

            sheet.mergeCells(`AC${signHeaderRow}:AG${signHeaderRow}`);
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
            sheet.getColumn(35).width = 8;
            sheet.getColumn(36).width = 8;
            sheet.getColumn(37).width = 8;
            sheet.getColumn(38).width = 9;
        }

        // =========================================================================
        // TRƯỜNG HỢP 3: XUẤT BẢNG CHẤM CÔNG LÀM THÊM GIỜ (Giống mẫu Thêm giờ trong Copy of THÁNG 9.xls)
        // =========================================================================
        if (type === 'CHAM_THEM_GIO') {
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

            // Điền dữ liệu cán bộ
            let currentRow = 10;
            let totalDeptDayHours = 0;
            let totalDeptNightHours = 0;
            let totalDeptOvertimeHours = 0;

            staffList.forEach((st, idx) => {
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

        const buffer = await workbook.xlsx.writeBuffer();
        const safeDeptCode = ma_khoa.replace(/[^a-zA-Z0-9]/g, '');
        const filename = type === 'CHAM_CONG'
            ? `Bang_cham_cong_T${month}_${year}_${safeDeptCode}.xlsx`
            : type === 'CHAM_THEM_GIO'
            ? `Bang_cham_them_gio_T${month}_${year}_${safeDeptCode}.xlsx`
            : `Bang_cham_truc_T${month}_${year}_${safeDeptCode}.xlsx`;

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (error: any) {
        console.error('Error exporting Excel:', error);
        return NextResponse.json({ error: error.message || 'Lỗi khi xuất file Excel' }, { status: 500 });
    }
}

import ExcelJS from 'exceljs';
import prisma from '@/lib/prisma';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

export interface ExportedFileInfo {
    key: string;
    fileName: string;
    title: string;
    buffer: Buffer;
    base64: string;
    mimeType: string;
}

const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
};

// Hàm hỗ trợ chuẩn bị dữ liệu nhân sự & phòng ban
async function getStaffAndDeptContext(ma_khoa: string) {
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

    const department = await prisma.department.findUnique({
        where: { ma_khoa },
        select: { ten_khoa: true, ma_khoa: true }
    });
    const deptName = department?.ten_khoa ? department.ten_khoa.toUpperCase() : 'PHÒNG CÔNG NGHỆ THÔNG TIN';

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

    const leaderStaff = staffList.find(st => {
        const cv = (st.chuc_vu_ref?.name || '').toLowerCase();
        return (cv.includes('trưởng phòng') || cv.includes('trưởng khoa') || cv.includes('phụ trách')) && !cv.includes('điều dưỡng');
    }) || staffList[0];
    const leaderName = leaderStaff?.ho_ten || '';

    return { staffList, department, deptName, leaderName, staffIds: staffList.map(s => s.id) };
}

// 1. SINH FILE BẢNG CHẤM CÔNG
async function generateAttendanceSheet(monthYear: string, ma_khoa: string, creatorName: string) {
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const { staffList, deptName, leaderName, staffIds } = await getStaffAndDeptContext(ma_khoa);
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BVĐK Lạng Sơn';
    const sheet = workbook.addWorksheet(`T${month}`);
    sheet.views = [{ showGridLines: true }];

    const attendanceRecords = await prisma.staffAttendanceRecord.findMany({
        where: {
            staffId: { in: staffIds },
            workDate: { gte: startDateStr, lte: endDateStr }
        },
        include: {
            dutyRecord: { select: { dutyDate: true, dutyCode: true } }
        }
    });

    const attMap: Record<string, Record<number, any>> = {};
    attendanceRecords.forEach(att => {
        const day = parseInt(att.workDate.split('-')[2], 10);
        if (!attMap[att.staffId]) attMap[att.staffId] = {};
        attMap[att.staffId][day] = att;
    });

    // Header bệnh viện
    sheet.mergeCells('A1:K1');
    sheet.getCell('A1').value = 'SỞ Y TẾ LẠNG SƠN';
    sheet.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:K2');
    sheet.getCell('A2').value = 'BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
    sheet.getCell('A2').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells('A3:K3');
    sheet.getCell('A3').value = deptName;
    sheet.getCell('A3').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A3').alignment = { horizontal: 'center' };

    sheet.mergeCells('A5:AI5');
    sheet.getCell('A5').value = `BẢNG CHẤM CÔNG THÁNG ${month} NĂM ${year}`;
    sheet.getCell('A5').font = { name: 'Times New Roman', size: 14, bold: true };
    sheet.getCell('A5').alignment = { horizontal: 'center' };

    // Dòng thứ trong tuần và ngày
    const row7 = sheet.getRow(7);
    const row8 = sheet.getRow(8);

    sheet.mergeCells('A7:A8');
    sheet.getCell('A7').value = 'STT';
    sheet.mergeCells('B7:B8');
    sheet.getCell('B7').value = 'Họ và tên';
    sheet.mergeCells('C7:C8');
    sheet.getCell('C7').value = 'Chức vụ';

    for (let d = 1; d <= daysInMonth; d++) {
        const colIdx = 3 + d;
        const curDate = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        const dayOfWeek = curDate.day();
        const dowText = dayOfWeek === 0 ? 'CN' : `T${dayOfWeek + 1}`;

        row7.getCell(colIdx).value = dowText;
        row8.getCell(colIdx).value = d;
    }

    const colTongCong = 4 + daysInMonth;
    sheet.mergeCells(7, colTongCong, 7, colTongCong + 3);
    sheet.getCell(7, colTongCong).value = 'Quy ra công';
    sheet.getCell(8, colTongCong).value = 'Thời gian';
    sheet.getCell(8, colTongCong + 1).value = 'Nghỉ phép';
    sheet.getCell(8, colTongCong + 2).value = 'BHXH';
    sheet.getCell(8, colTongCong + 3).value = 'Cộng';

    const colGhiChu = colTongCong + 4;
    sheet.mergeCells(7, colGhiChu, 8, colGhiChu);
    sheet.getCell(7, colGhiChu).value = 'Ghi chú';

    // Đổ dữ liệu nhân sự
    let curRowIdx = 9;
    staffList.forEach((st, idx) => {
        const row = sheet.getRow(curRowIdx);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = st.ho_ten;
        row.getCell(3).value = st.chuc_vu_ref?.name || '';

        let tgCount = 0;
        let pCount = 0;
        let bhxhCount = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const att = attMap[st.id]?.[d];
            const colIdx = 3 + d;
            if (att?.code) {
                const code = att.code;
                row.getCell(colIdx).value = code;
                const c = code.toUpperCase();
                if (['+', 'X', 'NB'].includes(c)) tgCount += (att.value || 1.0);
                else if (['+/2', 'X/2', 'NB/2'].includes(c)) tgCount += 0.5;
                else if (c === 'P') pCount += 1.0;
                else if (c === 'P/2') { tgCount += 0.5; pCount += 0.5; }
                else if (['Ô', 'TS'].includes(c)) bhxhCount += (att.value || 1.0);
            }
        }

        row.getCell(colTongCong).value = tgCount;
        row.getCell(colTongCong + 1).value = pCount;
        row.getCell(colTongCong + 2).value = bhxhCount;
        row.getCell(colTongCong + 3).value = tgCount + pCount + bhxhCount;

        curRowIdx++;
    });

    // Kẻ viền toàn bảng
    for (let r = 7; r < curRowIdx; r++) {
        const rObj = sheet.getRow(r);
        for (let c = 1; c <= colGhiChu; c++) {
            const cell = rObj.getCell(c);
            cell.border = thinBorder;
            cell.font = { name: 'Times New Roman', size: 10 };
            if (r === 7 || r === 8 || c === 1 || c > 3) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if (r === 7 || r === 8) {
                cell.font = { name: 'Times New Roman', size: 10, bold: true };
            }
        }
    }

    // Phần chữ ký
    const signRow = curRowIdx + 2;
    sheet.getCell(signRow, 2).value = 'NGƯỜI CHẤM CÔNG';
    sheet.getCell(signRow, 2).font = { name: 'Times New Roman', size: 11, bold: true };
    sheet.getCell(signRow, 2).alignment = { horizontal: 'center' };

    sheet.getCell(signRow, colTongCong).value = 'TRƯỞNG PHÒNG / KHOA';
    sheet.getCell(signRow, colTongCong).font = { name: 'Times New Roman', size: 11, bold: true };
    sheet.getCell(signRow, colTongCong).alignment = { horizontal: 'center' };

    sheet.getCell(signRow + 4, 2).value = creatorName;
    sheet.getCell(signRow + 4, 2).font = { name: 'Times New Roman', size: 11, bold: true };
    sheet.getCell(signRow + 4, 2).alignment = { horizontal: 'center' };

    sheet.getCell(signRow + 4, colTongCong).value = leaderName;
    sheet.getCell(signRow + 4, colTongCong).font = { name: 'Times New Roman', size: 11, bold: true };
    sheet.getCell(signRow + 4, colTongCong).alignment = { horizontal: 'center' };

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);
    return {
        key: 'CHAM_CONG',
        fileName: `01_BangChamCong_T${month}_${year}_${ma_khoa}.xlsx`,
        title: `Bảng Chấm Công Tháng ${month}/${year}`,
        buffer,
        base64: buffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
}

// 2. SINH FILE BẢNG CHẤM TRỰC
async function generateDutySheet(monthYear: string, ma_khoa: string, creatorName: string) {
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const { staffList, deptName, leaderName, staffIds } = await getStaffAndDeptContext(ma_khoa);
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BVĐK Lạng Sơn';
    const sheet = workbook.addWorksheet(`Trực_T${month}`);
    sheet.views = [{ showGridLines: true }];

    const dutyRecords = await prisma.staffDutyRecord.findMany({
        where: {
            staffId: { in: staffIds },
            dutyDate: { gte: startDateStr, lte: endDateStr }
        }
    });

    const dutyMap: Record<string, Record<number, any>> = {};
    dutyRecords.forEach(d => {
        const day = parseInt(d.dutyDate.split('-')[2], 10);
        if (!dutyMap[d.staffId]) dutyMap[d.staffId] = {};
        dutyMap[d.staffId][day] = d;
    });

    sheet.mergeCells('A1:K1');
    sheet.getCell('A1').value = 'BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
    sheet.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:K2');
    sheet.getCell('A2').value = deptName;
    sheet.getCell('A2').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells('A4:AH4');
    sheet.getCell('A4').value = `BẢNG CHẤM TRỰC THÁNG ${month} NĂM ${year}`;
    sheet.getCell('A4').font = { name: 'Times New Roman', size: 14, bold: true };
    sheet.getCell('A4').alignment = { horizontal: 'center' };

    const row6 = sheet.getRow(6);
    const row7 = sheet.getRow(7);

    sheet.mergeCells('A6:A7');
    sheet.getCell('A6').value = 'STT';
    sheet.mergeCells('B6:B7');
    sheet.getCell('B6').value = 'Họ và tên';
    sheet.mergeCells('C6:C7');
    sheet.getCell('C6').value = 'Chức vụ';

    for (let d = 1; d <= daysInMonth; d++) {
        const colIdx = 3 + d;
        const curDate = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        row6.getCell(colIdx).value = curDate.day() === 0 ? 'CN' : `T${curDate.day() + 1}`;
        row7.getCell(colIdx).value = d;
    }

    const colTongTruc = 4 + daysInMonth;
    sheet.mergeCells(6, colTongTruc, 6, colTongTruc + 2);
    sheet.getCell(6, colTongTruc).value = 'Tổng số phiên trực';
    sheet.getCell(7, colTongTruc).value = 'Thường (T)';
    sheet.getCell(7, colTongTruc + 1).value = 'T7, CN (C)';
    sheet.getCell(7, colTongTruc + 2).value = 'Tổng cộng';

    let curRowIdx = 8;
    staffList.forEach((st, idx) => {
        const row = sheet.getRow(curRowIdx);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = st.ho_ten;
        row.getCell(3).value = st.chuc_vu_ref?.name || '';

        let countT = 0;
        let countC = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const duty = dutyMap[st.id]?.[d];
            const colIdx = 3 + d;
            if (duty?.dutyCode) {
                row.getCell(colIdx).value = duty.dutyCode;
                const code = duty.dutyCode.toUpperCase();
                if (code === 'T') countT++;
                else if (code === 'C') countC++;
            }
        }

        row.getCell(colTongTruc).value = countT;
        row.getCell(colTongTruc + 1).value = countC;
        row.getCell(colTongTruc + 2).value = countT + countC;

        curRowIdx++;
    });

    for (let r = 6; r < curRowIdx; r++) {
        const rObj = sheet.getRow(r);
        for (let c = 1; c <= colTongTruc + 2; c++) {
            const cell = rObj.getCell(c);
            cell.border = thinBorder;
            cell.font = { name: 'Times New Roman', size: 10 };
            if (r === 6 || r === 7 || c === 1 || c > 3) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if (r === 6 || r === 7) cell.font = { name: 'Times New Roman', size: 10, bold: true };
        }
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);
    return {
        key: 'CHAM_TRUC',
        fileName: `02_BangChamTruc_T${month}_${year}_${ma_khoa}.xlsx`,
        title: `Bảng Chấm Trực Tháng ${month}/${year}`,
        buffer,
        base64: buffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
}

// 3. SINH FILE SỔ THEO DÕI & ĐỐI SOÁT NGHỈ BÙ
async function generateCompensatoryLedgerSheet(monthYear: string, ma_khoa: string, creatorName: string) {
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const { staffList, deptName, leaderName, staffIds } = await getStaffAndDeptContext(ma_khoa);
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BVĐK Lạng Sơn';
    const sheet = workbook.addWorksheet(`DoiSoatNghiBu_T${month}`);
    sheet.views = [{ showGridLines: true }];

    // Lấy tất cả ca trực trong tháng
    const dutyRecords = await prisma.staffDutyRecord.findMany({
        where: { staffId: { in: staffIds }, dutyDate: { gte: startDateStr, lte: endDateStr } }
    });

    // Lấy tất cả bản ghi nghỉ bù trong tháng
    const attendanceRecords = await prisma.staffAttendanceRecord.findMany({
        where: { staffId: { in: staffIds }, workDate: { gte: startDateStr, lte: endDateStr } },
        include: { dutyRecord: true }
    });

    // Lấy ca trực chưa nghỉ bù
    const uncompensatedDutyRecords = await prisma.staffDutyRecord.findMany({
        where: { staffId: { in: staffIds }, isFullyCompensated: false },
        orderBy: { dutyDate: 'asc' }
    });

    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = 'BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
    sheet.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value = deptName;
    sheet.getCell('A2').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells('A4:I4');
    sheet.getCell('A4').value = `SỔ THEO DÕI VÀ ĐỐI SOÁT NGHỈ BÙ TRỰC THÁNG ${month} NĂM ${year}`;
    sheet.getCell('A4').font = { name: 'Times New Roman', size: 14, bold: true };
    sheet.getCell('A4').alignment = { horizontal: 'center' };

    const headers = [
        'STT', 'Mã NV', 'Họ và tên cán bộ', 'Chức vụ',
        'Tổng phiên trực trong tháng', 'Hạn mức được nghỉ bù (ngày)',
        'Đã nghỉ bù thực tế (ngày)', 'Chi tiết các ngày đã nghỉ bù',
        'Quỹ ngày trực còn dư có thể bù'
    ];

    const hRow = sheet.getRow(6);
    headers.forEach((h, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: 'Times New Roman', size: 10, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
    });

    let curRowIdx = 7;
    staffList.forEach((st, idx) => {
        const row = sheet.getRow(curRowIdx);

        const stDuties = dutyRecords.filter(d => d.staffId === st.id);
        const countT = stDuties.filter(d => (d.dutyCode || '').toUpperCase() === 'T').length;
        const countC = stDuties.filter(d => (d.dutyCode || '').toUpperCase() === 'C').length;
        const countL = stDuties.filter(d => ['L', 'TE'].includes((d.dutyCode || '').toUpperCase())).length;
        const totalDuty = stDuties.length;
        const dutyText = `${totalDuty} ca (Thường: ${countT}, T7/CN: ${countC}, Lễ: ${countL})`;

        const allowance = stDuties.reduce((acc, d) => acc + (d.allowanceDays || 1.0), 0);

        // Các ngày đã nghỉ bù thực tế
        const stComps = attendanceRecords.filter(a => a.staffId === st.id && ['NB', 'NB/2', 'NB/X', 'X/NB'].includes((a.code || '').toUpperCase()));
        const compTotal = stComps.reduce((acc, a) => acc + (a.value || (a.code === 'Nb/2' ? 0.5 : 1.0)), 0);
        const compDetails = stComps.map(a => {
            const p = a.workDate.split('-');
            const sDate = `${p[2]}/${p[1]}`;
            const dutyText = a.dutyRecord?.dutyDate ? ` (ca ${a.dutyRecord.dutyDate.split('-').slice(1).reverse().join('/')})` : '';
            return `${sDate} (${a.code}: ${a.value || 0.5}d${dutyText})`;
        }).join(', ');

        // Các ca còn dư
        const stUncomps = uncompensatedDutyRecords.filter(d => d.staffId === st.id);
        const uncompDetails = stUncomps.map(d => {
            const p = d.dutyDate.split('-');
            const sDate = `${p[2]}/${p[1]}`;
            const rem = Math.max(0, (d.allowanceDays || 1.0) - (d.compensatedDays || 0));
            return `${sDate} (${d.dutyCode}: còn ${rem}d)`;
        }).join(', ');

        const remTotal = stUncomps.reduce((acc, d) => acc + Math.max(0, (d.allowanceDays || 1.0) - (d.compensatedDays || 0)), 0);

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = st.ma_nv;
        row.getCell(3).value = st.ho_ten;
        row.getCell(4).value = st.chuc_vu_ref?.name || '';
        row.getCell(5).value = dutyText;
        row.getCell(6).value = `${allowance} ngày`;
        row.getCell(7).value = `${compTotal} ngày`;
        row.getCell(8).value = compDetails || 'Chưa nghỉ bù';
        row.getCell(9).value = uncompDetails || 'Đã bù hết';

        for (let c = 1; c <= 9; c++) {
            const cell = row.getCell(c);
            cell.border = thinBorder;
            cell.font = { name: 'Times New Roman', size: 10 };
            if (c === 1 || c === 2 || c === 6 || c === 7) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (c === 3 || c === 4) {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            } else {
                cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            }
        }

        curRowIdx++;
    });

    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 10;
    sheet.getColumn(3).width = 24;
    sheet.getColumn(4).width = 18;
    sheet.getColumn(5).width = 26;
    sheet.getColumn(6).width = 16;
    sheet.getColumn(7).width = 16;
    sheet.getColumn(8).width = 34;
    sheet.getColumn(9).width = 34;

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);
    return {
        key: 'SO_DOI_SOAT',
        fileName: `03_SoDoiSoatNghiBu_T${month}_${year}_${ma_khoa}.xlsx`,
        title: `Sổ Đối Soát Nghỉ Bù Trực Tháng ${month}/${year}`,
        buffer,
        base64: buffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
}

// 4. SINH FILE BẢNG CHẤM THÊM GIỜ
async function generateOvertimeSheet(monthYear: string, ma_khoa: string, creatorName: string) {
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const { staffList, deptName, leaderName, staffIds } = await getStaffAndDeptContext(ma_khoa);
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BVĐK Lạng Sơn';
    const sheet = workbook.addWorksheet(`ThemGio_T${month}`);
    sheet.views = [{ showGridLines: true }];

    const otRecords = await prisma.staffOvertimeRecord.findMany({
        where: { staffId: { in: staffIds }, workDate: { gte: startDateStr, lte: endDateStr } }
    });

    const otMap: Record<string, Record<number, any>> = {};
    otRecords.forEach(ot => {
        const day = parseInt(ot.workDate.split('-')[2], 10);
        if (!otMap[ot.staffId]) otMap[ot.staffId] = {};
        otMap[ot.staffId][day] = ot;
    });

    sheet.mergeCells('A1:K1');
    sheet.getCell('A1').value = 'BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
    sheet.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:K2');
    sheet.getCell('A2').value = deptName;
    sheet.getCell('A2').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells('A4:AH4');
    sheet.getCell('A4').value = `BẢNG CHẤM LÀM THÊM GIỜ THÁNG ${month} NĂM ${year}`;
    sheet.getCell('A4').font = { name: 'Times New Roman', size: 14, bold: true };
    sheet.getCell('A4').alignment = { horizontal: 'center' };

    const row6 = sheet.getRow(6);
    const row7 = sheet.getRow(7);

    sheet.mergeCells('A6:A7');
    sheet.getCell('A6').value = 'STT';
    sheet.mergeCells('B6:B7');
    sheet.getCell('B6').value = 'Họ và tên';
    sheet.mergeCells('C6:C7');
    sheet.getCell('C6').value = 'Chức vụ';

    for (let d = 1; d <= daysInMonth; d++) {
        const colIdx = 3 + d;
        row6.getCell(colIdx).value = `N${d}`;
        row7.getCell(colIdx).value = d;
    }

    const colTongOT = 4 + daysInMonth;
    sheet.mergeCells(6, colTongOT, 6, colTongOT + 2);
    sheet.getCell(6, colTongOT).value = 'Tổng số giờ làm thêm';
    sheet.getCell(7, colTongOT).value = 'Ban ngày (h)';
    sheet.getCell(7, colTongOT + 1).value = 'Ban đêm (h)';
    sheet.getCell(7, colTongOT + 2).value = 'Tổng cộng (h)';

    let curRowIdx = 8;
    staffList.forEach((st, idx) => {
        const row = sheet.getRow(curRowIdx);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = st.ho_ten;
        row.getCell(3).value = st.chuc_vu_ref?.name || '';

        let dayH = 0;
        let nightH = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const ot = otMap[st.id]?.[d];
            const colIdx = 3 + d;
            if (ot) {
                const total = (ot.dayHours || 0) + (ot.nightHours || 0);
                if (total > 0) row.getCell(colIdx).value = total;
                dayH += (ot.dayHours || 0);
                nightH += (ot.nightHours || 0);
            }
        }

        row.getCell(colTongOT).value = dayH;
        row.getCell(colTongOT + 1).value = nightH;
        row.getCell(colTongOT + 2).value = dayH + nightH;

        curRowIdx++;
    });

    for (let r = 6; r < curRowIdx; r++) {
        const rObj = sheet.getRow(r);
        for (let c = 1; c <= colTongOT + 2; c++) {
            const cell = rObj.getCell(c);
            cell.border = thinBorder;
            cell.font = { name: 'Times New Roman', size: 10 };
            if (r === 6 || r === 7 || c === 1 || c > 3) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if (r === 6 || r === 7) cell.font = { name: 'Times New Roman', size: 10, bold: true };
        }
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);
    return {
        key: 'CHAM_THEM_GIO',
        fileName: `04_BangChamThemGio_T${month}_${year}_${ma_khoa}.xlsx`,
        title: `Bảng Chấm Thêm Giờ Tháng ${month}/${year}`,
        buffer,
        base64: buffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
}

// 5. SINH FILE BẢNG CHẤM ĐỘC HẠI
async function generateHazardSheet(monthYear: string, ma_khoa: string, creatorName: string) {
    const [yearStr, monthStr] = monthYear.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const { staffList, deptName, leaderName, staffIds } = await getStaffAndDeptContext(ma_khoa);
    const startDateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BVĐK Lạng Sơn';
    const sheet = workbook.addWorksheet(`DocHai_T${month}`);
    sheet.views = [{ showGridLines: true }];

    const hazardRecords = await prisma.staffHazardRecord.findMany({
        where: { staffId: { in: staffIds }, workDate: { gte: startDateStr, lte: endDateStr } }
    });

    const hzMap: Record<string, Record<number, any>> = {};
    hazardRecords.forEach(hz => {
        const day = parseInt(hz.workDate.split('-')[2], 10);
        if (!hzMap[hz.staffId]) hzMap[hz.staffId] = {};
        hzMap[hz.staffId][day] = hz;
    });

    sheet.mergeCells('A1:K1');
    sheet.getCell('A1').value = 'BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN';
    sheet.getCell('A1').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:K2');
    sheet.getCell('A2').value = deptName;
    sheet.getCell('A2').font = { name: 'Times New Roman', size: 10, bold: true };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells('A4:AH4');
    sheet.getCell('A4').value = `BẢNG CHẤM BỒI DƯỠNG NGHỀ ĐỘC HẠI BẰNG HIỆN VẬT THÁNG ${month} NĂM ${year}`;
    sheet.getCell('A4').font = { name: 'Times New Roman', size: 14, bold: true };
    sheet.getCell('A4').alignment = { horizontal: 'center' };

    const row6 = sheet.getRow(6);
    const row7 = sheet.getRow(7);

    sheet.mergeCells('A6:A7');
    sheet.getCell('A6').value = 'STT';
    sheet.mergeCells('B6:B7');
    sheet.getCell('B6').value = 'Họ và tên';
    sheet.mergeCells('C6:C7');
    sheet.getCell('C6').value = 'Chức vụ';

    for (let d = 1; d <= daysInMonth; d++) {
        const colIdx = 3 + d;
        row6.getCell(colIdx).value = `N${d}`;
        row7.getCell(colIdx).value = d;
    }

    const colTongHz = 4 + daysInMonth;
    sheet.mergeCells(6, colTongHz, 7, colTongHz);
    sheet.getCell(6, colTongHz).value = 'Tổng ngày hưởng độc hại';

    let curRowIdx = 8;
    staffList.forEach((st, idx) => {
        const row = sheet.getRow(curRowIdx);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = st.ho_ten;
        row.getCell(3).value = st.chuc_vu_ref?.name || '';

        let totalHz = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const hz = hzMap[st.id]?.[d];
            const colIdx = 3 + d;
            if (hz?.shiftValue) {
                row.getCell(colIdx).value = hz.shiftValue;
                if (['+', '1', '1.0'].includes(String(hz.shiftValue))) totalHz += 1.0;
                else if (['+/2', '0.5'].includes(String(hz.shiftValue))) totalHz += 0.5;
            }
        }

        row.getCell(colTongHz).value = totalHz;
        curRowIdx++;
    });

    for (let r = 6; r < curRowIdx; r++) {
        const rObj = sheet.getRow(r);
        for (let c = 1; c <= colTongHz; c++) {
            const cell = rObj.getCell(c);
            cell.border = thinBorder;
            cell.font = { name: 'Times New Roman', size: 10 };
            if (r === 6 || r === 7 || c === 1 || c > 3) {
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
            if (r === 6 || r === 7) cell.font = { name: 'Times New Roman', size: 10, bold: true };
        }
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(rawBuffer);
    return {
        key: 'CHAM_DOC_HAI',
        fileName: `05_BangChamDocHai_T${month}_${year}_${ma_khoa}.xlsx`,
        title: `Bảng Chấm Độc Hại Tháng ${month}/${year}`,
        buffer,
        base64: buffer.toString('base64'),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
}

// HÀM XUẤT TRỌN BỘ 5 FILE EXCEL CỦA THÁNG
export async function generateAllAttendanceWorkbooks(monthYear: string, ma_khoa: string, creatorName: string = 'Người quản lý'): Promise<ExportedFileInfo[]> {
    const [sheet1, sheet2, sheet3, sheet4, sheet5] = await Promise.all([
        generateAttendanceSheet(monthYear, ma_khoa, creatorName),
        generateDutySheet(monthYear, ma_khoa, creatorName),
        generateCompensatoryLedgerSheet(monthYear, ma_khoa, creatorName),
        generateOvertimeSheet(monthYear, ma_khoa, creatorName),
        generateHazardSheet(monthYear, ma_khoa, creatorName)
    ]);

    return [sheet1, sheet2, sheet3, sheet4, sheet5];
}


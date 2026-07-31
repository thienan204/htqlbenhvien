const XLSX = require('xlsx');
const fs = require('fs');

const INPUT_FILE = 'mau/HANAM_BAOCAOCANLAMSANG_A4_v1_987.xlsx';
const OUTPUT_FILE = 'mau/KETQUA_HANAM_PHANBOGIO.xlsx';

// 1. Read data
console.log('Đang đọc file Excel...');
const workbook = XLSX.readFile(INPUT_FILE);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log(`Đã đọc ${data.length} dòng dữ liệu.`);

// 2. Generate mock configuration
const uniqueServices = [...new Set(data.map(row => row.MADICHVU).filter(Boolean))];
const serviceConfig = {};

uniqueServices.forEach((madichvu, index) => {
    // Randomize for demonstration: 5, 10, or 15 minutes
    const times = [5, 10, 15];
    const time = times[index % 3];
    // Randomize role: BS or DD
    const role = index % 2 === 0 ? 'BS' : 'DD';
    serviceConfig[madichvu] = { thoigianthuc: time, role: role };
});

const STAFF = {
    BS: ['BS_Nguyen_Van_A', 'BS_Tran_Thi_B', 'BS_Le_Van_C'],
    DD: ['DD_Pham_Thi_D', 'DD_Hoang_Van_E', 'DD_Vu_Thi_F', 'DD_Dang_Van_G']
};

// 3. Scheduling logic
// Trackers to prevent overlaps
// Structure: { dateString: { entityId: [ {start: minutesFromMidnight, end: minutesFromMidnight} ] } }
const staffTracker = {};
const patientTracker = {};

function parseDateStr(dateStr) {
    // format: DD/MM/YYYY HH:MM:SS
    if (!dateStr) return null;
    const parts = dateStr.split(' ');
    const dateParts = parts[0].split('/'); // [DD, MM, YYYY]
    return {
        dateKey: parts[0],
        timestamp: new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T00:00:00`)
    };
}

function formatTime(dateKey, minutesFromMidnight) {
    const hours = Math.floor(minutesFromMidnight / 60);
    const mins = minutesFromMidnight % 60;
    const pad = (num) => String(num).padStart(2, '0');
    return `${dateKey} ${pad(hours)}:${pad(mins)}:00`;
}

function checkOverlap(intervals, start, end) {
    if (!intervals) return false;
    for (let interval of intervals) {
        // overlap if (start < interval.end) and (end > interval.start)
        if (start < interval.end && end > interval.start) {
            return true;
        }
    }
    return false;
}

console.log('Đang phân bổ lịch...');

data.forEach((row, i) => {
    if (!row.MADICHVU || !row.NGAYCHIDINH || !row.MAHOSOBENHAN) return;

    const config = serviceConfig[row.MADICHVU];
    if (!config) return;

    const parsedDate = parseDateStr(row.NGAYCHIDINH);
    if (!parsedDate) return;

    const dateKey = parsedDate.dateKey;
    const duration = config.thoigianthuc;
    const role = config.role;
    const patientId = row.MAHOSOBENHAN;

    // Initialize trackers for this date if not exist
    if (!staffTracker[dateKey]) staffTracker[dateKey] = {};
    if (!patientTracker[dateKey]) patientTracker[dateKey] = {};

    const availableStaff = STAFF[role];
    let scheduled = false;

    // Start looking for slots from 08:00 (8 * 60 = 480 minutes) to 12:00 (12 * 60 = 720 minutes)
    // For simplicity, we search minute by minute until we find a free slot.
    for (let currentMinute = 480; currentMinute <= 720 - duration; currentMinute += 5) {
        
        // Check if patient is free at this time
        if (checkOverlap(patientTracker[dateKey][patientId], currentMinute, currentMinute + duration)) {
            continue; // patient is busy, try next time slot
        }

        // Check if any staff is free
        for (let staffId of availableStaff) {
            if (!checkOverlap(staffTracker[dateKey][staffId], currentMinute, currentMinute + duration)) {
                // Found a slot!
                row.TT_CHINH = staffId;
                row.NGAYPTTTBATDAU = formatTime(dateKey, currentMinute);
                row.NGAYPTTTKETTHUC = formatTime(dateKey, currentMinute + duration);
                // Also save the config duration for reference
                row.THOIGIANTHUC_PHUT = duration;

                // Mark as busy
                if (!staffTracker[dateKey][staffId]) staffTracker[dateKey][staffId] = [];
                staffTracker[dateKey][staffId].push({ start: currentMinute, end: currentMinute + duration });

                if (!patientTracker[dateKey][patientId]) patientTracker[dateKey][patientId] = [];
                patientTracker[dateKey][patientId].push({ start: currentMinute, end: currentMinute + duration });

                scheduled = true;
                break;
            }
        }

        if (scheduled) break;
    }

    if (!scheduled) {
        console.warn(`Lưu ý: Không tìm được lịch trống cho bệnh nhân ${patientId} vào ngày ${dateKey} (Sáng).`);
        row.GHI_CHU = "Quá tải, cần xếp sang buổi chiều";
    }
});

// 4. Export to Excel
console.log('Đang xuất ra file Excel mới...');
const newWorksheet = XLSX.utils.json_to_sheet(data);
const newWorkbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Data_DaPhanBo');
XLSX.writeFile(newWorkbook, OUTPUT_FILE);

console.log(`Đã xuất thành công ra file: ${OUTPUT_FILE}`);

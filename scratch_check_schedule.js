const XLSX = require('xlsx');

function checkFile(filePath) {
    console.log('\n--- Checking file:', filePath, '---');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Tổng hợp
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    let staffSchedules = {};
    let currentStaff = '';
    
    // In format 1, Col A is Person, Col B is Ma BA, Col C is Ten BN, Col D is Ma DV, Col E is Ten DV, Col F is May, Col G is Start, Col H is End
    let startRow = 4; // Data starts at Row 5
    
    for (let i = startRow; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;
        
        if (row[0] && row[0].startsWith('---')) {
            // Shift header
        } else if (row[0] && row[0].includes('(')) {
            // Staff header
            currentStaff = row[0].split('(')[0].trim();
            if (!staffSchedules[currentStaff]) staffSchedules[currentStaff] = [];
        } else if (row[1] && row[6]) { // Ma BA exists and Start Time exists
            const service = row[4];
            const start = row[6];
            const end = row[7];
            const patient = row[2];
            if (currentStaff) {
                staffSchedules[currentStaff].push({ service, patient, start, end });
            }
        }
    }
    
    let totalGaps = 0;
    // Print schedules
    for (const [staff, schedule] of Object.entries(staffSchedules)) {
        console.log(`\nStaff: ${staff}`);
        let lastEnd = null;
        for (const item of schedule) {
            if (lastEnd && lastEnd !== item.start) {
                // Check gap
                const [h1, m1] = lastEnd.split(':').map(Number);
                const [h2, m2] = item.start.split(':').map(Number);
                const gap = (h2*60 + m2) - (h1*60 + m1);
                if (gap > 0 && !(h1 <= 11 && h2 >= 13)) { // Ignore lunch break
                    console.log(`    => GAP: ${gap} mins (from ${lastEnd} to ${item.start})`);
                    totalGaps += gap;
                }
            }
            console.log(`  ${item.start} - ${item.end} : ${item.service} (${item.patient})`);
            lastEnd = item.end;
        }
    }
    console.log('\nTotal gap time:', totalGaps, 'mins');
}

checkFile('d:/1.ProjectBVDKLS/htqlbenhvien/mau/chithoigian/Danh_sach_chia_thoi_gian_theo_bac_si_Khoa Y học cổ truyền_ngay_18-08-2026.xlsx');
checkFile('d:/1.ProjectBVDKLS/htqlbenhvien/mau/chithoigian/Danh_sach_chia_thoi_gian_theo_bac_si_Khoa Y học cổ truyền_ngay_18-08-2026 (1).xlsx');
checkFile('d:/1.ProjectBVDKLS/htqlbenhvien/mau/chithoigian/Danh_sach_chia_thoi_gian_theo_bac_si_Khoa Y học cổ truyền_ngay_18-08-2026 (2).xlsx');
checkFile('d:/1.ProjectBVDKLS/htqlbenhvien/mau/chithoigian/Danh_sach_chia_thoi_gian_theo_bac_si_Khoa Y học cổ truyền_ngay_18-08-2026 (3).xlsx');

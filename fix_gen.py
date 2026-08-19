import sys

content = open('src/app/api/clinical-scheduling/generate/route.ts', 'r', encoding='utf-8').read()

# 1. Add savedSchedules to params
old_params = "const { date, maKhoa, services, patientShifts = {}, serviceStaffMappings = {}, staffShifts = {}, morningStaffs = [], afternoonStaffs = [] } = body;"
new_params = "const { date, maKhoa, services, patientShifts = {}, serviceStaffMappings = {}, staffShifts = {}, morningStaffs = [], afternoonStaffs = [], savedSchedules = [] } = body;"
content = content.replace(old_params, new_params)

# 2. Add sequential matching logic right before 'unscheduled.push' loop
old_prepare = """        // 5. Chuẩn bị danh sách dịch vụ chờ xếp lịch (Unscheduled Pool)\n        const unscheduled = [];"""
new_prepare = """        // --- SEQUENTIAL MATCHING LOGIC ---
        const availableSavedSchedules = [...savedSchedules];
        
        // 5. Chuẩn bị danh sách dịch vụ chờ xếp lịch (Unscheduled Pool)
        const unscheduled = [];
"""
content = content.replace(old_prepare, new_prepare)

old_loop_start = """            let minStartMinutes = mStart;
            if (task.thoi_gian_chi_dinh) {"""
new_loop_start = """
            // --- SEQUENTIAL MATCH FINDER ---
            const soPhieu = String(task.so_phieu || task.SOPHIEU || '');
            let matchedSavedSchedule = null;
            if (soPhieu) {
                const matchIndex = availableSavedSchedules.findIndex(
                    (s: any) => s.so_phieu === soPhieu && String(s.ma_dich_vu) === ma_dich_vu
                );
                if (matchIndex !== -1) {
                    matchedSavedSchedule = availableSavedSchedules[matchIndex];
                    availableSavedSchedules.splice(matchIndex, 1);
                }
            }

            if (matchedSavedSchedule) {
                const sStart = parseTime(matchedSavedSchedule.bat_dau);
                const sEnd = parseTime(matchedSavedSchedule.ket_thuc);
                
                const ma_nv = matchedSavedSchedule.ma_nv;
                const ma_may = matchedSavedSchedule.ma_may;
                
                if (ma_nv) {
                    if (!staffTracker[ma_nv]) staffTracker[ma_nv] = [];
                    staffTracker[ma_nv].push({ start: sStart, end: sEnd });
                }
                if (ma_may) {
                    if (!machineTracker[ma_may]) machineTracker[ma_may] = [];
                    machineTracker[ma_may].push({ start: sStart, end: sEnd });
                }
                
                if (!patientTracker[ma_ba]) patientTracker[ma_ba] = [];
                patientTracker[ma_ba].push({ start: sStart, end: sEnd });

                scheduledResults.push({
                    ...task,
                    nguoi_thuc_hien: matchedSavedSchedule.nguoi_thuc_hien,
                    ma_nv: matchedSavedSchedule.ma_nv,
                    ma_may: matchedSavedSchedule.ma_may,
                    ten_may: matchedSavedSchedule.ten_may,
                    bat_dau: matchedSavedSchedule.bat_dau,
                    ket_thuc: matchedSavedSchedule.ket_thuc,
                    _startMinutes: sStart,
                    is_saved: true
                });
                
                continue;
            }

            let minStartMinutes = mStart;
            if (task.thoi_gian_chi_dinh) {"""
content = content.replace(old_loop_start, new_loop_start)

open('src/app/api/clinical-scheduling/generate/route.ts', 'w', encoding='utf-8').write(content)
print('Done generate')

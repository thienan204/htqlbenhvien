import sys

content = open('src/app/api/clinical-scheduling/generate/route.ts', 'r', encoding='utf-8').read()

# 1. Add Pre-loading logic right before the unscheduled loop
old_prepare = """        // --- SEQUENTIAL MATCHING LOGIC ---
        const availableSavedSchedules = [...savedSchedules];
        
        // 5. Chuẩn bị danh sách dịch vụ chờ xếp lịch (Unscheduled Pool)
        const unscheduled = [];"""

new_prepare = """        // --- PRE-LOAD TRACKERS WITH ALL SAVED SCHEDULES ---
        savedSchedules.forEach((saved: any) => {
            const sStart = parseTime(saved.bat_dau);
            const sEnd = parseTime(saved.ket_thuc);
            const ma_nv = saved.ma_nv;
            const ma_may = saved.ma_may;
            const ma_ba = saved.ma_ba;
            
            if (ma_nv) {
                if (!staffTracker[ma_nv]) staffTracker[ma_nv] = [];
                staffTracker[ma_nv].push({ start: sStart, end: sEnd });
            }
            if (ma_may) {
                if (!machineTracker[ma_may]) machineTracker[ma_may] = [];
                machineTracker[ma_may].push({ start: sStart, end: sEnd });
            }
            if (ma_ba) {
                if (!patientTracker[ma_ba]) patientTracker[ma_ba] = [];
                patientTracker[ma_ba].push({ start: sStart, end: sEnd });
            }
        });

        // --- SEQUENTIAL MATCHING LOGIC ---
        const availableSavedSchedules = [...savedSchedules];
        
        // 5. Chuẩn bị danh sách dịch vụ chờ xếp lịch (Unscheduled Pool)
        const unscheduled = [];"""

content = content.replace(old_prepare, new_prepare)

# 2. Remove Tracker updating from the match block (because they are already updated above)
old_match_block = """            if (matchedSavedSchedule) {
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

                scheduledResults.push({"""

new_match_block = """            if (matchedSavedSchedule) {
                const sStart = parseTime(matchedSavedSchedule.bat_dau);
                
                scheduledResults.push({"""
content = content.replace(old_match_block, new_match_block)

open('src/app/api/clinical-scheduling/generate/route.ts', 'w', encoding='utf-8').write(content)
print('Done pre-load generate')

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to parse time string HH:mm to minutes
function parseTime(timeStr: string) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

// Helper to convert minutes from midnight to HH:mm string
function formatTime(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Helper to check if a time slot is free in a tracker array
function isSlotFree(tracker: { start: number, end: number }[], startSlot: number, duration: number) {
    const endSlot = startSlot + duration;
    for (const busy of tracker) {
        // If there's an overlap
        if (startSlot < busy.end && endSlot > busy.start) {
            return false;
        }
    }
    return true;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, maKhoa, services, patientShifts = {}, serviceStaffMappings = {}, staffShifts = {}, heuristic = 'LPT' } = body;
        // services = [{ ma_ba, ten_bn, ma_dich_vu, ten_dich_vu, ... }, ...]

        if (!date || !maKhoa || !Array.isArray(services) || services.length === 0) {
            return NextResponse.json({ success: false, message: 'Dữ liệu đầu vào không hợp lệ' }, { status: 400 });
        }

        // 1. Lấy cấu hình khoảng cách nghỉ (buffer time)
        const config = await prisma.systemConfig.findUnique({ where: { key: 'clinical_scheduling_buffer_time' } });
        const bufferTime = config ? parseInt(config.value, 10) : 0;

        // 1b. Lấy cấu hình giờ làm việc theo Khoa
        const deptHoursConfig = await prisma.systemConfig.findUnique({ where: { key: 'clinical_scheduling_dept_hours' } });
        let deptHours: { morningStart: string; morningEnd: string; afternoonStart: string; afternoonEnd: string; bufferTime?: number | string } = { morningStart: '07:30', morningEnd: '11:30', afternoonStart: '13:30', afternoonEnd: '17:30' }; // Default
        if (deptHoursConfig && deptHoursConfig.value) {
            const allHours = JSON.parse(deptHoursConfig.value);
            if (allHours[maKhoa]) {
                deptHours = { ...deptHours, ...allHours[maKhoa] };
            }
        }
        const mStart = parseTime(deptHours.morningStart);
        const mEnd = parseTime(deptHours.morningEnd);
        const aStart = parseTime(deptHours.afternoonStart);
        const aEnd = parseTime(deptHours.afternoonEnd);
        const deptBufferTime = deptHours.bufferTime !== undefined ? Number(deptHours.bufferTime) : bufferTime;

        // 2. Lấy thông tin các dịch vụ từ Catalog
        const uniqueServiceCodes = [...new Set(services.map(s => String(s.ma_dich_vu)))];
        const catalogItems = await prisma.mau05Catalog.findMany({
            where: { MA_DICH_VU: { in: uniqueServiceCodes } }
        });

        // Lấy thông tin Phạm vi hành nghề yêu cầu của các dịch vụ
        const scopeMappings = await prisma.scopeServiceMapping.findMany({
            where: { ma_dich_vu: { in: uniqueServiceCodes } }
        });
        const serviceScopes: Record<string, string[]> = {};
        scopeMappings.forEach(mapping => {
            if (!serviceScopes[mapping.ma_dich_vu]) serviceScopes[mapping.ma_dich_vu] = [];
            serviceScopes[mapping.ma_dich_vu].push(mapping.ma_pham_vi);
        });

        const catalogMap: Record<string, any> = {};
        catalogItems.forEach(item => {
            // @ts-ignore: buffer_time có thể chưa được định nghĩa trong type sinh ra
            const itemBufferTime = item.buffer_time;
            // @ts-ignore
            const itemIsConcurrent = item.is_concurrent;
            // @ts-ignore
            const itemReqMachine = item.yeu_cau_may_moc;
            
            if (item.MA_DICH_VU) {
                catalogMap[item.MA_DICH_VU] = {
                    time: item.thoigian_thuc_hien || 10, // Default 10 mins if not set
                    qualification: item.yeu_cau_trinh_do, // Tên hoặc mã chức danh/trình độ
                    bufferTime: itemBufferTime !== null && itemBufferTime !== undefined ? itemBufferTime : deptBufferTime,
                    isConcurrent: itemIsConcurrent || false,
                    reqMachineCode: itemReqMachine || null
                };
            }
        });

        // 2b. Lấy danh sách máy móc khả dụng của Khoa trong ngày
        const targetDate = new Date(date);
        const targetStartOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
        const targetEndOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
        
        // Bỏ qua lỗi schema chưa sync
        // @ts-ignore
        const locationHistories = await prisma.machineLocationHistory.findMany({
            where: {
                ma_khoa: maKhoa,
                AND: [
                    { OR: [{ tu_ngay: null }, { tu_ngay: { lte: targetEndOfDay } }] },
                    { OR: [{ den_ngay: null }, { den_ngay: { gte: targetStartOfDay } }] }
                ]
            }
        });
        const activeMachineCodesInDept = locationHistories.map((h: any) => h.ma_may);

        // Lấy chi tiết các máy đó từ Mau06Catalog
        // @ts-ignore
        const availableMachines = await prisma.mau06Catalog.findMany({
            where: {
                MA_MAY: { in: activeMachineCodesInDept },
                isActive: { not: false }
            }
        });

        // 3. Lấy danh sách nhân viên của khoa và trạng thái điểm danh
        const rawStaff = await prisma.staff.findMany({
            where: { ma_khoa: maKhoa },
            include: {
                chuc_danh_ref: true,
                trinh_do_ref: true,
                attendances: {
                    where: { workDate: { lte: date } },
                    orderBy: { workDate: 'desc' },
                    take: 1,
                    include: { status_ref: true }
                },
                certificates: {
                    where: { isActive: true },
                    include: { scopes: true }
                }
            }
        });

        // Lọc ra nhân viên đi làm (Không có bản ghi điểm danh, hoặc trạng thái không chứa chữ "nghỉ", và is_thuc_hien_dvkt = true)
        const availableStaff = rawStaff.filter(staff => {
            if (staff.attendances.length === 0) return true; // Chưa điểm danh bao giờ = Mặc định đi làm & có làm DVKT
            
            const attendance = staff.attendances[0];
            const isToday = attendance.workDate === date;
            
            if (isToday) {
                const statusName = (attendance.status_ref?.name || '').toLowerCase();
                if (statusName.includes('nghỉ')) return false; // Lọc bỏ nghỉ phép, nghỉ ốm nếu điểm danh hnay
            }
            
            if (attendance.is_thuc_hien_dvkt === false) return false; // Bỏ qua nếu đánh dấu không làm DVKT (bảo lưu trạng thái các ngày trước)
            
            return true;
        });

        if (availableStaff.length === 0) {
            return NextResponse.json({ success: false, message: 'Không có nhân viên nào đang làm việc tại Khoa này trong ngày đã chọn.' }, { status: 400 });
        }

        // 4. Khởi tạo thuật toán xếp lịch
        const staffTracker: Record<string, { start: number, end: number }[]> = {};
        const patientTracker: Record<string, { start: number, end: number }[]> = {};
        const machineTracker: Record<string, { start: number, end: number }[]> = {};

        availableStaff.forEach(s => {
            staffTracker[s.id] = [];
        });
        availableMachines.forEach((m: any) => {
            machineTracker[m.MA_MAY] = [];
        });

        const scheduledResults = [];
        const failedResults = [];
        const patientAssignedStaff: Record<string, Set<string>> = {};

        // 5. Chuẩn bị danh sách dịch vụ chờ xếp lịch (Unscheduled Pool)
        const unscheduled = [];
        for (let i = 0; i < services.length; i++) {
            const task = services[i];
            const ma_dich_vu = String(task.ma_dich_vu);
            const ma_ba = String(task.ma_ba);
            const config = catalogMap[ma_dich_vu] || { time: 10, qualification: null, bufferTime: deptBufferTime, isConcurrent: false };
            const requiredTime = config.time;
            const requiredQual = config.qualification ? config.qualification.toLowerCase() : null;
            const currentServiceBufferTime = config.bufferTime;
            const staffOccupiedTime = config.isConcurrent ? Math.max(1, currentServiceBufferTime) : requiredTime;
            const requiredScopes = serviceScopes[ma_dich_vu] || [];
            
            let capableStaff = availableStaff.filter(s => {
                if (!s.certificates || s.certificates.length === 0) return false;
                for (const cert of s.certificates) {
                    if (cert.dich_vu_ky_thuat) {
                        const extraServices = cert.dich_vu_ky_thuat.split(/[,;]/).map((code: string) => code.trim()).filter(Boolean);
                        const isMatch = extraServices.some(allowedCode => allowedCode === ma_dich_vu || ma_dich_vu.startsWith(allowedCode));
                        if (isMatch) return true;
                    }
                    if (cert.scopes && cert.scopes.length > 0) {
                        const certScopes = cert.scopes.map((sc: any) => sc.ma_pham_vi);
                        const hasMatchingScope = requiredScopes.some(reqScope => certScopes.includes(reqScope));
                        if (hasMatchingScope) return true;
                    }
                }
                return false;
            });

            const assignedStaffIds = serviceStaffMappings[task.ten_dich_vu];
            if (assignedStaffIds && Array.isArray(assignedStaffIds) && assignedStaffIds.length > 0) {
                capableStaff = availableStaff.filter(s => assignedStaffIds.includes(s.id));
            } else if (assignedStaffIds && typeof assignedStaffIds === 'string') {
                const assignedStaff = availableStaff.find(s => s.id === assignedStaffIds);
                if (assignedStaff) capableStaff = [assignedStaff];
                else capableStaff = [];
            }

            if (capableStaff.length === 0) {
                if (requiredScopes.length > 0) {
                    failedResults.push({ ...task, error: `Không có NV nào trong Khoa đi làm có CCHN phù hợp (Yêu cầu PVHN: ${requiredScopes.join(', ')})` });
                } else {
                    failedResults.push({ ...task, error: 'Dịch vụ chưa cấu hình Phạm vi hành nghề yêu cầu (Và không có NV nào được gán đích danh).' });
                }
                continue;
            }

            const requiredMachineCode = config.reqMachineCode;
            let capableMachines = availableMachines;
            if (requiredMachineCode) {
                capableMachines = availableMachines.filter((m: any) => (m.loai_may_code || '').trim() === requiredMachineCode.trim());
            }
            if (requiredMachineCode && capableMachines.length === 0) {
                failedResults.push({ ...task, error: 'Không có thiết bị loại ' + requiredMachineCode + ' khả dụng trong ngày' });
                continue;
            }

            let minStartMinutes = mStart;
            if (task.thoi_gian_chi_dinh) {
                const timeStr = String(task.thoi_gian_chi_dinh).trim();
                let hm = '';
                if (timeStr.includes(' ')) {
                    hm = timeStr.split(' ').find(p => p.includes(':')) || '';
                } else {
                    hm = timeStr;
                }
                if (hm) {
                    const prescriptionMinutes = parseTime(hm.substring(0, 5));
                    if (prescriptionMinutes > minStartMinutes) {
                        minStartMinutes = prescriptionMinutes;
                    }
                }
            }

            unscheduled.push({
                task,
                config,
                requiredTime,
                currentServiceBufferTime,
                staffOccupiedTime,
                capableStaffIds: new Set(capableStaff.map(s => s.id)),
                requiredMachineCode,
                capableMachines,
                minStartMinutes,
                index: i
            });

            if (!patientTracker[ma_ba]) {
                patientTracker[ma_ba] = [];
            }
        }

        // 6. Mô phỏng sự kiện (Event-driven / Greedy) - Quét theo từng phút
        let currentTime = mStart;
        while (unscheduled.length > 0 && currentTime < aEnd) {
            // Bỏ qua giờ nghỉ trưa
            if (currentTime >= mEnd && currentTime < aStart) {
                currentTime = aStart;
            }

            let scheduledAnyInThisMinute = false;

            // Xử lý từng nhân viên đang rảnh
            for (const staff of availableStaff) {
                let keepAssigningToStaff = true;
                
                while (keepAssigningToStaff) {
                    keepAssigningToStaff = false;

                    // Tối ưu: Nếu nhân viên đang bận ngay tại phút này, bỏ qua luôn
                    if (!isSlotFree(staffTracker[staff.id], currentTime, 1)) break;

                    // Tìm tất cả ứng viên (dịch vụ) có thể thực hiện bởi staff này lúc currentTime
                    const candidates = [];
                    for (const u of unscheduled) {
                        const ma_ba = String(u.task.ma_ba);

                        // Chặn theo ca Bệnh nhân
                        const shiftPref = patientShifts[ma_ba];
                        if (shiftPref === 'MORNING' && currentTime >= mEnd) continue;
                        if (shiftPref === 'AFTERNOON' && currentTime < aStart) continue;

                        // Chặn theo ca Nhân viên
                        const staffShiftPref = staffShifts[staff.id];
                        if (staffShiftPref === 'MORNING' && currentTime >= mEnd) continue;
                        if (staffShiftPref === 'AFTERNOON' && currentTime < aStart) continue;

                        // Chặn theo thời gian chỉ định
                        if (currentTime < u.minStartMinutes) continue;

                        // Nhân viên này có làm được không?
                        if (!u.capableStaffIds.has(staff.id)) continue;

                        // Nhân viên có rảnh đủ thời gian không?
                        const totalStaffOccupiedTime = u.staffOccupiedTime + (u.config.isConcurrent ? 0 : u.currentServiceBufferTime);
                        if (currentTime + u.requiredTime > (currentTime < mEnd ? mEnd : aEnd)) continue; // Không vắt qua ca
                        if (!isSlotFree(staffTracker[staff.id], currentTime, totalStaffOccupiedTime)) continue;

                        // Bệnh nhân có rảnh không?
                        const totalPatientOccupiedTime = u.requiredTime + u.currentServiceBufferTime;
                        if (!isSlotFree(patientTracker[ma_ba], currentTime, totalPatientOccupiedTime)) continue;

                        // Máy có rảnh không?
                        let machineFree = true;
                        let selectedMachine = null;
                        if (u.requiredMachineCode) {
                            machineFree = false;
                            for (const machine of u.capableMachines) {
                                if (!machine.MA_MAY) continue;
                                const mTracker = machineTracker[machine.MA_MAY as string];
                                if (isSlotFree(mTracker, currentTime, u.requiredTime + u.currentServiceBufferTime)) {
                                    machineFree = true;
                                    selectedMachine = machine;
                                    break;
                                }
                            }
                        }
                        if (!machineFree) continue;

                        candidates.push({ ...u, selectedMachine });
                    }

                    // Nếu có ứng viên, chọn ra 1 người dựa theo chiến thuật (Heuristic)
                    if (candidates.length > 0) {
                        let winner = candidates[0];
                        if (candidates.length > 1) {
                            if (heuristic === 'LPT') {
                                // Longest Processing Time First
                                candidates.sort((a, b) => b.requiredTime - a.requiredTime || a.index - b.index);
                            } else if (heuristic === 'SPT') {
                                // Shortest Processing Time First
                                candidates.sort((a, b) => a.requiredTime - b.requiredTime || a.index - b.index);
                            } else {
                                // First Come First Serve
                                candidates.sort((a, b) => a.index - b.index);
                            }
                            winner = candidates[0];
                        }

                        // Gán lịch cho người chiến thắng
                        const finalTime = currentTime;
                        const endTime = finalTime + winner.requiredTime;
                        const ma_ba = String(winner.task.ma_ba);

                        const totalStaffOccupiedTime = winner.staffOccupiedTime + (winner.config.isConcurrent ? 0 : winner.currentServiceBufferTime);
                        
                        staffTracker[staff.id].push({ start: finalTime, end: finalTime + totalStaffOccupiedTime });
                        patientTracker[ma_ba].push({ start: finalTime, end: endTime + winner.currentServiceBufferTime });
                        
                        if (winner.selectedMachine && winner.selectedMachine.MA_MAY) {
                            machineTracker[winner.selectedMachine.MA_MAY].push({ start: finalTime, end: endTime + winner.currentServiceBufferTime });
                        }

                        scheduledResults.push({
                            ...winner.task,
                            nguoi_thuc_hien: staff.ho_ten,
                            ma_nv: staff.ma_nv,
                            cchn: (staff.certificates && staff.certificates.length > 0) ? staff.certificates[0].so_cchn : '',
                            ma_may: winner.selectedMachine ? winner.selectedMachine.MA_MAY : '',
                            ten_may: winner.selectedMachine ? (winner.selectedMachine.TEN_BV || winner.selectedMachine.TEN_TB) : '',
                            bat_dau: formatTime(finalTime),
                            ket_thuc: formatTime(endTime),
                            _startMinutes: finalTime
                        });

                        // Xóa khỏi bể chứa
                        const idx = unscheduled.findIndex(u => u.index === winner.index);
                        if (idx !== -1) unscheduled.splice(idx, 1);

                        scheduledAnyInThisMinute = true;
                        
                        // Nếu dịch vụ này là song song (occupied time = 0), staff vẫn rảnh trong phút này!
                        if (isSlotFree(staffTracker[staff.id], currentTime, 1)) {
                            keepAssigningToStaff = true;
                        }
                    }
                }
            }

            if (!scheduledAnyInThisMinute) {
                // Không ai xếp được ở phút này, tua thời gian tới
                currentTime++;
            }
        }

        // 7. Nhặt những ca không thể xếp được (hết giờ)
        for (const u of unscheduled) {
            const ma_ba = String(u.task.ma_ba);
            const shiftPref = patientShifts[ma_ba];
            if (shiftPref === 'MORNING') {
                failedResults.push({ ...u.task, error: 'Đã kín lịch hoặc không có máy trống trong buổi Sáng' });
            } else if (shiftPref === 'AFTERNOON') {
                failedResults.push({ ...u.task, error: 'Đã kín lịch hoặc không có máy trống trong buổi Chiều' });
            } else {
                failedResults.push({ ...u.task, error: 'Đã kín lịch hoặc không có máy trống trong toàn bộ khung giờ làm việc' });
            }
        }

        // Sắp xếp lại kết quả theo thời gian bắt đầu
        scheduledResults.sort((a, b) => a._startMinutes - b._startMinutes);

        return NextResponse.json({
            success: true,
            scheduled: scheduledResults,
            failed: failedResults
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}

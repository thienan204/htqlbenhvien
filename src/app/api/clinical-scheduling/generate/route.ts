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
        const { date, maKhoa, services } = body;
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
        const uniqueServiceCodes = [...new Set(services.map(s => s.ma_dich_vu))];
        const catalogItems = await prisma.mau05Catalog.findMany({
            where: { MA_DICH_VU: { in: uniqueServiceCodes } }
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
                    where: { workDate: date },
                    include: { status_ref: true }
                }
            }
        });

        // Lọc ra nhân viên đi làm (Không có bản ghi điểm danh, hoặc trạng thái không chứa chữ "nghỉ", và is_thuc_hien_dvkt = true)
        const availableStaff = rawStaff.filter(staff => {
            if (staff.attendances.length === 0) return true; // Chưa điểm danh = Mặc định đi làm & có làm DVKT
            
            const attendance = staff.attendances[0];
            const statusName = (attendance.status_ref?.name || '').toLowerCase();
            
            if (statusName.includes('nghỉ')) return false; // Lọc bỏ nghỉ phép, nghỉ ốm...
            if (attendance.is_thuc_hien_dvkt === false) return false; // Bỏ qua nếu đánh dấu không làm DVKT
            
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

        // 5. Chạy thuật toán cho từng dòng dữ liệu
        for (const task of services) {
            const { ma_dich_vu, ma_ba } = task;
            const config = catalogMap[ma_dich_vu] || { time: 10, qualification: null, bufferTime: deptBufferTime, isConcurrent: false };
            const requiredTime = config.time;
            const requiredQual = config.qualification ? config.qualification.toLowerCase() : null;
            const currentServiceBufferTime = config.bufferTime;
            // Tính toán thời gian Bác sĩ thực sự bị chiếm dụng (khoảng cách giữa các lần làm song song)
            // Lấy chính xác theo cấu hình Buffer của Dịch vụ -> Khoa (tối thiểu 1 phút để không bị trùng hoàn toàn)
            const staffOccupiedTime = config.isConcurrent ? Math.max(1, currentServiceBufferTime) : requiredTime;

            // Tìm nhân viên phù hợp
            let capableStaff = availableStaff;
            if (requiredQual) {
                const requiredQualList = requiredQual.split(',').map((q: string) => q.trim()).filter(Boolean);
                
                capableStaff = availableStaff.filter(s => {
                    const chucDanh = (s.chuc_danh_ref?.name || s.chuc_danh_ref?.code || '').toLowerCase();
                    const trinhDo = (s.trinh_do_ref?.name || s.trinh_do_ref?.code || '').toLowerCase();
                    
                    // Khớp với BẤT KỲ trình độ nào trong danh sách
                    return requiredQualList.some((qual: string) => chucDanh.includes(qual) || trinhDo.includes(qual));
                });
            }

            if (capableStaff.length === 0) {
                failedResults.push({ ...task, error: 'Không tìm thấy nhân viên có trình độ phù hợp' });
                continue;
            }

            if (!patientTracker[ma_ba]) {
                patientTracker[ma_ba] = [];
            }

            // Lấy danh sách máy phù hợp (nếu dịch vụ có yêu cầu máy)
            const requiredMachineCode = config.reqMachineCode;
            let capableMachines = availableMachines;
            if (requiredMachineCode) {
                capableMachines = availableMachines.filter((m: any) => (m.loai_may_code || '').trim() === requiredMachineCode.trim());
            }
            
            if (requiredMachineCode && capableMachines.length === 0) {
                failedResults.push({ ...task, error: 'Không có thiết bị loại ' + requiredMachineCode + ' khả dụng trong ngày' });
                continue;
            }

            // Tìm khung giờ sớm nhất thỏa mãn cả 3 yếu tố: Nhân viên, Bệnh nhân, và Máy móc (nếu cần)
            let earliestGlobalTime = 24 * 60; // Max time
            let chosenStaffForEarliest = null;
            let chosenMachineForEarliest = null;

            for (const staff of capableStaff) {
                const sTracker = staffTracker[staff.id];
                const pTracker = patientTracker[ma_ba];
                
                let currentTime = mStart;
                while (currentTime < aEnd) { 
                    // Bỏ qua giờ nghỉ trưa
                    if (currentTime + requiredTime > mEnd && currentTime < aStart) {
                        currentTime = aStart;
                    }

                    // Nếu nhảy qua aEnd thì dừng
                    if (currentTime + requiredTime > aEnd) {
                        break;
                    }

                    // Điều kiện 1 & 2: Nhân viên rảnh và Bệnh nhân rảnh
                    if (isSlotFree(sTracker, currentTime, staffOccupiedTime) && isSlotFree(pTracker, currentTime, requiredTime)) {
                        
                        // Điều kiện 3: Máy móc rảnh (nếu cần)
                        let machineFree = true;
                        let selectedMachine = null;
                        
                        if (requiredMachineCode) {
                            machineFree = false;
                            // Tìm 1 máy rảnh trong số các máy phù hợp
                            for (const machine of capableMachines) {
                                if (!machine.MA_MAY) continue;
                                const mTracker = machineTracker[machine.MA_MAY as string];
                                if (isSlotFree(mTracker, currentTime, requiredTime)) {
                                    machineFree = true;
                                    selectedMachine = machine;
                                    break;
                                }
                            }
                        }

                        if (machineFree) {
                            if (currentTime < earliestGlobalTime) {
                                earliestGlobalTime = currentTime;
                                chosenStaffForEarliest = staff;
                                chosenMachineForEarliest = selectedMachine;
                            }
                            break; // Tìm được giờ sớm nhất cho nhân viên này thì dừng vòng lặp while
                        }
                    }
                    // Nhảy 1 phút một lần để check lại
                    currentTime += 1;
                }
            }

            if (chosenStaffForEarliest && earliestGlobalTime < 24 * 60) {
                // Book the slot
                const endTime = earliestGlobalTime + requiredTime;
                
                // Bác sĩ chỉ bị giam khoảng staffOccupiedTime, cộng thêm bufferTime nếu không phải làm song song
                staffTracker[chosenStaffForEarliest.id].push({ start: earliestGlobalTime, end: earliestGlobalTime + staffOccupiedTime + (config.isConcurrent ? 0 : currentServiceBufferTime) });
                
                // Bệnh nhân vẫn tính đủ buffer time
                patientTracker[ma_ba].push({ start: earliestGlobalTime, end: endTime + currentServiceBufferTime }); 
                
                // Máy móc bị giam 100% thời gian (kể cả làm song song), cộng thêm buffer time để máy được vệ sinh/nghỉ ngơi
                if (chosenMachineForEarliest && chosenMachineForEarliest.MA_MAY) {
                    machineTracker[chosenMachineForEarliest.MA_MAY as string].push({ start: earliestGlobalTime, end: endTime + currentServiceBufferTime });
                }

                scheduledResults.push({
                    ...task,
                    nguoi_thuc_hien: chosenStaffForEarliest.ho_ten,
                    ma_may: chosenMachineForEarliest ? chosenMachineForEarliest.MA_MAY : '',
                    ten_may: chosenMachineForEarliest ? (chosenMachineForEarliest.TEN_BV || chosenMachineForEarliest.TEN_TB) : '',
                    bat_dau: formatTime(earliestGlobalTime),
                    ket_thuc: formatTime(endTime),
                    _startMinutes: earliestGlobalTime // used for sorting later
                });
            } else {
                failedResults.push({ ...task, error: 'Hết khung giờ trống trong ngày' });
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

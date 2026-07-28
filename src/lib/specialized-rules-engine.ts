import { ExtendedHosoRecord, getXmlDataList } from '@/lib/xml';

const DISTINCT_COLORS = [
    '#ffebee', '#e3f2fd', '#e8f5e9', '#f3e5f5', '#fff3e0',
    '#e0f7fa', '#fce4ec', '#f1f8e9', '#fff8e1', '#e8eaf6',
    '#efebe9', '#e0f2f1', '#f9fbe7', '#eceff1', '#fffde7',
    '#ffcdd2', '#c8e6c9', '#b3e5fc', '#d1c4e9', '#ffecb3'
];

export const parseDate = (str: string) => {
    // YYYYMMDD or YYYYMMDDHHmm or YYYYMMDDHHmmss
    if (!str) return new Date(0);
    const y = parseInt(str.substring(0, 4)) || 0;
    const m = (parseInt(str.substring(4, 6)) || 1) - 1;
    const d = parseInt(str.substring(6, 8)) || 1;
    const h = str.length >= 10 ? parseInt(str.substring(8, 10)) : 0;
    const min = str.length >= 12 ? parseInt(str.substring(10, 12)) : 0;
    const sec = str.length >= 14 ? parseInt(str.substring(12, 14)) : 0;
    const dObj = new Date(y, m, d, h, min, sec);
    if (isNaN(dObj.getTime())) return new Date(0);
    return dObj;
};

export const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '';
    // Length 14 (YYYYMMDDHHmmss) -> DD/MM/YYYY HH:mm:ss
    if (dateStr.length >= 14) {
        return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)} ${dateStr.substring(8, 10)}:${dateStr.substring(10, 12)}:${dateStr.substring(12, 14)}`;
    }
    // Length 12 (YYYYMMDDHHmm) -> DD/MM/YYYY HH:mm:ss
    if (dateStr.length >= 12) {
        return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)} ${dateStr.substring(8, 10)}:${dateStr.substring(10, 12)}:00`;
    }
    return dateStr;
};

// ==========================================
// 1. DUPLICATE BED (TRÙNG GIƯỜNG / THỜI GIAN)
// ==========================================
export const runDuplicateBedRule = (data: ExtendedHosoRecord[], config: any, deptMap: Record<string, string> = {}, staffMap: Record<string, any> = {}) => {
    const { fields, filter } = config;
    const list: any[] = [];
    let index = 1;

    // 1. Flatten Services
    data.forEach(record => {
        record.groups.forEach(group => {
            if (group.type === 'XML3') {
                const servs = getXmlDataList(group);
                servs.forEach((item: any) => {
                    let match = true;
                    if (filter) {
                        for (const [key, value] of Object.entries(filter)) {
                            if (value === '' || value === null || value === undefined) continue;

                            if (key === 'MA_DICH_VU_INCLUDE' && Array.isArray(value)) {
                                if (value.length > 0 && !value.includes(item.MA_DICH_VU)) match = false;
                                continue;
                            }
                            if (key === 'MA_DICH_VU_EXCLUDE' && Array.isArray(value)) {
                                if (value.length > 0 && value.includes(item.MA_DICH_VU)) match = false;
                                continue;
                            }

                            if (Array.isArray(value)) {
                                if (value.length > 0 && !value.map(String).includes(String(item[key]))) match = false;
                            } else {
                                if (item[key] != value) match = false;
                            }
                        }
                    }

                    if (match) {
                        let keyValues: string[] = [];
                        if (fields?.bed) {
                            if (Array.isArray(fields.bed) && fields.bed.length > 0) {
                                const bedFieldStr = fields.bed[0];
                                const rawVal = item[bedFieldStr] || record.summary?.[bedFieldStr] || '';
                                keyValues = [String(rawVal).split(';')[0].trim()];
                                
                                if (fields.bed.length > 1) {
                                    const suffix = fields.bed.slice(1).map((b: string) => {
                                        const rv = item[b] || record.summary?.[b] || '';
                                        return String(rv).split(';')[0].trim();
                                    }).join('-');
                                    keyValues = keyValues.map(k => `${k}-${suffix}`);
                                }
                            } else {
                                const rawVal = item[fields.bed] || record.summary?.[fields.bed] || '';
                                keyValues = [String(rawVal).split(';')[0].trim()];
                            }
                        } else {
                            keyValues = [item.MA_GIUONG || ''];
                        }

                        if (keyValues.length === 0) keyValues = [''];

                        const startTime = fields?.startTime ? item[fields.startTime] : item.NGAY_YL;
                        const endTime = fields?.endTime ? item[fields.endTime] : item.NGAY_KQ;
                        const deptCode = fields?.department ? item[fields.department] : (item.MA_KHOA || record.summary?.MA_KHOA);
                        const maBs = item.MA_BS || item.MA_BAC_SI || '';
                        const nguoiThucHien = item.NGUOI_THUC_HIEN || '';

                        keyValues.forEach((keyValue, kIndex) => {
                            list.push({
                                key: `${record.id}_${item.MA_DICH_VU}_${index}_${kIndex}`,
                                stt: index++,
                                MA_LK: record.summary?.MA_LK,
                                MA_BN: record.summary?.MA_BN,
                                MA_THE_BHYT: record.summary?.MA_THE_BHYT,
                                HO_TEN: record.summary?.HO_TEN,
                                MA_KHOA: deptCode,
                                TEN_KHOA: deptMap[deptCode] || '',
                                MA_BAC_SI: maBs,
                                TEN_BAC_SI: staffMap[maBs]?.ho_ten || '',
                                TRINH_DO: staffMap[maBs]?.trinh_do || '',
                                NGUOI_THUC_HIEN: nguoiThucHien,
                                TEN_NGUOI_THUC_HIEN: nguoiThucHien ? String(nguoiThucHien).split(';').map(c => staffMap[c.trim()]?.ho_ten || c.trim()).filter(Boolean).join('; ') : '',
                                MA_GIUONG: item.MA_GIUONG || '',
                                KEY_VALUE: keyValue || '',
                                TYLE_BH: item.TYLE_TT_BH || '',
                                TYLE_DV: item.TYLE_TT_DV || '',
                                NGAY_YL: item.NGAY_YL || '',
                                NGAY_KQ: item.NGAY_KQ || '',
                                NGAY_VAO: record.summary?.NGAY_VAO || '',
                                NGAY_RA: record.summary?.NGAY_RA || '',
                                NGAY_TH_YL: item.NGAY_TH_YL || '',
                                MA_DICH_VU: item.MA_DICH_VU,
                                TEN_DICH_VU: item.TEN_DICH_VU,
                                SOLUONG: item.SO_LUONG || 0,

                                _start: parseDate(startTime),
                                _end: parseDate(endTime).getTime() === 0 && parseDate(startTime).getTime() !== 0 ? parseDate(startTime) : parseDate(endTime),
                                _ma_giuong: item.MA_GIUONG,
                                _key_value: keyValue,
                                _ma_khoa: deptCode,

                                original: item,
                                recordId: record.id
                            });
                        });
                    }
                });
            }
        });
    });

    // 2. Scan Overlaps
    const groups: Record<string, typeof list> = {};
    list.forEach(item => {
        const groupKeyStr = item._key_value || item._ma_giuong;
        if (!groupKeyStr) return;
        if (!groups[groupKeyStr]) groups[groupKeyStr] = [];
        groups[groupKeyStr].push(item);
    });

    const duplicateItems: any[] = [];
    const overlaps = new Set<string>();
    let globalColorIndex = 0;

    Object.entries(groups).forEach(([key, items]) => {
        if (items.length < 2) return;

        items.sort((a, b) => a._start.getTime() - b._start.getTime());
        const adj: Record<number, number[]> = {};
        for (let i = 0; i < items.length; i++) adj[i] = [];

        for (let i = 0; i < items.length; i++) {
            const curr = items[i];
            for (let j = i + 1; j < items.length; j++) {
                const next = items[j];

                if (curr._start.getTime() === 0 || next._start.getTime() === 0) continue;

                const overlapMinutes = (Math.min(curr._end.getTime(), next._end.getTime()) - Math.max(curr._start.getTime(), next._start.getTime())) / 60000;
                const tolerance = config?.toleranceMinutes || 0;

                const isExactMatch = curr._start.getTime() === next._start.getTime() && curr._start.getTime() === curr._end.getTime() && next._start.getTime() === next._end.getTime();
                const isZeroDurationCollision = overlapMinutes === 0 && (curr._start.getTime() === curr._end.getTime() || next._start.getTime() === next._end.getTime());

                const ignoreIfSameField = config?.ignoreIfSameField;
                let isIgnoreMatch = false;

                if (ignoreIfSameField) {
                    const valA = curr[ignoreIfSameField] !== undefined ? String(curr[ignoreIfSameField]) : (curr.original ? String(curr.original[ignoreIfSameField]) : undefined);
                    const valB = next[ignoreIfSameField] !== undefined ? String(next[ignoreIfSameField]) : (next.original ? String(next.original[ignoreIfSameField]) : undefined);

                    if (valA && valB && valA === valB && valA !== 'undefined') {
                        isIgnoreMatch = true;
                    }
                }

                if (isIgnoreMatch) continue;

                if (overlapMinutes > tolerance || isExactMatch || isZeroDurationCollision) {
                    adj[i].push(j);
                    adj[j].push(i);
                }
            }
        }

        const visited = new Set<number>();
        for (let i = 0; i < items.length; i++) {
            if (visited.has(i)) continue;
            if (adj[i].length === 0) continue;

            const queue = [i];
            visited.add(i);
            const component = [i];

            while (queue.length > 0) {
                const u = queue.shift()!;
                for (const v of adj[u]) {
                    if (!visited.has(v)) {
                        visited.add(v);
                        queue.push(v);
                        component.push(v);
                    }
                }
            }

            if (component.length > 1) {
                const groupColor = DISTINCT_COLORS[globalColorIndex % DISTINCT_COLORS.length];
                const groupId = `group_${globalColorIndex}`;
                globalColorIndex++;

                component.forEach(idx => {
                    duplicateItems.push({
                        ...items[idx],
                        groupId,
                        rowColor: groupColor
                    });
                    overlaps.add(items[idx].recordId); // Collect overlapping record IDs
                });
            }
        }
    });

    duplicateItems.sort((a, b) => {
        const aKey = a._key_value || a._ma_giuong || '';
        const bKey = b._key_value || b._ma_giuong || '';
        if (aKey !== bKey) return aKey.localeCompare(bKey);
        
        if (a.groupId !== b.groupId) return (a.groupId || '').localeCompare(b.groupId || '', undefined, { numeric: true });

        return a._start.getTime() - b._start.getTime();
    });

    return { results: duplicateItems, overlaps, rawList: list };
};

// ==========================================
// 2. DUPLICATE DOCTOR (TRÙNG BÁC SĨ CÙNG THỜI ĐIỂM)
// ==========================================
export const runDuplicateDoctorRule = (data: ExtendedHosoRecord[], config: any, deptMap: Record<string, string> = {}, staffMap: Record<string, any> = {}) => {
    const fieldMaBs = config.fields?.doctor || 'MA_BS';
    const fieldNgayYl = config.fields?.time || 'NGAY_YL';
    
    const list: any[] = [];
    let index = 1;

    data.forEach(record => {
        record.groups.forEach(group => {
            if (group.type === 'XML2' || group.type === 'XML3') {
                const items = getXmlDataList(group);
                items.forEach((item: any) => {
                    const maBs = item[fieldMaBs] || item.MA_BAC_SI || item.MA_BS;
                    const ngayYl = item[fieldNgayYl] || item.NGAY_YL;

                    if (maBs && ngayYl) {
                        const configuredMaNhom = config.filter?.MA_NHOM;
                        if (configuredMaNhom && Array.isArray(configuredMaNhom) && configuredMaNhom.length > 0) {
                            if (!configuredMaNhom.includes(Number(item.MA_NHOM))) {
                                return;
                            }
                        }

                        const deptCode = item.MA_KHOA || record.summary?.MA_KHOA || '';
                        const isThuoc = group.type === 'XML2';

                        list.push({
                            key: `${record.id}_${item.MA_DICH_VU || item.MA_THUOC}_${index}`,
                            stt: index++,
                            MA_LK: record.summary?.MA_LK,
                            MA_BN: record.summary?.MA_BN || '',
                            HO_TEN: record.summary?.HO_TEN,
                            MA_KHOA: deptCode,
                            TEN_KHOA: deptMap[deptCode] || '',
                            MA_BS: maBs,
                            TEN_BAC_SI: staffMap[maBs]?.ho_ten || '',
                            TRINH_DO: staffMap[maBs]?.trinh_do || '',
                            THOI_GIAN_YL: ngayYl,
                            TYPE: isThuoc ? 'Thuốc' : 'Dịch Vụ',
                            MA_LOAI: isThuoc ? item.MA_THUOC : item.MA_DICH_VU,
                            TEN_LOAI: isThuoc ? item.TEN_THUOC : item.TEN_DICH_VU,
                            NGAY_VAO: record.summary?.NGAY_VAO || '',
                            NGAY_RA: record.summary?.NGAY_RA || '',

                            _ma_bs: maBs,
                            _ngay_yl: ngayYl,
                            _ma_lk: record.summary?.MA_LK,
                            _ma_bn: record.summary?.MA_BN || '',

                            original: item,
                            recordId: record.id
                        });
                    }
                });
            }
        });
    });

    const overlaps = new Set<string>();
    const groups: Record<string, typeof list> = {};

    list.forEach(item => {
        const groupKey = `${item._ma_bs}_${item._ngay_yl}`;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(item);
    });

    let filteredList: any[] = [];
    let colorIdx = 0;

    Object.entries(groups).forEach(([groupKey, items]) => {
        const distinctPatients = new Set(items.map(item => item._ma_bn));
        if (distinctPatients.size > 1) { // Same doctor same time but DIFFERENT patients
            const assignedColor = DISTINCT_COLORS[colorIdx % DISTINCT_COLORS.length];
            colorIdx++;

            items.forEach(item => {
                filteredList.push({
                    ...item,
                    groupId: groupKey,
                    rowColor: assignedColor
                });
                overlaps.add(item.recordId);
            });
        }
    });

    filteredList.sort((a, b) => {
        if (a._ma_bs !== b._ma_bs) return (a._ma_bs || '').localeCompare(b._ma_bs || '');
        if (a._ngay_yl !== b._ngay_yl) return (a._ngay_yl || '').localeCompare(b._ngay_yl || '');
        return a.stt - b.stt;
    });

    return { results: filteredList, overlaps, rawList: list };
};

// ==========================================
// 3. MACHINE CHECK
// ==========================================
export const runMachineCheckRule = (data: ExtendedHosoRecord[], config: any) => {
    const { fields, constraints, filter } = config;
    const machineUsage: Record<string, any[]> = {};
    const errors: any[] = [];
    const overlaps = new Set<string>();

    data.forEach(record => {
        record.groups.forEach(group => {
            if (!group.type.startsWith('XML')) return;

            const list = getXmlDataList(group);
            list.forEach((item: any) => {
                if (filter && filter.ma_nhom && item.MA_NHOM != filter.ma_nhom) return;

                const machineCode = item[fields.machineCode];
                const serviceCode = item[fields.serviceCode];
                const timeStr = item[fields.time];

                if (machineCode && timeStr) {
                    if (!machineUsage[machineCode]) machineUsage[machineCode] = [];
                    machineUsage[machineCode].push({
                        id: record.summary?.MA_LK,
                        recordId: record.id,
                        patientName: record.summary?.HO_TEN,
                        serviceName: item.TEN_DICH_VU,
                        time: parseDate(timeStr),
                        originalRecord: record
                    });
                }
            });
        });
    });

    Object.entries(machineUsage).forEach(([code, usages]) => {
        usages.sort((a, b) => a.time.getTime() - b.time.getTime());

        if (constraints?.maxPerDay) {
            const byDay: Record<string, { count: number, records: Set<string> }> = {};
            usages.forEach(u => {
                const day = u.time.toISOString().split('T')[0];
                if (!byDay[day]) byDay[day] = { count: 0, records: new Set() };
                byDay[day].count += 1;
                byDay[day].records.add(u.recordId);
            });
            Object.entries(byDay).forEach(([day, data]) => {
                if (data.count > constraints.maxPerDay) {
                    errors.push({
                        key: `${code}_${day}`,
                        message: `Máy ${code} quá tải ngày ${day}: ${data.count} lần (Max: ${constraints.maxPerDay})`,
                        type: 'OVERLOAD',
                        details: { machine: code, day, count: data.count }
                    });
                    data.records.forEach(r => overlaps.add(r));
                }
            });
        }
    });

    return { results: errors, overlaps };
};

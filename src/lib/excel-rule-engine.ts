// src/lib/excel-rule-engine.ts

export interface RuleConfig {
    id: string;
    ruleName: string;
    ruleType: 'TIME_OVERLAP' | 'EXACT_DUPLICATE' | 'OTHER';
    mapping: {
        groupCols?: string[]; // e.g., ['MA_MAY'] or ['NGUOI_THUC_HIEN']
        startCol?: string;    // e.g., 'GIO_BAT_DAU'
        endCol?: string;      // e.g., 'GIO_KET_THUC'
        serviceCol?: string;  // e.g., 'MA_DICH_VU'
        minGapMinutes?: number;
        ignoreValues?: string[];
    };
    permissions?: {
        allowedServices?: string[];
        excludedServices?: string[];
        departmentOverrides?: {
            departmentCode: string;
            allowedServices?: string[];
            excludedServices?: string[];
        }[];
    };
    active: boolean;
}

export interface ExcelTemplate {
    id: string;
    name: string;
    slug: string;
    description?: string;
    rules: RuleConfig[];
    outputConfig?: {
        exportFileName?: string;
        columnsToExport?: string[];
        displayColumns?: string[];
        columnOrder?: string[];
        includeViolationColumn?: boolean;
    };
    createdAt?: number;
    updatedAt?: number;
}

// Result structure per row
export interface RowResult {
    _uid: number; // Original index
    _violations: string[]; // List of rule names violated
    _overlap_duration?: string; // E.g., "15 phút", or "10:00 - 10:15"
    _groupId?: number; // Group ID for color coding overlaps
    [key: string]: any; // Original column data
}

export interface EngineContext {
    departmentCode?: string; // Current user's department
    customRuleFilters?: Record<string, { allowed?: string[]; excluded?: string[] }>; // Department's custom filter for this session per rule
    _nextGroupId?: number; // Internal counter for overlap groups
    _itemsRef?: RowResult[]; // Internal reference for group merging
}

/**
 * Parses date from various string formats or Excel numbers.
 * Reuse logic from the old PTTT page.
 */
export const parseDateStr = (dateStr: any): Date | null => {
    if (dateStr === null || dateStr === undefined || dateStr === '') return null;
    if (dateStr instanceof Date) return dateStr;
    if (typeof dateStr === 'number') {
        const ms = Math.round((dateStr - 25569) * 86400 * 1000);
        return new Date(ms); 
    }
    const s = String(dateStr).trim();
    const yyyymmddhhmm = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (yyyymmddhhmm) {
        return new Date(parseInt(yyyymmddhhmm[1]), parseInt(yyyymmddhhmm[2]) - 1, parseInt(yyyymmddhhmm[3]), parseInt(yyyymmddhhmm[4]), parseInt(yyyymmddhhmm[5]));
    }
    const yyyymmdd = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmdd) {
        return new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
    }
    const dmyhm = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2})/);
    if (dmyhm) {
        return new Date(parseInt(dmyhm[3]), parseInt(dmyhm[2]) - 1, parseInt(dmyhm[1]), parseInt(dmyhm[4]), parseInt(dmyhm[5]));
    }
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
        return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return null;
};

const getInd = (name: string, hdArray: string[]) => {
    const lowerName = String(name).trim().toLowerCase();
    return hdArray.findIndex(h => h && String(h).trim().toLowerCase() === lowerName);
};

export const executeRules = (
    headers: string[], 
    data: any[], 
    template: ExcelTemplate, 
    context: EngineContext = {}
): RowResult[] => {
    
    // Prepare items with UID
    const items = data.map((row, idx) => ({ ...row, _uid: idx, _violations: [], _groupId: undefined }));
    const activeRules = (template.rules || []).filter(r => r.active !== false);

    const internalContext = { ...context, _nextGroupId: 1, _itemsRef: items };

    for (const rule of activeRules) {
        if (rule.ruleType === 'TIME_OVERLAP') {
            checkTimeOverlap(headers, items, rule, internalContext);
        }
        // Switch for other rules in the future...
    }

    return items;
};

const checkTimeOverlap = (headers: string[], items: RowResult[], rule: RuleConfig, context: EngineContext) => {
    const { mapping, permissions } = rule;
    const groupCols = mapping.groupCols || [];
    const groupIndices = groupCols.map(c => getInd(c, headers)).filter(i => i !== -1);
    const startIdx = getInd(mapping.startCol || '', headers);
    const endIdx = getInd(mapping.endCol || '', headers);
    const serviceIdx = mapping.serviceCol ? getInd(mapping.serviceCol, headers) : -1;

    if (groupIndices.length === 0 || startIdx === -1 || endIdx === -1) {
        console.warn(`[RuleEngine] Bỏ qua rule "${rule.ruleName}" vì thiếu cột cấu hình.`);
        return;
    }

    const groupKeys = groupIndices.map(i => headers[i]);
    const startKey = headers[startIdx];
    const endKey = headers[endIdx];
    const serviceKey = serviceIdx !== -1 ? headers[serviceIdx] : null;

    const mapGroup: Record<string, RowResult[]> = {};

    // Grouping & Filtering
    for (const item of items) {
        if (serviceKey) {
            const serviceVal = String(item[serviceKey] || '');
            
            // 1. Resolve Permissions
            let allowed: string[] | undefined = permissions?.allowedServices;
            let excluded: string[] | undefined = permissions?.excludedServices;

            if (context.departmentCode && permissions?.departmentOverrides) {
                const deptOverride = permissions.departmentOverrides.find(d => d.departmentCode === context.departmentCode);
                if (deptOverride) {
                    if (deptOverride.allowedServices && deptOverride.allowedServices.length > 0) allowed = deptOverride.allowedServices;
                    if (deptOverride.excludedServices && deptOverride.excludedServices.length > 0) excluded = deptOverride.excludedServices;
                }
            }

            // 2. Custom User Inputs (Stage 2) override all rules
            const customFilter = context.customRuleFilters?.[rule.id];
            if (customFilter?.allowed && customFilter.allowed.length > 0) {
                allowed = customFilter.allowed;
            }
            if (customFilter?.excluded && customFilter.excluded.length > 0) {
                excluded = customFilter.excluded;
            }

            // Apply logic
            if (allowed && allowed.length > 0 && !allowed.includes(serviceVal)) continue; // Not in allowed list
            if (excluded && excluded.length > 0 && excluded.includes(serviceVal)) continue; // In excluded list
        }

        const groupValues = groupKeys.map(key => item[key]);
        const customIgnores = mapping.ignoreValues || [];
        // Ignore if any group value is intrinsically empty or explicitly matches a custom ignore value
        if (groupValues.some(v => v === null || v === undefined || String(v).trim() === '' || customIgnores.includes(String(v).trim()))) continue;

        const key = groupValues.join('|');
        if (!key) continue;
        
        if (!mapGroup[key]) mapGroup[key] = [];
        mapGroup[key].push(item);
    }

    // Overlap Calculation
    Object.values(mapGroup).forEach(group => {
        if (group.length < 2) return;

        for (let i = 0; i < group.length; i++) {
            const itemA = group[i];
            const startA = parseDateStr(itemA[startKey]);
            const endA = parseDateStr(itemA[endKey]);

            if (!startA || !endA) continue;

            for (let j = i + 1; j < group.length; j++) {
                const itemB = group[j];
                const startB = parseDateStr(itemB[startKey]);
                const endB = parseDateStr(itemB[endKey]);

                if (!startB || !endB) continue;

                const overlapStart = Math.max(startA.getTime(), startB.getTime());
                const overlapEnd = Math.min(endA.getTime(), endB.getTime());
                
                let isOverlap = false;

                if (mapping.minGapMinutes && mapping.minGapMinutes > 0) {
                    const gapMs = overlapStart - overlapEnd;
                    if (gapMs < mapping.minGapMinutes * 60000) {
                        isOverlap = true;
                    }
                } else {
                    if (overlapEnd > overlapStart) {
                        isOverlap = true;
                    } else if (overlapEnd === overlapStart) {
                        const lenA = endA.getTime() - startA.getTime();
                        const lenB = endB.getTime() - startB.getTime();
                        if (lenA === 0 || lenB === 0) isOverlap = true;
                    }
                }

                if (isOverlap) {
                    // 1. Group ID Assignment for coloring
                    if (!itemA._groupId && !itemB._groupId) {
                        const newId = context._nextGroupId || 1;
                        itemA._groupId = newId;
                        itemB._groupId = newId;
                        if (context._nextGroupId !== undefined) context._nextGroupId++;
                    } else if (itemA._groupId && !itemB._groupId) {
                        itemB._groupId = itemA._groupId;
                    } else if (!itemA._groupId && itemB._groupId) {
                        itemA._groupId = itemB._groupId;
                    } else if (itemA._groupId !== itemB._groupId) {
                        // Merge groups
                        const oldId = itemB._groupId;
                        if (context._itemsRef) {
                            context._itemsRef.forEach(it => {
                                if (it._groupId === oldId) it._groupId = itemA._groupId;
                            });
                        }
                    }

                    // 2. Mark both A and B
                    if (!itemA._violations.includes(rule.ruleName)) itemA._violations.push(rule.ruleName);
                    if (!itemB._violations.includes(rule.ruleName)) itemB._violations.push(rule.ruleName);
                    
                    // Calculate duration
                    if (overlapEnd > overlapStart) {
                        const formatDt = (ts: number) => {
                            const d = new Date(ts);
                            const pad = (n: number) => String(n).padStart(2, '0');
                            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        };
                        const durStr = `${formatDt(overlapStart)} đến ${formatDt(overlapEnd)}`;
                        
                        // Just append if not there. For a real app, maybe store an array of durations or complex objects.
                        if (!itemA._overlap_duration) itemA._overlap_duration = durStr;
                        else if (!itemA._overlap_duration.includes(durStr)) itemA._overlap_duration += `<br/>${durStr}`;
                        
                        if (!itemB._overlap_duration) itemB._overlap_duration = durStr;
                        else if (!itemB._overlap_duration.includes(durStr)) itemB._overlap_duration += `<br/>${durStr}`;
                    } else if (overlapEnd === overlapStart) {
                        itemA._overlap_duration = "Chạm mốc (0 phút)";
                        itemB._overlap_duration = "Chạm mốc (0 phút)";
                    }
                }
            }
        }
    });
};

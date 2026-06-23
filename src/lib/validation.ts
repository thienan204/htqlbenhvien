import { HosoRecord, XMLGroup, getXmlDataList } from './xml';

export type RuleType = 'Xuất toán' | 'Cảnh báo';

export interface ValidationRule {
    id: string;
    active: boolean;
    type: RuleType;
    xmlType: string;
    field?: string;
    name: string;
    description?: string;
    code: string; // The evaluation logic
    mathExpression?: string; // Optional: Code for mathematical calculation
    checkNotNull?: boolean; // Optional: Check if field is not null
    conditionField?: string; // Optional: Field to check condition on
    conditionValue?: string; // Optional: Comma-separated values for the condition field
    conditionMaDichVu?: string; // Optional: Field name for service code
    conditionMaDichVuValue?: string; // Optional: Comma-separated values for service code
    errorMessage?: string; // Optional: Custom error message to display
    isGroupCount?: boolean; // Add Group Count Flag
    minCountVal?: number | null; // Min occurrences (e.g. > 1 -> min = 2, or maxCount)
    maxCountVal?: number | null; // Max occurrences allowed
}

export interface ValidationResult {
    ruleId: string;
    ruleName: string;
    type: RuleType;
    xmlType: string;
    field?: string;
    message: string;
    isError: boolean;
    index?: number; // Row index for list items
}

const XML_LIST_PATHS: Record<string, string> = {
    'XML1': 'TONG_HOP',
    'XML2': 'CHITIEU_CHITIET_THUOC.DSACH_CHI_TIET_THUOC.CHI_TIET_THUOC',
    'XML3': 'CHITIEU_CHITIET_DVKT_VTYT.DSACH_CHI_TIET_DVKT.CHI_TIET_DVKT',
    'XML4': 'CHITIEU_CHITIET_DICHVUCANLAMSANG.DSACH_CHI_TIET_CLS.CHI_TIET_CLS',
    'XML5': 'CHITIEU_CHITIET_DIENBIENLAMSANG.DSACH_CHI_TIET_DIEN_BIEN_BENH.CHI_TIET_DIEN_BIEN_BENH',
    'XML7': 'CHITIEU_DU_LIEU_GIAY_RA_VIEN.GIAY_RA_VIEN',
};

/**
 * A basic validation engine that evaluates rules against a HosoRecord.
 * Rules can reference different XML groups.
 */
export class ValidationEngine {
    private rules: ValidationRule[] = [];
    private masterData: Record<string, Set<string>> = {};
    private allRecords: HosoRecord[] = [];

    constructor(rules: ValidationRule[] = [], masterData: Record<string, Set<string>> = {}) {
        this.rules = rules;
        this.masterData = masterData;
    }

    setContextRecords(records: HosoRecord[]) {
        this.allRecords = records;
    }

    private resolvePathValues(record: HosoRecord, path: string): any[] {
        const parts = path.trim().split('.');
        if (parts.length === 1) {
            return [record.summary?.[path]];
        }
        const xmlType = parts[0];
        const field = parts[1];
        if (xmlType === 'XML1') return [record.summary?.[field]];
        
        const group = record.groups.find(g => g.type === xmlType);
        if (!group) return [];
        const list = getXmlDataList(group);
        if (!list || !Array.isArray(list)) return [];
        
        return list.map(item => item[field]).filter(v => v !== undefined && v !== null);
    }

    setRules(rules: ValidationRule[]) {
        this.rules = rules;
    }

    validate(record: HosoRecord): ValidationResult[] {
        const results: ValidationResult[] = [];
        const activeRules = this.rules.filter(r => r.active);

        // Create a root context with all XML data available
        const rootContext: Record<string, any> = {};
        record.groups.forEach(g => {
            if (g.type === 'XML1' && g.data?.TONG_HOP) {
                rootContext[g.type] = g.data.TONG_HOP;
            } else {
                rootContext[g.type] = g.data;
            }
        });

        // Add shortcuts for strict XML structure if needed, or helper to get list

        activeRules.forEach(rule => {
            try {
                // Determine if this rule targets a list type and needs iteration
                const listPath = XML_LIST_PATHS[rule.xmlType];

                if (rule.xmlType === 'XML1' || !listPath) {
                    // Nếu không phải XML1 và dữ liệu của XML này hoàn toàn trống -> Bỏ qua không kiểm tra
                    if (rule.xmlType !== 'XML1') {
                        const xmlData = rootContext[rule.xmlType];
                        if (!xmlData || (typeof xmlData === 'object' && Object.keys(xmlData).length === 0) || (typeof xmlData === 'string' && xmlData.trim() === '')) {
                            return; // Skip rule
                        }
                    }

                    // Single object validation (XML1 or others)
                    // Merge fields from the specific XML type into top level
                    let xmlDataForContext = rootContext[rule.xmlType] || {};
                    if (xmlDataForContext && typeof xmlDataForContext === 'object') {
                        const keys = Object.keys(xmlDataForContext);
                        // Unwrap if it has exactly one child object (e.g. CHI_TIEU_DU_LIEU_TOM_TAT_HO_SO_BENH_AN)
                        if (keys.length === 1 && typeof xmlDataForContext[keys[0]] === 'object' && !Array.isArray(xmlDataForContext[keys[0]])) {
                            xmlDataForContext = xmlDataForContext[keys[0]];
                        }
                    }

                    let context = {
                        ...rootContext,
                        ...xmlDataForContext
                    };

                    if (rule.conditionField && rule.conditionValue) {
                        const parts = rule.conditionField.split('.');
                        let conditionVal: any = context;
                        for(const part of parts) {
                            if (conditionVal === undefined || conditionVal === null) break;
                            if (conditionVal[part] !== undefined) {
                                conditionVal = conditionVal[part];
                            } else {
                                const actualKey = Object.keys(conditionVal).find(k => k.toLowerCase() === part.toLowerCase());
                                if (actualKey) {
                                    conditionVal = conditionVal[actualKey];
                                } else {
                                    conditionVal = undefined;
                                }
                            }
                        }

                        const allowedValues = rule.conditionValue.split(/[;,\n]+/).map((s: string) => s.trim());
                        const valStr = this.getDataValue(conditionVal);

                        if (!valStr || !allowedValues.includes(valStr)) {
                            return; // Bỏ qua, điều kiện không thỏa mãn
                        }
                    }

                    let isError = false;

                    if (rule.code && rule.code.trim()) {
                        isError = this.evaluateRuleCode(rule.code, context);
                    }

                    if (!isError && rule.mathExpression && rule.mathExpression.trim()) {
                        try {
                            isError = this.evaluateMath(rule.mathExpression, context);
                        } catch (e) {
                            isError = false;
                        }
                    }

                    if (!isError && rule.checkNotNull && rule.field) {
                        const val = context[rule.field];
                        if (val === undefined || val === null || String(val).trim() === '') isError = true;
                    }

                    if (isError) {
                        results.push(this.createResult(rule));
                    }
                } else {
                    // List validation (XML2, 3, 4, 5)
                    // Find the group
                    const group = record.groups.find(g => g.type === rule.xmlType);
                    const list = getXmlDataList(group);

                    // const rawData = rootContext[rule.xmlType];
                    // const list = this.getListData(rawData, listPath);

                    if (list && Array.isArray(list)) {
                        if (rule.isGroupCount) {
                            let matchCount = 0;
                            const debugMatchedRows: number[] = [];

                            list.forEach((item, index) => {
                                // Check Generic Condition if specified
                                if (rule.conditionField && rule.conditionValue) {
                                    let conditionVal = item[rule.conditionField];
                                    if (conditionVal === undefined) {
                                        const actualKey = Object.keys(item).find(k => k.toLowerCase() === rule.conditionField?.toLowerCase());
                                        if (actualKey) conditionVal = item[actualKey];
                                    }
                                    const allowedValues = rule.conditionValue.split(',').map((s: string) => s.trim());
                                    const valStr = conditionVal !== null && conditionVal !== undefined ? String(conditionVal).trim() : '';
                                    if (!valStr || !allowedValues.includes(valStr)) return;
                                }

                                if (rule.conditionMaDichVuValue) {
                                    const fieldToCheck = rule.conditionMaDichVu || 'MA_DICH_VU';
                                    let conditionVal = item[fieldToCheck];
                                    const allowedValues = rule.conditionMaDichVuValue.split(/[;,\n]+/).map((s: string) => s.trim());
                                    const valStr = this.getDataValue(conditionVal);
                                    if (!valStr || !allowedValues.includes(valStr)) return;
                                }

                                const itemContext = {
                                    ...rootContext,
                                    [rule.xmlType]: item,
                                    'XML': item,
                                    '__CURRENT_LIST__': list
                                };
                                const extendedContext = { ...itemContext, ...item };

                                let isMatch = true;
                                if (rule.code && rule.code.trim()) {
                                    // For Group Count, code evaluation = true means it MATCHES the condition to be counted
                                    isMatch = this.evaluateRuleCode(rule.code, extendedContext);
                                }

                                if (isMatch && rule.mathExpression && rule.mathExpression.trim()) {
                                    try {
                                        isMatch = this.evaluateMath(rule.mathExpression, extendedContext);
                                    } catch (e) {
                                        isMatch = false;
                                    }
                                }

                                if (isMatch) {
                                    matchCount++;
                                    debugMatchedRows.push(index + 1);
                                }
                            });

                            let isError = false;
                            if (rule.minCountVal !== undefined && rule.minCountVal !== null) {
                                if (matchCount < rule.minCountVal) isError = true;
                            }
                            if (rule.maxCountVal !== undefined && rule.maxCountVal !== null) {
                                if (matchCount > rule.maxCountVal) isError = true;
                            }

                            if (isError) {
                                // Thay vì tạo 1 result gộp, ta tạo result cho TỪNG dòng đã match
                                // Để UI có thể map và hiển thị lên bảng (cần index list)
                                debugMatchedRows.forEach(rowIndex => {
                                    const debugMsg = `(Cảnh báo số lượng vi phạm hạn mức cấu hình: ${matchCount})`;
                                    results.push(this.createResult(rule, rowIndex - 1, debugMsg)); // rowIndex was 1-indexed, convert back to 0-indexed
                                });
                                // Nếu đếm ra 0 bản ghi nhưng MinCount = 1 (Tức là thiếu) -> Push 1 bản ghi lỗi trắng
                                if (debugMatchedRows.length === 0) {
                                    const debugMsg = `(Hồ sơ không có đủ dữ liệu theo yêu cầu, Số lượng: 0, Yêu cầu tối thiểu: ${rule.minCountVal})`;
                                    results.push(this.createResult(rule, undefined, debugMsg));
                                }
                            }
                        } else {
                            list.forEach((item, index) => {
                                // Check Generic Condition if specified
                                if (rule.conditionField && rule.conditionValue) {
                                    let conditionVal = item[rule.conditionField];
                                    if (conditionVal === undefined) {
                                        const actualKey = Object.keys(item).find(k => k.toLowerCase() === rule.conditionField?.toLowerCase());
                                        if (actualKey) conditionVal = item[actualKey];
                                    }

                                    // Support comma-separated list of allowed values
                                    const allowedValues = rule.conditionValue.split(/[;,\n]+/).map((s: string) => s.trim());

                                    // Check if value exists and matches one of the allowed values
                                    // We convert to string and trim to handle cases like " 1" or type mismatches
                                    const valStr = conditionVal !== null && conditionVal !== undefined ? String(conditionVal).trim() : '';

                                    if (!valStr || !allowedValues.includes(valStr)) {
                                        return;
                                    }
                                }

                                // DEBUG INFO
                                let debugMsg = '';

                                if (rule.conditionMaDichVuValue) {
                                    const fieldToCheck = rule.conditionMaDichVu || 'MA_DICH_VU';
                                    let conditionVal = item[fieldToCheck];

                                    const allowedValues = rule.conditionMaDichVuValue.split(/[;,\n]+/).map((s: string) => s.trim());
                                    const valStr = this.getDataValue(conditionVal);

                                    if (!valStr || !allowedValues.includes(valStr)) {
                                        return;
                                    }
                                } else if (rule.conditionMaDichVu || rule.name.includes('MA_MAY')) {
                                    // Logic if condition is MISSING but we suspect it should be there
                                    const fieldToCheck = rule.conditionMaDichVu || 'MA_DICH_VU';
                                    const valStr = this.getDataValue(item[fieldToCheck]);
                                    debugMsg = `[DEBUG: RuleCondValue='${rule.conditionMaDichVuValue}', RowVal='${valStr}']`;
                                }
                                // End check

                                const itemContext = {
                                    ...rootContext,
                                    [rule.xmlType]: item, // Overwrite the raw list with the specific item for this key
                                    'XML': item, // Generic alias for the current item
                                    '__CURRENT_LIST__': list
                                };

                                const extendedContext = { ...itemContext, ...item }; // Merge item props to top level for convenience

                                let isError = false;

                                if (rule.code && rule.code.trim()) {
                                    isError = this.evaluateRuleCode(rule.code, extendedContext);
                                }

                                if (!isError && rule.mathExpression && rule.mathExpression.trim()) {
                                    try {
                                        isError = this.evaluateMath(rule.mathExpression, extendedContext);
                                    } catch (e) {
                                        isError = false;
                                    }
                                }

                                if (!isError && rule.checkNotNull && rule.field) {
                                    const val = extendedContext[rule.field];
                                    if (val === undefined || val === null || String(val).trim() === '') isError = true;
                                }

                                if (isError) {
                                    results.push(this.createResult(rule, index, debugMsg));
                                }
                            });
                        }
                    }
                }

            } catch (err) {
                console.error(`Error evaluating rule ${rule.id}:`, err);
            }
        });

        return results;
    }

    private getListData(data: any, path: string): any[] {
        if (!data) return [];
        let current = data;
        const parts = path.split('.');
        for (const part of parts) {
            if (current === undefined || current === null) return [];
            current = current[part];
        }
        const list = Array.isArray(current) ? current : (current ? [current] : []);
        // Filter boolean to match the UI rendering which uses .filter(Boolean)
        // This ensures indices (0, 1, 2...) are consistent between Validator and UI
        return list.filter((item: any) => item);
    }

    private createResult(rule: ValidationRule, index?: number, debugInfo?: string): ValidationResult {
        return {
            ruleId: rule.id,
            ruleName: rule.name,
            type: rule.type,
            xmlType: rule.xmlType,
            field: rule.field,
            message: (rule.errorMessage || rule.name) + (debugInfo ? ` ${debugInfo}` : ''),
            isError: rule.type === 'Xuất toán',
            index
        };
    }

    // Helper to extract value from simple or complex XML node
    private getDataValue(val: any): string {
        if (val === undefined || val === null) return '';
        if (typeof val === 'object' && val.__cdata !== undefined) return String(val.__cdata).trim();
        // If it's an object but not cdata, it might be text node? 
        // fast-xml-parser usually puts text in #text if attributes exist.
        if (typeof val === 'object' && val['#text'] !== undefined) return String(val['#text']).trim();
        return String(val).trim();
    }

    public evaluateRule(rule: ValidationRule, record: HosoRecord): { isMatch: boolean, error?: string } {
        try {
            const rootContext: Record<string, any> = {};
            // ... (keep context setup)
            record.groups.forEach(g => {
                if (g.type === 'XML1' && g.data?.TONG_HOP) {
                    rootContext[g.type] = g.data.TONG_HOP;
                } else {
                    rootContext[g.type] = g.data;
                }
            });
            rootContext['root'] = rootContext;

            const checkLogic = (ctx: any) => {
                let isError = false;

                // 1. Check strict Logic Code
                if (rule.code && rule.code.trim()) {
                    isError = this.evaluateRuleCode(rule.code, ctx, true);
                }

                // 2. Check Math Expression (if present)
                if (!isError && rule.mathExpression && rule.mathExpression.trim()) {
                    try {
                        isError = this.evaluateMath(rule.mathExpression, ctx);
                    } catch (e) {
                        isError = false;
                    }
                }

                // 3. Check Not Null (if checked)
                if (!isError && rule.checkNotNull && rule.field) {
                    const val = ctx[rule.field];
                    // USE HELPER HERE
                    const strVal = this.getDataValue(val);
                    if (strVal === '') isError = true;
                }

                return isError;
            };

            const listPath = XML_LIST_PATHS[rule.xmlType];

            if (rule.xmlType === 'XML1' || !listPath) {
                if (rule.xmlType !== 'XML1') {
                    const xmlData = rootContext[rule.xmlType];
                    if (!xmlData || (typeof xmlData === 'object' && Object.keys(xmlData).length === 0) || (typeof xmlData === 'string' && xmlData.trim() === '')) {
                        return { isMatch: false };
                    }
                }

                let xmlDataForContext = rootContext[rule.xmlType] || {};
                if (xmlDataForContext && typeof xmlDataForContext === 'object') {
                    const keys = Object.keys(xmlDataForContext);
                    if (keys.length === 1 && typeof xmlDataForContext[keys[0]] === 'object' && !Array.isArray(xmlDataForContext[keys[0]])) {
                        xmlDataForContext = xmlDataForContext[keys[0]];
                    }
                }

                const context = { ...rootContext, ...xmlDataForContext };

                    if (rule.conditionField && rule.conditionValue) {
                        const parts = rule.conditionField.split('.');
                        let conditionVal: any = context;
                        for(const part of parts) {
                            if (conditionVal === undefined || conditionVal === null) break;
                            if (conditionVal[part] !== undefined) {
                                conditionVal = conditionVal[part];
                            } else {
                                const actualKey = Object.keys(conditionVal).find(k => k.toLowerCase() === part.toLowerCase());
                                if (actualKey) {
                                    conditionVal = conditionVal[actualKey];
                                } else {
                                    conditionVal = undefined;
                                }
                            }
                        }

                        const allowedValues = rule.conditionValue.split(/[;,\n]+/).map((s: string) => s.trim());
                        const valStr = this.getDataValue(conditionVal);

                    if (!valStr || !allowedValues.includes(valStr)) {
                        return { isMatch: false }; // Bỏ qua, điều kiện không thỏa mãn
                    }
                }

                try {
                    const result = checkLogic(context);
                    return { isMatch: result };
                } catch (e: any) {
                    return { isMatch: false, error: e.message || String(e) };
                }
            }

            const group = record.groups.find(g => g.type === rule.xmlType);
            const list = getXmlDataList(group);

            if (!list || !Array.isArray(list) || list.length === 0) {
                return { isMatch: false };
            }

            if (rule.isGroupCount) {
                let matchCount = 0;
                for (const item of list) {
                    if (rule.conditionField && rule.conditionValue) {
                        let conditionVal = item[rule.conditionField];
                        if (conditionVal === undefined) {
                            const actualKey = Object.keys(item).find(k => k.toLowerCase() === rule.conditionField?.toLowerCase());
                            if (actualKey) conditionVal = item[actualKey];
                        }
                        const allowedValues = rule.conditionValue.split(/[;,\n]+/).map((s: string) => s.trim());
                        const valStr = this.getDataValue(conditionVal);
                        if (!valStr || !allowedValues.includes(valStr)) continue;
                    }

                    if (rule.conditionMaDichVuValue) {
                        const fieldToCheck = rule.conditionMaDichVu || 'MA_DICH_VU';
                        let conditionVal = item[fieldToCheck];
                        const allowedValues = rule.conditionMaDichVuValue.split(/[;,\n]+/).map((s: string) => s.trim());
                        const valStr = this.getDataValue(conditionVal);
                        if (!valStr || !allowedValues.includes(valStr)) continue;
                    }

                    const itemContext = {
                        ...rootContext,
                        [rule.xmlType]: item,
                        'XML': item,
                        '__CURRENT_LIST__': list,
                        ...item
                    };

                    let isMatch = true;
                    if (rule.code && rule.code.trim()) {
                        isMatch = this.evaluateRuleCode(rule.code, itemContext);
                    }
                    if (isMatch && rule.mathExpression && rule.mathExpression.trim()) {
                        try {
                            isMatch = this.evaluateMath(rule.mathExpression, itemContext);
                        } catch (e) {
                            isMatch = false;
                        }
                    }

                    if (isMatch) matchCount++;
                }

                let isError = false;
                if (rule.minCountVal !== undefined && rule.minCountVal !== null) {
                    if (matchCount < rule.minCountVal) isError = true;
                }
                if (rule.maxCountVal !== undefined && rule.maxCountVal !== null) {
                    if (matchCount > rule.maxCountVal) isError = true;
                }

                if (isError) {
                    return { isMatch: true, error: `Số lượng bản ghi thỏa mãn: ${matchCount}` };
                } else {
                    return { isMatch: false };
                }
            } else {
                for (const item of list) {
                    if (rule.conditionField && rule.conditionValue) {
                        let conditionVal = item[rule.conditionField];
                        if (conditionVal === undefined) {
                            const actualKey = Object.keys(item).find(k => k.toLowerCase() === rule.conditionField?.toLowerCase());
                            if (actualKey) conditionVal = item[actualKey];
                        }
                        // USE HELPER HERE + Split by regex
                        const allowedValues = rule.conditionValue.split(/[;,\n]+/).map((s: string) => s.trim());
                        const valStr = this.getDataValue(conditionVal);

                        if (!valStr || !allowedValues.includes(valStr)) {
                            continue;
                        }
                    }

                    if (rule.conditionMaDichVuValue) {
                        const fieldToCheck = rule.conditionMaDichVu || 'MA_DICH_VU';
                        let conditionVal = item[fieldToCheck];

                        const allowedValues = rule.conditionMaDichVuValue.split(/[;,\n]+/).map((s: string) => s.trim());
                        // USE HELPER HERE
                        const valStr = this.getDataValue(conditionVal);

                        // ONE-TIME DEBUG LOG
                        // if (rule.conditionMaDichVuValue.includes('23.0058.1487') && !allowedValues.includes(valStr)) {
                        //    console.log(`[DEBUG MISMATCH] Rule ${rule.id} expects ${rule.conditionMaDichVuValue}. Got '${valStr}' from ${fieldToCheck}. Allowed: ${JSON.stringify(allowedValues)}`);
                        // }

                        if (!valStr || !allowedValues.includes(valStr)) {
                            continue;
                        }
                    }

                    const itemContext = {
                        ...rootContext,
                        [rule.xmlType]: item,
                        'XML': item,
                        '__CURRENT_LIST__': list,
                        ...item
                    };

                    try {
                        if (checkLogic(itemContext)) {
                            return { isMatch: true };
                        }
                    } catch (e: any) {
                        return { isMatch: false, error: `Row error: ${e.message || String(e)}` };
                    }
                }
            }

            return { isMatch: false };

        } catch (error: any) {
            return { isMatch: false, error: error.message || String(error) };
        }
    }

    private evaluateMath(expression: string, context: any): boolean {
        try {
            // Using raw expression without auto-fix
            let expr = expression;

            // Helper: Parse XML Date String (YYYYMMDDHHmm or YYYYMMDD)
            const parseDate = (str: any): Date | null => {
                if (!str) return null;
                const s = String(str).trim();
                if (s.length === 12) {
                    // YYYYMMDDHHmm
                    const year = parseInt(s.substring(0, 4));
                    const month = parseInt(s.substring(4, 6)) - 1;
                    const day = parseInt(s.substring(6, 8));
                    const hour = parseInt(s.substring(8, 10));
                    const minute = parseInt(s.substring(10, 12));
                    return new Date(year, month, day, hour, minute);
                }
                if (s.length === 8) {
                    // YYYYMMDD
                    const year = parseInt(s.substring(0, 4));
                    const month = parseInt(s.substring(4, 6)) - 1;
                    const day = parseInt(s.substring(6, 8));
                    return new Date(year, month, day);
                }
                // Try standard Date parse
                const d = new Date(s);
                return isNaN(d.getTime()) ? null : d;
            };

            // Helper: Calculate difference in hours (d1 - d2)
            const diffHours = (d1: any, d2: any): number => {
                const date1 = parseDate(d1);
                const date2 = parseDate(d2);
                if (!date1 || !date2) return 999999; // Return huge number if invalid dates to avoid false positives in < checks
                const diffMs = date1.getTime() - date2.getTime();
                return diffMs / (1000 * 60 * 60);
            };

            const EXISTS_IN = (listName: string, value: any): boolean => {
                if (!this.masterData || !this.masterData[listName] || value === null || value === undefined) return false;
                const valStr = String(value).trim();
                if (!valStr) return false;
                const parts = valStr.split(';').map(s => s.trim()).filter(Boolean);
                if (parts.length === 0) return false;
                return parts.every(p => this.masterData[listName].has(p));
            };

            const CHECK_DUPLICATE_DIFF = (pathSame: string, valSame: any, pathDiff: string, valDiff: any): boolean => {
                const sameValStr = valSame !== null && valSame !== undefined ? String(valSame).trim() : '';
                const diffValStr = valDiff !== null && valDiff !== undefined ? String(valDiff).trim() : '';
                if (!sameValStr) return false;

                return this.allRecords.some(r => {
                    const sameValues = this.resolvePathValues(r, pathSame);
                    const hasSame = sameValues.some(v => String(v).trim() === sameValStr);
                    if (!hasSame) return false;
                    
                    const diffValues = this.resolvePathValues(r, pathDiff);
                    const hasDifferent = diffValues.some(v => String(v).trim() !== diffValStr);
                    return hasDifferent;
                });
            };

            const CHECK_DUPLICATE_IN_LIST = (...args: any[]): boolean => {
                if (!context.__CURRENT_LIST__ || !Array.isArray(context.__CURRENT_LIST__)) return false;
                if (args.length === 0 || args.length % 2 !== 0) return false;

                // Nếu bất kỳ giá trị kiểm tra nào bị rỗng thì bỏ qua không quy thành duplicate
                for (let i = 1; i < args.length; i += 2) {
                    const val = this.getDataValue(args[i]);
                    if (!val) return false;
                }

                let count = 0;
                for (const row of context.__CURRENT_LIST__) {
                    let isMatch = true;
                    for (let i = 0; i < args.length; i += 2) {
                        const fieldName = String(args[i]).trim();
                        const expectedValue = this.getDataValue(args[i + 1]);
                        const rowVal = this.getDataValue(row[fieldName]);
                        
                        if (rowVal !== expectedValue) {
                            isMatch = false;
                            break;
                        }
                    }

                    if (isMatch) {
                        count++;
                        if (count > 1) return true;
                    }
                }
                return false;
            };

            let priceMapCache: Map<string, number> | null = null;
            const GET_PRICE_MAP = () => {
                if (priceMapCache) return priceMapCache;
                priceMapCache = new Map();
                const set = this.masterData['Mau05_PRICE_MAP'];
                if (set) {
                    for (const item of set) {
                        const [m, p] = item.split(':::');
                        priceMapCache.set(m, Number(p));
                    }
                }
                return priceMapCache;
            };

            const CHECK_MAU05_PRICE_MISMATCH = (maDichVu: any, donGia: any): boolean => {
                const mdv = String(maDichVu).trim();
                if (!mdv) return false;
                const map = GET_PRICE_MAP();
                if (!map.has(mdv)) return false; 
                const expectedPrice = map.get(mdv);
                const actualPrice = Number(donGia);
                return expectedPrice !== actualPrice; 
            };

            const _mismatchMaps: Record<string, Map<string, string>> = {};
            const CHECK_MISMATCH = (mapRef: string, keyVal: any, actualVal: any): boolean => {
                const kv = String(keyVal).trim();
                if (!kv) return false;
                
                const set = this.masterData[mapRef];
                if (!set) return false;

                if (!_mismatchMaps[mapRef]) {
                    const map = new Map<string, string>();
                    for (const item of set) {
                        const [m, p] = item.split(':::');
                        map.set(m, p);
                    }
                    _mismatchMaps[mapRef] = map;
                }

                const map = _mismatchMaps[mapRef];
                if (!map.has(kv)) return false; 
                
                const expectedVal = map.get(kv);
                const eNum = Number(expectedVal);
                const aNum = Number(actualVal);
                
                if (!isNaN(eNum) && !isNaN(aNum) && expectedVal !== '' && String(actualVal).trim() !== '') {
                     return eNum !== aNum;
                }
                
                return String(expectedVal).trim() !== String(actualVal).trim();
            };

            // Only expose specific safe keys and the context objects
            // We expose all keys in context for maximum flexibility
            // Inject Helpers
            const helpers = {
                Math: Math,
                Number: Number,
                parseFloat: parseFloat,
                parseInt: parseInt,
                parseDate: parseDate,
                diffHours: diffHours,
                EXISTS_IN: EXISTS_IN,
                CHECK_DUPLICATE_DIFF: CHECK_DUPLICATE_DIFF,
                CHECK_DUPLICATE_IN_LIST: CHECK_DUPLICATE_IN_LIST,
                CHECK_MAU05_PRICE_MISMATCH: CHECK_MAU05_PRICE_MISMATCH,
                CHECK_MISMATCH: CHECK_MISMATCH
            };

            const keys = [...Object.keys(context), ...Object.keys(helpers)];
            const values = [...Object.values(context), ...Object.values(helpers)];

            // Create function from expression
            // Replace '==' with '==='? No, loose equality is often desired in JS/XML data 
            // but strict == in JS is loose. 
            // Note: expression 'A == B' returns boolean. 

            const fn = new Function(...keys, `return ${expr};`);
            return !!fn(...values);
        } catch (e: any) {
            // console.error("Math Eval Failed:", e);
            throw new Error(`Lỗi biểu thức: ${e.message}`);
        }
    }

    private evaluateRuleCode(code: string, context: any, throwError = false): boolean {
        try {
            // Clean up code
            let cleanCode = code.trim();
            if (cleanCode.startsWith('DK_LOI') && cleanCode.includes('=')) {
                const firstEq = cleanCode.indexOf('=');
                if (cleanCode[firstEq + 1] !== '=') {
                    cleanCode = cleanCode.substring(firstEq + 1).trim();
                }
            }

            const getVal = (path: string) => {
                path = path.trim();
                // Handle String Literals
                if ((path.startsWith("'") && path.endsWith("'")) || (path.startsWith('"') && path.endsWith('"'))) {
                    return path.substring(1, path.length - 1);
                }
                // Handle Numbers
                if (!isNaN(Number(path)) && path !== '') {
                    return Number(path);
                }

                // Optimization: Check for direct property on context first
                if (path in context) {
                    let val = context[path];
                    if (val && typeof val === 'object' && val.__cdata !== undefined) return val.__cdata;
                    return val;
                }

                const parts = path.split('.');
                let current = context;
                for (const part of parts) {
                    if (current === undefined || current === null) return null;

                    if (current[part] !== undefined) {
                        current = current[part];
                    } else {
                        // Case-insensitive fallback
                        const keys = Object.keys(current);
                        const foundKey = keys.find(k => k.toLowerCase() === part.toLowerCase());
                        if (foundKey) {
                            current = current[foundKey];
                        } else {
                            return null;
                        }
                    }
                }
                if (current && typeof current === 'object' && current.__cdata !== undefined) {
                    return current.__cdata;
                }
                return current;
            };

            // 0. Handle EXISTS_IN Helper (Dynamic substitution)
            cleanCode = cleanCode.replace(/(!?)EXISTS_IN\(\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\s*\)/g, (match, notOp, listName, field) => {
                const val = getVal(field.trim());
                const valStr = val !== null && val !== undefined ? String(val).trim() : '';
                let exists = false;
                if (this.masterData && this.masterData[listName] && valStr !== '') {
                    const parts = valStr.split(';').map(s => s.trim()).filter(Boolean);
                    if (parts.length > 0) {
                        exists = parts.every(p => this.masterData[listName].has(p));
                    }
                }
                const result = notOp ? !exists : exists;
                // Return string representation of boolean
                return result ? "true" : "false";
            });

            // 0.5. Handle CHECK_DUPLICATE_DIFF
            cleanCode = cleanCode.replace(/CHECK_DUPLICATE_DIFF\(\s*['"]([^'"]+)['"]\s*,\s*([^,]+)\s*,\s*['"]([^'"]+)['"]\s*,\s*([^)]+)\s*\)/g, (match, pathSame, sameValueRef, pathDiff, diffValueRef) => {
                const valSame = getVal(sameValueRef.trim());
                const valDiff = getVal(diffValueRef.trim());
                const sameValStr = valSame !== null && valSame !== undefined ? String(valSame).trim() : '';
                const diffValStr = valDiff !== null && valDiff !== undefined ? String(valDiff).trim() : '';

                if (!sameValStr) return "false";

                const hasConflict = this.allRecords.some(r => {
                    const sameValues = this.resolvePathValues(r, pathSame);
                    const hasSame = sameValues.some(v => String(v).trim() === sameValStr);
                    if (!hasSame) return false;
                    
                    const diffValues = this.resolvePathValues(r, pathDiff);
                    const hasDifferent = diffValues.some(v => String(v).trim() !== diffValStr);
                    return hasDifferent;
                });

                return hasConflict ? "true" : "false";
            });

            // 0.6. Handle CHECK_MAU05_PRICE_MISMATCH
            cleanCode = cleanCode.replace(/CHECK_MAU05_PRICE_MISMATCH\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, (match, maDichVuRef, donGiaRef) => {
                const mdvVal = getVal(maDichVuRef.trim());
                const donGiaVal = getVal(donGiaRef.trim());
                const mdvStr = mdvVal !== null && mdvVal !== undefined ? String(mdvVal).trim() : '';
                
                if (!mdvStr) return "false";
                
                const set = this.masterData['Mau05_PRICE_MAP'];
                if (!set) return "false";

                let expectedPrice: number | null = null;
                for (const item of set) {
                    const [m, p] = item.split(':::');
                    if (m === mdvStr) {
                        expectedPrice = Number(p);
                        break;
                    }
                }

                if (expectedPrice === null) return "false";
                const actualPrice = Number(donGiaVal);
                return expectedPrice !== actualPrice ? "true" : "false";
            });

            // 0.7. Handle CHECK_MISMATCH (Regex fallback for code strings)
            cleanCode = cleanCode.replace(/CHECK_MISMATCH\(\s*['"]([^'"]+)['"]\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/g, (match, mapRef, keyRef, actualRef) => {
                const keyVal = getVal(keyRef.trim());
                const actualVal = getVal(actualRef.trim());
                
                const kv = keyVal !== null && keyVal !== undefined ? String(keyVal).trim() : '';
                if (!kv) return "false";
                
                const set = this.masterData[mapRef];
                if (!set) return "false";

                let expectedVal: string | null = null;
                for (const item of set) {
                    const [m, p] = item.split(':::');
                    if (m === kv) {
                        expectedVal = p;
                        break;
                    }
                }

                if (expectedVal === null) return "false";
                
                const eNum = Number(expectedVal);
                const aNum = Number(actualVal);
                
                if (!isNaN(eNum) && !isNaN(aNum) && expectedVal !== '' && String(actualVal).trim() !== '') {
                     return eNum !== aNum ? "true" : "false";
                }
                
                return String(expectedVal).trim() !== String(actualVal).trim() ? "true" : "false";
            });

            // 1. Handle LOGICAL OR (||)
            // Split by || but respect parentheses (naive implementation for now, assuming simple logic)
            if (cleanCode.includes('||')) {
                const parts = cleanCode.split('||');
                return parts.some(part => this.evaluateRuleCode(part, context, throwError));
            }

            // 2. Handle LOGICAL AND (&&)
            if (cleanCode.includes('&&')) {
                const parts = cleanCode.split('&&');
                // All parts must be true
                return parts.every(part => this.evaluateRuleCode(part, context, throwError));
            }

            // 3. Handle PARENTHESES (Basic support for wrapping single expression)
            if (cleanCode.startsWith('(') && cleanCode.endsWith(')')) {
                return this.evaluateRuleCode(cleanCode.substring(1, cleanCode.length - 1), context, throwError);
            }

            if (cleanCode === 'true') return true;
            if (cleanCode === 'false') return false;

            // 4. Comparison operations
            const ops = ['<=', '>=', '==', '!=', '===', '!==', '<', '>'];

            for (const op of ops) {
                const operatorIndex = cleanCode.indexOf(op);

                if (operatorIndex !== -1) {
                    const left = cleanCode.substring(0, operatorIndex).trim();
                    const right = cleanCode.substring(operatorIndex + op.length).trim();

                    // Special case for null/undefined checks
                    if (right === 'null' || right === 'undefined') {
                        const val = getVal(left);
                        if (op === '==' || op === '===') return val === null || val === undefined || val === '';
                        if (op === '!=' || op === '!==') return val !== null && val !== undefined && val !== '';
                    }

                    const valLeft = getVal(left);
                    const valRight = getVal(right);

                    // Skip comparison if either side is missing (unless checking for missing)
                    if (valLeft === null || valRight === null) return false;

                    switch (op) {
                        case '<': return valLeft < valRight;
                        case '>': return valLeft > valRight;
                        case '<=': return valLeft <= valRight;
                        case '>=': return valLeft >= valRight;
                        case '==':
                        case '===': return valLeft == valRight;
                        case '!=':
                        case '!==': return valLeft != valRight;
                    }

                    break;
                }
            }
            return false;
        } catch (e) {
            if (throwError) throw e;
            return false;
        }
    }
}

// Initial Default Rules (from screenshot)
export const DEFAULT_RULES: ValidationRule[] = [
    {
        id: '1',
        active: true,
        checkNotNull: false,
        type: 'Xuất toán',
        xmlType: 'XML3',
        name: 'Không có ngày kết quả',
        code: 'NGAY_KQ == null',
        errorMessage: 'Dịch vụ yêu cầu có kết quả nhưng chưa có ngày kết quả'
    },
    {
        id: '2',
        active: true,
        checkNotNull: false,
        type: 'Xuất toán',
        xmlType: 'XML3',
        field: 'NGAY_YL',
        name: 'Y lệnh trước khi vào viện',
        code: 'NGAY_YL < XML1.NGAY_VAO',
        errorMessage: 'Ngày y lệnh nhỏ hơn ngày vào viện'
    },
    {
        id: '3',
        active: true,
        checkNotNull: false,
        type: 'Xuất toán',
        xmlType: 'XML3',
        field: 'NGAY_TH_YL',
        name: 'Ngày thực hiện sau ngày kết quả',
        code: 'NGAY_TH_YL > XML3.NGAY_KQ',
        errorMessage: 'Ngày thực hiện lớn hơn ngày kết quả'
    },
    {
        id: '4',
        active: true,
        checkNotNull: false,
        type: 'Xuất toán',
        xmlType: 'XML3',
        field: 'NGAY_KQ',
        name: 'Ngày kết quả sau ngày ra viện',
        code: 'NGAY_KQ > XML1.NGAY_RA',
        errorMessage: 'Ngày kết quả lớn hơn ngày ra viện'
    },
    {
        id: '5',
        active: true,
        checkNotNull: false,
        type: 'Cảnh báo',
        xmlType: 'XML3',
        field: 'NGAY_TH_YL',
        name: 'Ngày thực hiện trước ngày y lệnh',
        code: 'NGAY_TH_YL < NGAY_YL',
        errorMessage: 'Ngày thực hiện nhỏ hơn ngày y lệnh'
    },
    {
        id: '6',
        active: true,
        checkNotNull: false,
        type: 'Xuất toán',
        xmlType: 'XML7',
        field: 'MA_TTDV',
        name: 'Thiếu mã tình trạng dịch vụ (Trạm y tế)',
        code: '(MA_TTDV == null || MA_TTDV == "") && XML1.MA_LOAI_KCB == "03"',
        errorMessage: 'Thiếu MA_TTDV đối với hồ sơ Trạm y tế (03)'
    },
    {
        id: '7',
        active: true,
        checkNotNull: false,
        type: 'Cảnh báo',
        xmlType: 'XML1',
        field: 'MA_THE_TAM',
        name: 'Sai định dạng Mã thẻ tạm',
        code: '(MA_THE_TAM != null && MA_THE_TAM != "") && (MA_THE_TAM.length != 15)',
        errorMessage: 'Mã thẻ tạm phải có độ dài 15 ký tự'
    }
];

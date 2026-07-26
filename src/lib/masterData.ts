import prisma from '@/lib/prisma';
import { ValidationRule } from './validation';

export async function fetchMasterDataForRules(rules: ValidationRule[]): Promise<Record<string, Set<string>>> {
    const refs = new Set<string>();
    
    rules.forEach(rule => {
        if (!rule.active) return;
        
        const scanText = (text?: string) => {
            if (!text) return;
            // Scan for EXISTS_IN
            for (const match of text.matchAll(/EXISTS_IN\(\s*['"]([^'"]+)['"]/g)) {
                if (match[1]) refs.add(match[1]);
            }
            // Scan for CHECK_MISMATCH
            for (const match of text.matchAll(/CHECK_MISMATCH\(\s*['"]([^'"]+)['"]/g)) {
                if (match[1]) refs.add(match[1]);
            }
            // Scan for CHECK_PRICE_MISMATCH
            for (const match of text.matchAll(/CHECK_PRICE_MISMATCH_MAU03_04\(\s*['"]([^'"]+)['"]/g)) {
                if (match[1]) refs.add(match[1]);
            }
            if (text.includes('CHECK_MAU05_PRICE_MISMATCH')) {
                refs.add('Mau05_PRICE_MAP');
            }
        };

        scanText(rule.code);
        scanText(rule.mathExpression);
    });

    if (refs.size === 0) return {};

    const result: Record<string, Set<string>> = {};

    for (const ref of Array.from(refs)) {
        if (ref === 'Mau05_PRICE_MAP') {
            try {
                const data = await prisma.mau05Catalog.findMany({ select: { MA_DICH_VU: true, DON_GIA: true } });
                result[ref] = new Set(data.filter((d: any) => d.MA_DICH_VU).map((d: any) => `${d.MA_DICH_VU}:::${d.DON_GIA}`));
            } catch (e) {}
            continue;
        }
        
        if (ref === 'BedCatalog.MaKhoa_MaGiuong') {
            try {
                const data = await prisma.bedCatalog.findMany({ select: { ma_khoa: true, ma_giuong: true } });
                result[ref] = new Set(data.filter((d: any) => d.ma_khoa && d.ma_giuong).map((d: any) => `${d.ma_khoa}_${d.ma_giuong}`));
            } catch (e) {}
            continue;
        }

        const [table, column] = ref.split('.');
        if (!table || !column) continue;
        const modelName = table.charAt(0).toLowerCase() + table.slice(1);
        if (typeof (prisma as any)[modelName] !== 'object') continue;

        try {
            if (column.includes(':')) {
                const [keyCol, valCol] = column.split(':');
                if (valCol.includes('.')) {
                    const [relName, relCol] = valCol.split('.');
                    const data = await (prisma as any)[modelName].findMany({
                        select: { [keyCol]: true, [relName]: { select: { [relCol]: true } } }
                    });
                    result[ref] = new Set(data.filter((d: any) => d[keyCol] && d[relName]).map((d: any) => `${d[keyCol]}:::${d[relName][relCol]}`));
                } else {
                    const data = await (prisma as any)[modelName].findMany({
                        select: { [keyCol]: true, [valCol]: true }
                    });
                    result[ref] = new Set(data.filter((d: any) => d[keyCol]).map((d: any) => `${d[keyCol]}:::${d[valCol]}`));
                }
            } else {
                const data = await (prisma as any)[modelName].findMany({ select: { [column]: true } });
                result[ref] = new Set(data.map((d: any) => d[column]).filter((v: any) => v !== null && v !== undefined).map(String));
            }
        } catch (err) {}
    }

    return result;
}

import { XMLParser } from 'fast-xml-parser';
import { ValidationEngine, ValidationResult, DEFAULT_RULES } from './validation';

export interface XMLGroup {
    type: string;
    data: any;
}

export interface HosoRecord {
    id: string; // MA_LK
    summary: any; // XML1 (TONG_HOP)
    groups: XMLGroup[]; // All XML files for this HOSO
    validationResults: ValidationResult[];
    uuid?: string;
}

export interface ExtendedHosoRecord extends HosoRecord {
    sourceFile: string;
}

export interface XMLData {
    records: HosoRecord[];
}

export function getXmlDataList(group: XMLGroup | undefined | null): any[] {
    if (!group?.data) return [];
    
    // If it's already an array (e.g. from Database), just return it
    if (Array.isArray(group.data)) return group.data;

    const type = group.type;
    if (type === 'XML1') {
        const data = group.data?.TONG_HOP || group.data;
        return data ? [data] : [];
    }

    // Try generic extraction
    const keys = Object.keys(group.data);
    for (const k of keys) {
        if (k.startsWith('CHITIEU_')) {
            const sub = group.data[k];
            const subKeys = Object.keys(sub || {});

            // Case 1: Has DSACH_
            const dsachKey = subKeys.find(sk => sk.startsWith('DSACH_'));
            if (dsachKey) {
                const dsach = sub[dsachKey];
                // Try to find inner detail list
                const detailKey = Object.keys(dsach || {}).find(dk => dk.startsWith('CHI_TIET') || dk === 'GIAY_RA_VIEN' || Array.isArray(dsach[dk]));
                if (detailKey) return Array.isArray(dsach[detailKey]) ? dsach[detailKey] : [dsach[detailKey]];

                // If no detail key found but dSach is mostly data
                return Array.isArray(dsach) ? dsach : [dsach];
            }

            // Case 2: Direct child (no DSACH_) - typical for some formats
            const detailKey = subKeys.find(dk => dk.startsWith('CHI_TIET') || dk === 'GIAY_RA_VIEN');
            if (detailKey) return Array.isArray(sub[detailKey]) ? sub[detailKey] : [sub[detailKey]];
        }
    }

    // Fallback for known specific paths if generic fails
    if (type === 'XML2' && group.data.CHITIEU_CHITIET_THUOC?.DSACH_CHI_TIET_THUOC?.CHI_TIET_THUOC)
        return Array.isArray(group.data.CHITIEU_CHITIET_THUOC.DSACH_CHI_TIET_THUOC.CHI_TIET_THUOC) ? group.data.CHITIEU_CHITIET_THUOC.DSACH_CHI_TIET_THUOC.CHI_TIET_THUOC : [group.data.CHITIEU_CHITIET_THUOC.DSACH_CHI_TIET_THUOC.CHI_TIET_THUOC];

    // XML3
    if (type === 'XML3' && group.data.CHITIEU_CHITIET_DVKT_VTYT?.DSACH_CHI_TIET_DVKT?.CHI_TIET_DVKT)
        return Array.isArray(group.data.CHITIEU_CHITIET_DVKT_VTYT.DSACH_CHI_TIET_DVKT.CHI_TIET_DVKT) ? group.data.CHITIEU_CHITIET_DVKT_VTYT.DSACH_CHI_TIET_DVKT.CHI_TIET_DVKT : [group.data.CHITIEU_CHITIET_DVKT_VTYT.DSACH_CHI_TIET_DVKT.CHI_TIET_DVKT];

    // XML7
    if (type === 'XML7') {
        // Try path: CHITIEU_DU_LIEU_GIAY_RA_VIEN -> GIAY_RA_VIEN
        if (group.data.CHITIEU_DU_LIEU_GIAY_RA_VIEN?.GIAY_RA_VIEN)
            return Array.isArray(group.data.CHITIEU_DU_LIEU_GIAY_RA_VIEN.GIAY_RA_VIEN) ? group.data.CHITIEU_DU_LIEU_GIAY_RA_VIEN.GIAY_RA_VIEN : [group.data.CHITIEU_DU_LIEU_GIAY_RA_VIEN.GIAY_RA_VIEN];

        // Try path with DSACH if it exists
        if (group.data.CHITIEU_DU_LIEU_GIAY_RA_VIEN?.DSACH_GIAY_RA_VIEN?.GIAY_RA_VIEN)
            return Array.isArray(group.data.CHITIEU_DU_LIEU_GIAY_RA_VIEN.DSACH_GIAY_RA_VIEN.GIAY_RA_VIEN) ? group.data.CHITIEU_DU_LIEU_GIAY_RA_VIEN.DSACH_GIAY_RA_VIEN.GIAY_RA_VIEN : [group.data.CHITIEU_DU_LIEU_GIAY_RA_VIEN.DSACH_GIAY_RA_VIEN.GIAY_RA_VIEN];
    }

    // XML9 - Giay Chung Sinh
    if (type === 'XML9') {
        // Variant 1: Standard naming
        if (group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH?.DSACH_GIAY_CHUNG_SINH?.GIAY_CHUNG_SINH)
            return Array.isArray(group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH.DSACH_GIAY_CHUNG_SINH.GIAY_CHUNG_SINH)
                ? group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH.DSACH_GIAY_CHUNG_SINH.GIAY_CHUNG_SINH
                : [group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH.DSACH_GIAY_CHUNG_SINH.GIAY_CHUNG_SINH];

        // Variant 2: Compact naming (DSACH_GIAYCHUNGSINH as seen in UI)
        if (group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH?.DSACH_GIAYCHUNGSINH?.GIAY_CHUNG_SINH)
            return Array.isArray(group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH.DSACH_GIAYCHUNGSINH.GIAY_CHUNG_SINH)
                ? group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH.DSACH_GIAYCHUNGSINH.GIAY_CHUNG_SINH
                : [group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH.DSACH_GIAYCHUNGSINH.GIAY_CHUNG_SINH];

        if (group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH?.DSACH_GIAYCHUNGSINH?.GIAYCHUNGSINH)
            return Array.isArray(group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH.DSACH_GIAYCHUNGSINH.GIAYCHUNGSINH)
                ? group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH.DSACH_GIAYCHUNGSINH.GIAYCHUNGSINH
                : [group.data.CHITIEU_DU_LIEU_GIAY_CHUNG_SINH.DSACH_GIAYCHUNGSINH.GIAYCHUNGSINH];
    }

    // Generic fallback: if data is an object, return it as a single-item list
    // This ensures XML7, XML8, etc. are at least displayed as a single row/object if strict path extraction fails
    if (group.data && typeof group.data === 'object') {
        // If it looks like a wrapped object with one key that is an object/array, maybe unwrap it?
        // E.g. { "XML8": { ... } } -> return [{ ... }]
        // But for now, just return the data root or try to find a likely child

        // Try to find the first inner object that looks like data
        const keys = Object.keys(group.data);
        if (keys.length === 1 && typeof group.data[keys[0]] === 'object') {
            const child = group.data[keys[0]];
            // logic for nested lists
            if (Array.isArray(child)) return child;
            return [child];
        }

        return [group.data];
    }

    return [];
};

export function parseXmlContent(xmlContent: string): XMLData {
    const parser = new XMLParser({
        ignoreAttributes: false,
        trimValues: true,
        parseTagValue: false, // Keep all values as strings (preserve leading zeros, no number conversion)
    });

    const jsonObj = parser.parse(xmlContent);

    // Navigate to the list of HOSO
    const hosoListRaw = jsonObj.GIAMDINHHS?.THONGTINHOSO?.DANHSACHHOSO?.HOSO;
    if (!hosoListRaw) {
        throw new Error('Invalid XML structure: Missing GIAMDINHHS.THONGTINHOSO.DANHSACHHOSO.HOSO');
    }

    const hosoList = Array.isArray(hosoListRaw) ? hosoListRaw : [hosoListRaw];

    const validator = new ValidationEngine(DEFAULT_RULES);

    // Parser for inner Base64 XML content
    const innerParser = new XMLParser({
        ignoreAttributes: false,
        trimValues: true,
        parseTagValue: false,
    });

    const records: HosoRecord[] = hosoList.map((hoso: any) => {
        const fileHosoList = Array.isArray(hoso.FILEHOSO) ? hoso.FILEHOSO : [hoso.FILEHOSO];

        const groups: XMLGroup[] = fileHosoList.map((file: any) => {
            let data = file?.NOIDUNGFILE;

            // Auto-decode Base64 if applicable
            if (typeof data === 'string') {
                try {
                    // Try to detect if it's base64 (simple regex or just try decoding)
                    // We assume valid Base64 has no spaces usually, but XML content might. 
                    // However, strictly NOIDUNGFILE in XML4217 is Base64. 
                    // Let's attempt to decode.
                    // Using a robust decode for UTF8 characters
                    const binaryString = atob(data.replace(/\s/g, ''));
                    const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
                    const decodedStore = new TextDecoder().decode(bytes);

                    // If decode successful and looks like XML, parse it
                    if (decodedStore.trim().startsWith('<')) {
                        data = innerParser.parse(decodedStore);
                    }
                } catch (e) {
                    // console.warn('Failed to decode/parse NOIDUNGFILE, using original value', e);
                    // If error (not base64 or invalid xml), keep original data
                }
            }

            return {
                type: file?.LOAIHOSO,
                data: data
            };
        });

        const xml1 = groups.find(g => g.type === 'XML1');
        const summary = xml1?.data?.TONG_HOP || xml1?.data || null;

        const record: HosoRecord = {
            id: String(summary?.MA_LK || Math.random()),
            summary,
            groups,
            validationResults: []
        };

        record.validationResults = validator.validate(record);

        return record;
    });

    return {
        records
    };
}

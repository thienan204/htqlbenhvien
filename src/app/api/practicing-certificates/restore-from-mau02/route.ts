import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/actions/auth';
import { decryptField, generateBlindIndex } from '@/lib/staffCrypto';

type RestoreMode = 'preview' | 'execute';
type MatchMethod = 'CCCD' | 'MA_NV' | 'HO_TEN_KHOA' | 'HO_TEN_DUY_NHAT';
type CandidateAction = 'CREATE' | 'UPDATE' | 'SKIP';

interface RestoreRequestBody {
    mode?: RestoreMode;
    options?: {
        updateExistingEmptyFields?: boolean;
    };
}

interface StaffIndexItem {
    id: string;
    ma_nv: string;
    ho_ten: string;
    ma_khoa: string;
    ten_khoa: string;
    ma_khoa_bhyt: string | null;
    ma_khoa_bv: string | null;
    cccd_plain: string | null;
    cccd_hash: string | null;
    ho_ten_norm: string;
    ho_ten_ascii: string;
}

interface ParsedMau02Cert {
    mau02Ids: string[];
    stt: number | null;
    so_dinh_danh: string;
    ho_ten_mau02: string;
    ma_khoa_mau02: string;
    ten_khoa_mau02: string;
    staff: StaffIndexItem;
    matchMethod: MatchMethod;
    so_cchn: string;
    ngay_cap: Date | null;
    ngay_cap_str: string | null;
    noi_cap_name: string | null;
    matchedScopes: string[];
    unknownScopes: string[];
    pham_vi_bo_sung: string | null;
    dich_vu_ky_thuat: string | null;
    vb_phan_cong: string | null;
    thoi_gian_dang_ky: string | null;
    thoi_gian_ngay: string | null;
    thoi_gian_tuan: string | null;
    cskcb_khac: string | null;
    cskcb_cgkt: string | null;
    qd_cgkt: string | null;
    tu_ngay: Date | null;
    den_ngay: Date | null;
    isActive: boolean;
}

interface PreviewCandidate {
    key: string;
    action: CandidateAction;
    staffId: string;
    ma_nv: string;
    ho_ten: string;
    ten_khoa: string;
    so_dinh_danh: string;
    matchMethod: MatchMethod;
    so_cchn: string;
    ngay_cap: string | null;
    noi_cap_name: string | null;
    noi_cap_id: string | null;
    matchedScopes: string[];
    unknownScopes: string[];
    updatedFields: string[];
    scopesToAdd: string[];
    existingCertId: string | null;
    payload: {
        ngay_cap: Date | null;
        noi_cap_cchn_id: string | null;
        noi_cap_name: string | null;
        pham_vi_bo_sung: string | null;
        dich_vu_ky_thuat: string | null;
        vb_phan_cong: string | null;
        thoi_gian_dang_ky: string | null;
        thoi_gian_ngay: string | null;
        thoi_gian_tuan: string | null;
        cskcb_khac: string | null;
        cskcb_cgkt: string | null;
        qd_cgkt: string | null;
        tu_ngay: Date | null;
        den_ngay: Date | null;
        isActive: boolean;
    };
}

interface UnmatchedMau02Item {
    mau02Id: string;
    stt: number | null;
    ho_ten: string;
    ma_khoa: string;
    ten_khoa: string;
    so_dinh_danh: string;
    so_cchn: string;
    reason: string;
}

function normalizeText(value: string | null | undefined): string {
    if (!value) return '';
    return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function normalizeIdentity(value: string | null | undefined): string {
    if (!value) return '';
    return value.normalize('NFC').replace(/\s+/g, '').trim();
}

function toAsciiLower(value: string | null | undefined): string {
    return normalizeText(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
}

function toCategoryCode(name: string): string {
    return normalizeText(name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();
}

function parseMau02Date(value: string | null | undefined): Date | null {
    const raw = normalizeText(value);
    if (!raw) return null;

    let year = 0;
    let month = 0;
    let day = 0;

    if (/^\d{8}$/.test(raw)) {
        year = Number(raw.slice(0, 4));
        month = Number(raw.slice(4, 6));
        day = Number(raw.slice(6, 8));
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        year = y;
        month = m;
        day = d;
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
        const [d, m, y] = raw.split('/').map(Number);
        year = y;
        month = m;
        day = d;
    } else {
        return null;
    }

    if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000Z`;
    const date = new Date(iso);
    if (
        Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() + 1 !== month ||
        date.getUTCDate() !== day
    ) {
        return null;
    }
    return date;
}

function formatDateDisplay(date: Date | null): string | null {
    if (!date) return null;
    const d = String(date.getUTCDate()).padStart(2, '0');
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const y = date.getUTCFullYear();
    return `${d}/${m}/${y}`;
}

function parseScopeCodes(
    phamViCm: string | null | undefined,
    validScopeSet: Set<string>
): { matchedScopes: string[]; unknownScopes: string[] } {
    const raw = normalizeText(phamViCm);
    if (!raw) return { matchedScopes: [], unknownScopes: [] };

    const matched: string[] = [];
    const unknown: string[] = [];
    const seen = new Set<string>();

    for (const part of raw.split(/[;,]/)) {
        const token = normalizeText(part);
        if (!token) continue;
        const match = token.match(/^([a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*)/);
        const code = match?.[1] || token;
        if (seen.has(code)) continue;
        seen.add(code);

        if (validScopeSet.has(code)) {
            matched.push(code);
        } else {
            unknown.push(code);
        }
    }

    return { matchedScopes: matched, unknownScopes: unknown };
}

function departmentMatches(
    staff: StaffIndexItem,
    maKhoaMau02: string,
    tenKhoaMau02: string
): boolean {
    const mau02Codes = maKhoaMau02
        .split(/[;,]/)
        .map((s) => normalizeText(s).toUpperCase())
        .filter(Boolean);

    const staffCodes = [staff.ma_khoa, staff.ma_khoa_bhyt, staff.ma_khoa_bv]
        .filter((s): s is string => Boolean(s))
        .flatMap((s) => s.split(/[;,]/))
        .map((s) => normalizeText(s).toUpperCase())
        .filter(Boolean);

    if (mau02Codes.some((code) => staffCodes.includes(code))) {
        return true;
    }

    const mau02TenNorm = toAsciiLower(tenKhoaMau02);
    const staffTenNorm = toAsciiLower(staff.ten_khoa);
    return Boolean(mau02TenNorm && staffTenNorm && mau02TenNorm === staffTenNorm);
}

function isStringEmpty(value: string | null | undefined): boolean {
    return !value || value.trim() === '';
}

function buildPlan(params: {
    mau02Rows: Awaited<ReturnType<typeof prisma.mau02Catalog.findMany>>;
    staffRows: Array<{
        id: string;
        ma_nv: string;
        ho_ten: string;
        ma_khoa: string;
        cccd: string | null;
        cccd_hash: string | null;
        department: {
            ten_khoa: string;
            ma_khoa_bhyt: string | null;
            ma_khoa_bv: string | null;
        } | null;
    }>;
    existingCerts: Array<{
        id: string;
        staffId: string;
        so_cchn: string;
        ngay_cap: Date | null;
        noi_cap_cchn_id: string | null;
        pham_vi_bo_sung: string | null;
        dich_vu_ky_thuat: string | null;
        vb_phan_cong: string | null;
        thoi_gian_dang_ky: string | null;
        thoi_gian_ngay: string | null;
        thoi_gian_tuan: string | null;
        cskcb_khac: string | null;
        cskcb_cgkt: string | null;
        qd_cgkt: string | null;
        tu_ngay: Date | null;
        den_ngay: Date | null;
        isActive: boolean;
        scopes: Array<{ ma_pham_vi: string }>;
    }>;
    validScopes: Array<{ ma_pham_vi: string }>;
    noiCapCategories: Array<{ id: string; code: string; name: string }>;
    updateExistingEmptyFields: boolean;
}) {
    const {
        mau02Rows,
        staffRows,
        existingCerts,
        validScopes,
        noiCapCategories,
        updateExistingEmptyFields,
    } = params;

    const validScopeSet = new Set(validScopes.map((s) => s.ma_pham_vi));

    const noiCapByNameLower = new Map<string, { id: string; name: string }>();
    const noiCapByCode = new Map<string, { id: string; name: string }>();
    for (const cat of noiCapCategories) {
        noiCapByNameLower.set(normalizeText(cat.name).toLowerCase(), { id: cat.id, name: cat.name });
        noiCapByCode.set(cat.code.toUpperCase(), { id: cat.id, name: cat.name });
    }

    const findExistingNoiCap = (rawName: string | null | undefined) => {
        const cleaned = normalizeText(rawName);
        if (!cleaned) return null;
        return (
            noiCapByNameLower.get(cleaned.toLowerCase()) ||
            noiCapByCode.get(toCategoryCode(cleaned)) ||
            null
        );
    };

    const staffIndex: StaffIndexItem[] = staffRows.map((s) => {
        let decrypted: string | null = null;
        try {
            decrypted = decryptField(s.cccd);
        } catch {
            decrypted = null;
        }
        const plain = normalizeIdentity(decrypted || s.cccd);
        return {
            id: s.id,
            ma_nv: normalizeText(s.ma_nv),
            ho_ten: normalizeText(s.ho_ten),
            ma_khoa: normalizeText(s.ma_khoa),
            ten_khoa: normalizeText(s.department?.ten_khoa || s.ma_khoa),
            ma_khoa_bhyt: s.department?.ma_khoa_bhyt || null,
            ma_khoa_bv: s.department?.ma_khoa_bv || null,
            cccd_plain: plain || null,
            cccd_hash: s.cccd_hash || null,
            ho_ten_norm: normalizeText(s.ho_ten).toLowerCase(),
            ho_ten_ascii: toAsciiLower(s.ho_ten),
        };
    });

    const byCccdPlain = new Map<string, StaffIndexItem[]>();
    const byCccdHash = new Map<string, StaffIndexItem[]>();
    const byMaNv = new Map<string, StaffIndexItem[]>();
    const byNameExact = new Map<string, StaffIndexItem[]>();
    const byNameAscii = new Map<string, StaffIndexItem[]>();

    const pushMap = (map: Map<string, StaffIndexItem[]>, key: string, item: StaffIndexItem) => {
        if (!key) return;
        const arr = map.get(key) || [];
        arr.push(item);
        map.set(key, arr);
    };

    for (const s of staffIndex) {
        if (s.cccd_plain) pushMap(byCccdPlain, s.cccd_plain, s);
        if (s.cccd_hash) pushMap(byCccdHash, s.cccd_hash, s);
        if (s.ma_nv) pushMap(byMaNv, s.ma_nv.toUpperCase(), s);
        if (s.ho_ten_norm) pushMap(byNameExact, s.ho_ten_norm, s);
        if (s.ho_ten_ascii) pushMap(byNameAscii, s.ho_ten_ascii, s);
    }

    const matchStaff = (row: (typeof mau02Rows)[number]): { staff?: StaffIndexItem; method?: MatchMethod; reason?: string } => {
        const rawId = normalizeText(row.SO_DINH_DANH);
        const normId = normalizeIdentity(row.SO_DINH_DANH);

        if (normId) {
            const cccdCandidates = new Map<string, StaffIndexItem>();
            for (const s of byCccdPlain.get(normId) || []) {
                cccdCandidates.set(s.id, s);
            }

            const blindVariants = new Set(
                [generateBlindIndex(normId), generateBlindIndex(rawId)].filter((v): v is string => Boolean(v))
            );
            for (const h of blindVariants) {
                for (const s of byCccdHash.get(h) || []) {
                    cccdCandidates.set(s.id, s);
                }
            }

            if (cccdCandidates.size === 1) {
                return { staff: Array.from(cccdCandidates.values())[0], method: 'CCCD' };
            }
            if (cccdCandidates.size > 1) {
                return { reason: `Số CCCD "${normId}" khớp với ${cccdCandidates.size} nhân sự khác nhau` };
            }

            // Excel sometimes strips the leading 0 of 12-digit CCCD
            if (/^\d{11}$/.test(normId)) {
                const padded = `0${normId}`;
                const paddedMatches = new Map<string, StaffIndexItem>();
                for (const s of byCccdPlain.get(padded) || []) paddedMatches.set(s.id, s);
                const paddedHash = generateBlindIndex(padded);
                if (paddedHash) {
                    for (const s of byCccdHash.get(paddedHash) || []) paddedMatches.set(s.id, s);
                }
                if (paddedMatches.size === 1) {
                    return { staff: Array.from(paddedMatches.values())[0], method: 'CCCD' };
                }
            }

            const maNvMatches = byMaNv.get(normId.toUpperCase()) || [];
            if (maNvMatches.length === 1) {
                return { staff: maNvMatches[0], method: 'MA_NV' };
            }
        }

        const hoTenNorm = normalizeText(row.HO_TEN).toLowerCase();
        const hoTenAscii = toAsciiLower(row.HO_TEN);
        const namePool =
            (hoTenNorm ? byNameExact.get(hoTenNorm) : undefined) ||
            (hoTenAscii ? byNameAscii.get(hoTenAscii) : undefined) ||
            [];

        if (namePool.length === 0) {
            return {
                reason: normId
                    ? `Không tìm thấy nhân sự có CCCD/Mã NV "${normId}" hoặc họ tên "${normalizeText(row.HO_TEN)}"`
                    : `Không có Số định danh và không tìm thấy họ tên "${normalizeText(row.HO_TEN)}"`,
            };
        }

        const deptMatched = namePool.filter((s) =>
            departmentMatches(s, normalizeText(row.MA_KHOA), normalizeText(row.TEN_KHOA))
        );

        if (deptMatched.length === 1) {
            return { staff: deptMatched[0], method: 'HO_TEN_KHOA' };
        }
        if (namePool.length === 1) {
            return { staff: namePool[0], method: 'HO_TEN_DUY_NHAT' };
        }

        return {
            reason: `Không khớp CCCD "${normId || '(trống)'}" và trùng họ tên "${normalizeText(row.HO_TEN)}" (${namePool.length} người)`,
        };
    };

    let skippedNoCchnCount = 0;
    const unmatched: UnmatchedMau02Item[] = [];
    const groupedByStaffCchn = new Map<string, ParsedMau02Cert>();
    const newNoiCapNamesSet = new Set<string>();

    for (const row of mau02Rows) {
        const soCchn = normalizeText(row.MACCHN);
        if (!soCchn) {
            skippedNoCchnCount++;
            continue;
        }

        const matched = matchStaff(row);
        if (!matched.staff || !matched.method) {
            unmatched.push({
                mau02Id: row.id,
                stt: row.STT,
                ho_ten: normalizeText(row.HO_TEN),
                ma_khoa: normalizeText(row.MA_KHOA),
                ten_khoa: normalizeText(row.TEN_KHOA),
                so_dinh_danh: normalizeText(row.SO_DINH_DANH),
                so_cchn: soCchn,
                reason: matched.reason || 'Không tìm thấy nhân sự tương ứng',
            });
            continue;
        }

        const staff = matched.staff;
        const dedupKey = `${staff.id}::${soCchn.toLowerCase()}`;
        const { matchedScopes, unknownScopes } = parseScopeCodes(row.PHAMVI_CM, validScopeSet);
        const ngayCap = parseMau02Date(row.NGAYCAP_CCHN);
        const tuNgay = parseMau02Date(row.TU_NGAY);
        const denNgay = parseMau02Date(row.DEN_NGAY);
        const noiCapRaw = normalizeText(row.NOICAP_CCHN) || null;
        if (noiCapRaw && !findExistingNoiCap(noiCapRaw)) {
            newNoiCapNamesSet.add(noiCapRaw);
        }

        const existingGroup = groupedByStaffCchn.get(dedupKey);
        if (!existingGroup) {
            groupedByStaffCchn.set(dedupKey, {
                mau02Ids: [row.id],
                stt: row.STT,
                so_dinh_danh: normalizeText(row.SO_DINH_DANH),
                ho_ten_mau02: normalizeText(row.HO_TEN),
                ma_khoa_mau02: normalizeText(row.MA_KHOA),
                ten_khoa_mau02: normalizeText(row.TEN_KHOA),
                staff,
                matchMethod: matched.method,
                so_cchn: soCchn,
                ngay_cap: ngayCap,
                ngay_cap_str: formatDateDisplay(ngayCap),
                noi_cap_name: noiCapRaw,
                matchedScopes,
                unknownScopes,
                pham_vi_bo_sung: normalizeText(row.PHAMVI_CMBS) || null,
                dich_vu_ky_thuat: normalizeText(row.DVKT_KHAC) || null,
                vb_phan_cong: normalizeText(row.VB_PHANCONG) || null,
                thoi_gian_dang_ky:
                    row.THOIGIAN_DK !== null && row.THOIGIAN_DK !== undefined ? String(row.THOIGIAN_DK) : null,
                thoi_gian_ngay: normalizeText(row.THOIGIAN_NGAY) || null,
                thoi_gian_tuan: normalizeText(row.THOIGIAN_TUAN) || null,
                cskcb_khac: normalizeText(row.CSKCB_KHAC) || null,
                cskcb_cgkt: normalizeText(row.CSKCB_CGKT) || null,
                qd_cgkt: normalizeText(row.QD_CGKT) || null,
                tu_ngay: tuNgay,
                den_ngay: denNgay,
                isActive: row.isActive ?? true,
            });
        } else {
            // Merge multiple Mau02 rows pointing to same staff + so_cchn without losing data
            existingGroup.mau02Ids.push(row.id);
            if (!existingGroup.ngay_cap && ngayCap) {
                existingGroup.ngay_cap = ngayCap;
                existingGroup.ngay_cap_str = formatDateDisplay(ngayCap);
            }
            if (!existingGroup.noi_cap_name && noiCapRaw) existingGroup.noi_cap_name = noiCapRaw;
            if (!existingGroup.pham_vi_bo_sung) existingGroup.pham_vi_bo_sung = normalizeText(row.PHAMVI_CMBS) || null;
            if (!existingGroup.dich_vu_ky_thuat) existingGroup.dich_vu_ky_thuat = normalizeText(row.DVKT_KHAC) || null;
            if (!existingGroup.vb_phan_cong) existingGroup.vb_phan_cong = normalizeText(row.VB_PHANCONG) || null;
            if (!existingGroup.thoi_gian_dang_ky && row.THOIGIAN_DK !== null && row.THOIGIAN_DK !== undefined) {
                existingGroup.thoi_gian_dang_ky = String(row.THOIGIAN_DK);
            }
            if (!existingGroup.thoi_gian_ngay) existingGroup.thoi_gian_ngay = normalizeText(row.THOIGIAN_NGAY) || null;
            if (!existingGroup.thoi_gian_tuan) existingGroup.thoi_gian_tuan = normalizeText(row.THOIGIAN_TUAN) || null;
            if (!existingGroup.cskcb_khac) existingGroup.cskcb_khac = normalizeText(row.CSKCB_KHAC) || null;
            if (!existingGroup.cskcb_cgkt) existingGroup.cskcb_cgkt = normalizeText(row.CSKCB_CGKT) || null;
            if (!existingGroup.qd_cgkt) existingGroup.qd_cgkt = normalizeText(row.QD_CGKT) || null;
            if (!existingGroup.tu_ngay && tuNgay) existingGroup.tu_ngay = tuNgay;
            if (!existingGroup.den_ngay && denNgay) existingGroup.den_ngay = denNgay;
            existingGroup.matchedScopes = Array.from(new Set([...existingGroup.matchedScopes, ...matchedScopes]));
            existingGroup.unknownScopes = Array.from(new Set([...existingGroup.unknownScopes, ...unknownScopes]));
            existingGroup.isActive = existingGroup.isActive || (row.isActive ?? true);
        }
    }

    const existingCertMap = new Map<string, (typeof existingCerts)[number]>();
    for (const cert of existingCerts) {
        existingCertMap.set(`${cert.staffId}::${normalizeText(cert.so_cchn).toLowerCase()}`, cert);
    }

    const matchedExistingCertIds = new Set<string>();
    const candidates: PreviewCandidate[] = [];

    for (const [key, item] of groupedByStaffCchn.entries()) {
        const existingCert = existingCertMap.get(key);
        const existingNoiCap = findExistingNoiCap(item.noi_cap_name);

        if (!existingCert) {
            candidates.push({
                key,
                action: 'CREATE',
                staffId: item.staff.id,
                ma_nv: item.staff.ma_nv,
                ho_ten: item.staff.ho_ten,
                ten_khoa: item.staff.ten_khoa,
                so_dinh_danh: item.so_dinh_danh,
                matchMethod: item.matchMethod,
                so_cchn: item.so_cchn,
                ngay_cap: item.ngay_cap_str,
                noi_cap_name: existingNoiCap?.name || item.noi_cap_name,
                noi_cap_id: existingNoiCap?.id || null,
                matchedScopes: item.matchedScopes,
                unknownScopes: item.unknownScopes,
                updatedFields: [],
                scopesToAdd: item.matchedScopes,
                existingCertId: null,
                payload: {
                    ngay_cap: item.ngay_cap,
                    noi_cap_cchn_id: existingNoiCap?.id || null,
                    noi_cap_name: item.noi_cap_name,
                    pham_vi_bo_sung: item.pham_vi_bo_sung,
                    dich_vu_ky_thuat: item.dich_vu_ky_thuat,
                    vb_phan_cong: item.vb_phan_cong,
                    thoi_gian_dang_ky: item.thoi_gian_dang_ky,
                    thoi_gian_ngay: item.thoi_gian_ngay,
                    thoi_gian_tuan: item.thoi_gian_tuan,
                    cskcb_khac: item.cskcb_khac,
                    cskcb_cgkt: item.cskcb_cgkt,
                    qd_cgkt: item.qd_cgkt,
                    tu_ngay: item.tu_ngay,
                    den_ngay: item.den_ngay,
                    isActive: item.isActive,
                },
            });
            continue;
        }

        matchedExistingCertIds.add(existingCert.id);

        const updatedFields: string[] = [];
        const existingScopeSet = new Set(existingCert.scopes.map((s) => s.ma_pham_vi));
        const scopesToAdd = updateExistingEmptyFields
            ? item.matchedScopes.filter((ma) => !existingScopeSet.has(ma))
            : [];

        if (updateExistingEmptyFields) {
            if (!existingCert.ngay_cap && item.ngay_cap) updatedFields.push('Ngày cấp');
            if (!existingCert.noi_cap_cchn_id && item.noi_cap_name) updatedFields.push('Nơi cấp CCHN');
            if (isStringEmpty(existingCert.pham_vi_bo_sung) && item.pham_vi_bo_sung) {
                updatedFields.push('Phạm vi bổ sung');
            }
            if (isStringEmpty(existingCert.dich_vu_ky_thuat) && item.dich_vu_ky_thuat) {
                updatedFields.push('DVKT khác');
            }
            if (isStringEmpty(existingCert.vb_phan_cong) && item.vb_phan_cong) updatedFields.push('VB phân công');
            if (isStringEmpty(existingCert.thoi_gian_dang_ky) && item.thoi_gian_dang_ky) {
                updatedFields.push('Thời gian ĐK');
            }
            if (isStringEmpty(existingCert.thoi_gian_ngay) && item.thoi_gian_ngay) {
                updatedFields.push('Thời gian ngày');
            }
            if (isStringEmpty(existingCert.thoi_gian_tuan) && item.thoi_gian_tuan) {
                updatedFields.push('Thời gian tuần');
            }
            if (isStringEmpty(existingCert.cskcb_khac) && item.cskcb_khac) updatedFields.push('CSKCB khác');
            if (isStringEmpty(existingCert.cskcb_cgkt) && item.cskcb_cgkt) updatedFields.push('CSKCB CGKT');
            if (isStringEmpty(existingCert.qd_cgkt) && item.qd_cgkt) updatedFields.push('QĐ CGKT');
            if (!existingCert.tu_ngay && item.tu_ngay) updatedFields.push('Từ ngày');
            if (!existingCert.den_ngay && item.den_ngay) updatedFields.push('Đến ngày');
            if (scopesToAdd.length > 0) updatedFields.push(`Phạm vi CM (+${scopesToAdd.length})`);
        }

        const action: CandidateAction = updatedFields.length > 0 ? 'UPDATE' : 'SKIP';
        candidates.push({
            key,
            action,
            staffId: item.staff.id,
            ma_nv: item.staff.ma_nv,
            ho_ten: item.staff.ho_ten,
            ten_khoa: item.staff.ten_khoa,
            so_dinh_danh: item.so_dinh_danh,
            matchMethod: item.matchMethod,
            so_cchn: item.so_cchn,
            ngay_cap: item.ngay_cap_str || formatDateDisplay(existingCert.ngay_cap),
            noi_cap_name: existingNoiCap?.name || item.noi_cap_name,
            noi_cap_id: existingNoiCap?.id || existingCert.noi_cap_cchn_id,
            matchedScopes: item.matchedScopes,
            unknownScopes: item.unknownScopes,
            updatedFields,
            scopesToAdd,
            existingCertId: existingCert.id,
            payload: {
                ngay_cap: !existingCert.ngay_cap ? item.ngay_cap : null,
                noi_cap_cchn_id: !existingCert.noi_cap_cchn_id ? existingNoiCap?.id || null : null,
                noi_cap_name: !existingCert.noi_cap_cchn_id ? item.noi_cap_name : null,
                pham_vi_bo_sung: isStringEmpty(existingCert.pham_vi_bo_sung) ? item.pham_vi_bo_sung : null,
                dich_vu_ky_thuat: isStringEmpty(existingCert.dich_vu_ky_thuat) ? item.dich_vu_ky_thuat : null,
                vb_phan_cong: isStringEmpty(existingCert.vb_phan_cong) ? item.vb_phan_cong : null,
                thoi_gian_dang_ky: isStringEmpty(existingCert.thoi_gian_dang_ky) ? item.thoi_gian_dang_ky : null,
                thoi_gian_ngay: isStringEmpty(existingCert.thoi_gian_ngay) ? item.thoi_gian_ngay : null,
                thoi_gian_tuan: isStringEmpty(existingCert.thoi_gian_tuan) ? item.thoi_gian_tuan : null,
                cskcb_khac: isStringEmpty(existingCert.cskcb_khac) ? item.cskcb_khac : null,
                cskcb_cgkt: isStringEmpty(existingCert.cskcb_cgkt) ? item.cskcb_cgkt : null,
                qd_cgkt: isStringEmpty(existingCert.qd_cgkt) ? item.qd_cgkt : null,
                tu_ngay: !existingCert.tu_ngay ? item.tu_ngay : null,
                den_ngay: !existingCert.den_ngay ? item.den_ngay : null,
                isActive: existingCert.isActive,
            },
        });
    }

    const preservedExistingCount = existingCerts.filter((c) => !matchedExistingCertIds.has(c.id)).length;
    const existingById = new Map(existingCerts.map((c) => [c.id, c]));

    return {
        summary: {
            totalMau02Rows: mau02Rows.length,
            totalMau02WithCchn: mau02Rows.length - skippedNoCchnCount,
            skippedNoCchnCount,
            createCount: candidates.filter((c) => c.action === 'CREATE').length,
            updateCount: candidates.filter((c) => c.action === 'UPDATE').length,
            skipCount: candidates.filter((c) => c.action === 'SKIP').length,
            unmatchedCount: unmatched.length,
            preservedExistingCount,
            existingTotalCertCount: existingCerts.length,
            newNoiCapCategories: Array.from(newNoiCapNamesSet),
        },
        candidates,
        unmatched,
        existingById,
    };
}

export async function POST(request: Request) {
    try {
        const user = await getCurrentUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Vui lòng đăng nhập để thực hiện thao tác này.' }, { status: 401 });
        }
        if (user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Chỉ tài khoản ADMIN mới có quyền khôi phục dữ liệu CCHN từ Mẫu 02.' },
                { status: 403 }
            );
        }

        const body = (await request.json().catch(() => ({}))) as RestoreRequestBody;
        const mode: RestoreMode = body.mode === 'execute' ? 'execute' : 'preview';
        const updateExistingEmptyFields = body.options?.updateExistingEmptyFields ?? true;

        const [mau02Rows, staffRows, existingCerts, validScopes, noiCapCategories] = await Promise.all([
            prisma.mau02Catalog.findMany({
                orderBy: [{ STT: 'asc' }, { HO_TEN: 'asc' }],
            }),
            prisma.staff.findMany({
                select: {
                    id: true,
                    ma_nv: true,
                    ho_ten: true,
                    ma_khoa: true,
                    cccd: true,
                    cccd_hash: true,
                    department: {
                        select: {
                            ten_khoa: true,
                            ma_khoa_bhyt: true,
                            ma_khoa_bv: true,
                        },
                    },
                },
            }),
            prisma.practicingCertificate.findMany({
                include: {
                    scopes: { select: { ma_pham_vi: true } },
                },
            }),
            prisma.scopeOfPracticeCatalog.findMany({
                select: { ma_pham_vi: true },
            }),
            prisma.systemCategory.findMany({
                where: { type: 'NOI_CAP_CCHN' },
                select: { id: true, code: true, name: true },
            }),
        ]);

        const plan = buildPlan({
            mau02Rows,
            staffRows,
            existingCerts,
            validScopes,
            noiCapCategories,
            updateExistingEmptyFields,
        });

        if (mode === 'preview') {
            return NextResponse.json({
                mode: 'preview',
                summary: plan.summary,
                candidates: plan.candidates.map((c) => ({
                    key: c.key,
                    action: c.action,
                    staffId: c.staffId,
                    ma_nv: c.ma_nv,
                    ho_ten: c.ho_ten,
                    ten_khoa: c.ten_khoa,
                    so_dinh_danh: c.so_dinh_danh,
                    matchMethod: c.matchMethod,
                    so_cchn: c.so_cchn,
                    ngay_cap: c.ngay_cap,
                    noi_cap_name: c.noi_cap_name,
                    matchedScopes: c.matchedScopes,
                    unknownScopes: c.unknownScopes,
                    updatedFields: c.updatedFields,
                    scopesToAdd: c.scopesToAdd,
                })),
                unmatched: plan.unmatched,
            });
        }

        // Execute mode:
        // 1) Pre-create any missing NOI_CAP_CCHN categories safely before batch transactions
        const noiCapResolvedMap = new Map<string, string>();
        for (const cat of noiCapCategories) {
            noiCapResolvedMap.set(normalizeText(cat.name).toLowerCase(), cat.id);
        }

        let createdNoiCapCount = 0;
        for (const rawName of plan.summary.newNoiCapCategories) {
            const cleanName = normalizeText(rawName);
            const keyLower = cleanName.toLowerCase();
            if (!cleanName || noiCapResolvedMap.has(keyLower)) continue;

            const baseCode = toCategoryCode(cleanName) || 'NOI_CAP_KHAC';
            let existing = await prisma.systemCategory.findFirst({
                where: {
                    type: 'NOI_CAP_CCHN',
                    OR: [{ name: cleanName }, { code: baseCode }],
                },
                select: { id: true },
            });

            if (!existing) {
                let candidateCode = baseCode;
                const codeCollision = await prisma.systemCategory.findUnique({
                    where: { type_code: { type: 'NOI_CAP_CCHN', code: candidateCode } },
                    select: { id: true },
                });
                if (codeCollision) {
                    candidateCode = `${baseCode}_${Date.now().toString().slice(-4)}`;
                }

                existing = await prisma.systemCategory.create({
                    data: {
                        type: 'NOI_CAP_CCHN',
                        code: candidateCode,
                        name: cleanName,
                    },
                    select: { id: true },
                });
                createdNoiCapCount++;
            }
            noiCapResolvedMap.set(keyLower, existing.id);
        }

        const resolveNoiCapId = (name: string | null, fallbackId: string | null) => {
            if (fallbackId) return fallbackId;
            if (!name) return null;
            return noiCapResolvedMap.get(normalizeText(name).toLowerCase()) || null;
        };

        const actionable = plan.candidates.filter((c) => c.action === 'CREATE' || c.action === 'UPDATE');
        const CHUNK_SIZE = 50;
        let createdCount = 0;
        let updatedCount = 0;
        let scopeMappingsAddedCount = 0;

        for (let i = 0; i < actionable.length; i += CHUNK_SIZE) {
            const chunk = actionable.slice(i, i + CHUNK_SIZE);
            await prisma.$transaction(
                async (tx) => {
                    for (const item of chunk) {
                        const resolvedNoiCapId = resolveNoiCapId(item.payload.noi_cap_name, item.payload.noi_cap_cchn_id);

                        if (item.action === 'CREATE') {
                            const createData: Prisma.PracticingCertificateUncheckedCreateInput = {
                                staffId: item.staffId,
                                so_cchn: item.so_cchn,
                                ngay_cap: item.payload.ngay_cap,
                                noi_cap_cchn_id: resolvedNoiCapId,
                                pham_vi_bo_sung: item.payload.pham_vi_bo_sung,
                                dich_vu_ky_thuat: item.payload.dich_vu_ky_thuat,
                                vb_phan_cong: item.payload.vb_phan_cong,
                                thoi_gian_dang_ky: item.payload.thoi_gian_dang_ky,
                                thoi_gian_ngay: item.payload.thoi_gian_ngay,
                                thoi_gian_tuan: item.payload.thoi_gian_tuan,
                                cskcb_khac: item.payload.cskcb_khac,
                                cskcb_cgkt: item.payload.cskcb_cgkt,
                                qd_cgkt: item.payload.qd_cgkt,
                                tu_ngay: item.payload.tu_ngay,
                                den_ngay: item.payload.den_ngay,
                                isActive: item.payload.isActive,
                                ...(item.matchedScopes.length > 0
                                    ? {
                                          scopes: {
                                              create: item.matchedScopes.map((ma) => ({ ma_pham_vi: ma })),
                                          },
                                      }
                                    : {}),
                            };

                            await tx.practicingCertificate.create({ data: createData });
                            createdCount++;
                            scopeMappingsAddedCount += item.matchedScopes.length;
                        } else if (item.action === 'UPDATE' && item.existingCertId) {
                            const updateData: Prisma.PracticingCertificateUncheckedUpdateInput = {};
                            if (item.payload.ngay_cap) updateData.ngay_cap = item.payload.ngay_cap;
                            if (resolvedNoiCapId) updateData.noi_cap_cchn_id = resolvedNoiCapId;
                            if (item.payload.pham_vi_bo_sung) updateData.pham_vi_bo_sung = item.payload.pham_vi_bo_sung;
                            if (item.payload.dich_vu_ky_thuat) updateData.dich_vu_ky_thuat = item.payload.dich_vu_ky_thuat;
                            if (item.payload.vb_phan_cong) updateData.vb_phan_cong = item.payload.vb_phan_cong;
                            if (item.payload.thoi_gian_dang_ky) {
                                updateData.thoi_gian_dang_ky = item.payload.thoi_gian_dang_ky;
                            }
                            if (item.payload.thoi_gian_ngay) updateData.thoi_gian_ngay = item.payload.thoi_gian_ngay;
                            if (item.payload.thoi_gian_tuan) updateData.thoi_gian_tuan = item.payload.thoi_gian_tuan;
                            if (item.payload.cskcb_khac) updateData.cskcb_khac = item.payload.cskcb_khac;
                            if (item.payload.cskcb_cgkt) updateData.cskcb_cgkt = item.payload.cskcb_cgkt;
                            if (item.payload.qd_cgkt) updateData.qd_cgkt = item.payload.qd_cgkt;
                            if (item.payload.tu_ngay) updateData.tu_ngay = item.payload.tu_ngay;
                            if (item.payload.den_ngay) updateData.den_ngay = item.payload.den_ngay;

                            if (Object.keys(updateData).length > 0) {
                                await tx.practicingCertificate.update({
                                    where: { id: item.existingCertId },
                                    data: updateData,
                                });
                            }

                            if (item.scopesToAdd.length > 0) {
                                await tx.cCHNScopeMapping.createMany({
                                    data: item.scopesToAdd.map((ma) => ({
                                        cchn_id: item.existingCertId as string,
                                        ma_pham_vi: ma,
                                    })),
                                    skipDuplicates: true,
                                });
                                scopeMappingsAddedCount += item.scopesToAdd.length;
                            }

                            updatedCount++;
                        }
                    }
                },
                { timeout: 30000 }
            );
        }

        return NextResponse.json({
            mode: 'execute',
            success: true,
            result: {
                createdCount,
                updatedCount,
                skippedCount: plan.summary.skipCount,
                unmatchedCount: plan.summary.unmatchedCount,
                preservedExistingCount: plan.summary.preservedExistingCount,
                createdNoiCapCount,
                scopeMappingsAddedCount,
            },
            unmatched: plan.unmatched,
        });
    } catch (error) {
        console.error('Error restoring CCHN from Mau02Catalog:', error);
        const messageText = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { error: `Lỗi khi khôi phục dữ liệu CCHN từ Mẫu 02: ${messageText}` },
            { status: 500 }
        );
    }
}


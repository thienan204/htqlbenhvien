import { NextResponse } from 'next/server';
import { PrismaClient, type Prisma } from '@prisma/client';
import { gunzipSync, gzipSync } from 'zlib';
import prisma from '@/lib/prisma';
import { getCurrentUserFromRequest, type UserPayload } from '@/actions/auth';

export const MAX_SNAPSHOT_RECORDS = 15000;
export const MAX_SNAPSHOT_GZIP_BYTES = 10 * 1024 * 1024; // 10 MB compressed

export type SnapshotActionType = 'DELETE_ALL' | 'BULK_DELETE' | 'SYNC_OVERWRITE';

export type SnapshotTableName =
    | 'Staff'
    | 'PracticingCertificate'
    | 'ScopeOfPracticeCatalog'
    | 'ScopeServiceMapping'
    | 'Department'
    | 'DepartmentCatalog'
    | 'Mau02Catalog'
    | 'Mau03Catalog'
    | 'Mau04Catalog'
    | 'Mau05Catalog'
    | 'Mau06Catalog'
    | 'ValidationRule'
    | 'HoSoDaGui'
    | 'Xml1'
    | 'ITRequest'
    | 'ClinicalScheduleRecord'
    | 'DoctorServiceMapping'
    | 'TT32Category';

export class SnapshotLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SnapshotLimitError';
    }
}

interface AuthorizeOptions {
    allowedRoles?: string[];
    menuKeys?: string[];
    action?: 'VIEW' | 'EDIT' | 'DELETE';
    requireAdmin?: boolean;
    allowAuthenticated?: boolean;
}

/**
 * Kiểm tra quyền từ payload JWT (hỗ trợ cả kiểu Array và Object permissions từ /roles)
 */
export function hasMenuPermission(
    user: UserPayload | null,
    menuKeys: string[],
    action: 'VIEW' | 'EDIT' | 'DELETE' = 'DELETE'
): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    const perms = user.permissions;
    if (!perms) return false;

    if (Array.isArray(perms)) {
        if (perms.includes('*')) return true;
        return menuKeys.some((key) => perms.includes(key));
    }

    if (typeof perms === 'object') {
        const recordPerms = perms as Record<string, Record<string, boolean> | undefined>;
        return menuKeys.some((key) => Boolean(recordPerms[key]?.[action]));
    }

    return false;
}

export async function parseDeleteIdsFromRequest(request: Request): Promise<string[]> {
    const collected = new Set<string>();
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');
    if (idsParam && idsParam !== 'all') {
        for (const id of idsParam.split(',')) {
            const trimmed = id.trim();
            if (trimmed) collected.add(trimmed);
        }
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        try {
            const body = (await request.clone().json()) as { ids?: unknown };
            if (Array.isArray(body?.ids)) {
                for (const item of body.ids) {
                    const trimmed = String(item ?? '').trim();
                    if (trimmed) collected.add(trimmed);
                }
            }
        } catch {
            // Empty or non-JSON body
        }
    }

    return Array.from(collected);
}

/**
 * Chuẩn hóa kiểm tra đăng nhập và phân quyền cho API xóa / thao tác nhạy cảm
 */
export async function authorizeApiRequest(
    request: Request,
    options: AuthorizeOptions = {}
): Promise<{ user: UserPayload | null; errorResponse?: NextResponse }> {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
        const msg = 'Vui lòng đăng nhập để thực hiện thao tác này.';
        return {
            user: null,
            errorResponse: NextResponse.json(
                { error: msg, message: msg },
                { status: 401 }
            ),
        };
    }

    if (user.role?.trim() === 'GUEST') {
        const msg = 'Tài khoản khách (GUEST) không có quyền thực hiện thao tác xóa dữ liệu.';
        return {
            user,
            errorResponse: NextResponse.json(
                { error: msg, message: msg },
                { status: 403 }
            ),
        };
    }

    if (user.role === 'ADMIN') {
        return { user };
    }

    if (options.requireAdmin) {
        const msg = 'Chỉ tài khoản ADMIN mới có quyền thực hiện thao tác này.';
        return {
            user,
            errorResponse: NextResponse.json(
                { error: msg, message: msg },
                { status: 403 }
            ),
        };
    }

    const roleMatched = options.allowedRoles ? options.allowedRoles.includes(user.role) : false;
    const menuMatched = options.menuKeys
        ? hasMenuPermission(user, options.menuKeys, options.action || 'DELETE')
        : false;

    if (roleMatched || menuMatched || Boolean(options.allowAuthenticated)) {
        return { user };
    }

    const deniedMsg = `Tài khoản (${user.role}) không có quyền thực hiện thao tác xóa dữ liệu này.`;
    return {
        user,
        errorResponse: NextResponse.json(
            { error: deniedMsg, message: deniedMsg },
            { status: 403 }
        ),
    };
}

interface CreateSnapshotParams {
    tx?: Prisma.TransactionClient;
    tableName: SnapshotTableName | string;
    displayName: string;
    actionType: SnapshotActionType;
    filterSummary?: string;
    recordsCount: number;
    data: unknown;
    user: UserPayload | null;
    restorable?: boolean;
}

interface SnapshotEnvelope {
    version: 1;
    tableName: string;
    exportedAt: string;
    data: unknown;
}

function getSnapshotDelegate(db: PrismaClient | Prisma.TransactionClient) {
    return (db as unknown as {
        dataDeleteSnapshot?: Prisma.TransactionClient['dataDeleteSnapshot'];
    }).dataDeleteSnapshot;
}

/**
 * Tự động nén và lưu snapshot JSON trước khi xóa hàng loạt / xóa toàn bộ
 */
export async function createDeleteSnapshot(params: CreateSnapshotParams): Promise<{
    created: boolean;
    snapshotId?: string;
    recordCount: number;
    compressedBytes: number;
}> {
    const {
        tx,
        tableName,
        displayName,
        actionType,
        filterSummary,
        recordsCount,
        data,
        user,
        restorable = true,
    } = params;

    if (recordsCount <= 0) {
        return { created: false, recordCount: 0, compressedBytes: 0 };
    }

    if (recordsCount > MAX_SNAPSHOT_RECORDS) {
        throw new SnapshotLimitError(
            `Dữ liệu cần xóa (${recordsCount.toLocaleString('vi-VN')} dòng) vượt ngưỡng Snapshot tự động (${MAX_SNAPSHOT_RECORDS.toLocaleString('vi-VN')} dòng). Vui lòng thu hẹp bộ lọc hoặc sao lưu toàn hệ thống bằng ./backup.sh trước khi xóa.`
        );
    }

    const envelope: SnapshotEnvelope = {
        version: 1,
        tableName,
        exportedAt: new Date().toISOString(),
        data,
    };

    const jsonString = JSON.stringify(envelope);
    const rawSizeBytes = Buffer.byteLength(jsonString, 'utf8');
    const compressed = gzipSync(jsonString);

    if (compressed.length > MAX_SNAPSHOT_GZIP_BYTES) {
        throw new SnapshotLimitError(
            `Dung lượng Snapshot nén vượt mức tối đa 10 MB. Vui lòng thu hẹp phạm vi xóa hoặc sao lưu DB trên server trước.`
        );
    }

    const db = tx || prisma;
    const delegate = getSnapshotDelegate(db);
    if (!delegate) {
        throw new Error('Model DataDeleteSnapshot chưa sẵn sàng. Vui lòng chạy prisma generate / db push.');
    }

    const created = await delegate.create({
        data: {
            tableName,
            displayName,
            actionType,
            filterSummary: filterSummary || 'Toàn bộ dữ liệu',
            recordCount: recordsCount,
            rawSizeBytes,
            payloadGzip: compressed,
            restorable,
            deletedById: user?.id || null,
            deletedByName: user?.name || user?.username || null,
            deletedByRole: user?.role || null,
        },
        select: { id: true },
    });

    return {
        created: true,
        snapshotId: created.id,
        recordCount: recordsCount,
        compressedBytes: compressed.length,
    };
}

export function decompressSnapshotEnvelope(payloadGzip: Uint8Array | Buffer): SnapshotEnvelope {
    const buf = Buffer.isBuffer(payloadGzip) ? payloadGzip : Buffer.from(payloadGzip);
    const jsonString = gunzipSync(buf).toString('utf8');
    return JSON.parse(jsonString) as SnapshotEnvelope;
}

const DATE_FIELD_NAMES = new Set([
    'createdAt',
    'updatedAt',
    'ngay_sinh',
    'ngay_tuyen_dung',
    'ngay_vao_nganh',
    'ngay_nang_luong',
    'ngay_cap',
    'tu_ngay',
    'den_ngay',
    'ngay_nghi_viec',
    'ngay_quyet_dinh',
    'ngay_het_han',
    'startedAt',
    'completedAt',
]);

function reviveRowDates<T extends Record<string, unknown>>(row: T): T {
    const copy: Record<string, unknown> = { ...row };
    for (const [k, v] of Object.entries(copy)) {
        if (DATE_FIELD_NAMES.has(k) && typeof v === 'string' && v.trim() !== '') {
            const d = new Date(v);
            if (!Number.isNaN(d.getTime())) {
                copy[k] = d;
            }
        }
    }
    return copy as T;
}

function reviveArrayDates<T extends Record<string, unknown>>(rows: T[] | undefined | null): T[] {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => reviveRowDates(r));
}

export interface RestoreSnapshotResult {
    tableName: string;
    restoredCounts: Record<string, number>;
    skippedReason?: string;
}

interface StaffBundlePayload {
    staff: Array<Record<string, unknown>>;
    certificates?: Array<Record<string, unknown>>;
    cchnScopeMappings?: Array<Record<string, unknown>>;
    trainings?: Array<Record<string, unknown>>;
    workHistories?: Array<Record<string, unknown>>;
}

interface ScopeBundlePayload {
    scopes: Array<Record<string, unknown>>;
    scopeServiceMappings?: Array<Record<string, unknown>>;
    cchnScopeMappings?: Array<Record<string, unknown>>;
}

interface CertBundlePayload {
    certificates: Array<Record<string, unknown>>;
    cchnScopeMappings?: Array<Record<string, unknown>>;
}

interface Tt32BundlePayload {
    categories: Array<Record<string, unknown>>;
    chapterMappings?: Array<Record<string, unknown>>;
}

/**
 * Khôi phục dữ liệu từ Snapshot theo đúng thứ tự khóa ngoại (sử dụng skipDuplicates: true)
 */
export async function restoreFromDeleteSnapshot(
    snapshotId: string,
    user: UserPayload
): Promise<RestoreSnapshotResult> {
    const snapshot = await prisma.dataDeleteSnapshot.findUnique({
        where: { id: snapshotId },
    });

    if (!snapshot) {
        throw new Error('Không tìm thấy bản sao lưu Snapshot.');
    }
    if (!snapshot.restorable) {
        throw new Error(`Bảng ${snapshot.tableName} chưa hỗ trợ khôi phục tự động trên web. Vui lòng tải file JSON để kiểm tra.`);
    }

    const envelope = decompressSnapshotEnvelope(snapshot.payloadGzip);
    const restoredCounts: Record<string, number> = {};

    await prisma.$transaction(
        async (tx) => {
            switch (snapshot.tableName) {
                case 'Department': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.department.createMany({
                            data: rows as unknown as Prisma.DepartmentCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.Department = res.count;
                    }
                    break;
                }

                case 'Mau02Catalog': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.mau02Catalog.createMany({
                            data: rows as unknown as Prisma.Mau02CatalogCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.Mau02Catalog = res.count;
                    }
                    break;
                }

                case 'DepartmentCatalog': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.departmentCatalog.createMany({
                            data: rows as unknown as Prisma.DepartmentCatalogCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.DepartmentCatalog = res.count;
                    }
                    break;
                }

                case 'Mau03Catalog': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.mau03Catalog.createMany({
                            data: rows as unknown as Prisma.Mau03CatalogCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.Mau03Catalog = res.count;
                    }
                    break;
                }

                case 'Mau04Catalog': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.mau04Catalog.createMany({
                            data: rows as unknown as Prisma.Mau04CatalogCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.Mau04Catalog = res.count;
                    }
                    break;
                }

                case 'Mau05Catalog': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.mau05Catalog.createMany({
                            data: rows as unknown as Prisma.Mau05CatalogCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.Mau05Catalog = res.count;
                    }
                    break;
                }

                case 'Mau06Catalog': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.mau06Catalog.createMany({
                            data: rows as unknown as Prisma.Mau06CatalogCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.Mau06Catalog = res.count;
                    }
                    break;
                }

                case 'ValidationRule': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.validationRule.createMany({
                            data: rows as unknown as Prisma.ValidationRuleCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.ValidationRule = res.count;
                    }
                    break;
                }

                case 'HoSoDaGui': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.hoSoDaGui.createMany({
                            data: rows as unknown as Prisma.HoSoDaGuiCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.HoSoDaGui = res.count;
                    }
                    break;
                }

                case 'DoctorServiceMapping': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    if (rows.length > 0) {
                        const res = await tx.doctorServiceMapping.createMany({
                            data: rows as unknown as Prisma.DoctorServiceMappingCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.DoctorServiceMapping = res.count;
                    }
                    break;
                }

                case 'ScopeServiceMapping': {
                    const rows = reviveArrayDates(envelope.data as Array<Record<string, unknown>>);
                    const existingScopes = await tx.scopeOfPracticeCatalog.findMany({
                        select: { ma_pham_vi: true },
                    });
                    const scopeSet = new Set(existingScopes.map((s) => s.ma_pham_vi));
                    const validRows = rows.filter((r) => typeof r.ma_pham_vi === 'string' && scopeSet.has(r.ma_pham_vi));
                    if (validRows.length > 0) {
                        const res = await tx.scopeServiceMapping.createMany({
                            data: validRows as unknown as Prisma.ScopeServiceMappingCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.ScopeServiceMapping = res.count;
                    }
                    break;
                }

                case 'ScopeOfPracticeCatalog': {
                    const bundle = envelope.data as ScopeBundlePayload;
                    const scopes = reviveArrayDates(bundle.scopes);
                    if (scopes.length > 0) {
                        const res = await tx.scopeOfPracticeCatalog.createMany({
                            data: scopes as unknown as Prisma.ScopeOfPracticeCatalogCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.ScopeOfPracticeCatalog = res.count;
                    }

                    const scopeServiceMappings = reviveArrayDates(bundle.scopeServiceMappings);
                    if (scopeServiceMappings.length > 0) {
                        const res = await tx.scopeServiceMapping.createMany({
                            data: scopeServiceMappings as unknown as Prisma.ScopeServiceMappingCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.ScopeServiceMapping = res.count;
                    }

                    const cchnScopeMappings = reviveArrayDates(bundle.cchnScopeMappings);
                    if (cchnScopeMappings.length > 0) {
                        const existingCerts = await tx.practicingCertificate.findMany({ select: { id: true } });
                        const certSet = new Set(existingCerts.map((c) => c.id));
                        const validCchnScopes = cchnScopeMappings.filter(
                            (m) => typeof m.cchn_id === 'string' && certSet.has(m.cchn_id)
                        );
                        if (validCchnScopes.length > 0) {
                            const res = await tx.cCHNScopeMapping.createMany({
                                data: validCchnScopes as unknown as Prisma.CCHNScopeMappingCreateManyInput[],
                                skipDuplicates: true,
                            });
                            restoredCounts.CCHNScopeMapping = res.count;
                        }
                    }
                    break;
                }

                case 'TT32Category': {
                    const bundle = envelope.data as Tt32BundlePayload;
                    const categories = reviveArrayDates(bundle.categories);
                    if (categories.length > 0) {
                        const res = await tx.tT32Category.createMany({
                            data: categories as unknown as Prisma.TT32CategoryCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.TT32Category = res.count;
                    }

                    const chapterMappings = reviveArrayDates(bundle.chapterMappings);
                    if (chapterMappings.length > 0) {
                        const existingChapters = await tx.serviceChapter.findMany({ select: { code: true } });
                        const chapSet = new Set(existingChapters.map((c) => c.code));
                        const validMappings = chapterMappings.filter(
                            (m) => typeof m.chapter_code === 'string' && chapSet.has(m.chapter_code)
                        );
                        if (validMappings.length > 0) {
                            const res = await tx.tT32ChapterMapping.createMany({
                                data: validMappings as unknown as Prisma.TT32ChapterMappingCreateManyInput[],
                                skipDuplicates: true,
                            });
                            restoredCounts.TT32ChapterMapping = res.count;
                        }
                    }
                    break;
                }

                case 'PracticingCertificate': {
                    const bundle = envelope.data as CertBundlePayload;
                    const [existingStaff, existingCats, existingTt32, existingScopes] = await Promise.all([
                        tx.staff.findMany({ select: { id: true } }),
                        tx.systemCategory.findMany({ select: { id: true } }),
                        tx.tT32Category.findMany({ select: { id: true } }),
                        tx.scopeOfPracticeCatalog.findMany({ select: { ma_pham_vi: true } }),
                    ]);
                    const staffSet = new Set(existingStaff.map((s) => s.id));
                    const catSet = new Set(existingCats.map((c) => c.id));
                    const tt32Set = new Set(existingTt32.map((t) => t.id));
                    const scopeSet = new Set(existingScopes.map((s) => s.ma_pham_vi));

                    const certs = reviveArrayDates(bundle.certificates)
                        .filter((c) => typeof c.staffId === 'string' && staffSet.has(c.staffId))
                        .map((c) => ({
                            ...c,
                            noi_cap_cchn_id:
                                typeof c.noi_cap_cchn_id === 'string' && catSet.has(c.noi_cap_cchn_id)
                                    ? c.noi_cap_cchn_id
                                    : null,
                            tt32_category_id:
                                typeof c.tt32_category_id === 'string' && tt32Set.has(c.tt32_category_id)
                                    ? c.tt32_category_id
                                    : null,
                        }));

                    if (certs.length > 0) {
                        const res = await tx.practicingCertificate.createMany({
                            data: certs as unknown as Prisma.PracticingCertificateCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.PracticingCertificate = res.count;
                    }

                    const mappings = reviveArrayDates(bundle.cchnScopeMappings).filter(
                        (m) => typeof m.ma_pham_vi === 'string' && scopeSet.has(m.ma_pham_vi)
                    );
                    if (mappings.length > 0) {
                        const res = await tx.cCHNScopeMapping.createMany({
                            data: mappings as unknown as Prisma.CCHNScopeMappingCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.CCHNScopeMapping = res.count;
                    }
                    break;
                }

                case 'Staff': {
                    const bundle = envelope.data as StaffBundlePayload;
                    const [existingDepts, existingCats, existingTt32, existingScopes] = await Promise.all([
                        tx.department.findMany({ select: { ma_khoa: true } }),
                        tx.systemCategory.findMany({ select: { id: true } }),
                        tx.tT32Category.findMany({ select: { id: true } }),
                        tx.scopeOfPracticeCatalog.findMany({ select: { ma_pham_vi: true } }),
                    ]);
                    const deptSet = new Set(existingDepts.map((d) => d.ma_khoa));
                    const catSet = new Set(existingCats.map((c) => c.id));
                    const tt32Set = new Set(existingTt32.map((t) => t.id));
                    const scopeSet = new Set(existingScopes.map((s) => s.ma_pham_vi));

                    const optionalStaffCategoryFields = [
                        'chuc_danh_id',
                        'chuc_vu_id',
                        'gioi_tinh_id',
                        'loai_hop_dong_id',
                        'trinh_do_id',
                        'vi_tri_id',
                        'dan_toc_id',
                        'trang_thai_id',
                        'vi_tri_bhyt_id',
                        'noi_sinh_ward_id',
                        'que_quan_ward_id',
                        'noi_o_ward_id',
                        'ma_ngach_id',
                        'he_so_luong_id',
                        'bac_luong_id',
                        'phu_cap_tnvk_id',
                    ];

                    const staffRows = reviveArrayDates(bundle.staff)
                        .filter((s) => typeof s.ma_khoa === 'string' && deptSet.has(s.ma_khoa))
                        .map((s) => {
                            const cleaned: Record<string, unknown> = { ...s };
                            for (const f of optionalStaffCategoryFields) {
                                const val = cleaned[f];
                                if (typeof val === 'string' && !catSet.has(val)) {
                                    cleaned[f] = null;
                                }
                            }
                            return cleaned;
                        });

                    if (staffRows.length > 0) {
                        const res = await tx.staff.createMany({
                            data: staffRows as unknown as Prisma.StaffCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.Staff = res.count;
                    }

                    const staffIdsNow = new Set(
                        (await tx.staff.findMany({ select: { id: true } })).map((s) => s.id)
                    );

                    const certs = reviveArrayDates(bundle.certificates)
                        .filter((c) => typeof c.staffId === 'string' && staffIdsNow.has(c.staffId))
                        .map((c) => ({
                            ...c,
                            noi_cap_cchn_id:
                                typeof c.noi_cap_cchn_id === 'string' && catSet.has(c.noi_cap_cchn_id)
                                    ? c.noi_cap_cchn_id
                                    : null,
                            tt32_category_id:
                                typeof c.tt32_category_id === 'string' && tt32Set.has(c.tt32_category_id)
                                    ? c.tt32_category_id
                                    : null,
                        }));

                    if (certs.length > 0) {
                        const res = await tx.practicingCertificate.createMany({
                            data: certs as unknown as Prisma.PracticingCertificateCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.PracticingCertificate = res.count;
                    }

                    const certIdsNow = new Set(
                        (await tx.practicingCertificate.findMany({ select: { id: true } })).map((c) => c.id)
                    );
                    const scopes = reviveArrayDates(bundle.cchnScopeMappings).filter(
                        (m) =>
                            typeof m.cchn_id === 'string' &&
                            certIdsNow.has(m.cchn_id) &&
                            typeof m.ma_pham_vi === 'string' &&
                            scopeSet.has(m.ma_pham_vi)
                    );
                    if (scopes.length > 0) {
                        const res = await tx.cCHNScopeMapping.createMany({
                            data: scopes as unknown as Prisma.CCHNScopeMappingCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.CCHNScopeMapping = res.count;
                    }

                    const trainings = reviveArrayDates(bundle.trainings)
                        .filter((t) => typeof t.staffId === 'string' && staffIdsNow.has(t.staffId))
                        .map((t) => ({
                            ...t,
                            loai_dao_tao_id:
                                typeof t.loai_dao_tao_id === 'string' && catSet.has(t.loai_dao_tao_id)
                                    ? t.loai_dao_tao_id
                                    : null,
                        }));
                    if (trainings.length > 0) {
                        const res = await tx.staffTraining.createMany({
                            data: trainings as unknown as Prisma.StaffTrainingCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.StaffTraining = res.count;
                    }

                    const histories = reviveArrayDates(bundle.workHistories)
                        .filter(
                            (h) =>
                                typeof h.staffId === 'string' &&
                                staffIdsNow.has(h.staffId) &&
                                typeof h.ma_khoa === 'string' &&
                                deptSet.has(h.ma_khoa)
                        )
                        .map((h) => ({
                            ...h,
                            chuc_vu_id:
                                typeof h.chuc_vu_id === 'string' && catSet.has(h.chuc_vu_id)
                                    ? h.chuc_vu_id
                                    : null,
                        }));
                    if (histories.length > 0) {
                        const res = await tx.staffWorkHistory.createMany({
                            data: histories as unknown as Prisma.StaffWorkHistoryCreateManyInput[],
                            skipDuplicates: true,
                        });
                        restoredCounts.StaffWorkHistory = res.count;
                    }
                    break;
                }

                default:
                    throw new Error(`Chưa hỗ trợ khôi phục tự động cho bảng ${snapshot.tableName}.`);
            }

            await tx.dataDeleteSnapshot.update({
                where: { id: snapshot.id },
                data: {
                    restoredAt: new Date(),
                    restoredByName: user.name || user.username,
                },
            });
        },
        { timeout: 30000 }
    );

    return {
        tableName: snapshot.tableName,
        restoredCounts,
    };
}


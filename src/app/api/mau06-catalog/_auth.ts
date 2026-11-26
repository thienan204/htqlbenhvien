import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest, UserPayload } from '@/actions/auth';
import { getSystemConfig } from '@/lib/systemConfig';

/**
 * Kiểm tra quyền từ cấu hình Menu (/roles) hỗ trợ cả MENU_CATALOG_06 và MENU_MAU01_CATALOG
 */
export function hasMau06MenuPermission(user: UserPayload | null, action: 'VIEW' | 'EDIT' | 'DELETE'): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    const perms = user.permissions;
    if (!perms) return false;

    const menuCodes = ['MENU_CATALOG_06', 'MENU_MAU01_CATALOG'];
    if (Array.isArray(perms)) {
        if (perms.includes('*')) return true;
        if (action === 'DELETE') return false;
        return menuCodes.some(code => perms.includes(code));
    }

    if (typeof perms === 'object') {
        return menuCodes.some(code => Boolean(perms[code]?.[action]));
    }
    return false;
}

/**
 * Xác thực quyền Thêm/Sửa hoặc Xóa danh mục Mẫu 06 cho các API Route (kết hợp /roles và /system-config)
 */
export async function authorizeMau06Action(
    request: Request,
    action: 'EDIT' | 'DELETE',
    requireAdminForDeleteAll: boolean = false
): Promise<{ user: UserPayload | null; errorResponse?: NextResponse }> {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
        return {
            user: null,
            errorResponse: NextResponse.json({ error: 'Vui lòng đăng nhập để thực hiện thao tác' }, { status: 401 })
        };
    }

    if (user.role === 'ADMIN') {
        return { user };
    }

    if (requireAdminForDeleteAll) {
        return {
            user,
            errorResponse: NextResponse.json({ error: 'Chỉ Quản trị viên (ADMIN) mới có quyền xóa toàn bộ danh mục' }, { status: 403 })
        };
    }

    if (hasMau06MenuPermission(user, action)) {
        return { user };
    }

    const configKey = action === 'EDIT' ? 'MAU06_EDIT_ROLES' : 'MAU06_DELETE_ROLES';
    const defaultVal = action === 'EDIT' ? 'ADMIN,CNTT,VTYT' : 'ADMIN';
    const rolesRaw = await getSystemConfig(configKey, defaultVal);
    const allowedRoles = rolesRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (allowedRoles.includes(user.role)) {
        return { user };
    }

    return {
        user,
        errorResponse: NextResponse.json(
            { error: `Tài khoản (${user.role}) không có quyền ${action === 'EDIT' ? 'Thêm/Sửa/Import' : 'Xóa'} danh mục Mẫu 06` },
            { status: 403 }
        )
    };
}


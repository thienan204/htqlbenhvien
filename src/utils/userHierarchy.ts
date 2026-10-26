export const UserLevel = {
    LEVEL_1_BGD: 'LEVEL_1_BGD',
    LEVEL_2_LEADER: 'LEVEL_2_LEADER',
    LEVEL_3_STAFF: 'LEVEL_3_STAFF'
} as const;
export type UserLevel = 'LEVEL_1_BGD' | 'LEVEL_2_LEADER' | 'LEVEL_3_STAFF';

export function calculateUserHierarchy(
    userRole: string, 
    chucVuCode?: string | null, 
    maKhoa?: string | null,
    explicitLevel?: string | null
) {
    if (userRole === 'ADMIN') {
        return {
            userLevel: 'LEVEL_1_BGD' as UserLevel,
            isManager: true,
            isDirector: true,
            isDeptLeader: false,
            isITLeader: true
        };
    }

    const isIT = userRole === 'CNTT' || maKhoa === 'KP046';

    // 1. Ưu tiên cấp bậc Level được khai báo trực tiếp trong Danh mục Chức vụ (SystemCategory)
    if (explicitLevel === 'LEVEL_1_BGD') {
        return {
            userLevel: 'LEVEL_1_BGD' as UserLevel,
            isManager: true,
            isDirector: true,
            isDeptLeader: false,
            isITLeader: false
        };
    }

    if (explicitLevel === 'LEVEL_2_LEADER') {
        return {
            userLevel: 'LEVEL_2_LEADER' as UserLevel,
            isManager: true,
            isDirector: false,
            isDeptLeader: true,
            isITLeader: isIT
        };
    }

    if (explicitLevel === 'LEVEL_3_STAFF') {
        return {
            userLevel: 'LEVEL_3_STAFF' as UserLevel,
            isManager: false,
            isDirector: false,
            isDeptLeader: false,
            isITLeader: false
        };
    }

    // 2. Dự phòng: Tự động nhận diện theo mã Chức vụ nếu chưa cấu hình explicitLevel
    const code = (chucVuCode || '').toUpperCase();
    const isDirector = code.includes('GIAM_OC');
    const isDeptLeader = !isDirector && (
        code.includes('TRUONG_KHOA') || 
        code.includes('TRUONG_PHONG') || 
        code.includes('PHU_TRACH') || 
        code.includes('IEU_DUONG_TRUONG') || 
        code.includes('HO_SINH_TRUONG') || 
        code.includes('KY_THUAT_Y_TRUONG')
    );

    let userLevel: UserLevel = 'LEVEL_3_STAFF';
    if (isDirector) {
        userLevel = 'LEVEL_1_BGD';
    } else if (isDeptLeader) {
        userLevel = 'LEVEL_2_LEADER';
    }

    const isITLeader = isIT && isDeptLeader;

    return {
        userLevel,
        isManager: isDirector || isDeptLeader,
        isDirector,
        isDeptLeader,
        isITLeader
    };
}

'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { UserPayload } from '@/actions/auth';

interface AuthContextType {
    user: UserPayload | null;
    hasPermission: (menuCode: string, action?: 'VIEW' | 'EDIT' | 'DELETE') => boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    hasPermission: () => false,
});

export function AuthProvider({ user, guestPermissions, children }: { user: UserPayload | null; guestPermissions?: any; children: ReactNode }) {
    
    const hasPermission = (menuCode: string, action: 'VIEW' | 'EDIT' | 'DELETE' = 'VIEW') => {
        if (!user) {
            // Check guest permissions
            if (!guestPermissions) return false;
            
            if (Array.isArray(guestPermissions)) {
                if (guestPermissions.includes('*')) return true;
                if (action === 'VIEW') {
                    return guestPermissions.includes(menuCode);
                }
                return false;
            }

            if (typeof guestPermissions === 'object') {
                const menuPerms = guestPermissions[menuCode];
                if (!menuPerms) return false;
                return !!menuPerms[action];
            }

            return false;
        }

        if (user.role === 'ADMIN') return true;
        if (!user.permissions) return false;

        // Tương thích ngược: Nếu permissions đang lưu kiểu mảng string
        if (Array.isArray(user.permissions)) {
            if (user.permissions.includes('*')) return true;
            if (action === 'DELETE') return false;
            return user.permissions.includes(menuCode);
        }

        // Kiểu đối tượng mới: { "MENU_CODE": { "VIEW": true, "EDIT": true, "DELETE": false } }
        if (typeof user.permissions === 'object') {
            const menuPerms = user.permissions[menuCode];
            if (!menuPerms) return false;
            return !!menuPerms[action];
        }

        return false;
    };

    return (
        <AuthContext.Provider value={{ user, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-me-in-prod';

export async function middleware(request: NextRequest) {
    // 1. Check if route is protected
    // Protected routes: /kiem-tra-loi-bhxh/*, /admin/*
    // Public routes: /login, /api/auth/*, /_next/*, /favicon.ico, /images/*

    let path = request.nextUrl.pathname;
    let targetPathForRewrite: string | null = null;
    const bp = request.nextUrl.basePath || '';

    // 1. Resolve Alias if any
    try {
        const aliasUrl = new URL(`${bp}/api/menus/aliases`, request.url);
        // Fetch from the API, cached at Edge
        const aliasRes = await fetch(aliasUrl, { next: { revalidate: 60 } });
        if (aliasRes.ok) {
            const aliases = await aliasRes.json();
            if (aliases[path]) {
                if (aliases[path] !== path) {
                    targetPathForRewrite = aliases[path];
                }
                path = aliases[path] as string; // Use target path for Auth checks
            }
        }
    } catch (e) {
        console.error("Middleware fetch alias error:", e);
    }

    // Define strictly public routes that don't need DB checks
    const isPublic = ['/login', '/favicon.ico', '/logo.png'].includes(path) || path.startsWith('/_next') || path.startsWith('/images') || path.startsWith('/api/menus/aliases') || path.startsWith('/api/upload-image');

    if (isPublic) {
        if (targetPathForRewrite) return NextResponse.rewrite(new URL(`${bp}${targetPathForRewrite}`, request.url));
        return NextResponse.next();
    }

    // Dynamic guest paths
    let roleManagedPublicPaths = ['/doc-file-excel', '/pttt-excel', '/chuyen-de', '/icd10'];
    try {
        const guestPathsUrl = new URL(`${bp}/api/menus/guest-paths`, request.url);
        const guestPathsRes = await fetch(guestPathsUrl, { next: { revalidate: 60 } });
        if (guestPathsRes.ok) {
            const dynamicGuestPaths = await guestPathsRes.json();
            if (Array.isArray(dynamicGuestPaths)) {
                roleManagedPublicPaths = [...roleManagedPublicPaths, ...dynamicGuestPaths];
            }
        }
    } catch (e) {
        console.error("Middleware fetch guest-paths error:", e);
    }

    const isRoleManagedPublic = roleManagedPublicPaths.some(p => path.startsWith(p));
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
        if (isRoleManagedPublic) {
            if (targetPathForRewrite) return NextResponse.rewrite(new URL(`${bp}${targetPathForRewrite}`, request.url));
            return NextResponse.next();
        }
        return NextResponse.redirect(new URL(`${bp}/login`, request.url));
    }

    // We have a token, verify it
    try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jose.jwtVerify(token, secret);
        
        // 1. Admin-Only Routes
        let adminOnlyPaths: string[] = [];
        try {
            const adminPathsUrl = new URL(`${bp}/api/admin/paths-config`, request.url);
            const adminPathsRes = await fetch(adminPathsUrl, { next: { revalidate: 60 } });
            if (adminPathsRes.ok) {
                adminOnlyPaths = await adminPathsRes.json();
            }
        } catch (e) {
            console.error("Middleware fetch admin-paths error:", e);
        }
        
        const tccbPaths = ['/staff', '/departments', '/practicing-certificates'];
        
        const isAdminRoute = adminOnlyPaths.some((p: string) => path.startsWith(p));
        const isTccbRoute = tccbPaths.some((p: string) => path.startsWith(p));
        
        if (isAdminRoute && payload.role !== 'ADMIN') {
            return NextResponse.redirect(new URL(`${bp}/?error=unauthorized`, request.url));
        }

        if (isTccbRoute && !['ADMIN', 'TCCB', 'KHOA_PHONG', 'KHOA'].includes(payload.role as string)) {
            return NextResponse.redirect(new URL(`${bp}/?error=unauthorized`, request.url));
        }

        if (targetPathForRewrite) return NextResponse.rewrite(new URL(`${bp}${targetPathForRewrite}`, request.url));
        return NextResponse.next();
    } catch (error) {
        // Token is invalid/expired
        if (isRoleManagedPublic) {
            if (targetPathForRewrite) return NextResponse.rewrite(new URL(`${bp}${targetPathForRewrite}`, request.url));
            return NextResponse.next();
        }
        return NextResponse.redirect(new URL(`${bp}/login`, request.url));
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes except specific protected ones? for now let's protect UI only or check inside API)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};

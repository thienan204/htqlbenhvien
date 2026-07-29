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

    // 1. Resolve Alias if any
    try {
        const aliasUrl = new URL('/api/menus/aliases', request.url);
        // Fetch from the API, cached at Edge
        const aliasRes = await fetch(aliasUrl, { next: { revalidate: 60 } });
        if (aliasRes.ok) {
            const aliases = await aliasRes.json();
            if (aliases[path]) {
                targetPathForRewrite = aliases[path];
                path = targetPathForRewrite as string; // Use target path for Auth checks
            }
        }
    } catch (e) {
        console.error("Middleware fetch alias error:", e);
    }

    const bp = request.nextUrl.basePath || '';
    
    // Define all routes that require authentication
    const isPublic = ['/login', '/favicon.ico', '/logo.png'].includes(path) || path.startsWith('/_next') || path.startsWith('/images') || path.startsWith('/api/menus/aliases');

    if (!isPublic) {
        const token = request.cookies.get('auth_token')?.value;

        if (!token) {
            const roleManagedPublicPaths = ['/doc-file-excel', '/pttt-excel', '/chuyen-de', '/icd10'];
            const isRoleManagedPublic = roleManagedPublicPaths.some(p => path.startsWith(p));
            if (isRoleManagedPublic) {
                if (targetPathForRewrite) return NextResponse.rewrite(new URL(targetPathForRewrite, request.url));
                return NextResponse.next();
            }
            return NextResponse.redirect(new URL(`${bp}/login`, request.url));
        }

        try {
            const secret = new TextEncoder().encode(JWT_SECRET);
            const { payload } = await jose.jwtVerify(token, secret);
            
            // 1. Admin-Only Routes
            let adminOnlyPaths: string[] = [];
            try {
                const adminPathsUrl = new URL('/api/admin/paths-config', request.url);
                const adminPathsRes = await fetch(adminPathsUrl, { next: { revalidate: 60 } });
                if (adminPathsRes.ok) {
                    adminOnlyPaths = await adminPathsRes.json();
                }
            } catch (e) {
                console.error("Middleware fetch admin-paths error:", e);
            }
            
            const tccbPaths = ['/staff', '/departments'];
            
            const isAdminRoute = adminOnlyPaths.some((p: string) => path.startsWith(p));
            const isTccbRoute = tccbPaths.some((p: string) => path.startsWith(p));
            
            if (isAdminRoute && payload.role !== 'ADMIN') {
                return NextResponse.redirect(new URL(`${bp}/?error=unauthorized`, request.url));
            }

            if (isTccbRoute && !['ADMIN', 'TCCB', 'KHOA_PHONG'].includes(payload.role as string)) {
                return NextResponse.redirect(new URL(`${bp}/?error=unauthorized`, request.url));
            }

            if (targetPathForRewrite) return NextResponse.rewrite(new URL(targetPathForRewrite, request.url));
            return NextResponse.next();
        } catch (error) {
            return NextResponse.redirect(new URL(`${bp}/login`, request.url));
        }
    }

    if (targetPathForRewrite) return NextResponse.rewrite(new URL(targetPathForRewrite, request.url));
    return NextResponse.next();
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

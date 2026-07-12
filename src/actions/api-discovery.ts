'use server';

import fs from 'fs';
import path from 'path';

export interface ApiDoc {
    description?: string;
    headers?: Record<string, string>;
    body?: any;
    postmanSnippet?: string;
}

export interface ApiEndpoint {
    path: string;
    methods: string[];
    category: string;
    docs?: Record<string, ApiDoc>;
}

const API_DOCS_DB: Record<string, Record<string, ApiDoc>> = {
    '/api/mobile/auth/login': {
        'POST': {
            description: 'Đăng nhập từ Mobile App để lấy JWT Token.',
            headers: { 'Content-Type': 'application/json' },
            body: { username: "tentaikhoan", password: "matkhau" },
            postmanSnippet: 'Gắn URL http://localhost:3000/api/mobile/auth/login vào Postman, chọn Method POST. Chuyển sang tab Body -> chọn raw -> chọn JSON và dán chuỗi JSON mẫu vào.'
        }
    },
    '/api/mobile/it-requests': {
        'GET': {
            description: 'Lấy danh sách các yêu cầu IT (Hỗ trợ lọc theo trạng thái).',
            headers: { 'Authorization': 'Bearer <token_cua_ban>' },
            postmanSnippet: 'Trong Postman, chọn tab Authorization -> Type: Bearer Token -> Dán token lấy được từ API Login vào ô Token.'
        },
        'POST': {
            description: 'Tạo một yêu cầu IT mới từ App điện thoại.',
            headers: { 
                'Authorization': 'Bearer <token_cua_ban>',
                'Content-Type': 'application/json' 
            },
            body: { 
                "ten_loi": "Máy in tại phòng khám số 3 không in được", 
                "category": "HARDWARE", 
                "targetDepartment": "CNTT",
                "ma_khoa": "K01",
                "dynamicFields": { 
                    "Người báo": "Bác sĩ Nguyễn Văn A",
                    "Ghi chú": "Cần sửa gấp"
                }
            },
            postmanSnippet: '1. Gắn Header Authorization giống API GET ở trên.\n2. Chuyển sang tab Body -> raw -> JSON và dán nội dung body mẫu vào.'
        }
    }
};

export async function discoverApiEndpoints(): Promise<ApiEndpoint[]> {
    const apiDirectory = path.join(process.cwd(), 'src', 'app', 'api', 'mobile');
    
    if (!fs.existsSync(apiDirectory)) {
        return [];
    }

    const endpoints = scanDirectory(apiDirectory, '/api/mobile');
    return endpoints.sort((a, b) => a.path.localeCompare(b.path));
}

function scanDirectory(dir: string, baseRoute: string): ApiEndpoint[] {
    let results: ApiEndpoint[] = [];
    const list = fs.readdirSync(dir);
    
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat && stat.isDirectory()) {
            results = results.concat(scanDirectory(fullPath, `${baseRoute}/${file}`));
        } else if (file === 'route.ts' || file === 'route.js') {
            const content = fs.readFileSync(fullPath, 'utf8');
            const methods: string[] = [];
            
            if (content.includes('export async function GET') || content.includes('export function GET')) methods.push('GET');
            if (content.includes('export async function POST') || content.includes('export function POST')) methods.push('POST');
            if (content.includes('export async function PUT') || content.includes('export function PUT')) methods.push('PUT');
            if (content.includes('export async function DELETE') || content.includes('export function DELETE')) methods.push('DELETE');
            if (content.includes('export async function PATCH') || content.includes('export function PATCH')) methods.push('PATCH');
            
            if (methods.length > 0) {
                // Determine category from path
                const pathParts = baseRoute.replace('/api/mobile/', '').split('/');
                const category = pathParts.length > 0 && pathParts[0] ? `MOBILE / ${pathParts[0].toUpperCase()}` : 'MOBILE GENERAL';
                const finalPath = baseRoute.replace(/\\/g, '/');
                
                results.push({
                    path: finalPath,
                    methods,
                    category,
                    docs: API_DOCS_DB[finalPath] || undefined
                });
            }
        }
    }
    
    return results;
}

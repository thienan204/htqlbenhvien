'use server';

import fs from 'fs';
import path from 'path';

export interface ApiDoc {
    description?: string;
    headers?: Record<string, string>;
    body?: any;
    postmanSnippet?: string;
    extensionSnippet?: string;
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
    },
    '/api/his-services': {
        'GET': {
            description: 'Lấy danh sách dịch vụ bác sĩ được thực hiện dựa vào tên đăng nhập HIS (userHIS). API sẽ tự động map userHIS -> CCHN -> Các dịch vụ được phép thực hiện.',
            headers: { 'Content-Type': 'application/json' },
            postmanSnippet: 'Gắn URL http://localhost:3000/htqlbenhvien/api/his-services?userHIS=admin vào Postman, chọn Method GET để xem danh sách dịch vụ.'
        },
        'POST': {
            description: 'Thêm mới (cấp phép) hàng loạt mã dịch vụ vào CCHN của bác sĩ dựa trên tên đăng nhập HIS (userHIS). Các mã đã có sẽ tự động bị bỏ qua.',
            headers: { 'Content-Type': 'application/json' },
            body: { 
                userHIS: "tendangnhapHIS", 
                services: [
                    { ma_dich_vu: "DV001", ten_dich_vu: "Khám bệnh", isChiDinh: true, isThucHien: true },
                    { ma_dich_vu: "DV002", ten_dich_vu: "Siêu âm", isChiDinh: true, isThucHien: false }
                ] 
            },
            postmanSnippet: 'Gắn URL http://localhost:3000/htqlbenhvien/api/his-services vào Postman, chọn Method POST. Chuyển qua tab Body -> raw (JSON) và dán nội dung body mẫu vào để cấp quyền dịch vụ.'
        }
    },
    '/api/beds/check-overlap': {
        'POST': {
            description: 'Kiểm tra trùng lặp thời gian sử dụng giường bệnh (Extension check)',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                userHIS: 'admin',
                ma_giuong: 'H016',
                tu_ngay: '202310010800',
                den_ngay: '202310021000',
                ma_lk_hien_tai: 'OP',
                ma_nhom: '15'
            },
            postmanSnippet: 'Gắn URL http://localhost:3000/htqlbenhvien/api/beds/check-overlap vào Postman, chọn Method POST và truyền Body dạng JSON. API sẽ tự tra ma_khoa từ userHIS để lọc bảng Xml3.',
            extensionSnippet: `async function checkBedOverlap(maGiuong, tuNgay, denNgay, userHIS, maNhom = '15') {
  try {
    const response = await fetch('http://localhost:3000/htqlbenhvien/api/beds/check-overlap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userHIS: userHIS,
        ma_giuong: maGiuong,
        tu_ngay: tuNgay,
        den_ngay: denNgay,
        ma_nhom: maNhom
      })
    });
    
    const result = await response.json();
    if (result.isOverlapped) {
      const bn = result.overlapDetails[0];
      alert(\`CẢNH BÁO: Giường \${maGiuong} ĐÃ CÓ NGƯỜI NẰM!\\nBệnh nhân: \${bn.ho_ten} (\${bn.ma_bn})\\nTừ: \${bn.tu_ngay}\\nĐến: \${bn.den_ngay}\`);
    } else {
      console.log('Giường hợp lệ!');
    }
  } catch (err) {
    console.error(err);
  }
}`
        }
    },
    '/api/extension-config': {
        'GET': {
            description: 'Lấy cấu hình cho extension. Mặc định key="carecheck_rules". Trả về trực tiếp mảng JSON.',
            headers: { 'Content-Type': 'application/json' },
            postmanSnippet: 'Gắn URL http://localhost:3000/htqlbenhvien/api/extension-config?key=carecheck_rules vào Postman và chọn GET.'
        },
        'POST': {
            description: 'Lưu hoặc cập nhật cấu hình cho extension. Gửi mảng JSON cấu hình vào Body.',
            headers: { 'Content-Type': 'application/json' },
            body: [
                {
                    "id": "mock-1",
                    "name": "Cảnh báo trái tuyến"
                }
            ],
            postmanSnippet: 'Gắn URL http://localhost:3000/htqlbenhvien/api/extension-config?key=carecheck_rules vào Postman, chọn Method POST, dán mảng JSON vào Body.'
        }
    }
};

export async function discoverApiEndpoints(): Promise<ApiEndpoint[]> {
    const apiDirectory = path.join(process.cwd(), 'src', 'app', 'api', 'mobile');
    const hisApiDirectory = path.join(process.cwd(), 'src', 'app', 'api', 'his-services');
    const extApiDirectory = path.join(process.cwd(), 'src', 'app', 'api', 'extension-config');
    const bedsApiDirectory = path.join(process.cwd(), 'src', 'app', 'api', 'beds');
    
    let endpoints: ApiEndpoint[] = [];
    
    if (fs.existsSync(apiDirectory)) {
        endpoints = endpoints.concat(scanDirectory(apiDirectory, '/api/mobile'));
    }
    
    if (fs.existsSync(hisApiDirectory)) {
        endpoints = endpoints.concat(scanDirectory(hisApiDirectory, '/api/his-services'));
    }

    if (fs.existsSync(extApiDirectory)) {
        endpoints = endpoints.concat(scanDirectory(extApiDirectory, '/api/extension-config'));
    }

    if (fs.existsSync(bedsApiDirectory)) {
        endpoints = endpoints.concat(scanDirectory(bedsApiDirectory, '/api/beds'));
    }

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
                let category = 'GENERAL APIS';
                if (baseRoute.includes('/api/mobile')) {
                    const pathParts = baseRoute.replace('/api/mobile/', '').split('/');
                    category = pathParts.length > 0 && pathParts[0] ? `MOBILE / ${pathParts[0].toUpperCase()}` : 'MOBILE GENERAL';
                } else if (baseRoute.includes('/api/his-services')) {
                    category = 'HIS INTEGRATION APIS';
                } else if (baseRoute.includes('/api/extension-config') || baseRoute.includes('/api/beds')) {
                    category = 'EXTENSION APIS';
                }

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

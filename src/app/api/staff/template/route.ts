import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const action = searchParams.get('action');
        
        if (!type) return NextResponse.json({ error: 'Thiếu loại mẫu' }, { status: 400 });

        let filename = '';
        if (type === 'bieu1a') filename = 'bieu1a_template.xlsx';
        else return NextResponse.json({ error: 'Loại mẫu không hợp lệ' }, { status: 400 });

        const dir = path.join(process.cwd(), 'src', 'templates');
        
        // Trả về cấu hình JSON nếu yêu cầu
        if (action === 'config') {
            const configPath = path.join(dir, `${type}_config.json`);
            if (fs.existsSync(configPath)) {
                const configStr = fs.readFileSync(configPath, 'utf-8');
                return NextResponse.json(JSON.parse(configStr));
            }
            // Default config
            return NextResponse.json({ startRow: 8 });
        }
        
        // Trả về danh sách các cột có thể xuất
        if (action === 'fields') {
            const fieldsPath = path.join(dir, `available_fields.json`);
            if (fs.existsSync(fieldsPath)) {
                const fieldsStr = fs.readFileSync(fieldsPath, 'utf-8');
                return NextResponse.json(JSON.parse(fieldsStr));
            }
            return NextResponse.json([]);
        }

        const filePath = path.join(dir, filename);
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Không tìm thấy file mẫu trên server' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(filePath);

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (error) {
        console.error('Lỗi khi tải mẫu:', error);
        return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const type = formData.get('type') as string;
        const action = formData.get('action') as string;
        const file = formData.get('file') as Blob | null;
        const startRow = formData.get('startRow') as string;
        const groupBy = formData.get('groupBy') as string;
        const columnMappingStr = formData.get('columnMapping') as string;
        const filtersStr = formData.get('filters') as string;

        if (!type) return NextResponse.json({ error: 'Thiếu loại mẫu' }, { status: 400 });

        const dir = path.join(process.cwd(), 'src', 'templates');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // API thêm trường mới vào available_fields.json
        if (action === 'addField') {
            const fieldValue = formData.get('value') as string;
            const fieldLabel = formData.get('label') as string;
            
            if (!fieldValue || !fieldLabel) {
                return NextResponse.json({ error: 'Thiếu thông tin trường mới' }, { status: 400 });
            }

            const fieldsPath = path.join(dir, 'available_fields.json');
            let fields: any[] = [];
            if (fs.existsSync(fieldsPath)) {
                try {
                    fields = JSON.parse(fs.readFileSync(fieldsPath, 'utf-8'));
                } catch(e) {}
            }
            
            // Kiểm tra trùng lặp
            if (!fields.find(f => f.value === fieldValue)) {
                fields.push({ value: fieldValue, label: fieldLabel });
                fs.writeFileSync(fieldsPath, JSON.stringify(fields, null, 2));
            }
            return NextResponse.json({ success: true, fields });
        }

        let filename = '';
        if (type === 'bieu1a') filename = 'bieu1a_template.xlsx';
        else return NextResponse.json({ error: 'Loại mẫu không hợp lệ' }, { status: 400 });

        // Lưu config nếu có
        if (startRow || groupBy || columnMappingStr || filtersStr) {
            const configPath = path.join(dir, `${type}_config.json`);
            let currentConfig: any = {};
            if (fs.existsSync(configPath)) {
                try {
                    currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                } catch (e) { }
            }
            if (startRow) currentConfig.startRow = startRow;
            if (groupBy) currentConfig.groupBy = groupBy;
            if (columnMappingStr) currentConfig.columnMapping = JSON.parse(columnMappingStr);
            if (filtersStr) currentConfig.filters = JSON.parse(filtersStr);
            
            fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
        }

        // Nếu người dùng không upload file (chỉ lưu config)
        if (!file) {
            return NextResponse.json({ success: true, message: 'Đã cập nhật cấu hình mẫu thành công' });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filePath = path.join(dir, filename);
        fs.writeFileSync(filePath, buffer);

        return NextResponse.json({ success: true, message: 'Đã cập nhật file mẫu và cấu hình thành công' });
    } catch (error) {
        console.error('Lỗi khi cập nhật mẫu:', error);
        return NextResponse.json({ error: 'Đã xảy ra lỗi' }, { status: 500 });
    }
}

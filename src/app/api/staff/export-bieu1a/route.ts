import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';

        // Query tương tự như trang chủ staff
        const whereClause: any = {
            OR: [
                { ho_ten: { contains: search } },
                { ma_nv: { contains: search } },
            ]
        };

        const staffData = await prisma.staff.findMany({
            where: search ? whereClause : {},
            orderBy: [
                { department: { ma_khoa: 'asc' } },
                { ho_ten: 'asc' }
            ],
            include: {
                department: true,
                gioi_tinh_ref: true,
                chuc_danh_ref: true,
                chuc_vu_ref: true,
                vi_tri_ref: true,
                loai_hop_dong_ref: true,
                dan_toc_ref: true,
                trinh_do_ref: true,
                que_quan_ward: {
                    include: {
                        parent: {
                            include: { parent: true }
                        }
                    }
                },
                noi_o_ward: {
                    include: {
                        parent: {
                            include: { parent: true }
                        }
                    }
                },
                certificates: {
                    include: {
                        noi_cap_cchn_ref: true,
                        scopes: {
                            include: { scope: true }
                        }
                    }
                }
            }
        });

        // Load file mẫu từ src/templates
        const templatePath = path.join(process.cwd(), 'src', 'templates', 'bieu1a_template.xlsx');
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const worksheet = workbook.getWorksheet(1);
        
        if (!worksheet) {
            return NextResponse.json({ error: 'Không tìm thấy Sheet báo cáo' }, { status: 500 });
        }

        // Đọc cấu hình
        let START_ROW = 8;
        let GROUP_BY = 'department'; // Mặc định
        let COLUMN_MAPPING: {[key: string]: string} | null = null;
        let FILTERS: any[] = [];
        const configPath = path.join(process.cwd(), 'src', 'templates', 'bieu1a_config.json');
        if (fs.existsSync(configPath)) {
            try {
                const configStr = fs.readFileSync(configPath, 'utf-8');
                const config = JSON.parse(configStr);
                if (config.startRow) START_ROW = config.startRow;
                if (config.groupBy) GROUP_BY = config.groupBy;
                if (config.columnMapping) COLUMN_MAPPING = config.columnMapping;
                if (config.filters) FILTERS = config.filters;
            } catch (e) {
                console.error('Lỗi khi đọc file config', e);
            }
        }

        // 1. Quét map từ khóa
        const styleRow = worksheet.getRow(START_ROW);
        const columnMap: { [key: string]: number } = {};
        let maxCol = 15; // Mặc định 15 cột
        
        if (COLUMN_MAPPING) {
            // Dùng mapping từ cấu hình UI mới
            for (const colStr in COLUMN_MAPPING) {
                const fieldKey = COLUMN_MAPPING[colStr];
                if (fieldKey && fieldKey !== 'none') {
                    const colNum = parseInt(colStr, 10);
                    if (!isNaN(colNum)) {
                        columnMap[fieldKey] = colNum;
                        if (colNum > maxCol) maxCol = colNum;
                    }
                }
            }
        } else {
            // Tương thích ngược: Quét từ khóa {{...}} trên dòng Excel
            styleRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
                const val = cell.value?.toString().trim();
                if (val && val.startsWith('{{') && val.endsWith('}}')) {
                    const key = val.replace('{{', '').replace('}}', '').trim();
                    columnMap[key] = colNumber;
                    if (colNumber > maxCol) maxCol = colNumber;
                }
            });
        }
        
        const hasMap = Object.keys(columnMap).length > 0;

        // Lưu lại định dạng của dòng mẫu
        const styles: any[] = [];
        for (let i = 1; i <= maxCol; i++) {
            const cell = styleRow.getCell(i);
            styles.push({
                font: cell.font,
                alignment: cell.alignment,
                border: cell.border
            });
        }

        // 1.5. Chuyển đổi dữ liệu thô sang Generic Export Data
        const mappedStaffData = staffData.map(staff => {
            const namSinh = staff.ngay_sinh ? new Date(staff.ngay_sinh).getFullYear() : '';
            const ngaySinhDayDu = staff.ngay_sinh ? new Date(staff.ngay_sinh).toLocaleDateString('vi-VN') : '';
            const chucVu = staff.chuc_vu_ref?.name || '';
            const chucDanh = staff.chuc_danh_ref?.name || '';
            const strChucDanh = [chucVu, chucDanh].filter(Boolean).join(' - ');
            
            const cchn = staff.certificates?.[0];
            let phamVi = '';
            if (cchn) {
                const scopes = cchn.scopes?.map((s: any) => s.scope?.ten_pham_vi).filter(Boolean);
                if (scopes && scopes.length > 0) phamVi = scopes.join('; ');
                else if (cchn.pham_vi_bo_sung) phamVi = cchn.pham_vi_bo_sung;
            }
            let ngayCap = '';
            if (cchn?.ngay_cap) {
                const d = new Date(cchn.ngay_cap);
                ngayCap = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')}/${d.getFullYear()}`;
            }

            const queQuanWard = (staff as any).que_quan_ward;
            const queQuanDistrict = queQuanWard?.parent;
            const queQuanProvince = queQuanDistrict?.parent;
            const queQuanArr = [queQuanWard?.name, queQuanDistrict?.name, queQuanProvince?.name].filter(Boolean);

            const noiOWard = (staff as any).noi_o_ward;
            const noiODistrict = noiOWard?.parent;
            const noiOProvince = noiODistrict?.parent;
            const noiOArr = [staff.noi_o_thon, noiOWard?.name, noiODistrict?.name, noiOProvince?.name].filter(Boolean);

            const exportData: any = {
                ma_nv: staff.ma_nv || '',
                ho_ten: staff.ho_ten || '',
                phong_ban: staff.department?.ten_khoa || '',
                ngay_sinh: ngaySinhDayDu,
                nam_sinh: namSinh,
                gioi_tinh: staff.gioi_tinh_ref?.name || '',
                cccd: staff.cccd || '',
                dan_toc: staff.dan_toc_ref?.name || '',
                dien_thoai: staff.so_dien_thoai || '',
                email: '',
                que_quan: queQuanArr.join(', '),
                noi_o: noiOArr.join(', '),
                chuc_danh: strChucDanh,
                vi_tri: (staff as any).vi_tri_ref?.name || '',
                loai_hd: staff.loai_hop_dong_ref?.name || '',
                trinh_do_cm: staff.trinh_do_ref?.name || '',
                thoi_gian: 'Toàn thời gian',
                cchn_so: cchn?.so_cchn || '',
                cchn_pham_vi: phamVi,
                cchn_ngay_cap: ngayCap,
                cchn_noi_cap: cchn?.noi_cap_cchn_ref?.name || '',
                ghi_chu: ''
            };

            return { raw: staff, exportData };
        });

        // 1.8. Áp dụng Bộ Lọc Động (Dynamic Filters)
        let filteredStaffData = mappedStaffData;
        if (FILTERS && FILTERS.length > 0) {
            filteredStaffData = mappedStaffData.filter(item => {
                return FILTERS.every(f => {
                    if (!f.field || !f.operator || f.value === undefined) return true;
                    
                    let val = item.exportData[f.field];
                    if (val === undefined || val === '') {
                        val = item.raw[f.field as keyof typeof item.raw];
                    }
                    if (val === undefined || val === null) val = '';
                    
                    const strVal = String(val).toLowerCase();
                    const filterVal = String(f.value).toLowerCase();
                    
                    if (f.operator === 'equals') return strVal === filterVal;
                    if (f.operator === 'not_equals') return strVal !== filterVal;
                    if (f.operator === 'contains') return strVal.includes(filterVal);
                    if (f.operator === 'not_contains') return !strVal.includes(filterVal);
                    
                    return true;
                });
            });
        }

        // 2. Gom nhóm dữ liệu động (Dynamic Group By)
        const groupedStaff: { [key: string]: any[] } = {};
        
        if (GROUP_BY === 'none') {
            groupedStaff['all'] = filteredStaffData;
        } else {
            filteredStaffData.forEach(item => {
                // Thử tìm trong exportData trước, nếu không có thì tìm trong raw DB
                let groupName = item.exportData[GROUP_BY];
                if (groupName === undefined || groupName === '') {
                    groupName = item.raw[GROUP_BY as keyof typeof item.raw];
                }
                if (groupName === undefined || groupName === null || groupName === '') {
                    groupName = 'Khác';
                }
                
                if (!groupedStaff[groupName]) groupedStaff[groupName] = [];
                groupedStaff[groupName].push(item);
            });
        }

        // 3. Tính toán và chèn dòng
        const groupKeys = Object.keys(groupedStaff);
        if (GROUP_BY !== 'none') {
            groupKeys.sort(); // Sort A-Z
        }
        
        const totalRows = staffData.length + (GROUP_BY === 'none' ? 0 : groupKeys.length);
        
        if (totalRows > 1) {
            worksheet.spliceRows(START_ROW + 1, 0, ...Array(totalRows - 1).fill([]));
        }

        // Hàm chuyển số thành số La Mã (cho tên nhóm)
        const romanize = (num: number) => {
            const lookup: any = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
            let roman = '';
            for (let i in lookup) {
                while (num >= lookup[i]) {
                    roman += i;
                    num -= lookup[i];
                }
            }
            return roman;
        };

        // 4. Đổ dữ liệu
        let currentRow = START_ROW;
        let globalIndex = 1;

        groupKeys.forEach((groupName, groupIndex) => {
            // A. Dòng Tiêu đề nhóm (chỉ chèn nếu có gom nhóm)
            if (GROUP_BY !== 'none') {
                const groupRow = worksheet.getRow(currentRow);
                groupRow.getCell(1).value = romanize(groupIndex + 1) + '. ' + groupName;
                
                // Format group row: bold, xám, merge cells
                worksheet.mergeCells(currentRow, 1, currentRow, maxCol);
                const groupCell = groupRow.getCell(1);
                groupCell.font = { bold: true, size: 11, name: 'Times New Roman' };
                groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                for (let i = 1; i <= maxCol; i++) {
                    groupRow.getCell(i).border = styles[0]?.border; // Copy border từ STT
                }
                currentRow++;
            }

            // B. Các dòng nhân viên trong nhóm
            const groupStaff = groupedStaff[groupName];
            groupStaff.forEach((item, staffIndex) => {
                const row = worksheet.getRow(currentRow);
                const { raw: staff, exportData } = item;
                
                const setVal = (key: string, val: any) => {
                    if (columnMap[key]) row.getCell(columnMap[key]).value = val;
                };

                const sttValue = (GROUP_BY === 'none') ? globalIndex++ : staffIndex + 1;
                exportData['stt'] = sttValue; // Inject STT

                if (hasMap) {
                    // Ghi đè vào cột tương ứng
                    for (const key in columnMap) {
                        if (exportData[key] !== undefined) {
                            setVal(key, exportData[key]);
                        } else if (staff[key as keyof typeof staff] !== undefined) {
                            // Fallback to raw db property
                            setVal(key, staff[key as keyof typeof staff]);
                        }
                    }
                } else {
                    // Dùng thứ tự cột tĩnh (Cũ)
                    row.getCell(1).value = sttValue;
                    row.getCell(2).value = exportData.ma_nv;
                    row.getCell(3).value = exportData.ho_ten;
                    row.getCell(4).value = exportData.nam_sinh; 
                    row.getCell(5).value = exportData.gioi_tinh; 
                    row.getCell(6).value = exportData.cccd; 
                    row.getCell(7).value = exportData.chuc_danh; 
                    row.getCell(8).value = exportData.vi_tri; 
                    row.getCell(9).value = exportData.loai_hd; 
                    row.getCell(10).value = exportData.thoi_gian; 
                    row.getCell(11).value = exportData.cchn_pham_vi;
                    row.getCell(12).value = exportData.cchn_so;
                    row.getCell(13).value = exportData.cchn_ngay_cap;
                    row.getCell(14).value = exportData.cchn_noi_cap;
                    row.getCell(15).value = '';
                }

                // Copy style
                for (let i = 1; i <= maxCol; i++) {
                    const cell = row.getCell(i);
                    if (styles[i-1]) {
                        cell.font = styles[i-1].font;
                        cell.alignment = styles[i-1].alignment;
                        cell.border = styles[i-1].border;
                    }
                }

                currentRow++;
            });
        });

        // Xóa dòng mẫu nếu mảng rỗng
        if (staffData.length === 0) {
            worksheet.spliceRows(START_ROW, 1);
        }

        const outBuffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(outBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Bieu1A_NhanSu.xlsx"'
            }
        });
    } catch (error: any) {
        console.error('Lỗi khi export:', error);
        return NextResponse.json({ error: 'Đã xảy ra lỗi khi tạo file Excel', details: error.message, stack: error.stack }, { status: 500 });
    }
}

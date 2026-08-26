import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    try {
        // Lấy tất cả danh mục
        const categories = await prisma.systemCategory.findMany({
            where: {
                type: {
                    in: ['GENDER', 'NGHE_NGHIEP', 'DAN_TOC', 'QUOC_GIA', 'PROVINCE', 'WARD']
                },
                isActive: true
            },
            orderBy: { order: 'asc' }
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'BenhVienDKLS';
        workbook.created = new Date();

        // ======= SHEET 2: DANHMUC =======
        const sheetDanhMuc = workbook.addWorksheet('DANHMUC');
        sheetDanhMuc.state = 'hidden'; // Ẩn sheet danh mục cho đẹp (hoặc để visible nếu muốn)
        
        // Define columns
        sheetDanhMuc.columns = [
            { header: 'GIOITINH', key: 'gender', width: 25 },
            { header: 'NGHENGHIEP', key: 'job', width: 40 },
            { header: 'DANTOC', key: 'ethnic', width: 25 },
            { header: 'QUOCGIA', key: 'country', width: 25 },
            { header: 'TINH', key: 'province', width: 40 },
            { header: 'XA', key: 'ward', width: 40 }
        ];

        // Format data: "Code - Name"
        const genderList = categories.filter(c => c.type === 'GENDER').map(c => `${c.code} - ${c.name}`);
        const jobList = categories.filter(c => c.type === 'NGHE_NGHIEP').map(c => `${c.code} - ${c.name}`);
        const ethnicList = categories.filter(c => c.type === 'DAN_TOC').map(c => `${c.code} - ${c.name}`);
        const countryList = categories.filter(c => c.type === 'QUOC_GIA').map(c => `${c.code} - ${c.name}`);
        const provinceList = categories.filter(c => c.type === 'PROVINCE').map(c => `${c.code} - ${c.name}`);
        const wardList = categories.filter(c => c.type === 'WARD').map(c => `${c.code} - ${c.name}`);

        const maxRows = Math.max(
            genderList.length, jobList.length, ethnicList.length, 
            countryList.length, provinceList.length, wardList.length
        );

        for (let i = 0; i < maxRows; i++) {
            sheetDanhMuc.addRow({
                gender: genderList[i] || '',
                job: jobList[i] || '',
                ethnic: ethnicList[i] || '',
                country: countryList[i] || '',
                province: provinceList[i] || '',
                ward: wardList[i] || ''
            });
        }

        // ======= SHEET 1: DANHSACH =======
        const sheetDanhSach = workbook.addWorksheet('DANHSACH');
        const headers = [
            'STT', 'TENBENHNHAN (Bắt buộc)', 'NGAYSINH (Bắt buộc)', 'GIOITINH (Bắt buộc)', 
            'NGHENGHIEP (Bắt buộc)', 'DANTOC (Bắt buộc)', 'QUOCGIA (Bắt buộc)', 'CCCD (Bắt buộc)', 
            'NGAYCAPCCCD', 'NOICAPCCCD', 'TINH (Bắt buộc)', 'XA (Bắt buộc)', 'DIACHI (Bắt buộc)', 
            'DOTKHAM', 'SDTBENHNHAN (Bắt buộc)', 'TENNGUOITHAN', 'MA_BHYT', 'BHYT_BD', 'BHYT_KT', 
            'MA_KCBBD', 'DIACHI_BHYT'
        ];

        // Header style
        const headerRow = sheetDanhSach.addRow(headers);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0070C0' }
        };

        sheetDanhSach.columns.forEach(col => {
            col.width = 20;
        });

        // Format cột C (NGAYSINH) và I (NGAYCAPCCCD) thành Text hoặc Date
        // Để ép nhập dd/mm/yyyy, ta có thể dùng Data Validation kiểu Custom
        // Tuy nhiên cách tốt nhất để tránh Excel tự động đổi format là set Text
        // Hoặc set numFmt = 'dd/mm/yyyy' và dùng type: 'date'
        const colNgaySinh = sheetDanhSach.getColumn('C');
        colNgaySinh.numFmt = 'dd/mm/yyyy';

        const colNgayCapCccd = sheetDanhSach.getColumn('I');
        colNgayCapCccd.numFmt = 'dd/mm/yyyy';

        // Set Data Validation for 5000 rows
        for (let rowIdx = 2; rowIdx <= 5001; rowIdx++) {
            
            // Gán Data Validation chuẩn Date cho Cột C (NGAYSINH)
            sheetDanhSach.getCell(`C${rowIdx}`).dataValidation = {
                type: 'date',
                operator: 'between',
                allowBlank: true,
                showErrorMessage: true,
                errorTitle: 'Sai ngày tháng',
                error: 'Vui lòng nhập định dạng Ngày/Tháng/Năm (Ví dụ: 20/11/1990)',
                formulae: [new Date(1900, 0, 1), new Date(2100, 11, 31)]
            };

            // Cột I (NGAYCAPCCCD)
            sheetDanhSach.getCell(`I${rowIdx}`).dataValidation = {
                type: 'date',
                operator: 'between',
                allowBlank: true,
                showErrorMessage: true,
                errorTitle: 'Sai ngày tháng',
                error: 'Vui lòng nhập định dạng Ngày/Tháng/Năm (Ví dụ: 20/11/2020)',
                formulae: [new Date(1900, 0, 1), new Date(2100, 11, 31)]
            };

            // Cột D (4) - GIOITINH (Col A of DANHMUC)
            if (genderList.length > 0) {
                sheetDanhSach.getCell(`D${rowIdx}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`DANHMUC!$A$2:$A$${genderList.length + 1}`]
                };
            }

            // Cột E (5) - NGHENGHIEP (Col B of DANHMUC)
            if (jobList.length > 0) {
                sheetDanhSach.getCell(`E${rowIdx}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`DANHMUC!$B$2:$B$${jobList.length + 1}`]
                };
            }

            // Cột F (6) - DANTOC (Col C of DANHMUC)
            if (ethnicList.length > 0) {
                sheetDanhSach.getCell(`F${rowIdx}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`DANHMUC!$C$2:$C$${ethnicList.length + 1}`]
                };
            }

            // Cột G (7) - QUOCGIA (Col D of DANHMUC)
            if (countryList.length > 0) {
                sheetDanhSach.getCell(`G${rowIdx}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`DANHMUC!$D$2:$D$${countryList.length + 1}`]
                };
            }

            // Cột K (11) - TINH (Col E of DANHMUC)
            if (provinceList.length > 0) {
                sheetDanhSach.getCell(`K${rowIdx}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`DANHMUC!$E$2:$E$${provinceList.length + 1}`]
                };
            }

            // Cột L (12) - XA (Col F of DANHMUC)
            if (wardList.length > 0) {
                sheetDanhSach.getCell(`L${rowIdx}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`DANHMUC!$F$2:$F$${wardList.length + 1}`]
                };
            }
        }

        // Thêm Conditional Formatting để cảnh báo đỏ nếu paste data sai
        const applyRedWarning = (colLetter: string, danhmucCol: string) => {
            sheetDanhSach.addConditionalFormatting({
                ref: `${colLetter}2:${colLetter}5001`,
                rules: [
                    {
                        type: 'expression',
                        formulae: [`AND(${colLetter}2<>"", ISERROR(MATCH(${colLetter}2, DANHMUC!$${danhmucCol}:$${danhmucCol}, 0)))`],
                        style: {
                            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } },
                            font: { color: { argb: 'FF9C0006' } }
                        }
                    }
                ]
            });
        };

        if (genderList.length > 0) applyRedWarning('D', 'A');
        if (jobList.length > 0) applyRedWarning('E', 'B');
        if (ethnicList.length > 0) applyRedWarning('F', 'C');
        if (countryList.length > 0) applyRedWarning('G', 'D');
        if (provinceList.length > 0) applyRedWarning('K', 'E');
        if (wardList.length > 0) applyRedWarning('L', 'F');

        // Active sheet is DANHSACH
        workbook.views = [
            {
                x: 0, y: 0, width: 10000, height: 20000,
                firstSheet: 1, activeTab: 1, visibility: 'visible'
            }
        ];

        // Xuất file
        const buffer = await workbook.xlsx.writeBuffer();
        
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Disposition': 'attachment; filename="MauFileImportBenhNhan_ksktoandan.xlsx"',
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
        });

    } catch (error: any) {
        console.error('Export Excel Error:', error);
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}

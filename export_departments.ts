import * as xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Fetching departments from database...');
        const departments = await prisma.department.findMany({
            orderBy: { ma_khoa: 'asc' }
        });

        const data = departments.map(d => ({
            ma_khoa: d.ma_khoa,
            ten_khoa: d.ten_khoa,
            ma_khoa_bv: d.ma_khoa_bv || '',
            ten_khoa_bv: d.ten_khoa_bv || ''
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, "Departments");
        
        const filePath = 'd:/1.ProjectBVDKLS/htqlbenhvien/export_departments.xlsx';
        xlsx.writeFile(wb, filePath);
        
        console.log(`Successfully exported ${departments.length} departments to ${filePath}`);
    } catch (error) {
        console.error('Export failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();

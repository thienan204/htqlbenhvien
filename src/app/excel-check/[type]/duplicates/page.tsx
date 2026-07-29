import OverlapExcelDuplicates from '@/components/shared/OverlapExcelDuplicates';

export default async function DynamicExcelDuplicatesPage({ params }: { params: Promise<{ type: string }> }) {
    const resolvedParams = await params;
    const typeKey = resolvedParams.type.toUpperCase();

    // Mapping tên hiển thị cho đẹp
    const titleMap: Record<string, string> = {
        'GIUONG': 'Danh sách Trùng lặp Giường Bệnh',
        'KHAM-BENH': 'Danh sách Trùng lặp Khám Bệnh',
        'XE-CAP-CUU': 'Danh sách Trùng lặp Xe Cấp Cứu',
        'PTTT': 'Danh sách Dữ liệu Trùng lặp PTTT',
    };

    const pageTitle = titleMap[typeKey] || `Danh sách Trùng lặp ${typeKey}`;

    return (
        <OverlapExcelDuplicates 
            ruleType={typeKey} 
            pageTitle={pageTitle} 
        />
    );
}

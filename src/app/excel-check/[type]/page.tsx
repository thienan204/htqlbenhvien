import OverlapExcelChecker from '@/components/shared/OverlapExcelChecker';

export default async function DynamicExcelCheckPage({ params }: { params: Promise<{ type: string }> }) {
    // Await params do Next.js phiên bản mới yêu cầu params là một Promise
    const resolvedParams = await params;
    const typeKey = resolvedParams.type.toUpperCase();

    // Mapping tên hiển thị cho đẹp, mặc định lấy nguyên typeKey
    const titleMap: Record<string, string> = {
        'GIUONG': 'Kiểm tra trùng thời gian Giường Bệnh',
        'KHAM-BENH': 'Kiểm tra trùng thời gian Khám Bệnh',
        'XE-CAP-CUU': 'Kiểm tra trùng thời gian Xe Cấp Cứu',
        'PTTT': 'Kiểm tra trùng PTTT Excel',
    };

    const pageTitle = titleMap[typeKey] || `Kiểm tra trùng ${typeKey}`;

    return (
        <OverlapExcelChecker 
            ruleType={typeKey} 
            pageTitle={pageTitle} 
            enableTyleDvFilter={false} // Tỷ lệ DV thường chỉ dùng cho PTTT
        />
    );
}

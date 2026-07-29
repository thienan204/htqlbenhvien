import OverlapExcelDuplicates from '@/components/shared/OverlapExcelDuplicates';

export default function PTTTDuplicatesPage() {
    return (
        <OverlapExcelDuplicates 
            ruleType="PTTT" 
            pageTitle="Danh sách Dữ liệu Trùng lặp PTTT" 
        />
    );
}

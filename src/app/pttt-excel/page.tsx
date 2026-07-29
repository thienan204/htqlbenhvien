import OverlapExcelChecker from '@/components/shared/OverlapExcelChecker';

export default function PTTTReaderPage() {
    return (
        <OverlapExcelChecker 
            ruleType="PTTT" 
            pageTitle="Kiểm tra trùng PTTT Excel" 
            enableTyleDvFilter={true} 
        />
    );
}

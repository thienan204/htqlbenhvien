import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Quản Lý Nghỉ Phép & Thẩm Tra Phép Năm | BVĐK Tỉnh Lạng Sơn',
    description: 'Phân hệ quản lý đơn nghỉ phép, thẩm tra phép năm và phê duyệt văn bản giấy'
};

export default function LeaveManagementLayout({
    children
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}


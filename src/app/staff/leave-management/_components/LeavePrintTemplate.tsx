'use client';

import React from 'react';
import { Modal, Button } from 'antd';
import { PrinterOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface LeavePrintTemplateProps {
    open: boolean;
    onClose: () => void;
    requestData: any;
    balanceData?: any;
}

export const LeavePrintTemplate: React.FC<LeavePrintTemplateProps> = ({
    open,
    onClose,
    requestData,
    balanceData
}) => {
    if (!requestData) return null;

    const staff = requestData.staff || {};
    const finalDays = typeof requestData.approvedDays === 'number' ? requestData.approvedDays : requestData.requestedDays;
    const startDateStr = requestData.approvedStartDate || requestData.requestedStartDate;
    const endDateStr = requestData.approvedEndDate || requestData.requestedEndDate;

    const formattedStart = startDateStr ? dayjs(startDateStr).format('DD/MM/YYYY') : '...';
    const formattedEnd = endDateStr ? dayjs(endDateStr).format('DD/MM/YYYY') : '...';
    const now = dayjs();

    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="close" icon={<CloseOutlined />} onClick={onClose}>
                    Đóng
                </Button>,
                <Button
                    key="print"
                    type="primary"
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    className="bg-blue-600 hover:bg-blue-500"
                >
                    In Phiếu Ra Giấy (A4)
                </Button>
            ]}
        >
            <div className="p-6 bg-white text-black font-serif printable-leave-document" id="printable-leave-area">
                <style jsx global>{`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #printable-leave-area, #printable-leave-area * {
                            visibility: visible;
                        }
                        #printable-leave-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            padding: 20mm;
                            margin: 0;
                            box-shadow: none !important;
                            border: none !important;
                        }
                    }
                `}</style>

                {/* Tiêu ngữ & Quốc hiệu */}
                <div className="flex justify-between items-start border-b border-black pb-3 mb-4">
                    <div className="text-center text-xs">
                        <div className="font-semibold uppercase">SỞ Y TẾ TỈNH LẠNG SƠN</div>
                        <div className="font-bold uppercase text-sm">BỆNH VIỆN ĐA KHOA TỈNH LẠNG SƠN</div>
                        <div className="italic text-[11px] mt-1">Số: {requestData.directorPaperCode || `.../PB-TCCB`}</div>
                    </div>
                    <div className="text-center text-xs">
                        <div className="font-bold uppercase text-sm">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div className="font-semibold underline">Độc lập - Tự do - Hạnh phúc</div>
                        <div className="italic text-[11px] mt-1">
                            Lạng Sơn, ngày {now.date()} tháng {now.month() + 1} năm {now.year()}
                        </div>
                    </div>
                </div>

                {/* Tiêu đề văn bản */}
                <div className="text-center my-5">
                    <h2 className="text-lg font-bold uppercase tracking-wide">
                        PHIẾU BÁO KẾT QUẢ GIẢI QUYẾT NGHỈ PHÉP NĂM
                    </h2>
                    <div className="italic text-xs text-slate-600 mt-1">
                        (Dành cho việc trình Ban Giám Đốc phê duyệt và lưu hồ sơ công chức, viên chức)
                    </div>
                </div>

                {/* Kính gửi */}
                <div className="mb-4 text-xs leading-relaxed">
                    <div className="font-bold">Kính gửi:</div>
                    <div className="pl-6">- Ban Giám Đốc Bệnh Viện Đa Khoa Tỉnh Lạng Sơn;</div>
                    <div className="pl-6">- Lãnh đạo Khoa/Phòng: {staff.department?.ten_khoa || '...'};</div>
                    <div className="pl-6">- Đồng chí: <strong>{staff.ho_ten || '...'}</strong>.</div>
                </div>

                {/* Nội dung kết quả thẩm tra */}
                <div className="text-xs leading-relaxed space-y-2 mb-6 text-justify">
                    <p>
                        Căn cứ Đơn xin nghỉ phép của đồng chí <strong>{staff.ho_ten}</strong> (Mã NV: {staff.ma_nv}), 
                        Chức vụ: <strong>{staff.chuc_vu_ref?.name || 'Nhân viên'}</strong>, công tác tại Khoa/Phòng: <strong>{staff.department?.ten_khoa}</strong>;
                    </p>
                    <p>
                        Căn cứ Quỹ ngày nghỉ phép năm <strong>{now.year()}</strong> của cán bộ 
                        {balanceData ? ` (Tổng quỹ: ${balanceData.totalAvailable} ngày, Đã nghỉ: ${balanceData.usedDays} ngày, Còn lại: ${balanceData.remainingDays} ngày)` : ''};
                    </p>
                    <p>
                        Sau khi xem xét ý kiến của Lãnh đạo Khoa/Phòng và thẩm tra chế độ, Phòng Tổ chức Cán bộ kính trình Ban Giám Đốc giải quyết chế độ nghỉ phép như sau:
                    </p>

                    <div className="bg-slate-50 border border-slate-300 p-3 rounded space-y-1.5 my-3">
                        <div className="flex justify-between">
                            <span>1. Số ngày được giải quyết nghỉ phép:</span>
                            <span className="font-bold text-sm underline">{finalDays} ngày</span>
                        </div>
                        <div className="flex justify-between">
                            <span>2. Thời gian nghỉ:</span>
                            <span className="font-semibold">
                                Từ ngày <strong>{formattedStart}</strong> đến hết ngày <strong>{formattedEnd}</strong>
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>3. Buổi nghỉ trong ngày:</span>
                            <span>{requestData.session === 'MORNING' ? 'Buổi Sáng (07:00 - 11:30)' : requestData.session === 'AFTERNOON' ? 'Buổi Chiều (13:30 - 17:00)' : 'Cả ngày (8h)'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>4. Lý do nghỉ phép:</span>
                            <span>{requestData.reason}</span>
                        </div>
                        {requestData.handoverStaff && (
                            <div className="flex justify-between">
                                <span>5. Cán bộ nhận bàn giao việc:</span>
                                <span className="font-medium">{requestData.handoverStaff.ho_ten}</span>
                            </div>
                        )}
                        {requestData.actingHeadStaff && (
                            <div className="flex justify-between text-blue-900 font-medium">
                                <span>5. Đồng chí Phó phòng điều hành thay:</span>
                                <span className="font-bold">{requestData.actingHeadStaff.ho_ten}</span>
                            </div>
                        )}
                        {requestData.tccbNote && (
                            <div className="flex justify-between text-amber-900">
                                <span>6. Ghi chú của Phòng TCCB:</span>
                                <span className="italic">{requestData.tccbNote}</span>
                            </div>
                        )}
                    </div>

                    <p className="italic text-[11px] text-slate-600">
                        * Kính đề nghị Giám đốc Bệnh viện xem xét, ký duyệt để Khoa/Phòng và cá nhân đồng chí thực hiện theo quy định.
                    </p>
                </div>

                {/* Chữ ký 3 bên */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs mt-8 pt-4">
                    <div>
                        <div className="font-bold uppercase">NGƯỜI LÀM ĐƠN</div>
                        <div className="italic text-[10px] text-slate-500 mb-14">(Ký và ghi rõ họ tên)</div>
                        <div className="font-semibold">{staff.ho_ten}</div>
                    </div>
                    <div>
                        <div className="font-bold uppercase">TRƯỞNG PHÒNG TCCB</div>
                        <div className="italic text-[10px] text-slate-500 mb-14">(Ký và ghi rõ họ tên)</div>
                        <div className="font-semibold">Phòng Tổ Chức Cán Bộ</div>
                    </div>
                    <div>
                        <div className="font-bold uppercase">GIÁM ĐỐC BỆNH VIỆN</div>
                        <div className="italic text-[10px] text-slate-500 mb-14">(Ký, đóng dấu phê duyệt)</div>
                        <div className="font-semibold">
                            {requestData.directorSignerName || 'Ban Giám Đốc'}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

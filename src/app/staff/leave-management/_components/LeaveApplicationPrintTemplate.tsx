'use client';

import React from 'react';
import { Modal, Button } from 'antd';
import { PrinterOutlined, CloseOutlined, FileWordOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface LeaveApplicationPrintTemplateProps {
    open: boolean;
    onClose: () => void;
    requestData: any;
    departmentHeadName?: string;
}

export const LeaveApplicationPrintTemplate: React.FC<LeaveApplicationPrintTemplateProps> = ({
    open,
    onClose,
    requestData,
    departmentHeadName
}) => {
    if (!requestData) return null;

    const staff = requestData.staff || {};
    const isDeptHead = requestData.formType === 'DEPARTMENT_HEAD';

    const startDate = requestData.requestedStartDate ? dayjs(requestData.requestedStartDate) : dayjs();
    const endDate = requestData.requestedEndDate ? dayjs(requestData.requestedEndDate) : startDate;
    const leaveYear = startDate.year();
    const createdDate = requestData.createdAt ? dayjs(requestData.createdAt) : dayjs();

    const formattedStart = startDate.format('DD/MM/YYYY');
    const formattedEnd = endDate.format('DD/MM/YYYY');

    let timeText = `Từ ngày ${formattedStart} đến ngày ${formattedEnd}`;
    if (startDate.isSame(endDate, 'day')) {
        timeText = `Ngày ${formattedStart}`;
    }

    let sessionText = '';
    if (requestData.session === 'MORNING') {
        sessionText = ' (Buổi Sáng: 07h00 - 11h30)';
    } else if (requestData.session === 'AFTERNOON') {
        sessionText = ' (Buổi Chiều: 13h30 - 17h00)';
    }

    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={780}
            footer={[
                <Button key="close" icon={<CloseOutlined />} onClick={onClose}>
                    Đóng
                </Button>,
                <Button
                    key="print"
                    type="primary"
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    className="bg-blue-600 hover:bg-blue-500 font-semibold"
                >
                    In Đơn Nghỉ Phép (A4)
                </Button>
            ]}
        >
            <div
                className="p-8 bg-white text-black font-serif text-[13pt] leading-normal printable-application-doc"
                id="printable-application-area"
                style={{ minHeight: '297mm' }}
            >
                <style jsx global>{`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #printable-application-area, #printable-application-area * {
                            visibility: visible;
                        }
                        #printable-application-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            padding: 20mm 20mm;
                            margin: 0;
                            box-shadow: none !important;
                            border: none !important;
                        }
                    }
                `}</style>

                {/* Tiêu ngữ Quốc hiệu chuẩn */}
                <div className="text-center mb-6">
                    <div className="font-bold text-sm tracking-wide">
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </div>
                    <div className="font-bold text-sm mt-0.5">
                        <span className="border-b border-black pb-0.5 inline-block">
                            Độc lập - Tự do - Hạnh phúc
                        </span>
                    </div>
                </div>

                {/* Tiêu đề Đơn */}
                <div className="text-center my-6">
                    <h1 className="text-xl font-bold uppercase tracking-wider m-0">
                        ĐƠN XIN NGHỈ PHÉP
                    </h1>
                </div>

                {/* Kính gửi */}
                <div className="mb-4 pl-4 text-sm leading-relaxed">
                    <div className="flex">
                        <span className="font-bold w-24 shrink-0">Kính gửi:</span>
                        <div className="space-y-0.5">
                            <div>- Ban Lãnh đạo Bệnh viện Đa khoa tỉnh Lạng Sơn</div>
                            <div>- Phòng Tổ chức cán bộ</div>
                            {!isDeptHead && (
                                <div>- Lãnh đạo {staff.department?.ten_khoa || 'Khoa/Phòng'}</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Thông tin cá nhân & Nội dung xin nghỉ */}
                <div className="space-y-3 text-sm leading-relaxed text-justify mb-4">
                    <div>
                        <span>Tên tôi là: </span>
                        <strong className="text-base font-bold uppercase tracking-wide">
                            {staff.ho_ten || '.......................................................................................'}
                        </strong>
                        {staff.ma_nv && <span className="text-xs text-slate-500 ml-2">(Mã NV: {staff.ma_nv})</span>}
                    </div>

                    <div>
                        <span>Đang công tác tại: </span>
                        <strong className="font-semibold">
                            {staff.department?.ten_khoa || 'Khoa/Phòng ....................................................'}
                        </strong>
                        <span> - Bệnh viện Đa khoa tỉnh Lạng Sơn.</span>
                    </div>

                    <div>
                        <span>Chức vụ hiện nay: </span>
                        <strong>{staff.chuc_vu_ref?.name || 'Nhân viên'}</strong>
                    </div>

                    <p className="indent-6 leading-relaxed">
                        Tôi viết đơn này kính mong Ban Lãnh đạo, phòng Tổ chức cán bộ
                        {!isDeptHead && `, ${staff.department?.ten_khoa || 'khoa/phòng'}`} cho tôi được nghỉ phép năm{' '}
                        <strong>{leaveYear}</strong> theo chế độ.
                    </p>

                    <div>
                        <span>Thời gian nghỉ phép: </span>
                        <strong>{timeText}</strong>
                        <span> (Tổng số: <strong>{requestData.approvedDays ?? requestData.requestedDays} ngày</strong>{sessionText})</span>
                    </div>

                    <div>
                        <span>Nơi nghỉ phép: </span>
                        <strong className="underline">
                            {requestData.destination || 'Tại địa phương'}
                        </strong>
                    </div>

                    {requestData.reason && (
                        <div>
                            <span>Lý do nghỉ phép: </span>
                            <span>{requestData.reason}</span>
                        </div>
                    )}

                    {/* Bàn giao hoặc Ủy quyền */}
                    {isDeptHead ? (
                        requestData.actingHeadStaff && (
                            <div>
                                <span>Phân công Lãnh đạo phụ trách điều hành thay: </span>
                                <strong>Đ/c {requestData.actingHeadStaff.ho_ten}</strong>
                            </div>
                        )
                    ) : (
                        requestData.handoverStaff && (
                            <div>
                                <span>Cán bộ nhận bàn giao công việc: </span>
                                <strong>Đ/c {requestData.handoverStaff.ho_ten}</strong>
                            </div>
                        )
                    )}

                    <p className="mt-4">
                        Tôi xin chân thành cảm ơn./.
                    </p>
                </div>

                {/* Khối chữ ký 2 bên chuẩn xác theo mẫu Word */}
                <div className="grid grid-cols-2 gap-4 text-center text-sm mt-8 pt-4">
                    {/* CỘT TRÁI: Xác nhận của Khoa/Phòng (Mẫu 1) HOẶC Lãnh đạo BV (Mẫu 2) */}
                    <div>
                        {isDeptHead ? (
                            <div>
                                <div className="font-bold uppercase tracking-tight">
                                    XÁC NHẬN CỦA LÃNH ĐẠO BV
                                </div>
                                <div className="italic text-xs text-slate-500 mb-20">
                                    (Ký, đóng dấu phê duyệt)
                                </div>
                                <div className="font-bold uppercase text-slate-700">
                                    Ban Giám Đốc
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="font-bold uppercase tracking-tight">
                                    XÁC NHẬN CỦA KHOA/PHÒNG
                                </div>
                                <div className="italic text-xs text-slate-500 mb-20">
                                    (Trưởng khoa/phòng ký, ghi rõ họ tên)
                                </div>
                                <div className="font-bold uppercase text-slate-800">
                                    {departmentHeadName || requestData.deptApproverName || 'Trưởng Khoa/Phòng'}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* CỘT PHẢI: Người làm đơn */}
                    <div>
                        <div className="italic text-xs mb-1">
                            Lạng Sơn, ngày {createdDate.date()} tháng {createdDate.month() + 1} năm {createdDate.year()}
                        </div>
                        <div className="font-bold uppercase">
                            Người làm đơn
                        </div>
                        <div className="italic text-xs text-slate-500 mb-20">
                            (Ký và ghi rõ họ tên)
                        </div>
                        <div className="font-bold uppercase text-slate-800">
                            {staff.ho_ten}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};


import React from 'react';
import { Modal, Descriptions, Tag, Button } from 'antd';
import dayjs from 'dayjs';

interface StaffDetailsModalProps {
    open: boolean;
    onClose: () => void;
    staff: any;
}

export default function StaffDetailsModal({ open, onClose, staff }: StaffDetailsModalProps) {
    if (!staff) return null;

    return (
        <Modal
            title={<div className="text-xl font-bold text-slate-800 border-b pb-3 mb-2">Hồ sơ Nhân sự: {staff.ho_ten}</div>}
            open={open}
            onCancel={onClose}
            footer={[
                <Button key="close" onClick={onClose} type="primary">
                    Đóng
                </Button>
            ]}
            width={800}
            centered
        >
            <Descriptions bordered column={1} size="middle">
                <Descriptions.Item label="Mã Nhân viên">
                    <span className="font-semibold text-blue-600">{staff.ma_nv}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Khoa/Phòng">
                    {staff.department?.ten_khoa || staff.ma_khoa}
                </Descriptions.Item>
                <Descriptions.Item label="Họ và tên">
                    <span className="font-medium text-slate-800">{staff.ho_ten}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">
                    {staff.ngay_sinh ? dayjs(staff.ngay_sinh).format('DD/MM/YYYY') : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Giới tính">
                    {staff.gioi_tinh_ref?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Dân tộc">
                    {staff.dan_toc_ref?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">
                    {staff.so_dien_thoai || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Căn cước công dân (CCCD)">
                    {staff.cccd || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Mã số BHXH">
                    {staff.ma_bhxh || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ">
                    {staff.dia_chi || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Chức danh nghề nghiệp">
                    {staff.chuc_danh_ref?.name ? <Tag color="blue">{staff.chuc_danh_ref.name}</Tag> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Chức vụ">
                    {staff.chuc_vu_ref?.name ? <Tag color="green">{staff.chuc_vu_ref.name}</Tag> : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Trình độ chuyên môn">
                    {staff.trinh_do_ref?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Vị trí việc làm">
                    {staff.vi_tri_ref?.name || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Loại hợp đồng">
                    {staff.loai_hop_dong_ref?.name || '-'}
                </Descriptions.Item>
            </Descriptions>
        </Modal>
    );
}

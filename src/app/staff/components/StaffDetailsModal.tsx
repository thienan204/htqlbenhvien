import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Tag, Button, Tabs, Table } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

interface StaffDetailsModalProps {
    open: boolean;
    onClose: () => void;
    staff: any;
}

export default function StaffDetailsModal({ open, onClose, staff }: StaffDetailsModalProps) {
    const [histories, setHistories] = useState<any[]>([]);
    const [loadingHistories, setLoadingHistories] = useState(false);

    useEffect(() => {
        if (open && staff?.id) {
            setLoadingHistories(true);
            fetch(`/api/staff/work-history?staffId=${staff.id}`)
                .then(res => res.ok ? res.json() : [])
                .then(data => setHistories(data))
                .catch(err => console.error(err))
                .finally(() => setLoadingHistories(false));
        }
    }, [open, staff?.id]);

    if (!staff) return null;

    const historyColumns = [
        {
            title: 'STT',
            key: 'stt',
            width: 50,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => index + 1
        },
        {
            title: 'Khoa / Phòng',
            key: 'khoa',
            render: (_: any, r: any) => (
                <div>
                    <span className="font-semibold text-slate-800">{r.department?.ten_khoa || r.ma_khoa}</span>
                    <span className="text-xs text-slate-400 block">Mã: {r.ma_khoa}</span>
                </div>
            )
        },
        {
            title: 'Thời gian công tác',
            key: 'thoi_gian',
            render: (_: any, r: any) => {
                const tuNgayStr = r.tu_ngay ? dayjs(r.tu_ngay).format('DD/MM/YYYY') : '?';
                const denNgayStr = r.den_ngay ? dayjs(r.den_ngay).format('DD/MM/YYYY') : null;
                return r.isCurrent ? (
                    <span className="font-medium text-emerald-700">Từ {tuNgayStr} → Đến nay</span>
                ) : (
                    <span className="text-slate-600">{tuNgayStr} → {denNgayStr || 'Chưa xác định'}</span>
                );
            }
        },
        {
            title: 'Quyết định / Lý do',
            key: 'qd',
            render: (_: any, r: any) => (
                <div>
                    {r.so_quyet_dinh && <span className="font-medium text-slate-700 block">Số: {r.so_quyet_dinh}</span>}
                    {r.ghi_chu && <span className="text-xs text-slate-500 italic block">{r.ghi_chu}</span>}
                </div>
            )
        },
        {
            title: 'Trạng thái',
            key: 'status',
            width: 130,
            align: 'center' as const,
            render: (_: any, r: any) => r.isCurrent ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>Đang làm việc</Tag>
            ) : (
                <Tag color="default">Đã chuyển đi</Tag>
            )
        }
    ];

    const tabItems = [
        {
            key: 'basic',
            label: 'Thông tin chung',
            children: (
                <Descriptions bordered column={1} size="middle">
                    <Descriptions.Item label="Mã Nhân viên">
                        <span className="font-semibold text-blue-600">{staff.ma_nv}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Khoa/Phòng hiện tại">
                        <span className="font-semibold text-emerald-700">{staff.department?.ten_khoa || staff.ma_khoa}</span>
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
            )
        },
        {
            key: 'history',
            label: `Lịch sử luân chuyển khoa (${histories.length})`,
            children: (
                <Table
                    dataSource={histories}
                    columns={historyColumns}
                    rowKey="id"
                    loading={loadingHistories}
                    pagination={false}
                    size="small"
                    bordered
                />
            )
        }
    ];

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
            width={850}
            centered
        >
            <Tabs defaultActiveKey="basic" type="card" items={tabItems} />
        </Modal>
    );
}

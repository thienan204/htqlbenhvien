'use client';

import React from 'react';
import { Table, Tag, Button } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAttendance, StaffMatrixData } from '../AttendanceContext';

export default function CompensatoryLedgerPage() {
    const router = useRouter();
    const { filteredStaffData, loading, matrixData, searchText } = useAttendance();

    const columns = [
        {
            title: 'STT',
            dataIndex: 'stt',
            key: 'stt',
            width: 50,
            align: 'center' as const
        },
        {
            title: 'Họ và Tên Cán Bộ',
            dataIndex: 'ho_ten',
            key: 'ho_ten',
            width: 200,
            render: (name: string, record: StaffMatrixData) => {
                const hasPosition = Boolean(record.chuc_vu && record.chuc_vu.trim() !== '' && record.chuc_vu.trim().toLowerCase() !== 'cán bộ');
                return (
                    <div className="py-0.5">
                        <span className="font-semibold text-slate-800 block leading-tight">{name}</span>
                        {hasPosition && <div className="text-[11px] text-blue-700 font-semibold mt-0.5 leading-none">{record.chuc_vu}</div>}
                    </div>
                );
            }
        },
        {
            title: 'Tổng Phiên Trực Trong Tháng',
            dataIndex: ['dutySummary', 'tongSo'],
            key: 'tongSo',
            width: 130,
            align: 'center' as const,
            render: (val: number, record: StaffMatrixData) => (
                <div>
                    <Tag color="blue" className="font-bold text-sm">{val} ca</Tag>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                        (Thường: {record.dutySummary.ngayThuong}, T7/CN: {record.dutySummary.t7cn}, Lễ: {record.dutySummary.leTet}, Kèm: {record.dutySummary.trucKem || 0})
                    </div>
                </div>
            )
        },
        {
            title: 'Hạn Mức Được Nghỉ Bù',
            dataIndex: ['dutySummary', 'totalAllowanceDays'],
            key: 'totalAllowanceDays',
            width: 140,
            align: 'center' as const,
            render: (val: number, record: StaffMatrixData) => (
                <div>
                    <span className="font-bold text-slate-700">{val} ngày</span>
                    {record.dutySummary.leTet > 0 && (
                        <div className="text-[10px] text-purple-600 font-medium">(Đã gồm ca Lễ bù 2 ngày)</div>
                    )}
                </div>
            )
        },
        {
            title: 'Đã Nghỉ Bù (Thực tế)',
            dataIndex: ['dutySummary', 'totalCompensatedDays'],
            key: 'totalCompensatedDays',
            width: 130,
            align: 'center' as const,
            render: (val: number) => <Tag color="green" className="font-bold">{val} ngày</Tag>
        },
        {
            title: 'Quỹ Ngày Trực Còn Dư Có Thể Bù',
            dataIndex: ['dutySummary', 'remainingCompensatoryDays'],
            key: 'remainingCompensatoryDays',
            width: 170,
            align: 'center' as const,
            render: (val: number) => {
                if (val <= 0) return <Tag color="default">Đã bù hết</Tag>;
                if (val <= 1) return <Tag color="warning" className="font-bold text-sm">Còn {val} ngày</Tag>;
                return <Tag color="error" className="font-bold text-sm">Còn {val} ngày</Tag>;
            }
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 130,
            align: 'center' as const,
            render: () => (
                <Button
                    type="link"
                    size="small"
                    icon={<CalendarOutlined />}
                    onClick={() => router.push('/staff/attendance')}
                    className="text-blue-600 font-medium"
                >
                    Chấm Nghỉ Bù
                </Button>
            )
        }
    ];

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <p className="text-xs text-slate-500 mb-0">
                    Bảng đối soát quỹ ngày trực và số ngày đã nghỉ bù của từng cán bộ trong tháng. Trực ngày Lễ được tính định mức nghỉ bù 2 ngày theo Bộ luật Lao động.
                </p>
                <span className="text-xs text-slate-500 shrink-0">
                    Quân số: <b className="text-slate-800">{filteredStaffData.length}</b>
                    {searchText.trim() && <span className="text-blue-600 font-semibold ml-1">(Lọc từ {matrixData?.staffData?.length || 0})</span>} cán bộ
                </span>
            </div>
            <Table
                columns={columns}
                dataSource={filteredStaffData}
                rowKey="staffId"
                loading={loading}
                pagination={false}
                bordered
                size="middle"
                className="attendance-matrix-table"
            />
        </div>
    );
}

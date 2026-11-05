'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, Table, Tag, Button, Space, Input, Select, Badge, Tooltip, message, Popconfirm } from 'antd';
import { 
    PlusOutlined, 
    PrinterOutlined, 
    CheckCircleOutlined, 
    CloseCircleOutlined, 
    EditOutlined, 
    SettingOutlined, 
    CalendarOutlined,
    ArrowLeftOutlined,
    SafetyCertificateOutlined,
    FileTextOutlined,
    PieChartOutlined
} from '@ant-design/icons';
import { LeaveBalanceManager } from './_components/LeaveBalanceManager';
import Link from 'next/link';
import dayjs from 'dayjs';

import { LeaveBalanceCard } from './_components/LeaveBalanceCard';
import { CreateLeaveModal } from './_components/CreateLeaveModal';
import { TccbReviewModal } from './_components/TccbReviewModal';
import { LeavePrintTemplate } from './_components/LeavePrintTemplate';
import { LeaveApplicationPrintTemplate } from './_components/LeaveApplicationPrintTemplate';
import { DirectorSignModal } from './_components/DirectorSignModal';
import { LeavePolicyConfigModal } from './_components/LeavePolicyConfigModal';

export default function LeaveManagementPage() {
    const [activeTab, setActiveTab] = useState<string>('my-requests');
    const [loading, setLoading] = useState(false);

    // Dữ liệu cán bộ hiện tại & Quỹ phép
    const [currentStaff, setCurrentStaff] = useState<any>(null);
    const [leaveBalance, setLeaveBalance] = useState<any>(null);
    const [departmentStaffs, setDepartmentStaffs] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);

    // Danh sách đơn theo từng tab
    const [myRequests, setMyRequests] = useState<any[]>([]);
    const [deptRequests, setDeptRequests] = useState<any[]>([]);
    const [allTccbRequests, setAllTccbRequests] = useState<any[]>([]);

    // Modal states
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [reviewModalOpen, setReviewModalOpen] = useState(false);
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [appPrintModalOpen, setAppPrintModalOpen] = useState(false);
    const [signModalOpen, setSignModalOpen] = useState(false);
    const [policyModalOpen, setPolicyModalOpen] = useState(false);

    const [selectedRequest, setSelectedRequest] = useState<any>(null);

    // Lấy số dư phép & thông tin cán bộ
    const fetchBalanceAndStaff = async () => {
        try {
            const res = await fetch('/api/staff/leave-management/balance');
            const data = await res.json();
            if (data.success) {
                setCurrentStaff(data.staff);
                setLeaveBalance(data.balance);
            }
        } catch (err) {
            console.error('Lỗi nạp thông tin số dư phép:', err);
        }
    };

    // Lấy danh sách cán bộ trong khoa để chọn người bàn giao/phụ trách
    const fetchDepartmentStaffs = async () => {
        try {
            const res = await fetch('/api/staff/list');
            const data = await res.json();
            if (data.success && Array.isArray(data.staffs)) {
                setDepartmentStaffs(data.staffs);
            }
        } catch (err) {
            console.error('Lỗi nạp danh sách cán bộ:', err);
        }
    };

    // Lấy danh sách đơn theo chế độ xem
    const fetchRequests = async (viewType: string) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/staff/leave-management?view=${viewType}`);
            const data = await res.json();
            if (data.success) {
                if (viewType === 'MY_REQUESTS') setMyRequests(data.requests || []);
                else if (viewType === 'DEPT_REQUESTS') setDeptRequests(data.requests || []);
                else if (viewType === 'ALL_TCCB') setAllTccbRequests(data.requests || []);
            }
        } catch (err) {
            console.error('Lỗi nạp danh sách đơn:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalanceAndStaff();
        fetchDepartmentStaffs();
        fetch('/api/departments')
            .then(res => res.ok ? res.json() : [])
            .then(data => setDepartments(data))
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (activeTab === 'my-requests') fetchRequests('MY_REQUESTS');
        else if (activeTab === 'dept-requests') fetchRequests('DEPT_REQUESTS');
        else if (activeTab === 'tccb-review') fetchRequests('ALL_TCCB');
    }, [activeTab]);

    const handleOpenPrint = (req: any) => {
        setSelectedRequest(req);
        setPrintModalOpen(true);
    };

    const handleOpenAppPrint = (req: any) => {
        setSelectedRequest(req);
        setAppPrintModalOpen(true);
    };

    const handleOpenReview = (req: any) => {
        setSelectedRequest(req);
        setReviewModalOpen(true);
    };

    const handleOpenSign = (req: any) => {
        setSelectedRequest(req);
        setSignModalOpen(true);
    };

    // Duyệt nhanh cấp Trưởng khoa
    const handleDeptQuickApprove = async (requestId: string) => {
        try {
            const res = await fetch('/api/staff/leave-management/review', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId,
                    action: 'DEPT_APPROVE',
                    deptComment: 'Đồng ý giải quyết nghỉ phép theo kế hoạch của Khoa'
                })
            });
            const data = await res.json();
            if (res.ok) {
                message.success('Trưởng khoa đã duyệt đơn! Đơn đã được chuyển lên Phòng TCCB.');
                fetchRequests('DEPT_REQUESTS');
            } else {
                message.error(data.error || 'Duyệt đơn thất bại');
            }
        } catch (err) {
            console.error('Lỗi duyệt:', err);
        }
    };

    // Render tag trạng thái
    const renderStatusTag = (status: string, req: any) => {
        switch (status) {
            case 'PENDING_DEPT':
                return <Tag color="orange" className="font-medium">1. Chờ Trưởng khoa duyệt</Tag>;
            case 'PENDING_TCCB':
                return <Tag color="blue" className="font-medium">2. Chờ TCCB thẩm tra</Tag>;
            case 'PENDING_DIRECTOR':
                return (
                    <Tag color="purple" className="font-medium">
                        3. Sẵn sàng trình Lãnh đạo ký
                    </Tag>
                );
            case 'APPROVED':
                return (
                    <Tag color="success" className="font-bold flex-inline items-center gap-1">
                        <CheckCircleOutlined /> Đã duyệt & Đã ký (Đã vào công)
                    </Tag>
                );
            case 'REJECTED':
                return (
                    <Tag color="error" className="font-medium">
                        {req.rejectReasonType === 'THIEU_NHAN_LUC' ? 'Từ chối (Thiếu nhân lực - Đề xuất trả tiền)' : 'Bị từ chối'}
                    </Tag>
                );
            default:
                return <Tag>{status}</Tag>;
        }
    };

    // Cột danh sách đơn
    const getColumns = (tabType: string) => [
        {
            title: 'Mã & Loại Đơn',
            key: 'formType',
            width: 140,
            render: (_: any, r: any) => (
                <div>
                    <span className="font-mono text-xs font-bold text-blue-700">
                        #{r.id.slice(-6).toUpperCase()}
                    </span>
                    <div className="mt-0.5">
                        {r.formType === 'DEPARTMENT_HEAD' ? (
                            <Tag color="purple" className="text-[10px] m-0">Mẫu 2: Trưởng Phòng</Tag>
                        ) : (
                            <Tag color="cyan" className="text-[10px] m-0">Mẫu 1: NV / Phó Phòng</Tag>
                        )}
                    </div>
                </div>
            )
        },
        ...(tabType !== 'my-requests' ? [
            {
                title: 'Cán Bộ Làm Đơn',
                key: 'staffInfo',
                width: 180,
                render: (_: any, r: any) => (
                    <div>
                        <div className="font-semibold text-slate-800">{r.staff?.ho_ten}</div>
                        <div className="text-[11px] text-slate-500">
                            {r.staff?.chuc_vu_ref?.name || 'Nhân viên'} - {r.staff?.department?.ten_khoa}
                        </div>
                    </div>
                )
            }
        ] : []),
        {
            title: 'Thời Gian Nghỉ',
            key: 'timeRange',
            width: 190,
            render: (_: any, r: any) => {
                const isModified = typeof r.approvedDays === 'number' && r.approvedDays !== r.requestedDays;
                return (
                    <div>
                        <div className="text-xs font-semibold text-slate-800">
                            {dayjs(r.approvedStartDate || r.requestedStartDate).format('DD/MM/YYYY')} → {dayjs(r.approvedEndDate || r.requestedEndDate).format('DD/MM/YYYY')}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                            <span>
                                {r.session === 'MORNING' ? 'Sáng (07h-11h30)' : r.session === 'AFTERNOON' ? 'Chiều (13h30-17h)' : 'Cả ngày (8h)'}
                            </span>
                            <span>•</span>
                            <span className="font-bold text-blue-700">
                                {r.approvedDays ?? r.requestedDays} ngày
                            </span>
                            {isModified && (
                                <Tooltip title={`TCCB đã điều chỉnh từ ${r.requestedDays} ngày xuống ${r.approvedDays} ngày`}>
                                    <Tag color="volcano" className="text-[9px] px-1 py-0 m-0">TCCB đã sửa</Tag>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Lý Do & Bàn Giao',
            key: 'reason',
            render: (_: any, r: any) => (
                <div className="text-xs">
                    <div className="font-medium text-slate-800 line-clamp-1">{r.reason}</div>
                    {r.handoverStaff && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                            Bàn giao: <strong>{r.handoverStaff.ho_ten}</strong>
                        </div>
                    )}
                    {r.actingHeadStaff && (
                        <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
                            Phó phòng điều hành: <strong>{r.actingHeadStaff.ho_ten}</strong>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Trạng Thái',
            key: 'status',
            width: 180,
            render: (_: any, r: any) => renderStatusTag(r.status, r)
        },
        {
            title: 'Thao Tác',
            key: 'actions',
            width: 220,
            align: 'right' as const,
            render: (_: any, r: any) => (
                <Space size="small">
                    {/* Nút In Đơn Xin Nghỉ Phép (A4 Chuẩn Mẫu Word 2025 BVĐKLS) */}
                    <Button
                        size="small"
                        icon={<FileTextOutlined />}
                        onClick={() => handleOpenAppPrint(r)}
                        title="In Đơn Xin Nghỉ Phép (Mẫu A4 BVĐK Lạng Sơn)"
                        className="text-blue-700 border-blue-200 hover:bg-blue-50"
                    >
                        In Đơn
                    </Button>

                    {/* Nút in mẫu A4 Kết quả thẩm tra TCCB (khi TCCB đã thẩm tra hoặc chờ ký) */}
                    {(r.status === 'PENDING_DIRECTOR' || r.status === 'APPROVED' || r.status === 'PENDING_TCCB') && (
                        <Button
                            size="small"
                            icon={<PrinterOutlined />}
                            onClick={() => handleOpenPrint(r)}
                            title="In Mẫu Kết Quả Nghỉ Phép (A4 - TCCB)"
                        />
                    )}

                    {/* Dành cho Trưởng khoa duyệt */}
                    {tabType === 'dept-requests' && r.status === 'PENDING_DEPT' && (
                        <Popconfirm
                            title="Xác nhận duyệt đơn nghỉ phép này?"
                            onConfirm={() => handleDeptQuickApprove(r.id)}
                            okText="Đồng ý"
                            cancelText="Hủy"
                        >
                            <Button size="small" type="primary" className="bg-emerald-600 hover:bg-emerald-500 text-xs">
                                Duyệt Đơn
                            </Button>
                        </Popconfirm>
                    )}

                    {/* Dành cho TCCB thẩm tra & sửa số ngày */}
                    {tabType === 'tccb-review' && (r.status === 'PENDING_TCCB' || r.status === 'PENDING_DIRECTOR') && (
                        <Button
                            size="small"
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={() => handleOpenReview(r)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-xs"
                        >
                            Thẩm Tra
                        </Button>
                    )}

                    {/* Dành cho TCCB xác nhận sau khi Lãnh đạo ký */}
                    {tabType === 'tccb-review' && r.status === 'PENDING_DIRECTOR' && (
                        <Button
                            size="small"
                            type="primary"
                            icon={<SafetyCertificateOutlined />}
                            onClick={() => handleOpenSign(r)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-xs"
                        >
                            Xác Nhận Đã Ký
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div className="p-4 bg-slate-50 min-h-screen">
            {/* Top Bar Navigation */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                    <Link href="/staff/attendance">
                        <Button icon={<ArrowLeftOutlined />} size="small">
                            Bảng Chấm Công
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-base font-bold text-slate-800 m-0 flex items-center gap-2">
                            <span>PHÂN HỆ QUẢN LÝ NGHỈ PHÉP & THẨM TRA PHÉP NĂM</span>
                            <Tag color="blue" className="text-[11px] font-normal">Độc Lập</Tag>
                        </h1>
                        <div className="text-xs text-slate-500">
                            Bệnh Viện Đa Khoa Tỉnh Lạng Sơn • Quy trình 2 Mẫu Đơn & Phê Duyệt Văn Bản Giấy
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        icon={<SettingOutlined />}
                        onClick={() => setPolicyModalOpen(true)}
                        className="text-xs"
                    >
                        ⚙️ Cấu Hình Hạn 30/03 & Trả Tiền
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setCreateModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 font-medium text-xs shadow-xs"
                    >
                        Tạo Đơn Xin Nghỉ Phép
                    </Button>
                </div>
            </div>

            {/* Thẻ Quỹ Ngày Phép Năm Cá Nhân */}
            <LeaveBalanceCard
                balance={leaveBalance}
                staffName={currentStaff?.ho_ten}
                cutoffDateStr="30/03"
            />

            {/* Khung Quản Lý Các Tab (type="card" theo đúng quy chuẩn UI) */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
                <Tabs
                    type="card"
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'my-requests',
                            label: (
                                <span className="font-medium text-xs flex items-center gap-1.5">
                                    <FileTextOutlined /> 1. Đơn Nghỉ Phép Của Tôi ({myRequests.length})
                                </span>
                            ),
                            children: (
                                <Table
                                    columns={getColumns('my-requests')}
                                    dataSource={myRequests}
                                    rowKey="id"
                                    loading={loading}
                                    size="small"
                                    bordered
                                    pagination={{ pageSize: 8 }}
                                />
                            )
                        },
                        {
                            key: 'dept-requests',
                            label: (
                                <span className="font-medium text-xs flex items-center gap-1.5">
                                    <CalendarOutlined /> 2. Duyệt Đơn Khoa/Phòng ({deptRequests.length})
                                </span>
                            ),
                            children: (
                                <Table
                                    columns={getColumns('dept-requests')}
                                    dataSource={deptRequests}
                                    rowKey="id"
                                    loading={loading}
                                    size="small"
                                    bordered
                                    pagination={{ pageSize: 8 }}
                                />
                            )
                        },
                        {
                            key: 'tccb-review',
                            label: (
                                <span className="font-medium text-xs flex items-center gap-1.5 text-indigo-700">
                                    <EditOutlined /> 3. Phòng TCCB Thẩm Tra & In Phiếu ({allTccbRequests.length})
                                </span>
                            ),
                            children: (
                                <Table
                                    columns={getColumns('tccb-review')}
                                    dataSource={allTccbRequests}
                                    rowKey="id"
                                    loading={loading}
                                    size="small"
                                    bordered
                                    pagination={{ pageSize: 8 }}
                                />
                            )
                        },
                        {
                            key: 'leave-balances',
                            label: (
                                <span className="font-semibold text-xs flex items-center gap-1.5 text-blue-700">
                                    <PieChartOutlined /> 4. Quản Lý Quỹ Phép Năm & Đối Soát Chấm Công
                                </span>
                            ),
                            children: (
                                <LeaveBalanceManager departments={departments} />
                            )
                        }
                    ]}
                />
            </div>

            {/* Modal Tạo Đơn Nghỉ Phép (2 Mẫu) */}
            <CreateLeaveModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSuccess={() => {
                    fetchBalanceAndStaff();
                    fetchRequests(activeTab === 'my-requests' ? 'MY_REQUESTS' : activeTab === 'dept-requests' ? 'DEPT_REQUESTS' : 'ALL_TCCB');
                }}
                currentStaff={currentStaff}
                departmentStaffs={departmentStaffs}
                remainingDays={leaveBalance?.remainingDays || 0}
            />

            {/* Modal TCCB Thẩm Tra & Sửa Số Ngày Nghỉ */}
            <TccbReviewModal
                open={reviewModalOpen}
                onClose={() => setReviewModalOpen(false)}
                onSuccess={() => fetchRequests('ALL_TCCB')}
                onOpenPrint={handleOpenPrint}
                requestData={selectedRequest}
            />

            {/* Mẫu In A4 Kết Quả Giải Quyết Nghỉ Phép */}
            <LeavePrintTemplate
                open={printModalOpen}
                onClose={() => setPrintModalOpen(false)}
                requestData={selectedRequest}
                balanceData={leaveBalance}
            />

            {/* Mẫu In A4 Đơn Xin Nghỉ Phép (Chuẩn File Word 2025 BVĐK Tỉnh Lạng Sơn) */}
            <LeaveApplicationPrintTemplate
                open={appPrintModalOpen}
                onClose={() => setAppPrintModalOpen(false)}
                requestData={selectedRequest}
            />

            {/* Modal Xác Nhận Lãnh Đạo Đã Ký Văn Bản Giấy */}
            <DirectorSignModal
                open={signModalOpen}
                onClose={() => setSignModalOpen(false)}
                onSuccess={() => {
                    fetchRequests('ALL_TCCB');
                    fetchBalanceAndStaff();
                }}
                requestData={selectedRequest}
            />

            {/* Modal Cấu Hình Hạn 30/03 & Danh Sách Đề Xuất Trả Tiền */}
            <LeavePolicyConfigModal
                open={policyModalOpen}
                onClose={() => setPolicyModalOpen(false)}
            />
        </div>
    );
}


'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { 
    Card, Table, Tag, Button, Input, Select, Tabs, Space, 
    Badge, Tooltip, message, Image as AntImage, Breadcrumb 
} from 'antd';
import { 
    ShopOutlined, 
    ArrowLeftOutlined, 
    ReloadOutlined, 
    SearchOutlined, 
    ClockCircleOutlined, 
    AlertOutlined, 
    CheckCircleOutlined, 
    DesktopOutlined, 
    CodeOutlined, 
    MessageOutlined, 
    FileTextOutlined,
    CalendarOutlined,
    EditOutlined,
    SettingOutlined,
    LinkOutlined,
    ShareAltOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dayjs from 'dayjs';
import { Ticket, ITUser, VendorItem } from '../it-requests/types';
import { TicketActionModal } from '../it-requests/components/TicketActionModal';
import { getDefaultPagination } from '@/utils/pagination';
import { TicketChatModal } from '../it-requests/components/TicketChatModal';
import { TicketImage } from '@/components/shared/TicketImage';
import { getBasePath } from '@/utils/config';
import { copyTicketShareLink, copyTicketZaloMessage } from '../it-requests/utils/shareUtils';

function VendorTasksContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetDepartment = searchParams.get('targetDepartment') || 'CNTT';

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [vendors, setVendors] = useState<VendorItem[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [itUsers, setItUsers] = useState<ITUser[]>([]);
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Filters
    const [activeTab, setActiveTab] = useState<string>('ALL'); // ALL, HARDWARE, SOFTWARE, OVERDUE, RESOLVED
    const [selectedVendor, setSelectedVendor] = useState<string>('ALL');
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // Modals
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [isChatVisible, setIsChatVisible] = useState(false);

    // Fetch user & itUsers
    const fetchAuthAndUsers = async () => {
        try {
            const authRes = await fetch(`${getBasePath()}/api/auth/me`);
            if (authRes.ok) {
                const authData = await authRes.json();
                setUser(authData);
            }
            const itRes = await fetch(`${getBasePath()}/api/error-management/duty-roster?targetDepartment=${targetDepartment}`);
            if (itRes.ok) {
                const itData = await itRes.json();
                setItUsers(itData.users || []);
            }
            const deptRes = await fetch(`${getBasePath()}/api/departments`);
            if (deptRes.ok) {
                const deptData = await deptRes.json();
                setDepartments(deptData || []);
            }
            const vendorRes = await fetch(`${getBasePath()}/api/system-categories?type=DOI_TAC_NGOAI`);
            if (vendorRes.ok) {
                const vendorData = await vendorRes.json();
                if (Array.isArray(vendorData)) {
                    setVendors(vendorData.filter((v: any) => v.isActive !== false));
                }
            }
        } catch (e) {
            console.error('Lỗi khởi tạo:', e);
        }
    };

    // Fetch tickets
    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests?targetDepartment=${targetDepartment}&_t=${Date.now()}`);
            if (res.ok) {
                const data: Ticket[] = await res.json();
                setTickets(data);
            } else {
                message.error('Không thể tải danh sách phiếu');
            }
        } catch (err) {
            console.error(err);
            message.error('Lỗi kết nối khi tải phiếu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuthAndUsers();
        fetchTickets();
    }, [targetDepartment]);

    // Handle update ticket from modal
    const handleUpdateTicket = async (values: any) => {
        if (!selectedTicket) return;
        try {
            const isMarkingResolved = values.status === 'RESOLVED';
            const payload: any = {
                id: selectedTicket.id,
                status: values.status,
                it_note: values.it_note,
                assigneeId: values.assigneeId !== undefined ? values.assigneeId : selectedTicket.assigneeId,
                vendorId: values.vendorId !== undefined ? values.vendorId : selectedTicket.vendorId,
                vendorName: values.vendorName !== undefined ? values.vendorName : selectedTicket.vendorName,
                vendorTicketCode: values.vendorTicketCode !== undefined ? values.vendorTicketCode : selectedTicket.vendorTicketCode,
                vendorExpectedReturnAt: values.vendorExpectedReturnAt !== undefined ? values.vendorExpectedReturnAt : selectedTicket.vendorExpectedReturnAt,
                it_images: values.it_images || []
            };

            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                if (isMarkingResolved) {
                    message.success('Đã hoàn thành công việc đối tác! Đã chuyển sang tab "Đã hoàn thành / Nhận máy".');
                    setActiveTab('RESOLVED'); // Tự động chuyển tab để thấy ngay phiếu đã hoàn thành
                } else {
                    message.success('Cập nhật tiến độ thành công!');
                }
                setIsActionModalVisible(false);
                fetchTickets();
            } else {
                message.error('Cập nhật thất bại');
            }
        } catch (err) {
            message.error('Lỗi kết nối');
        }
    };

    // Lọc các ticket có liên quan đến Đơn vị / Đối tác ngoài
    // Bao gồm: Đang chờ đối tác (WAITING_VENDOR) HOẶC Đã hoàn thành mà từng chuyển đối tác (vendorName/vendorId/vendorSentAt != null)
    const vendorTickets = useMemo(() => {
        return tickets.filter(t => 
            t.status === 'WAITING_VENDOR' || 
            ((t.vendorName || t.vendorId || t.vendorSentAt) && t.status === 'RESOLVED')
        );
    }, [tickets]);

    // Tính toán KPI Thống kê
    const stats = useMemo(() => {
        const activeVendorList = vendorTickets.filter(t => t.status === 'WAITING_VENDOR');
        const hardwareCount = activeVendorList.filter(t => t.category === 'HARDWARE').length;
        const softwareCount = activeVendorList.filter(t => t.category === 'SOFTWARE').length;
        
        const now = dayjs();
        const overdueCount = activeVendorList.filter(t => {
            if (!t.vendorExpectedReturnAt) return false;
            return now.isAfter(dayjs(t.vendorExpectedReturnAt).endOf('day'));
        }).length;

        const resolvedCount = vendorTickets.filter(t => t.status === 'RESOLVED').length;

        return {
            totalWaiting: activeVendorList.length,
            hardwareCount,
            softwareCount,
            overdueCount,
            resolvedCount
        };
    }, [vendorTickets]);

    // Lọc theo Tab, Đối tác và Từ khóa tìm kiếm
    const filteredTickets = useMemo(() => {
        let result = vendorTickets;
        const now = dayjs();

        // Lọc theo Tab
        if (activeTab === 'ALL') {
            result = result.filter(t => t.status === 'WAITING_VENDOR');
        } else if (activeTab === 'HARDWARE') {
            result = result.filter(t => t.status === 'WAITING_VENDOR' && t.category === 'HARDWARE');
        } else if (activeTab === 'SOFTWARE') {
            result = result.filter(t => t.status === 'WAITING_VENDOR' && t.category === 'SOFTWARE');
        } else if (activeTab === 'OVERDUE') {
            result = result.filter(t => {
                if (t.status !== 'WAITING_VENDOR' || !t.vendorExpectedReturnAt) return false;
                return now.isAfter(dayjs(t.vendorExpectedReturnAt).endOf('day'));
            });
        } else if (activeTab === 'RESOLVED') {
            result = result.filter(t => t.status === 'RESOLVED');
        }

        // Lọc theo Đối tác (Hỗ trợ so khớp chính xác mã, tên hoặc chuỗi chứa)
        if (selectedVendor !== 'ALL') {
            result = result.filter(t => {
                if (t.vendorId === selectedVendor || t.vendorName === selectedVendor) return true;
                if (t.vendorName && selectedVendor) {
                    const vName = t.vendorName.toLowerCase();
                    const sName = selectedVendor.toLowerCase();
                    return vName.includes(sName) || sName.includes(vName);
                }
                return false;
            });
        }

        // Lọc theo từ khóa tìm kiếm
        if (searchKeyword.trim()) {
            const kw = searchKeyword.trim().toLowerCase();
            result = result.filter(t => {
                const tenLoi = (t.ten_loi || '').toLowerCase();
                const maBa = (t.ma_ba || '').toLowerCase();
                const vendorName = (t.vendorName || '').toLowerCase();
                const vendorTicketCode = (t.vendorTicketCode || '').toLowerCase();
                const itNote = (t.it_note || '').toLowerCase();
                const dept = departments.find(d => d.ma_khoa === t.ma_khoa);
                const tenKhoa = (dept?.ten_khoa || '').toLowerCase();
                return tenLoi.includes(kw) || maBa.includes(kw) || vendorName.includes(kw) || vendorTicketCode.includes(kw) || itNote.includes(kw) || tenKhoa.includes(kw);
            });
        }

        return result;
    }, [vendorTickets, activeTab, selectedVendor, searchKeyword, departments]);

    // Bảng cột
    const columns = [
        {
            title: 'STT',
            key: 'stt',
            width: 60,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (
                <span className="text-slate-400 font-mono text-xs">{index + 1}</span>
            )
        },
        {
            title: 'Đơn vị / Đối tác ngoài',
            key: 'vendor',
            width: 240,
            render: (_: any, record: Ticket) => {
                const dept = departments.find(d => d.ma_khoa === record.ma_khoa);
                return (
                    <div className="space-y-1.5">
                        <div className="font-bold text-amber-950 flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1.5 truncate">
                                <ShopOutlined className="text-amber-600" />
                                <span>{record.vendorName || 'Chưa gán đối tác'}</span>
                            </span>
                            <div className="flex items-center shrink-0">
                                <Tooltip title="Sao chép Link xem phiếu gửi đối tác">
                                    <Button 
                                        size="small" 
                                        type="text" 
                                        className="h-6 w-6 p-0 text-slate-400 hover:text-blue-600"
                                        icon={<LinkOutlined />} 
                                        onClick={() => copyTicketShareLink(record.id)} 
                                    />
                                </Tooltip>
                                <Tooltip title="Sao chép tin nhắn Zalo kèm Link">
                                    <Button 
                                        size="small" 
                                        type="text" 
                                        className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        icon={<ShareAltOutlined />} 
                                        onClick={() => copyTicketZaloMessage(record, { deptName: dept?.ten_khoa })} 
                                    />
                                </Tooltip>
                            </div>
                        </div>
                        {record.vendorTicketCode && (
                            <div className="text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 inline-block">
                                Mã ticket: <strong>{record.vendorTicketCode}</strong>
                            </div>
                        )}
                        {record.vendorSentAt && (
                            <div className="text-[11px] text-slate-400">
                                Gửi ngày: {dayjs(record.vendorSentAt).format('DD/MM/YYYY HH:mm')}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Yêu cầu & Khoa phòng',
            key: 'issue',
            width: 280,
            render: (_: any, record: Ticket) => {
                const dept = departments.find(d => d.ma_khoa === record.ma_khoa);
                const sdt = record.dynamicFields?.['SĐT'];
                return (
                    <div className="space-y-1.5">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                            {record.category === 'HARDWARE' ? (
                                <Tag color="cyan" className="m-0 text-[11px] font-medium">Phần cứng</Tag>
                            ) : (
                                <Tag color="blue" className="m-0 text-[11px] font-medium">Phần mềm</Tag>
                            )}
                            <span>{record.ten_loi}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">🏥 {dept?.ten_khoa || record.ma_khoa}</span>
                            {sdt && <span className="text-red-600 font-semibold">📞 {sdt}</span>}
                            {record.ma_ba && (
                                <span className="font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.2">
                                    BA: {record.ma_ba}
                                </span>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Yêu cầu kỹ thuật CNTT gửi & Ảnh biên nhận',
            key: 'it_note',
            width: 320,
            render: (_: any, record: Ticket) => {
                const hasImages = Array.isArray(record.it_images) && record.it_images.length > 0;
                return (
                    <div className="space-y-2">
                        <div className="text-slate-700 italic text-sm whitespace-pre-wrap bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                            {record.it_note || <span className="text-slate-400">Chưa có ghi chú kỹ thuật</span>}
                        </div>
                        {hasImages && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <AntImage.PreviewGroup>
                                    {record.it_images!.map((url: string, idx: number) => (
                                        <div key={idx} className="relative group">
                                            <TicketImage url={url} />
                                        </div>
                                    ))}
                                </AntImage.PreviewGroup>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Ngày hẹn trả & Trạng thái',
            key: 'schedule',
            width: 180,
            render: (_: any, record: Ticket) => {
                if (record.status === 'RESOLVED') {
                    return (
                        <div className="space-y-1">
                            <Tag color="success" className="font-semibold m-0 flex items-center gap-1">
                                <CheckCircleOutlined /> Đã hoàn thành
                            </Tag>
                            <div className="text-[11px] text-slate-400">
                                Nhận máy / sửa xong
                            </div>
                        </div>
                    );
                }

                let isOverdue = false;
                let overdueDays = 0;
                if (record.vendorExpectedReturnAt) {
                    const expected = dayjs(record.vendorExpectedReturnAt).endOf('day');
                    const now = dayjs();
                    if (now.isAfter(expected)) {
                        isOverdue = true;
                        overdueDays = now.diff(expected, 'day') + 1;
                    }
                }

                return (
                    <div className="space-y-1">
                        {record.vendorExpectedReturnAt ? (
                            <>
                                <div className="text-xs font-medium text-slate-700 flex items-center gap-1">
                                    <CalendarOutlined className="text-slate-400" />
                                    <span>Hạn: {dayjs(record.vendorExpectedReturnAt).format('DD/MM/YYYY')}</span>
                                </div>
                                {isOverdue ? (
                                    <Tag color="error" className="m-0 font-bold border-red-300 animate-pulse text-[11px]">
                                        ⚠️ Quá hạn {overdueDays} ngày!
                                    </Tag>
                                ) : (
                                    <Tag color="processing" className="m-0 text-[11px]">
                                        Đang chờ trả máy
                                    </Tag>
                                )}
                            </>
                        ) : (
                            <span className="text-xs text-slate-400 italic">Chưa hẹn ngày trả</span>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Kỹ thuật viên phụ trách',
            key: 'assignee',
            width: 160,
            render: (_: any, record: Ticket) => (
                <div className="space-y-0.5">
                    <Tag color="purple" className="font-medium m-0">{record.assigneeName || 'Chưa phân công'}</Tag>
                    {record.assigneePhone && (
                        <div className="text-[11px] text-slate-500 font-semibold">
                            📞 {record.assigneePhone}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 150,
            fixed: 'right' as const,
            align: 'center' as const,
            render: (_: any, record: Ticket) => {
                const dept = departments.find(d => d.ma_khoa === record.ma_khoa);
                return (
                    <div className="flex flex-col items-center gap-1.5">
                        <Button 
                            size="small" 
                            type="primary"
                            className="bg-amber-600 hover:bg-amber-500 font-medium text-xs w-full"
                            icon={<EditOutlined />}
                            onClick={() => {
                                setSelectedTicket(record);
                                setIsActionModalVisible(true);
                            }}
                        >
                            {record.status === 'RESOLVED' ? 'Xem lại' : 'Cập nhật / Nhận'}
                        </Button>
                        <div className="flex items-center gap-1 w-full justify-center">
                            <Tooltip title="Sao chép tin nhắn Zalo gửi đối tác">
                                <Button
                                    size="small"
                                    type="default"
                                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                    icon={<ShareAltOutlined />}
                                    onClick={() => copyTicketZaloMessage(record, { deptName: dept?.ten_khoa })}
                                />
                            </Tooltip>
                            <Badge count={record.unreadMessageCount || 0} size="small" offset={[-4, 4]}>
                                <Button 
                                    size="small" 
                                    type="dashed" 
                                    icon={<MessageOutlined />} 
                                    title={record.unreadMessageCount ? `${record.unreadMessageCount} tin chưa đọc` : 'Thảo luận / Trao đổi'} 
                                    onClick={() => {
                                        setSelectedTicket(record);
                                        setIsChatVisible(true);
                                    }} 
                                />
                            </Badge>
                            {record.ma_ba && record.hasXml && (
                                <Button 
                                    size="small" 
                                    type="default" 
                                    icon={<FileTextOutlined />} 
                                    title="Xem hồ sơ XML" 
                                    onClick={() => window.open(`/xml1-viewer?search=${record.ma_ba}`, '_blank')} 
                                />
                            )}
                        </div>
                    </div>
                );
            }
        }
    ];

    // Tabs items - Tuân thủ quy tắc Ant Design Tabs luôn dùng type="card"
    const tabItems = [
        {
            key: 'ALL',
            label: (
                <span className="flex items-center gap-1.5 px-1 font-medium">
                    <ShopOutlined /> Tất cả đang gửi ({stats.totalWaiting})
                </span>
            )
        },
        {
            key: 'HARDWARE',
            label: (
                <span className="flex items-center gap-1.5 px-1 font-medium">
                    <DesktopOutlined /> Phần cứng / Thiết bị ({stats.hardwareCount})
                </span>
            )
        },
        {
            key: 'SOFTWARE',
            label: (
                <span className="flex items-center gap-1.5 px-1 font-medium">
                    <CodeOutlined /> Phần mềm / Lỗi hệ thống ({stats.softwareCount})
                </span>
            )
        },
        {
            key: 'OVERDUE',
            label: (
                <span className="flex items-center gap-1.5 px-1 font-bold text-red-600">
                    <AlertOutlined /> Quá hạn hẹn trả ({stats.overdueCount})
                </span>
            )
        },
        {
            key: 'RESOLVED',
            label: (
                <span className="flex items-center gap-1.5 px-1 font-medium text-emerald-600">
                    <CheckCircleOutlined /> Đã hoàn thành / Nhận máy ({stats.resolvedCount})
                </span>
            )
        }
    ];

    return (
        <div className="w-full max-w-[98%] mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
            {/* Breadcrumb & Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Breadcrumb 
                    items={[
                        { title: <Link href="/error-management/it-requests">Yêu cầu CNTT</Link> },
                        { title: <span className="font-semibold text-slate-800">Công việc gửi Đơn vị / Đối tác ngoài</span> }
                    ]}
                />
                <div className="flex items-center gap-2">
                    <Link href={`/system-categories?type=DOI_TAC_NGOAI`}>
                        <Button icon={<SettingOutlined />} className="text-slate-600">
                            Khai báo Danh mục Đối tác
                        </Button>
                    </Link>
                    <Link href={`/error-management/it-requests?targetDepartment=${targetDepartment}`}>
                        <Button icon={<ArrowLeftOutlined />} type="default">
                            Quay lại Yêu cầu {targetDepartment}
                        </Button>
                    </Link>
                    <Button icon={<ReloadOutlined />} onClick={fetchTickets} loading={loading}>
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Header Title Banner */}
            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 rounded-2xl p-5 sm:p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider text-amber-100">
                        <ShopOutlined /> Theo dõi tiến độ bảo hành & sửa chữa ngoài
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white m-0">
                        Quản lý Công việc gửi Đơn vị / Đối tác ngoài
                    </h1>
                    <p className="text-sm text-amber-100/90 m-0 max-w-3xl">
                        Theo dõi tập trung thiết bị phần cứng gửi sửa chữa (máy in, máy tính...) và các lỗi phần mềm gửi đối tác hãng (HIS VNPT, LIS, Viettel...)
                    </p>
                </div>
            </div>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <Card className="rounded-2xl border-amber-200 bg-gradient-to-br from-amber-50/70 to-orange-50/40 shadow-xs" styles={{ body: { padding: '16px' } }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-semibold text-amber-700 uppercase">Đang gửi đối tác</div>
                            <div className="text-2xl sm:text-3xl font-bold text-amber-950 mt-1">{stats.totalWaiting}</div>
                            <div className="text-[11px] text-amber-600 mt-0.5">Công việc đang xử lý</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center text-xl">
                            <ShopOutlined />
                        </div>
                    </div>
                </Card>

                <Card className="rounded-2xl border-cyan-200 bg-gradient-to-br from-cyan-50/70 to-blue-50/40 shadow-xs" styles={{ body: { padding: '16px' } }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-semibold text-cyan-700 uppercase">Phần cứng / Máy in</div>
                            <div className="text-2xl sm:text-3xl font-bold text-cyan-950 mt-1">{stats.hardwareCount}</div>
                            <div className="text-[11px] text-cyan-600 mt-0.5">Thiết bị gửi bảo hành</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-700 flex items-center justify-center text-xl">
                            <DesktopOutlined />
                        </div>
                    </div>
                </Card>

                <Card className="rounded-2xl border-blue-200 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 shadow-xs" styles={{ body: { padding: '16px' } }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-xs font-semibold text-blue-700 uppercase">Phần mềm / HIS</div>
                            <div className="text-2xl sm:text-3xl font-bold text-blue-950 mt-1">{stats.softwareCount}</div>
                            <div className="text-[11px] text-blue-600 mt-0.5">Lỗi phần mềm gửi hãng</div>
                        </div>
                        <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center text-xl">
                            <CodeOutlined />
                        </div>
                    </div>
                </Card>

                <Card className={`rounded-2xl shadow-xs transition-all ${stats.overdueCount > 0 ? 'border-red-300 bg-gradient-to-br from-red-50 to-orange-50/70 ring-2 ring-red-400/30' : 'border-slate-200 bg-white'}`} styles={{ body: { padding: '16px' } }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className={`text-xs font-semibold uppercase ${stats.overdueCount > 0 ? 'text-red-700' : 'text-slate-500'}`}>Quá hạn hẹn trả</div>
                            <div className={`text-2xl sm:text-3xl font-bold mt-1 ${stats.overdueCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>{stats.overdueCount}</div>
                            <div className={`text-[11px] mt-0.5 ${stats.overdueCount > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                                {stats.overdueCount > 0 ? 'Cần liên hệ giục đối tác!' : 'Đúng hạn tiến độ'}
                            </div>
                        </div>
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${stats.overdueCount > 0 ? 'bg-red-500/10 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                            <AlertOutlined />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Main Content Card with Tabs (type="card") */}
            <Card className="rounded-2xl shadow-sm border-slate-200 overflow-hidden" styles={{ body: { padding: '16px 20px' } }}>
                {/* Tabs Ant Design type="card" */}
                <Tabs 
                    type="card" 
                    activeKey={activeTab} 
                    onChange={setActiveTab} 
                    items={tabItems}
                    className="mb-3"
                />

                {/* Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs font-semibold text-slate-600">Lọc theo Đối tác:</span>
                        <Select
                            value={selectedVendor}
                            onChange={setSelectedVendor}
                            className="min-w-[200px]"
                            placeholder="Tất cả đơn vị đối tác"
                            options={[
                                { value: 'ALL', label: 'Tất cả Đơn vị / Đối tác' },
                                ...vendors.map(v => ({ value: v.name, label: v.name }))
                            ]}
                        />
                    </div>

                    <div className="w-full sm:w-80">
                        <Input
                            placeholder="Tìm kiếm lỗi, mã BA, mã ticket, khoa..."
                            prefix={<SearchOutlined className="text-slate-400" />}
                            value={searchKeyword}
                            onChange={e => setSearchKeyword(e.target.value)}
                            allowClear
                        />
                    </div>
                </div>

                {/* Tickets Table */}
                <Table
                    columns={columns}
                    dataSource={filteredTickets}
                    rowKey="id"
                    loading={loading}
                    pagination={getDefaultPagination({
                        pageSize: 10,
                        unit: 'công việc'
                    })}
                    scroll={{ x: 1200 }}
                    locale={{
                        emptyText: (
                            <div className="py-12 text-center text-slate-400 space-y-2">
                                <ShopOutlined className="text-4xl text-slate-300" />
                                <div className="text-sm font-medium">Không tìm thấy công việc nào gửi đơn vị ngoài</div>
                            </div>
                        )
                    }}
                />
            </Card>

            {/* Modal Xử lý / Cập nhật tiến độ */}
            {isActionModalVisible && (
                <TicketActionModal
                    visible={isActionModalVisible}
                    ticket={selectedTicket}
                    itUsers={itUsers}
                    user={user}
                    onCancel={() => setIsActionModalVisible(false)}
                    onOk={handleUpdateTicket}
                    targetDepartment={targetDepartment}
                />
            )}

            {/* Modal Thảo luận Chat */}
            {isChatVisible && (
                <TicketChatModal
                    visible={isChatVisible}
                    ticket={selectedTicket}
                    user={user}
                    onClose={() => setIsChatVisible(false)}
                    onMessageSent={fetchTickets}
                />
            )}
        </div>
    );
}

export default function VendorTasksPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-slate-500">Đang tải trang công việc gửi đối tác...</div>}>
            <VendorTasksContent />
        </Suspense>
    );
}

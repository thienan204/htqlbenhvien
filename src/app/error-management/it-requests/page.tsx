'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, Select, Tag, Space, message, Card, notification, Popconfirm, DatePicker, Segmented, Radio, Switch, Image as AntImage } from 'antd';
import { PlusOutlined, BugOutlined, MinusCircleOutlined, SendOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface Ticket {
    id: string;
    ma_ba: string;
    ten_loi: string;
    ma_khoa: string;
    status: string;
    assigneeId: string | null;
    assigneeName: string;
    transferToId?: string | null;
    transferToName?: string | null;
    dynamicFields: any;
    it_note: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ITUser {
    id: string;
    username: string;
    name: string;
    isAvailable: boolean;
}

import { getBasePath } from '@/utils/config';

const TicketImage = ({ url }: { url: string }) => {
    const [hasError, setHasError] = useState(false);

    if (hasError) {
        return (
            <div className="w-[40px] h-[40px] flex items-center justify-center bg-slate-50 border border-dashed border-red-300 rounded overflow-hidden p-0.5">
                <span className="text-[8px] text-red-500 font-medium text-center leading-[1.1]">Ảnh đã<br/>xoá</span>
            </div>
        );
    }

    const fullUrl = url.startsWith('http') ? url : `${getBasePath()}${url}`;

    return (
        <AntImage 
            src={fullUrl} 
            width={40} 
            height={40} 
            className="object-cover rounded border border-slate-200 cursor-pointer"
            onError={() => setHasError(true)}
        />
    );
};

export default function ITRequestsPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [itUsers, setItUsers] = useState<ITUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [actionForm] = Form.useForm();
    const router = useRouter();

    const { user, hasPermission } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'CNTT';

    const [softwareErrors, setSoftwareErrors] = useState<string[]>([]);
    const [hardwareErrors, setHardwareErrors] = useState<string[]>([]);
    const [allStaffs, setAllStaffs] = useState<any[]>([]);
    const [departments, setDepartments] = useState<any[]>([]);
    const [departmentStaff, setDepartmentStaff] = useState<any[]>([]);
    const [assignmentMode, setAssignmentMode] = useState<string>('A');
    const [filterMode, setFilterMode] = useState<'ALL' | 'MINE' | 'UNASSIGNED'>('MINE');
    const [isAvailable, setIsAvailable] = useState<boolean>(false);
    const [togglingAvailability, setTogglingAvailability] = useState(false);

    const handleToggleAvailability = async (checked: boolean) => {
        if (!user) return;
        setTogglingAvailability(true);
        try {
            const res = await fetch('/api/error-management/duty-roster', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    users: [{ id: user.id, isAvailable: checked }]
                })
            });
            if (res.ok) {
                setIsAvailable(checked);
                message.success(`Đã ${checked ? 'Bật' : 'Tắt'} trạng thái nhận việc tự động!`);
                fetchITUsers();
            } else {
                message.error('Lỗi khi cập nhật trạng thái');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        } finally {
            setTogglingAvailability(false);
        }
    };

    const filteredTickets = useMemo(() => {
        if (!isAdmin) return tickets;
        if (filterMode === 'MINE') return tickets.filter(t => t.assigneeId === user?.id || t.transferToId === user?.id);
        if (filterMode === 'UNASSIGNED') return tickets.filter(t => !t.assigneeId);
        return tickets;
    }, [tickets, filterMode, isAdmin, user]);

    useEffect(() => {
        const initData = async () => {
            try {
                fetchTickets();
                fetchITUsers();
                fetchConfiguredFields();
                fetchStaffs();
                fetchDepartments();
            } catch (e) {
                console.error(e);
            }
        };
        initData();
    }, []);


    const fetchConfiguredFields = async () => {
        try {
            const res = await fetch('/api/error-management/it-request-config');
            if (res.ok) {
                const configData = await res.json();
                setSoftwareErrors(configData.softwareErrors || []);
                setHardwareErrors(configData.hardwareErrors || [
                    'Máy tính không lên',
                    'Hết mực in / Kẹt giấy',
                    'Mất mạng Internet',
                    'Lỗi bàn phím / Chuột',
                    'Khác'
                ]);
                setAssignmentMode(configData.assignmentMode || 'A');
            }
        } catch (error) {
            console.error('Failed to fetch config', error);
        }
    };

    const fetchDepartments = async () => {
        try {
            const res = await fetch('/api/departments');
            if (res.ok) {
                const data = await res.json();
                setDepartments(data);
            }
        } catch (error) {
            console.error('Failed to fetch departments', error);
        }
    };

    const fetchStaffs = async () => {
        try {
            const res = await fetch('/api/staff');
            if (res.ok) {
                const data = await res.json();
                setAllStaffs(data);
                // Lọc danh sách nhân viên theo Khoa nếu user là KHOA
                if (user && user.role === 'KHOA') {
                    setDepartmentStaff(data.filter((s: any) => s.ma_khoa === user.ma_khoa));
                } else {
                    setDepartmentStaff(data);
                }
            }
        } catch (error) {
            console.error('Failed to fetch staffs', error);
        }
    };

    // Hàm phát âm thanh thông báo
    const playNotificationSound = () => {
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // Nốt C5
            oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // Nốt E5
            
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.error('Audio play failed', e);
        }
    };

    // Polling cho Web Notification (chỉ chạy nếu là CNTT/ADMIN)
    const [lastUnassignedCount, setLastUnassignedCount] = useState<number>(0);
    const [lastMyTicketCount, setLastMyTicketCount] = useState<number>(0);
    useEffect(() => {
        const interval = setInterval(() => {
            fetchTickets(true);
        }, 15000); // 15 giây check 1 lần
        return () => clearInterval(interval);
    }, [lastUnassignedCount, lastMyTicketCount]);

    const fetchTickets = async (isPolling = false) => {
        if (!isPolling) setLoading(true);
        try {
            const res = await fetch('/api/error-management/it-requests');
            if (res.ok) {
                const data = await res.json();
                setTickets(data);
                const unassignedTickets = data.filter((t: any) => !t.assigneeId && t.status === 'PENDING');
                const myTickets = data.filter((t: any) => (t.assigneeId === user?.id || t.transferToId === user?.id) && t.status !== 'RESOLVED');
                
                // Cảnh báo chung khi có Phiếu "VÔ CHỦ" (Áp dụng cho Cách A)
                if (isPolling && unassignedTickets.length > lastUnassignedCount && lastUnassignedCount !== 0) {
                    if (isAdmin) {
                        playNotificationSound();
                        notification.info({
                            title: 'Có lỗi mới chờ tiếp nhận!',
                            description: 'Có một lỗi mới vừa được gửi lên chưa có người xử lý.',
                            placement: 'bottomRight',
                        });
                    }
                }

                // Cảnh báo RIÊNG khi CÓ VIỆC VỪA ĐƯỢC GIAO CHO CHÍNH MÌNH (Áp dụng cho Cách B, C)
                if (isPolling && myTickets.length > lastMyTicketCount && lastMyTicketCount !== 0) {
                    playNotificationSound();
                    notification.success({
                        title: 'Việc mới được phân công!',
                        description: 'Bạn vừa nhận được một yêu cầu hỗ trợ mới, vui lòng kiểm tra.',
                        placement: 'bottomRight',
                    });
                }

                setLastUnassignedCount(unassignedTickets.length);
                setLastMyTicketCount(myTickets.length);
            }
        } catch (error) {
            if (!isPolling) message.error('Lỗi khi tải dữ liệu');
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    const fetchITUsers = async () => {
        try {
            const res = await fetch('/api/error-management/duty-roster');
            if (res.ok) {
                const data = await res.json();
                // Chỉ lấy những người đang rảnh (isAvailable = true)
                setItUsers(data.filter((u: ITUser) => u.isAvailable));
                if (user) {
                    const me = data.find((u: ITUser) => u.id === user.id);
                    if (me) setIsAvailable(me.isAvailable);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };



    const handleUpdateTicket = async (values: any) => {
        if (!selectedTicket) return;
        try {
            let payload: any = {
                id: selectedTicket.id,
                status: values.status,
                it_note: values.it_note,
                assigneeId: values.assigneeId || null
            };

            // Nếu thay đổi người xử lý trong khi đã có người xử lý thì đó là chuyển giao (Transfer)
            if (selectedTicket.assigneeId && values.assigneeId && values.assigneeId !== selectedTicket.assigneeId) {
                payload = {
                    id: selectedTicket.id,
                    action: 'TRANSFER',
                    transferToId: values.assigneeId,
                    it_note: values.it_note,
                };
            }

            const res = await fetch('/api/error-management/it-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                message.success('Cập nhật thành công!');
                setIsActionModalVisible(false);
                fetchTickets();
            } else {
                message.error('Cập nhật thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const handleDeleteTicket = async (id: string) => {
        try {
            const res = await fetch(`/api/error-management/it-requests?id=${id}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                message.success('Xóa yêu cầu thành công!');
                fetchTickets();
            } else {
                const err = await res.json();
                message.error(err.error || 'Xóa yêu cầu thất bại');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    const columns = [
        {
            title: 'Mã BA',
            dataIndex: 'ma_ba',
            key: 'ma_ba',
            width: 120,
            render: (text: string) => <span className="font-bold text-blue-600">{text}</span>
        },
        {
            title: 'Lỗi yêu cầu',
            dataIndex: 'ten_loi',
            key: 'ten_loi',
            width: 250,
            render: (text: string, record: Ticket) => (
                <div>
                    <div className="font-medium">{text}</div>
                    {/* Hiển thị các dynamic fields dạng tags */}
                    {record.dynamicFields && Object.keys(record.dynamicFields).length > 0 && (
                        <div className="mt-1 flex flex-col gap-2">
                            <div className="flex flex-wrap gap-1">
                                {Object.entries(record.dynamicFields).filter(([k]) => k !== 'Hình ảnh đính kèm').map(([k, v]) => (
                                    <Tag key={k} className="text-xs"><b>{k}:</b> {v as string}</Tag>
                                ))}
                            </div>
                            {record.dynamicFields['Hình ảnh đính kèm'] && Array.isArray(record.dynamicFields['Hình ảnh đính kèm']) && (
                                <div className="flex flex-wrap gap-2 mt-1">
                                    <AntImage.PreviewGroup>
                                        {record.dynamicFields['Hình ảnh đính kèm'].map((url: string, idx: number) => (
                                            <TicketImage key={idx} url={url} />
                                        ))}
                                    </AntImage.PreviewGroup>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Khoa gửi',
            dataIndex: 'ma_khoa',
            key: 'ma_khoa',
            width: 120,
        },
        {
            title: 'Tên khoa',
            key: 'ten_khoa',
            width: 200,
            render: (_: any, record: Ticket) => {
                const dept = departments.find(d => d.ma_khoa === record.ma_khoa);
                return <span className="text-slate-600 font-medium">{dept?.ten_khoa || ''}</span>;
            }
        },
        {
            title: 'Người xử lý',
            key: 'assigneeName',
            width: 170,
            render: (_: any, record: Ticket) => {
                if (record.status === 'TRANSFERRING' && record.transferToName) {
                    return <Tag color="warning" className="whitespace-normal leading-tight py-1">{record.assigneeName} ➜ {record.transferToName}</Tag>
                }
                return <Tag color="purple">{record.assigneeName}</Tag>
            }
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status: string) => {
                let color = 'default';
                let label = 'Chờ xử lý';
                if (status === 'IN_PROGRESS') { color = 'blue'; label = 'Đang xử lý'; }
                if (status === 'RESOLVED') { color = 'success'; label = 'Hoàn thành'; }
                if (status === 'TRANSFERRING') { color = 'warning'; label = 'Chờ chuyển giao'; }
                return <Tag color={color}>{label}</Tag>;
            }
        },
        {
            title: 'Phản hồi CNTT',
            dataIndex: 'it_note',
            key: 'it_note',
            render: (text: string) => <div className="text-slate-600 italic whitespace-pre-wrap">{text || '-'}</div>
        },
        {
            title: 'Thời gian',
            key: 'time',
            width: 170,
            render: (_: any, record: Ticket) => {
                const created = dayjs(record.createdAt);
                if (record.status === 'RESOLVED' && record.updatedAt) {
                    const resolved = dayjs(record.updatedAt);
                    const diffMins = resolved.diff(created, 'minute');
                    const kpiText = diffMins > 60 
                        ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m` 
                        : `${diffMins} phút`;
                    
                    return (
                        <div className="text-xs">
                            <div className="text-slate-500">Tạo: {created.format('DD/MM HH:mm')}</div>
                            <div className="text-green-600 font-medium mt-1">Xong: {resolved.format('DD/MM HH:mm')}</div>
                            <Tag color="green" className="mt-1">KPI: {kpiText}</Tag>
                        </div>
                    );
                }
                return <div className="text-slate-500">{created.format('DD/MM/YYYY HH:mm')}</div>;
            }
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 200,
            render: (_: any, record: any) => {
                return (
                    <Space>
                        {/* Nút Nhận việc cho Chế độ A */}
                        {hasPermission('MENU_ERROR_REQUESTS', 'EDIT') && assignmentMode === 'A' && !record.assigneeId && (
                            <Button 
                                size="small" 
                                type="primary" 
                                className="bg-green-600 hover:bg-green-500"
                                onClick={async () => {
                                    try {
                                        const res = await fetch('/api/error-management/it-requests', {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                id: record.id,
                                                assigneeId: user?.id,
                                                status: 'IN_PROGRESS'
                                            })
                                        });
                                        if (res.ok) {
                                            message.success('Đã nhận việc!');
                                            fetchTickets();
                                        }
                                    } catch (err) {
                                        message.error('Lỗi nhận việc');
                                    }
                                }}
                            >
                                Nhận việc
                            </Button>
                        )}

                        {/* Nút Xử lý chuyển giao */}
                        {record.status === 'TRANSFERRING' && record.transferToId === user?.id && (
                            <>
                                <Button 
                                    size="small" 
                                    type="primary" 
                                    className="bg-green-600 hover:bg-green-500"
                                    onClick={async () => {
                                        const res = await fetch('/api/error-management/it-requests', {
                                            method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id: record.id, action: 'ACCEPT_TRANSFER' })
                                        });
                                        if (res.ok) {
                                            message.success('Đã nhận chuyển giao!');
                                            fetchTickets();
                                        }
                                    }}
                                >
                                    Đồng ý
                                </Button>
                                <Button 
                                    size="small" 
                                    danger
                                    onClick={async () => {
                                        const res = await fetch('/api/error-management/it-requests', {
                                            method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ id: record.id, action: 'REJECT_TRANSFER' })
                                        });
                                        if (res.ok) {
                                            message.info('Đã từ chối chuyển giao');
                                            fetchTickets();
                                        }
                                    }}
                                >
                                    Từ chối
                                </Button>
                            </>
                        )}
                        
                        {hasPermission('MENU_ERROR_REQUESTS', 'EDIT') && (user?.role === 'ADMIN' || user?.role === 'CNTT') && (
                            <Button size="small" type="primary" ghost onClick={() => {
                                setSelectedTicket(record);
                                actionForm.setFieldsValue({
                                    status: record.status,
                                    it_note: record.it_note,
                                    assigneeId: record.assigneeId
                                });
                                setIsActionModalVisible(true);
                            }}>Xử lý</Button>
                        )}

                        {hasPermission('MENU_ERROR_REQUESTS', 'DELETE') && (
                            <Popconfirm 
                                title="Xóa yêu cầu?" 
                                description="Bạn có chắc chắn muốn xóa yêu cầu này không?"
                                onConfirm={() => handleDeleteTicket(record.id)}
                                disabled={record.status !== 'PENDING'}
                                okText="Xóa"
                                cancelText="Hủy"
                            >
                                <Button 
                                    size="small" 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    disabled={record.status !== 'PENDING'}
                                    title={record.status !== 'PENDING' ? 'Chỉ có thể xóa yêu cầu đang Chờ xử lý' : ''}
                                />
                            </Popconfirm>
                        )}
                    </Space>
                );
            }
        }
    ];


    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-[30px] py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
                        <BugOutlined />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 mb-1 leading-tight">Yêu cầu xử lý của khoa phòng</h1>
                        <p className="text-sm sm:text-base text-slate-500 m-0">Quản lý các ticket hỗ trợ gửi lên phòng CNTT</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center mt-4 sm:mt-0">
                    {user?.role === 'CNTT' && (
                        <div className="flex items-center justify-between sm:justify-start gap-2 bg-slate-50 px-4 py-2 sm:px-3 sm:py-1.5 rounded-xl sm:rounded-lg border border-slate-200 w-full sm:w-auto">
                            <span className="text-sm font-medium text-slate-600">Trạng thái Nhận việc:</span>
                            <Switch 
                                checked={isAvailable}
                                loading={togglingAvailability}
                                onChange={handleToggleAvailability}
                                checkedChildren="Bật"
                                unCheckedChildren="Tắt"
                            />
                        </div>
                    )}
                    {user?.role === 'ADMIN' && (
                        <Link href="/error-management/config" className="w-full sm:w-auto">
                            <Button 
                                type="default" 
                                size="large" 
                                icon={<SettingOutlined />} 
                                className="w-full text-slate-600 border-slate-200 hover:text-blue-600 hover:border-blue-400"
                            >
                                Cấu hình Lỗi phần mềm
                            </Button>
                        </Link>
                    )}
                    <Button className="w-full sm:w-auto" type="primary" size="large" icon={<PlusOutlined />} onClick={() => {
                        router.push('/error-management/it-requests/create');
                    }}>
                        Tạo Yêu Cầu
                    </Button>
                </div>
            </div>

            {isAdmin && (
                <div className="flex bg-white p-1 sm:p-2 rounded-xl border border-slate-100 shadow-sm w-full sm:w-fit overflow-x-auto scrollbar-hide">
                    <Segmented 
                        className="w-full sm:w-auto min-w-max"
                        options={[
                            { label: 'Tất cả Yêu cầu', value: 'ALL' },
                            { label: 'Việc của tôi', value: 'MINE' },
                            ...(assignmentMode !== 'C' ? [{ label: 'Chờ nhận việc (Trống)', value: 'UNASSIGNED' }] : [])
                        ]}
                        value={filterMode}
                        onChange={(val: any) => setFilterMode(val)}
                    />
                </div>
            )}

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <Table 
                    dataSource={filteredTickets} 
                    columns={columns}
                    rowKey="id" 
                    loading={loading}
                    pagination={{ defaultPageSize: 10 }}
                    scroll={{ x: 1000 }}
                    rowClassName={(record) => record.status === 'RESOLVED' ? 'bg-green-50/50' : ''}
                />
            </Card>


            {/* Modal Xử lý (dành cho CNTT / Cập nhật trạng thái) */}
            <Modal
                title="Xử lý Yêu cầu"
                open={isActionModalVisible}
                onCancel={() => setIsActionModalVisible(false)}
                onOk={() => actionForm.submit()}
                okText="Lưu cập nhật"
                cancelText="Hủy"
            >
                <Form form={actionForm} layout="vertical" onFinish={handleUpdateTicket}>
                    <Form.Item name="status" label="Trạng thái">
                        <Select>
                            <Select.Option value="PENDING">Chờ xử lý</Select.Option>
                            <Select.Option value="IN_PROGRESS">Đang xử lý</Select.Option>
                            <Select.Option value="RESOLVED">Hoàn thành</Select.Option>
                        </Select>
                    </Form.Item>
                    {/* Admins có thể chuyển assign */}
                    <Form.Item name="assigneeId" label="Người xử lý" extra="Nếu bạn chọn người khác, phiếu sẽ vào trạng thái Chờ chuyển giao cho đến khi người đó xác nhận.">
                        <Select allowClear>
                            {itUsers.map(u => (
                                <Select.Option key={u.id} value={u.id}>{u.name || u.username}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    
                    <Form.Item 
                        name="it_note" 
                        label="Ghi chú / Phản hồi (Cách xử lý)"
                    >
                        <Input.TextArea rows={4} placeholder="Nhập phản hồi lại cho khoa..." />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal Cấu hình Trường phụ (Chỉ Admin) */}
        </div>
    );
}

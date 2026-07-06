import React from 'react';
import { Table, Button, Tag, Space, Popconfirm, message, Image as AntImage } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { TicketImage } from '@/components/shared/TicketImage';
import { Ticket } from '../types';

interface TicketTableProps {
    tickets: Ticket[];
    loading: boolean;
    departments: any[];
    user: any;
    hasPermission: (menuCode: string, action?: 'VIEW' | 'EDIT' | 'DELETE') => boolean;
    assignmentMode: string;
    onFetchTickets: () => void;
    onDeleteTicket: (id: string) => void;
    onProcessClick: (ticket: Ticket) => void;
    onEditClick?: (ticket: Ticket) => void;
    targetDepartment?: string;
}

export const TicketTable: React.FC<TicketTableProps> = ({
    tickets,
    loading,
    departments,
    user,
    hasPermission,
    assignmentMode,
    onFetchTickets,
    onDeleteTicket,
    onProcessClick,
    onEditClick,
    targetDepartment = 'CNTT'
}) => {
    
    const handleReceiveTicket = async (id: string) => {
        try {
            const res = await fetch('/api/error-management/it-requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    assigneeId: user?.id,
                    status: 'IN_PROGRESS'
                })
            });
            if (res.ok) {
                message.success('Đã nhận việc!');
                onFetchTickets();
            }
        } catch (err) {
            message.error('Lỗi nhận việc');
        }
    };

    const handleTransferResponse = async (id: string, action: 'ACCEPT_TRANSFER' | 'REJECT_TRANSFER') => {
        const res = await fetch('/api/error-management/it-requests', {
            method: 'PUT', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action })
        });
        if (res.ok) {
            message.success(action === 'ACCEPT_TRANSFER' ? 'Đã nhận chuyển giao!' : 'Đã từ chối chuyển giao');
            onFetchTickets();
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
            title: targetDepartment === 'CNTT' ? 'Phản hồi CNTT' : `Phản hồi ${targetDepartment}`,
            dataIndex: 'it_note',
            key: 'it_note',
            width: 300,
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
            width: 130,
            render: (_: any, record: Ticket) => {
                return (
                    <Space>
                        {hasPermission('MENU_ERROR_REQUESTS', 'EDIT') && assignmentMode === 'A' && !record.assigneeId && (
                            <Button 
                                size="small" 
                                type="primary" 
                                className="bg-green-600 hover:bg-green-500"
                                onClick={() => handleReceiveTicket(record.id)}
                            >
                                Nhận việc
                            </Button>
                        )}

                        {record.status === 'TRANSFERRING' && record.transferToId === user?.id && (
                            <>
                                <Button 
                                    size="small" 
                                    type="primary" 
                                    className="bg-green-600 hover:bg-green-500"
                                    onClick={() => handleTransferResponse(record.id, 'ACCEPT_TRANSFER')}
                                >
                                    Đồng ý
                                </Button>
                                <Button 
                                    size="small" 
                                    danger
                                    onClick={() => handleTransferResponse(record.id, 'REJECT_TRANSFER')}
                                >
                                    Từ chối
                                </Button>
                            </>
                        )}
                        
                        {hasPermission('MENU_ERROR_REQUESTS', 'EDIT') && (user?.role === 'ADMIN' || user?.role === targetDepartment) && (
                            <Button size="small" type="primary" ghost onClick={() => onProcessClick(record)}>Xử lý</Button>
                        )}

                        {hasPermission('MENU_ERROR_REQUESTS', 'DELETE') && (
                            <Space size="small">
                                {record.status === 'PENDING' && onEditClick && (
                                    <Button 
                                        size="small" 
                                        type="primary" 
                                        className="bg-blue-600 hover:bg-blue-500"
                                        onClick={() => onEditClick(record)}
                                    >
                                        Sửa
                                    </Button>
                                )}
                                <Popconfirm 
                                    title="Xóa yêu cầu?" 
                                    description="Bạn có chắc chắn muốn xóa yêu cầu này không?"
                                    onConfirm={() => onDeleteTicket(record.id)}
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
                            </Space>
                        )}
                    </Space>
                );
            }
        }
    ];

    return (
        <Table 
            dataSource={tickets} 
            columns={columns}
            rowKey="id" 
            loading={loading}
            pagination={{ defaultPageSize: 10 }}
            scroll={{ x: 1000 }}
            rowClassName={(record) => record.status === 'RESOLVED' ? 'bg-green-50/50' : ''}
        />
    );
};

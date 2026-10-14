'use client';

import React, { useState } from 'react';
import { Table, Button, Tag, Space, Popconfirm, message, Image as AntImage, Badge } from 'antd';
import { DeleteOutlined, FileTextOutlined, MessageOutlined } from '@ant-design/icons';
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
    onReceiveTicket?: (id: string) => Promise<void>;
    onProcessClick: (ticket: Ticket) => void;
    onEditClick?: (ticket: Ticket) => void;
    onChatClick?: (ticket: Ticket) => void;
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
    onReceiveTicket,
    onProcessClick,
    onEditClick,
    onChatClick,
    targetDepartment = 'CNTT'
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    
    const handleReceiveTicket = async (id: string) => {
        if (onReceiveTicket) {
            await onReceiveTicket(id);
            return;
        }
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
            title: 'STT',
            key: 'stt',
            width: 65,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => (
                <span className="text-slate-500 font-medium font-mono text-[13px]">
                    {(currentPage - 1) * pageSize + index + 1}
                </span>
            )
        },
        {
            title: 'Lỗi yêu cầu',
            dataIndex: 'ten_loi',
            key: 'ten_loi',
            width: 250,
            render: (text: string, record: Ticket) => {
                const hasDetails = !!record.ma_ba || (record.dynamicFields && Object.keys(record.dynamicFields).length > 0);
                return (
                    <div>
                        <div className="font-medium text-slate-800">{text}</div>
                        {hasDetails && (
                            <div className="mt-1.5 flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {record.ma_ba && (
                                        <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50/90 border border-blue-200 rounded px-2 py-0.5 inline-flex items-center gap-1 shadow-2xs">
                                            📄 Mã BA: {record.ma_ba}
                                        </span>
                                    )}
                                    {record.dynamicFields && Object.keys(record.dynamicFields).length > 0 &&
                                        Object.entries(record.dynamicFields).filter(([k]) => k !== 'Hình ảnh đính kèm').map(([k, v]) => {
                                            if (k === 'SĐT') {
                                                return <div key={k} className="text-sm text-red-600 font-bold bg-red-50 border border-red-200 rounded px-2 py-0.5 w-fit">SĐT: {v as string}</div>;
                                            }
                                            return <Tag key={k} className="text-xs"><b>{k}:</b> {v as string}</Tag>;
                                        })
                                    }
                                </div>
                                {record.dynamicFields?.['Hình ảnh đính kèm'] && Array.isArray(record.dynamicFields['Hình ảnh đính kèm']) && (
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
                );
            }
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
                return (
                    <div className="flex flex-col items-start gap-1">
                        <Tag color="purple">{record.assigneeName}</Tag>
                        {record.assigneePhone && (
                            <div className="text-[11px] font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-sm">
                                📞 {record.assigneePhone}
                            </div>
                        )}
                    </div>
                );
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
            width: 110,
            fixed: 'right' as const,
            align: 'center' as const,
            onCell: () => ({
                style: { paddingLeft: 6, paddingRight: 6 }
            }),
            onHeaderCell: () => ({
                style: { paddingLeft: 6, paddingRight: 6 }
            }),
            render: (_: any, record: Ticket) => {
                const canReceive = hasPermission('MENU_ERROR_REQUESTS', 'EDIT') && (
                    (assignmentMode === 'A' && !record.assigneeId) ||
                    (record.assigneeId === user?.id && record.status === 'PENDING')
                );
                const isTransferringToMe = record.status === 'TRANSFERRING' && record.transferToId === user?.id;

                return (
                    <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                        {/* Hàng trên: Nhận việc hoặc Đồng ý/Từ chối chuyển giao */}
                        {(canReceive || isTransferringToMe) && (
                            <div className="w-full flex justify-center">
                                {canReceive && (
                                    <Button 
                                        size="small" 
                                        type="primary" 
                                        className="bg-green-600 hover:bg-green-500 whitespace-nowrap font-medium text-xs px-2.5"
                                        onClick={() => handleReceiveTicket(record.id)}
                                    >
                                        Nhận việc
                                    </Button>
                                )}

                                {isTransferringToMe && (
                                    <div className="flex items-center justify-center gap-1 w-full">
                                        <Button 
                                            size="small" 
                                            type="primary" 
                                            className="bg-green-600 hover:bg-green-500 whitespace-nowrap text-xs px-2"
                                            onClick={() => handleTransferResponse(record.id, 'ACCEPT_TRANSFER')}
                                        >
                                            Đồng ý
                                        </Button>
                                        <Button 
                                            size="small" 
                                            danger
                                            className="whitespace-nowrap text-xs px-2"
                                            onClick={() => handleTransferResponse(record.id, 'REJECT_TRANSFER')}
                                        >
                                            Từ chối
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Hàng dưới: Xử lý, Thảo luận, XML, Sửa, Xóa */}
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                            {record.ma_ba && record.hasXml && (
                                <Button 
                                    size="small" 
                                    type="default"
                                    icon={<FileTextOutlined />}
                                    title="Xem hồ sơ XML gốc"
                                    onClick={() => window.open(`/xml1-viewer?search=${record.ma_ba}`, '_blank')}
                                />
                            )}

                            {hasPermission('MENU_ERROR_REQUESTS', 'EDIT') && (user?.role === 'ADMIN' || user?.role === targetDepartment) && (
                                <Button size="small" type="primary" ghost className="whitespace-nowrap" onClick={() => onProcessClick(record)}>
                                    Xử lý
                                </Button>
                            )}
                            
                            {onChatClick && (
                                <Badge count={record.messageCount} size="small" offset={[-4, 4]}>
                                    <Button size="small" type="dashed" icon={<MessageOutlined />} title="Thảo luận" onClick={() => onChatClick(record)} />
                                </Badge>
                            )}

                            {hasPermission('MENU_ERROR_REQUESTS', 'DELETE') && (
                                <>
                                    {record.status === 'PENDING' && onEditClick && (
                                        <Button 
                                            size="small" 
                                            type="primary" 
                                            className="bg-blue-600 hover:bg-blue-500 whitespace-nowrap"
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
                                </>
                            )}
                        </div>
                    </div>
                );
            }
        }
    ];

    return (
        <Table 
            bordered
            dataSource={tickets} 
            columns={columns}
            rowKey="id" 
            loading={loading}
            pagination={{ 
                current: currentPage,
                pageSize: pageSize,
                defaultPageSize: 10,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                onChange: (page, size) => {
                    setCurrentPage(page);
                    setPageSize(size);
                }
            }}
            scroll={{ x: 1390 }}
            sticky
            rowClassName={(record) => record.status === 'RESOLVED' ? 'bg-green-50/50' : ''}
        />
    );
};

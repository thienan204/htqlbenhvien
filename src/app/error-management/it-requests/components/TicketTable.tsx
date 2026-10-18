'use client';

import React, { useState } from 'react';
import { Table, Button, Tag, Space, Popconfirm, message, Image as AntImage, Badge, Tooltip } from 'antd';
import { DeleteOutlined, FileTextOutlined, MessageOutlined, CheckCircleOutlined, LoadingOutlined, PaperClipOutlined, LinkOutlined, ShareAltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { TicketImage } from '@/components/shared/TicketImage';
import { Ticket } from '../types';
import { getBasePath } from '@/utils/config';
import { copyTicketShareLink, copyTicketZaloMessage } from '../utils/shareUtils';

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
    const [resolvingId, setResolvingId] = useState<string | null>(null);

    const handleQuickResolve = async (id: string) => {
        setResolvingId(id);
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: id,
                    status: 'RESOLVED'
                })
            });
            if (res.ok) {
                message.success('Đã chuyển trạng thái Hoàn thành thành công!');
                onFetchTickets();
            } else {
                const data = await res.json();
                message.error(data.error || 'Lỗi khi cập nhật hoàn thành');
            }
        } catch (err) {
            message.error('Lỗi kết nối khi cập nhật');
        } finally {
            setResolvingId(null);
        }
    };
    
    const handleReceiveTicket = async (id: string) => {
        if (onReceiveTicket) {
            await onReceiveTicket(id);
            return;
        }
        try {
            const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
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
        const res = await fetch(`${getBasePath()}/api/error-management/it-requests`, {
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
                        <div className="font-medium text-slate-800 flex items-center gap-1.5 flex-wrap">
                            {record.isFocusTask && (
                                <Tag color="purple" className="m-0 font-bold border-purple-300 bg-purple-50 text-purple-700 shadow-2xs">
                                    🎯 Nhiệm vụ tập trung
                                </Tag>
                            )}
                            <span>{text}</span>
                        </div>
                        {hasDetails && (
                            <div className="mt-1.5 flex flex-col gap-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {record.ma_ba && (() => {
                                        const isXmlTicket = Boolean(
                                            record.ten_loi?.includes('[Hỗ trợ Lỗi Hồ sơ]') ||
                                            record.dynamicFields?.['Loại lỗi']?.includes('Lỗi XML') ||
                                            record.dynamicFields?.['Loại lỗi']?.includes('Lỗi Chuyên đề') ||
                                            record.dynamicFields?.['Mã LK']
                                        );
                                        return (
                                            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50/90 border border-blue-200 rounded px-2 py-0.5 inline-flex items-center gap-1 shadow-2xs">
                                                📄 {isXmlTicket ? 'Mã LK' : 'Mã BA'}: {record.ma_ba}
                                            </span>
                                        );
                                    })()}
                                    {record.dynamicFields && Object.keys(record.dynamicFields).length > 0 && (() => {
                                        const attachmentKeys = ['Hình ảnh đính kèm', 'Tệp đính kèm', 'File đính kèm', 'Tài liệu đính kèm', 'tệp đính kèm', 'hình ảnh đính kèm'];
                                        return Object.entries(record.dynamicFields)
                                            .filter(([k]) => !attachmentKeys.includes(k) && k !== 'Mã LK')
                                            .map(([k, v]) => {
                                                if (k === 'SĐT') {
                                                    return <div key={k} className="text-sm text-red-600 font-bold bg-red-50 border border-red-200 rounded px-2 py-0.5 w-fit">SĐT: {v as string}</div>;
                                                }
                                                return <Tag key={k} className="text-xs"><b>{k}:</b> {v as string}</Tag>;
                                            });
                                    })()}
                                </div>
                                {(() => {
                                    const attachmentKeys = ['Hình ảnh đính kèm', 'Tệp đính kèm', 'File đính kèm', 'Tài liệu đính kèm', 'tệp đính kèm', 'hình ảnh đính kèm'];
                                    const rawAttachments: string[] = [];
                                    if (record.dynamicFields && typeof record.dynamicFields === 'object') {
                                        attachmentKeys.forEach(k => {
                                            const val = record.dynamicFields[k];
                                            if (Array.isArray(val)) {
                                                rawAttachments.push(...val);
                                            } else if (typeof val === 'string' && val.startsWith('/uploads/')) {
                                                rawAttachments.push(val);
                                            }
                                        });
                                    }
                                    const attachments = Array.from(new Set(rawAttachments)).filter(Boolean);

                                    if (attachments.length === 0) return null;

                                    return (
                                        <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-slate-100">
                                            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                                <PaperClipOutlined className="text-blue-500" /> Tệp đính kèm ({attachments.length}):
                                            </span>
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                {attachments.map((url: string, idx: number) => (
                                                    <TicketImage key={idx} url={url} />
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
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
            width: 140,
            render: (status: string, record: Ticket) => {
                if (status === 'WAITING_VENDOR') {
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

                    const dept = departments.find(d => d.ma_khoa === record.ma_khoa);

                    return (
                        <div className="flex flex-col items-start gap-1">
                            <Tag color="orange" className="font-semibold m-0 flex items-center gap-1 border-amber-300">
                                🏢 Chờ đối tác
                            </Tag>
                            {record.vendorName && (
                                <span className="text-[11px] font-medium text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded leading-tight max-w-[150px] truncate" title={record.vendorName}>
                                    {record.vendorName}
                                </span>
                            )}
                            {record.vendorExpectedReturnAt ? (
                                isOverdue ? (
                                    <Tag color="error" className="text-[10px] m-0 font-bold border-red-300 animate-pulse">
                                        ⚠️ Quá hạn {overdueDays} ngày
                                    </Tag>
                                ) : (
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        Hẹn: {dayjs(record.vendorExpectedReturnAt).format('DD/MM/YYYY')}
                                    </span>
                                )
                            ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                    Chưa hẹn ngày
                                </span>
                            )}
                            <div className="flex items-center gap-1 mt-0.5">
                                <Tooltip title="Sao chép Link xem phiếu gửi đối tác">
                                    <Button
                                        size="small"
                                        type="text"
                                        className="h-5 px-1.5 text-[11px] text-slate-600 hover:text-blue-600 flex items-center gap-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded"
                                        icon={<LinkOutlined className="text-[10px]" />}
                                        onClick={() => copyTicketShareLink(record.id)}
                                    >
                                        Link
                                    </Button>
                                </Tooltip>
                                <Tooltip title="Sao chép tin nhắn Zalo kèm Link">
                                    <Button
                                        size="small"
                                        type="text"
                                        className="h-5 px-1.5 text-[11px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-0.5 border border-blue-200 rounded font-medium"
                                        icon={<ShareAltOutlined className="text-[10px]" />}
                                        onClick={() => copyTicketZaloMessage(record, { deptName: dept?.ten_khoa })}
                                    >
                                        Zalo
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>
                    );
                }

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
            render: (text: string, record: Ticket) => {
                const hasImages = Array.isArray(record.it_images) && record.it_images.length > 0;
                return (
                    <div className="space-y-1.5">
                        <div className="text-slate-600 italic whitespace-pre-wrap">{text || '-'}</div>
                        {hasImages && (
                            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                                <AntImage.PreviewGroup>
                                    {record.it_images!.map((url: string, idx: number) => (
                                        <TicketImage key={idx} url={url} />
                                    ))}
                                </AntImage.PreviewGroup>
                            </div>
                        )}
                    </div>
                );
            }
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
            width: 120,
            fixed: 'right' as const,
            align: 'center' as const,
            onCell: () => ({
                style: { paddingLeft: 6, paddingRight: 6 }
            }),
            onHeaderCell: () => ({
                style: { paddingLeft: 6, paddingRight: 6 }
            }),
            render: (_: any, record: Ticket) => {
                const isMyTask = Boolean(record.assigneeId) && record.assigneeId === user?.id;
                const canReceive = hasPermission('MENU_ERROR_REQUESTS', 'EDIT') && (
                    (assignmentMode === 'A' && !record.assigneeId) ||
                    (isMyTask && record.status === 'PENDING')
                );
                const isTransferringToMe = record.status === 'TRANSFERRING' && record.transferToId === user?.id;
                const canQuickResolve = record.status !== 'RESOLVED' && !canReceive && isMyTask;

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
                                <Badge count={record.unreadMessageCount || 0} size="small" offset={[-4, 4]}>
                                    <Button 
                                        size="small" 
                                        type="dashed" 
                                        icon={<MessageOutlined />} 
                                        title={record.unreadMessageCount ? `${record.unreadMessageCount} tin chưa đọc` : 'Thảo luận'} 
                                        onClick={() => onChatClick(record)} 
                                    />
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

                        {/* Nút Hoàn thành 1-Click (Nhiệm vụ của ai người đó mới được hoàn thành) */}
                        {canQuickResolve && (
                            <button
                                type="button"
                                disabled={resolvingId === record.id}
                                onClick={() => handleQuickResolve(record.id)}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-0.5 text-xs font-semibold rounded-full text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-300 hover:border-emerald-600 shadow-2xs hover:shadow transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 mt-1"
                                title="Xác nhận hoàn thành nhiệm vụ này"
                            >
                                {resolvingId === record.id ? (
                                    <LoadingOutlined className="text-xs animate-spin" />
                                ) : (
                                    <CheckCircleOutlined className="text-xs text-emerald-600 group-hover:text-white" />
                                )}
                                <span>Hoàn thành</span>
                            </button>
                        )}
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

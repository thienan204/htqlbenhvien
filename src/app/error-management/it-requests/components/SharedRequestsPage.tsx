'use client';

import React, { useState, useMemo } from 'react';
import { Card, Segmented, message, Select } from 'antd';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import { TicketHeader } from './TicketHeader';
import { TicketTable } from './TicketTable';
import { TicketActionModal } from './TicketActionModal';
import { EditTicketModal } from './EditTicketModal';
import { NotificationSettingsModal } from './NotificationSettingsModal';
import { useITMasterData } from '../hooks/useITMasterData';
import { useTickets } from '../hooks/useTickets';
import { Ticket } from '../types';

interface SharedRequestsPageProps {
    targetDepartment: string;
    createPath: string;
}

export function SharedRequestsPage({ targetDepartment, createPath }: SharedRequestsPageProps) {
    const router = useRouter();
    const { user, hasPermission } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === targetDepartment;

    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [filterMode, setFilterMode] = useState<'ALL' | 'MINE' | 'UNASSIGNED'>('MINE');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [togglingAvailability, setTogglingAvailability] = useState(false);

    const {
        itUsers,
        departments,
        assignmentMode,
        isAvailable,
        setIsAvailable,
        fetchITUsers
    } = useITMasterData(user, targetDepartment);

    const {
        tickets,
        loading,
        fetchTickets,
        handleUpdateTicket,
        handleDeleteTicket
    } = useTickets(user, isAdmin, targetDepartment);

    const filteredTickets = useMemo(() => {
        let result = tickets;
        if (isAdmin) {
            if (filterMode === 'MINE') result = result.filter(t => t.assigneeId === user?.id || t.transferToId === user?.id);
            if (filterMode === 'UNASSIGNED') result = result.filter(t => !t.assigneeId);
        }
        if (statusFilter !== 'ALL') {
            result = result.filter(t => t.status === statusFilter);
        }
        return result;
    }, [tickets, filterMode, isAdmin, user, statusFilter]);

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

    const handleDeleteAllTickets = async () => {
        try {
            const res = await fetch(`/api/error-management/it-requests?action=delete_all&targetDepartment=${targetDepartment}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                message.success('Đã xóa toàn bộ dữ liệu thành công!');
                fetchTickets();
            } else {
                const data = await res.json();
                message.error(data.error || 'Lỗi khi xóa dữ liệu');
            }
        } catch (error) {
            message.error('Lỗi kết nối');
        }
    };

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-[30px] py-4 sm:py-6 space-y-4 sm:space-y-6">
            <TicketHeader 
                user={user}
                isAdmin={isAdmin}
                isAvailable={isAvailable}
                togglingAvailability={togglingAvailability}
                onToggleAvailability={handleToggleAvailability}
                onCreateRequest={() => router.push(createPath)}
                onOpenSettings={() => setIsSettingsVisible(true)}
                onDeleteAll={isAdmin ? handleDeleteAllTickets : undefined}
                targetDepartment={targetDepartment}
            />

            <div className="flex flex-col sm:flex-row gap-4 items-center">
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
                <div className="flex bg-white p-1 sm:p-2 rounded-xl border border-slate-100 shadow-sm w-full sm:w-fit">
                    <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        variant="borderless"
                        className="w-full sm:min-w-[180px]"
                        options={[
                            { value: 'ALL', label: 'Tất cả trạng thái' },
                            { value: 'PENDING', label: 'Chờ xử lý' },
                            { value: 'IN_PROGRESS', label: 'Đang xử lý' },
                            { value: 'TRANSFERRING', label: 'Chờ chuyển giao' },
                            { value: 'RESOLVED', label: 'Hoàn thành' }
                        ]}
                    />
                </div>
            </div>

            <Card className="shadow-sm rounded-2xl overflow-hidden border-slate-100" styles={{ body: { padding: 0 } }}>
                <TicketTable 
                    tickets={filteredTickets}
                    loading={loading}
                    departments={departments}
                    user={user}
                    hasPermission={hasPermission}
                    assignmentMode={assignmentMode}
                    onFetchTickets={fetchTickets}
                    onDeleteTicket={handleDeleteTicket}
                    onProcessClick={(ticket) => {
                        setSelectedTicket(ticket);
                        setIsActionModalVisible(true);
                    }}
                    onEditClick={(ticket) => {
                        setSelectedTicket(ticket);
                        setIsEditModalVisible(true);
                    }}
                    targetDepartment={targetDepartment}
                />
            </Card>

            <TicketActionModal 
                visible={isActionModalVisible}
                ticket={selectedTicket}
                itUsers={itUsers}
                user={user}
                onCancel={() => setIsActionModalVisible(false)}
                onOk={(values) => handleUpdateTicket(values, selectedTicket, () => setIsActionModalVisible(false))}
                targetDepartment={targetDepartment}
            />

            <EditTicketModal
                visible={isEditModalVisible}
                ticket={selectedTicket}
                onCancel={() => setIsEditModalVisible(false)}
                onSuccess={() => {
                    setIsEditModalVisible(false);
                    fetchTickets();
                }}
                targetDepartment={targetDepartment}
            />

            <NotificationSettingsModal 
                visible={isSettingsVisible}
                onCancel={() => setIsSettingsVisible(false)}
                targetDepartment={targetDepartment}
            />
        </div>
    );
}

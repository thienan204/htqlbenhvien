'use client';

import React, { useState, useMemo } from 'react';
import { Card, Segmented, message } from 'antd';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import { TicketHeader } from './components/TicketHeader';
import { TicketTable } from './components/TicketTable';
import { TicketActionModal } from './components/TicketActionModal';
import { useITMasterData } from './hooks/useITMasterData';
import { useTickets } from './hooks/useTickets';
import { Ticket } from './types';

export default function ITRequestsPage() {
    const router = useRouter();
    const { user, hasPermission } = useAuth();
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'CNTT';

    const [isActionModalVisible, setIsActionModalVisible] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [filterMode, setFilterMode] = useState<'ALL' | 'MINE' | 'UNASSIGNED'>('MINE');
    const [togglingAvailability, setTogglingAvailability] = useState(false);

    const {
        itUsers,
        departments,
        assignmentMode,
        isAvailable,
        setIsAvailable,
        fetchITUsers
    } = useITMasterData(user);

    const {
        tickets,
        loading,
        fetchTickets,
        handleUpdateTicket,
        handleDeleteTicket
    } = useTickets(user, isAdmin);

    const filteredTickets = useMemo(() => {
        if (!isAdmin) return tickets;
        if (filterMode === 'MINE') return tickets.filter(t => t.assigneeId === user?.id || t.transferToId === user?.id);
        if (filterMode === 'UNASSIGNED') return tickets.filter(t => !t.assigneeId);
        return tickets;
    }, [tickets, filterMode, isAdmin, user]);

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

    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-[30px] py-4 sm:py-6 space-y-4 sm:space-y-6">
            <TicketHeader 
                user={user}
                isAdmin={isAdmin}
                isAvailable={isAvailable}
                togglingAvailability={togglingAvailability}
                onToggleAvailability={handleToggleAvailability}
                onCreateRequest={() => router.push('/error-management/it-requests/create')}
            />

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
                />
            </Card>

            <TicketActionModal 
                visible={isActionModalVisible}
                ticket={selectedTicket}
                itUsers={itUsers}
                onCancel={() => setIsActionModalVisible(false)}
                onOk={(values) => handleUpdateTicket(values, selectedTicket, () => setIsActionModalVisible(false))}
            />
        </div>
    );
}

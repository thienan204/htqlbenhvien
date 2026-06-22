import React, { useEffect } from 'react';
import { Modal, Form, Select, Input } from 'antd';
import { Ticket, ITUser } from '../types';

interface TicketActionModalProps {
    visible: boolean;
    onCancel: () => void;
    onOk: (values: any) => void;
    ticket: Ticket | null;
    itUsers: ITUser[];
    user?: any;
}

export const TicketActionModal: React.FC<TicketActionModalProps> = ({
    visible,
    onCancel,
    onOk,
    ticket,
    itUsers,
    user
}) => {
    const [actionForm] = Form.useForm();

    const isManager = user?.isManager || user?.role === 'ADMIN';
    const isMyTicket = ticket?.assigneeId === user?.id;
    const isUnassigned = !ticket?.assigneeId;

    const canChangeAssignee = isManager || isMyTicket || isUnassigned;

    let availableUsers = itUsers;
    if (!isManager && isUnassigned) {
        // Nhân viên thường chỉ có thể tự nhận việc nếu phiếu chưa ai nhận
        availableUsers = itUsers.filter(u => u.id === user?.id);
    }

    useEffect(() => {
        if (visible && ticket) {
            actionForm.setFieldsValue({
                status: ticket.status,
                it_note: ticket.it_note,
                assigneeId: ticket.assigneeId
            });
        }
    }, [visible, ticket, actionForm]);

    const handleOk = () => {
        actionForm.submit();
    };

    return (
        <Modal
            title="Xử lý Yêu cầu"
            open={visible}
            onCancel={onCancel}
            onOk={handleOk}
            okText="Lưu cập nhật"
            cancelText="Hủy"
            destroyOnHidden
        >
            <Form form={actionForm} layout="vertical" onFinish={onOk}>
                <Form.Item name="status" label="Trạng thái">
                    <Select>
                        <Select.Option value="PENDING">Chờ xử lý</Select.Option>
                        <Select.Option value="IN_PROGRESS">Đang xử lý</Select.Option>
                        <Select.Option value="RESOLVED">Hoàn thành</Select.Option>
                    </Select>
                </Form.Item>
                {/* Phân quyền chọn Người xử lý */}
                <Form.Item name="assigneeId" label="Người xử lý" extra="Nếu bạn chọn người khác, phiếu sẽ vào trạng thái Chờ chuyển giao cho đến khi người đó xác nhận.">
                    <Select allowClear disabled={!canChangeAssignee}>
                        {availableUsers.map(u => (
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
    );
};

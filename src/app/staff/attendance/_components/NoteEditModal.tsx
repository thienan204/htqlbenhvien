'use client';

import React from 'react';
import { Modal, Input, Button } from 'antd';
import { EditOutlined, SaveOutlined } from '@ant-design/icons';
import { useAttendance } from '../AttendanceContext';

export const NoteEditModal: React.FC = () => {
    const {
        editingNoteStaff,
        setEditingNoteStaff,
        tempNoteText,
        setTempNoteText,
        isSavingNote,
        handleSaveNote
    } = useAttendance();

    if (!editingNoteStaff) return null;

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800">
                    <EditOutlined className="text-blue-600" />
                    <span>Ghi Chú Chấm Công Tháng - <b>{editingNoteStaff.ho_ten}</b> ({editingNoteStaff.ma_nv})</span>
                </div>
            }
            open={!!editingNoteStaff}
            onCancel={() => {
                setEditingNoteStaff(null);
                setTempNoteText('');
            }}
            footer={[
                <Button key="cancel" onClick={() => { setEditingNoteStaff(null); setTempNoteText(''); }}>
                    Hủy
                </Button>,
                <Button
                    key="save"
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={isSavingNote}
                    onClick={() => handleSaveNote(editingNoteStaff.staffId, tempNoteText)}
                    className="bg-blue-600 hover:bg-blue-500 font-medium"
                >
                    Lưu Ghi Chú (Enter)
                </Button>
            ]}
            destroyOnHidden
            centered
        >
            <div className="py-2">
                <p className="text-xs text-slate-500 mb-2">
                    Nội dung này tương ứng với cột <b>Ghi chú (Cột AK)</b> trên mẫu Bảng Chấm Công của bệnh viện (ví dụ: <i>60% 15 N</i>, <i>Chuyển khoa từ ngày 15</i>, <i>Tập sự</i>...):
                </p>
                <Input.TextArea
                    rows={4}
                    value={tempNoteText}
                    onChange={(e) => setTempNoteText(e.target.value)}
                    placeholder="Nhập ghi chú tháng cho cán bộ..."
                    maxLength={500}
                    showCount
                    autoFocus
                    onPressEnter={(e) => {
                        if (!e.shiftKey) {
                            e.preventDefault();
                            handleSaveNote(editingNoteStaff.staffId, tempNoteText);
                        }
                    }}
                />
            </div>
        </Modal>
    );
};

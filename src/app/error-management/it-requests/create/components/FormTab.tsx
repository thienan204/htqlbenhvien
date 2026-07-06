import React from 'react';
import { Form, Input, Select, Radio, Button, Card, Upload } from 'antd';
import { PictureOutlined, CameraOutlined } from '@ant-design/icons';

interface FormTabProps {
    form: any;
    handleCreateTicket: (values: any) => void;
    isAdmin: boolean;
    isManager: boolean;
    softwareErrors: string[];
    hardwareErrors: string[];
    departments: any[];
    departmentStaff: any[];
    setDepartmentStaff: (staff: any[]) => void;
    allStaffs: any[];
    itUsers: any[];
    user: any;
    setSavedStaffId: (id: string | null) => void;
    fileList: any[];
    uploadProps: any;
    loading: boolean;
    targetDepartment?: string;
}

export function FormTab({
    form,
    handleCreateTicket,
    isAdmin,
    isManager,
    softwareErrors,
    hardwareErrors,
    departments,
    departmentStaff,
    setDepartmentStaff,
    allStaffs,
    itUsers,
    user,
    setSavedStaffId,
    fileList,
    uploadProps,
    loading,
    targetDepartment = 'CNTT'
}: FormTabProps) {
    return (
        <Card className="shadow-sm rounded-b-2xl rounded-tr-2xl border-slate-200 border-t-0">
            <Form form={form} layout="vertical" onFinish={handleCreateTicket}>
                {targetDepartment === 'CNTT' ? (
                    <Form.Item name="category" noStyle>
                        <Radio.Group className="w-full mb-6 flex rounded-lg p-1 bg-slate-100" optionType="button" buttonStyle="solid">
                            <Radio.Button value="SOFTWARE" className="flex-1 text-center border-none shadow-none bg-transparent font-medium !text-[13px] sm:!text-[14px] h-auto min-h-[40px] flex items-center justify-center py-1">
                                Bệnh án
                            </Radio.Button>
                            <Radio.Button value="HARDWARE" className="flex-1 text-center border-none shadow-none bg-transparent font-medium !text-[13px] sm:!text-[14px] h-auto min-h-[40px] flex items-center justify-center py-1">
                                Thiết bị/Sửa chữa
                            </Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                ) : (
                    <Form.Item name="category" initialValue="HARDWARE" hidden><Input /></Form.Item>
                )}

                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
                    {({ getFieldValue }) => {
                        const isSoftware = targetDepartment === 'CNTT' ? getFieldValue('category') === 'SOFTWARE' : false;
                        return (
                            <>
                                {isSoftware && (
                                    <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 mb-6 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                            <Form.Item name="ma_ba" label={<span className="font-semibold">Mã Bệnh Án</span>} rules={[{ required: true, message: 'Vui lòng nhập mã bệnh án' }]} className="mb-0">
                                                <Input placeholder="Nhập mã BA" />
                                            </Form.Item>
                                            <Form.Item name="trang_thai_ba" label={<span className="font-semibold">Trạng thái bệnh án</span>} className="mb-0">
                                                <Radio.Group className="flex pt-2">
                                                    <Radio value="Đang điều trị">Đang điều trị</Radio>
                                                    <Radio value="Đã ra viện">Đã ra viện</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                        </div>
                                        
                                        <Form.Item name="ten_loi_software" label={<span className="font-semibold">Vấn đề cần hỗ trợ (Lỗi nghiệp vụ)</span>} rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập vấn đề' }]} className="mb-0">
                                            <Select mode="tags" placeholder="Chọn hoặc gõ thêm lỗi..." options={softwareErrors.map(e => ({ label: e, value: e }))} />
                                        </Form.Item>
                                    </div>
                                )}

                                {!isSoftware && (
                                    <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 mb-6">
                                        <Form.Item name="ten_loi_hardware" label={<span className="font-semibold">Vấn đề cần hỗ trợ (Sửa chữa)</span>} rules={[{ required: true, message: 'Vui lòng chọn sự cố' }]} className="mb-0">
                                            <Radio.Group className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
                                                {hardwareErrors.map((t: string) => (
                                                    <Radio.Button key={t} value={t} className="rounded-xl sm:rounded-full h-10 sm:h-auto flex items-center justify-center sm:inline-flex px-4 !text-[14px]">{t}</Radio.Button>
                                                ))}
                                            </Radio.Group>
                                        </Form.Item>
                                    </div>
                                )}

                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-6">
                                    <Form.Item name="ghi_chu" label={<span className="font-semibold">Ghi chú thêm / Mô tả chi tiết (Tuỳ chọn)</span>} className="mb-0">
                                        <Input.TextArea rows={3} placeholder="Mô tả cụ thể hoặc cho biết vị trí máy bị lỗi..." />
                                    </Form.Item>

                                    <Form.Item label={<span className="font-semibold">Đính kèm hình ảnh (Bắt lỗi màn hình, thiết bị)</span>} className="mb-0">
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <div className="hidden sm:block">
                                                <Upload {...uploadProps}>
                                                    {fileList.length >= 3 ? null : (
                                                        <div className="flex flex-col items-center justify-center text-slate-500">
                                                            <PictureOutlined className="text-2xl mb-1" />
                                                            <div className="text-xs">Tải ảnh lên</div>
                                                        </div>
                                                    )}
                                                </Upload>
                                            </div>
                                            
                                            {/* Giao diện Upload/Chụp ảnh cho Mobile */}
                                            <div className="sm:hidden flex flex-col gap-3">
                                                <div className="flex gap-2">
                                                    <div className="flex-1 relative overflow-hidden bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center p-3 cursor-pointer">
                                                        <PictureOutlined className="mr-2" /> <span>Thư viện</span>
                                                        <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                                            if(e.target.files && e.target.files.length > 0) {
                                                                const fileObj = e.target.files[0];
                                                                uploadProps.customRequest({ file: fileObj });
                                                            }
                                                            e.target.value = '';
                                                        }} />
                                                    </div>
                                                    <div className="flex-1 relative overflow-hidden bg-green-50 text-green-600 rounded-lg border border-green-200 hover:bg-green-100 transition-colors flex items-center justify-center p-3 cursor-pointer">
                                                        <CameraOutlined className="mr-2" /> <span>Chụp ảnh</span>
                                                        <input type="file" accept="image/*" capture="environment" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                                                            if(e.target.files && e.target.files.length > 0) {
                                                                const fileObj = e.target.files[0];
                                                                uploadProps.customRequest({ file: fileObj });
                                                            }
                                                            e.target.value = '';
                                                        }} />
                                                    </div>
                                                </div>
                                                {fileList.length > 0 && (
                                                    <Upload {...uploadProps} />
                                                )}
                                            </div>
                                        </div>
                                    </Form.Item>

                                    {isAdmin && (
                                        <Form.Item name="ma_khoa" label={<span className="font-semibold">Khoa phòng yêu cầu</span>} rules={[{ required: true, message: 'Vui lòng chọn khoa' }]} className="mb-0">
                                            <Select
                                                showSearch
                                                placeholder="Chọn khoa phòng"
                                                virtual={false}
                                                optionFilterProp="children"
                                                onChange={(val) => {
                                                    setDepartmentStaff(allStaffs.filter((s: any) => s.ma_khoa === val));
                                                    form.setFieldsValue({ nguoi_bao_id: undefined });
                                                }}
                                            >
                                                {departments.map((d: any) => (
                                                    <Select.Option key={d.ma_khoa} value={d.ma_khoa}>{d.ten_khoa}</Select.Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    )}

                                    <Form.Item name="nguoi_bao_id" label={<span className="font-semibold">{isAdmin ? "Người báo" : "Người báo"}</span>} rules={[{ required: true, message: 'Vui lòng chọn tên' }]} className="mb-0">
                                        <Select 
                                            showSearch 
                                            placeholder="Tìm tên nhân viên..." 
                                            virtual={false}
                                            disabled={!!user?.staffId && !isAdmin}
                                            optionFilterProp="children"
                                            onChange={(val) => {
                                                if (!user?.staffId || isAdmin) {
                                                    localStorage.setItem('last_it_request_staff_id', val);
                                                    setSavedStaffId(val);
                                                }
                                            }}
                                        >
                                            {departmentStaff.map((s: any) => (
                                                <Select.Option key={s.id} value={s.id}>
                                                    {s.ho_ten} {s.chuc_danh ? `(${s.chuc_danh})` : ''} {isAdmin ? `- ${s.department?.ten_khoa || s.ma_khoa}` : ''}
                                                </Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </div>
                                
                                {isManager && (
                                    <div className="mt-6 bg-purple-50/50 p-6 rounded-xl border border-purple-100">
                                        <div className="font-bold text-purple-800 mb-4 uppercase text-sm">Khu vực dành cho Quản lý / Trưởng phòng</div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <Form.Item name="assigneeId" label={<span className="font-semibold text-purple-700">Chỉ định người xử lý (Giao việc)</span>} className="mb-0">
                                                <Select placeholder="Để trống hệ thống tự chia việc" allowClear>
                                                    {itUsers.map((u: any) => (
                                                        <Select.Option key={u.id} value={u.id}>{u.name || u.username}</Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item name="ke_hoach" label={<span className="font-semibold text-purple-700">Kế hoạch / Chỉ đạo thực hiện</span>} className="mb-0">
                                                <Input.TextArea rows={2} placeholder="Nhập yêu cầu, thời hạn hoặc hướng dẫn xử lý..." />
                                            </Form.Item>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-8 flex justify-end">
                                    <Button type="primary" htmlType="submit" size="large" className="px-8 font-semibold bg-blue-600 hover:bg-blue-500" loading={loading}>
                                        Gửi Yêu Cầu Hỗ Trợ
                                    </Button>
                                </div>
                            </>
                        );
                    }}
                </Form.Item>
            </Form>
        </Card>
    );
}

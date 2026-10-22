import React, { useState, useRef, useEffect } from 'react';
import { Form, Input, Select, Radio, Button, Card, Upload, Switch, Alert, Tag, Segmented } from 'antd';
import { PictureOutlined, CameraOutlined, LoadingOutlined, FileTextOutlined, DesktopOutlined, AimOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { getBasePath } from '@/utils/config';
import { useCheckBa } from '../hooks/useCheckBa';
import { BaPaymentStatusAlert } from './BaPaymentStatusAlert';

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
    savedStaffId?: string | null;
    setSavedStaffId: (id: string | null) => void;
    fileList: any[];
    uploadProps: any;
    loading: boolean;
    targetDepartment?: string;
    maBaLength?: number;
    activeCategory?: 'SOFTWARE' | 'HARDWARE';
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
    savedStaffId,
    setSavedStaffId,
    fileList,
    uploadProps,
    loading,
    targetDepartment = 'CNTT',
    maBaLength = 11,
    activeCategory
}: FormTabProps) {
    const [inputMaBa, setInputMaBa] = useState<string>('');
    const { baCode, baInfo, hasPaymentRequest, isChecking, isFound, triggerCheck } = useCheckBa(inputMaBa);

    useEffect(() => {
        if (savedStaffId && !form.getFieldValue('nguoi_bao_id')) {
            form.setFieldsValue({ nguoi_bao_id: savedStaffId });
        }
    }, [savedStaffId]);

    // Tự động chuyển trạng thái "Đã ra viện" nếu hồ sơ đã có ngày ra viện
    useEffect(() => {
        if (baInfo && baInfo.ngayRa) {
            if (form.getFieldValue('trang_thai_ba') === 'Đang điều trị') {
                form.setFieldsValue({ trang_thai_ba: 'Đã ra viện' });
            }
        }
    }, [baInfo]);

    const normalizeString = (str: string) => {
        return (str || '')
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .toLowerCase()
            .trim();
    };

    const getInitials = (str: string) => {
        const normalized = normalizeString(str);
        return normalized.replace(/[^a-z0-9\s]/gi, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('');
    };

    const onMaBaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        // Tự động viết hoa 2 ký tự đầu 'ba' hoặc 'Ba' thành 'BA'
        if (/^ba/i.test(val)) {
            val = 'BA' + val.slice(2);
            form.setFieldsValue({ ma_ba: val });
        }
        setInputMaBa(val);
    };

    return (
        <Card className="shadow-sm rounded-b-2xl rounded-tr-2xl border-slate-200 border-t-0">
            <Form 
                form={form} 
                layout="vertical" 
                onFinish={(vals) => handleCreateTicket({ ...vals, category: activeCategory || vals.category || (targetDepartment === 'CNTT' ? 'SOFTWARE' : 'HARDWARE') })}
                initialValues={{ 
                    category: activeCategory || (targetDepartment === 'CNTT' ? 'SOFTWARE' : 'HARDWARE'),
                    trang_thai_ba: 'Đang điều trị',
                    nguoi_bao_id: savedStaffId || undefined,
                    selfAssign: false
                }}
            >
                <Form.Item name="category" hidden>
                    <Input />
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
                    {({ getFieldValue }) => {
                        const isSoftware = activeCategory ? activeCategory === 'SOFTWARE' : (targetDepartment === 'CNTT' ? getFieldValue('category') === 'SOFTWARE' : false);
                        const isITStaff = user?.role === targetDepartment || user?.role === 'ADMIN';
                        return (
                            <>
                                {isSoftware && (
                                    <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white p-5 sm:p-6 rounded-2xl border border-blue-200/80 shadow-xs mb-6 space-y-5">
                                        <div className="flex items-center justify-between pb-3 border-b border-blue-100/90">
                                            <div className="flex items-center gap-2 text-blue-900 font-bold text-sm tracking-wide uppercase">
                                                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></span>
                                                Thông tin Bệnh Án & Sự cố phần mềm
                                            </div>
                                            <span className="text-xs text-blue-700 font-medium bg-blue-100/80 px-2.5 py-0.5 rounded-full border border-blue-200/60">
                                                HIS / EMR / BHYT
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
                                            <div className="lg:col-span-4 sm:col-span-1">
                                                <Form.Item 
                                                    name="ma_ba" 
                                                    label={
                                                        <span className="font-semibold text-slate-800 flex items-center gap-2">
                                                            <FileTextOutlined className="text-blue-600" /> Mã Bệnh Án
                                                            {isChecking && <LoadingOutlined className="text-blue-500 text-xs ml-1" />}
                                                        </span>
                                                    } 
                                                    rules={[{ required: true, message: 'Vui lòng nhập mã bệnh án' }]} 
                                                    className="mb-0"
                                                >
                                                    <Input 
                                                        size="large"
                                                        placeholder="VD: BA001028282" 
                                                        maxLength={maBaLength || 11}
                                                        className="!rounded-xl font-mono text-[15px] font-semibold tracking-wide !h-11 border-slate-300 shadow-2xs"
                                                        onChange={onMaBaChange}
                                                        onBlur={(e) => triggerCheck(e.target.value)}
                                                        allowClear
                                                    />
                                                </Form.Item>
                                            </div>
                                            <div className="lg:col-span-4 sm:col-span-1">
                                                <Form.Item 
                                                    name="trang_thai_ba" 
                                                    label={<span className="font-semibold text-slate-800">Trạng thái bệnh án</span>} 
                                                    className="mb-0"
                                                >
                                                    <Segmented 
                                                        block
                                                        size="large"
                                                        className="w-full !h-11 p-1 bg-slate-200/80 rounded-xl font-medium text-[13px] border border-slate-200 flex items-center"
                                                        options={[
                                                            { label: '🏥 Đang điều trị', value: 'Đang điều trị' },
                                                            { label: '📋 Đã ra viện', value: 'Đã ra viện' }
                                                        ]}
                                                    />
                                                </Form.Item>
                                            </div>
                                        </div>

                                        <BaPaymentStatusAlert
                                            baCode={baCode || inputMaBa}
                                            baInfo={baInfo}
                                            hasPaymentRequest={hasPaymentRequest}
                                            isChecking={isChecking}
                                            isFound={isFound}
                                        />
                                        
                                        <Form.Item 
                                            name="ten_loi_software" 
                                            label={<span className="font-semibold text-slate-800">Vấn đề cần hỗ trợ (Lỗi nghiệp vụ)</span>} 
                                            rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập vấn đề' }]} 
                                            className="mb-0"
                                        >
                                            <Select 
                                                mode="tags" 
                                                size="large"
                                                className="!rounded-xl"
                                                placeholder="Chọn trong danh sách hoặc gõ thêm lỗi cần hỗ trợ..." 
                                                options={(softwareErrors || [])
                                                    .map((e: any) => typeof e === 'string' ? e : e?.name)
                                                    .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
                                                    .map(e => ({ label: e, value: e }))} 
                                            />
                                        </Form.Item>
                                    </div>
                                )}

                                {!isSoftware && (
                                    <div className="bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white p-5 sm:p-6 rounded-2xl border border-amber-200/80 shadow-xs mb-6 space-y-4">
                                        <div className="flex items-center justify-between pb-3 border-b border-amber-100/90">
                                            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm tracking-wide uppercase">
                                                <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
                                                Sự cố Thiết bị & Phần cứng
                                            </div>
                                            <span className="text-xs text-amber-800 font-medium bg-amber-100/80 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                                                Máy in / Máy tính / Mạng
                                            </span>
                                        </div>
                                        <Form.Item name="ten_loi_hardware" label={<span className="font-semibold text-slate-800">Chọn sự cố cần sửa chữa</span>} rules={[{ required: true, message: 'Vui lòng chọn sự cố' }]} className="mb-0">
                                            <Radio.Group className="!flex !flex-wrap gap-2 sm:gap-3 items-center">
                                                {(hardwareErrors || [])
                                                    .map((t: any) => typeof t === 'string' ? t : t?.name)
                                                    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
                                                    .map((t: string) => (
                                                    <Radio.Button 
                                                        key={t} 
                                                        value={t} 
                                                        className="!inline-flex !items-center !justify-center !rounded-xl !h-11 px-5 !text-[13px] font-medium transition-all shadow-2xs hover:border-amber-400"
                                                    >
                                                        {t}
                                                    </Radio.Button>
                                                ))}
                                            </Radio.Group>
                                        </Form.Item>
                                    </div>
                                )}

                                <div className="bg-gradient-to-br from-slate-50 to-slate-100/60 p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm tracking-wide uppercase">
                                            <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                                            Chi tiết yêu cầu & Thông tin người gửi
                                        </div>
                                    </div>

                                    <Form.Item name="ghi_chu" label={<span className="font-semibold text-slate-800">Ghi chú thêm / Mô tả chi tiết (Tuỳ chọn)</span>} className="mb-0">
                                        <Input.TextArea rows={3} className="!rounded-xl" placeholder="Mô tả cụ thể hoặc cho biết vị trí máy bị lỗi..." />
                                    </Form.Item>

                                    <Form.Item label={<span className="font-semibold text-slate-800">Đính kèm hình ảnh (Bắt lỗi màn hình, thiết bị)</span>} className="mb-0">
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                                        {isAdmin && (
                                            <Form.Item name="ma_khoa" label={<span className="font-semibold text-slate-800">Khoa phòng yêu cầu</span>} rules={[{ required: true, message: 'Vui lòng chọn khoa' }]} className="mb-0">
                                                <Select
                                                    showSearch
                                                    size="large"
                                                    className="!rounded-xl"
                                                    placeholder="Chọn khoa phòng (hoặc gõ tắt ví dụ: knth)"
                                                    virtual={false}
                                                    filterOption={(input, option) => {
                                                        if (!input) return true;
                                                        const search = normalizeString(input);
                                                        const label = String((option as any)?.searchtext || (option as any)?.children || '');
                                                        const normLabel = normalizeString(label);
                                                        const initials = getInitials(label);
                                                        return normLabel.includes(search) || initials.includes(search);
                                                    }}
                                                    onChange={(val) => {
                                                        setDepartmentStaff(allStaffs.filter((s: any) => s.ma_khoa === val));
                                                        form.setFieldsValue({ nguoi_bao_id: undefined });
                                                    }}
                                                >
                                                    {departments.map((d: any) => (
                                                        <Select.Option key={d.ma_khoa} value={d.ma_khoa} searchtext={d.ten_khoa}>
                                                            {d.ten_khoa}
                                                        </Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                        )}

                                        <Form.Item name="nguoi_bao_id" label={<span className="font-semibold text-slate-800">Người báo</span>} rules={[{ required: true, message: 'Vui lòng chọn tên' }]} className="mb-0">
                                            <Select 
                                                showSearch 
                                                size="large"
                                                className="!rounded-xl"
                                                placeholder="Tìm tên nhân viên (hoặc gõ tắt ví dụ: btq)..." 
                                                virtual={false}
                                                disabled={!!user?.staffId && !isAdmin && user?.role !== 'KHOA'}
                                                filterOption={(input, option) => {
                                                    if (!input) return true;
                                                    const search = normalizeString(input);
                                                    const optVal = String(option?.value || '').toLowerCase();
                                                    if (optVal === search || optVal.includes(search)) return true;

                                                    const fullText = String((option as any)?.searchtext || (option as any)?.children || '');
                                                    const staffName = String((option as any)?.staffname || '');
                                                    
                                                    const normFull = normalizeString(fullText);
                                                    if (normFull.includes(search)) return true;

                                                    const fullInitials = getInitials(fullText);
                                                    if (fullInitials.includes(search)) return true;

                                                    if (staffName) {
                                                        const nameInitials = getInitials(staffName);
                                                        if (nameInitials.includes(search)) return true;
                                                    }

                                                    return false;
                                                }}
                                                onChange={(val) => {
                                                    if (!user?.staffId || isAdmin || user?.role === 'KHOA') {
                                                        localStorage.setItem('last_it_request_staff_id', val);
                                                        setSavedStaffId(val);
                                                    }
                                                }}
                                            >
                                                {departmentStaff.map((s: any) => {
                                                    const labelText = `${s.ho_ten}${s.chuc_danh ? ` (${s.chuc_danh})` : ''}${isAdmin ? ` - ${s.department?.ten_khoa || s.ma_khoa}` : ''}`;
                                                    return (
                                                        <Select.Option key={s.id} value={s.id} searchtext={labelText} staffname={s.ho_ten}>
                                                            {labelText}
                                                        </Select.Option>
                                                    );
                                                })}
                                            </Select>
                                        </Form.Item>
                                    </div>
                                </div>
                                
                                {isITStaff && (
                                    <div className="mt-6 p-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 to-indigo-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-200 shrink-0">
                                                ⚡
                                            </div>
                                            <div>
                                                <div className="font-bold text-blue-950 text-[14px]">Tôi trực tiếp xử lý yêu cầu này (Tự nhận việc)</div>
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    Hệ thống sẽ gán ngay cho bạn <b>({user?.name || user?.username})</b> để chạy trước tính năng, không phân phối ngẫu nhiên.
                                                </div>
                                            </div>
                                        </div>
                                        <Form.Item name="selfAssign" valuePropName="checked" noStyle>
                                            <Switch 
                                                checkedChildren="Tôi xử lý" 
                                                unCheckedChildren="Chưa nhận"
                                                className="bg-slate-300"
                                                onChange={(checked) => {
                                                    if (checked) {
                                                        form.setFieldsValue({ assigneeId: user?.id });
                                                    } else if (!isManager) {
                                                        form.setFieldsValue({ assigneeId: undefined });
                                                    }
                                                }}
                                            />
                                        </Form.Item>
                                    </div>
                                )}

                                {isManager && (
                                    <div className="mt-6 bg-purple-50/50 p-5 sm:p-6 rounded-2xl border border-purple-100 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                                            <div className="font-bold text-purple-900 uppercase text-sm flex items-center gap-2">
                                                <span>👑</span> Khu vực dành cho Quản lý / Trưởng phòng
                                            </div>
                                            <Tag color="purple" className="m-0 font-medium">Chỉ đạo & Giao việc</Tag>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                                            <Form.Item name="assigneeId" label={<span className="font-semibold text-purple-800">Chỉ định người xử lý (Giao việc)</span>} className="mb-0">
                                                <Select 
                                                    placeholder="Chọn nhân viên hoặc để trống hệ thống tự chia" 
                                                    allowClear
                                                    size="large"
                                                    className="!rounded-xl"
                                                >
                                                    {itUsers.map((u: any) => (
                                                        <Select.Option key={u.id} value={u.id}>
                                                            {u.name || u.username} {u.autoAssignDisabled ? `(🎯 Đang bận: ${u.focusReason || 'Nhiệm vụ riêng'})` : ''}
                                                        </Select.Option>
                                                    ))}
                                                </Select>
                                            </Form.Item>
                                            <Form.Item name="ke_hoach" label={<span className="font-semibold text-purple-800">Kế hoạch / Chỉ đạo thực hiện</span>} className="mb-0">
                                                <Input.TextArea rows={2} placeholder="Nhập yêu cầu, thời hạn hoặc hướng dẫn xử lý..." className="!rounded-xl" />
                                            </Form.Item>
                                        </div>

                                        {/* Tùy chọn Giao việc làm tập trung (Miễn chia việc tự động) */}
                                        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 transition-all">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                                                        <AimOutlined />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-amber-950 text-sm">
                                                            Giao việc dưới dạng &quot;Nhiệm vụ tập trung&quot;
                                                        </div>
                                                        <div className="text-xs text-amber-800/80 mt-0.5">
                                                            Tự động khóa nhận việc tự động từ khoa phòng cho nhân viên này cho đến khi hoàn thành nhiệm vụ.
                                                        </div>
                                                    </div>
                                                </div>
                                                <Form.Item name="isFocusTask" valuePropName="checked" noStyle>
                                                    <Switch 
                                                        checkedChildren="Bật" 
                                                        unCheckedChildren="Tắt"
                                                        className="bg-slate-300"
                                                    />
                                                </Form.Item>
                                            </div>

                                            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.isFocusTask !== cur.isFocusTask}>
                                                {({ getFieldValue }) => {
                                                    const isFocus = getFieldValue('isFocusTask');
                                                    if (!isFocus) return null;
                                                    return (
                                                        <div className="mt-3 pt-3 border-t border-amber-200/80 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <Form.Item 
                                                                name="focusReason" 
                                                                label={<span className="text-xs font-semibold text-amber-900">Lý do / Tên nhiệm vụ hiển thị trên trạng thái</span>} 
                                                                className="mb-0"
                                                                extra={<span className="text-[11px] text-amber-700">Để trống hệ thống sẽ tự lấy theo tên lỗi/công việc</span>}
                                                            >
                                                                <Input.TextArea placeholder="Ví dụ: Triển khai EMR, Cài máy chủ..." rows={2} style={{ resize: 'vertical' }} className="!rounded-lg text-xs" />
                                                            </Form.Item>
                                                            <Form.Item 
                                                                name="status" 
                                                                label={<span className="text-xs font-semibold text-amber-900">Trạng thái phiếu bắt đầu</span>} 
                                                                className="mb-0"
                                                                initialValue="IN_PROGRESS"
                                                            >
                                                                <Select size="small" className="!rounded-lg text-xs">
                                                                    <Select.Option value="IN_PROGRESS">Đang xử lý (Vào việc ngay)</Select.Option>
                                                                    <Select.Option value="PENDING">Chờ xử lý (Chờ nhân viên tiếp nhận)</Select.Option>
                                                                </Select>
                                                            </Form.Item>
                                                        </div>
                                                    );
                                                }}
                                            </Form.Item>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-8 flex justify-end">
                                    <Button 
                                        type="primary" 
                                        htmlType="submit" 
                                        size="large" 
                                        className="px-10 !h-12 !rounded-xl font-bold text-[15px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 transition-all" 
                                        loading={loading}
                                    >
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

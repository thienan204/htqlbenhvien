'use client';

import React, { useState, useEffect } from 'react';
import { Modal, Button, Progress, Alert, Spin, Tag, List, Checkbox, Switch, Radio, Space, Divider, message, Tooltip } from 'antd';
import {
    SaveOutlined,
    CloudSyncOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    FolderOpenOutlined,
    FileExcelOutlined,
    SettingOutlined,
    LaptopOutlined,
    SwapOutlined,
    FileZipOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import {
    isFileSystemAccessSupported,
    getDirectoryHandle,
    saveDirectoryHandle,
    clearDirectoryHandle,
    verifyDirectoryPermission,
    writeFilesToDirectory,
    downloadBase64File
} from './directoryStorage';

const getBasePath = () => {
    if (typeof window !== 'undefined') {
        const parts = window.location.pathname.split('/staff');
        return parts.length > 1 ? parts[0] : '';
    }
    return '';
};

interface AttendanceDriveSyncModalProps {
    open: boolean;
    onClose: () => void;
    onOpenConfig: () => void;
    monthYear: string;
    ma_khoa: string;
    deptName?: string;
    selectedDateStr?: string;
}

const DEFAULT_SHEETS = [
    { key: 'CHAM_CONG', name: '1. Bảng Chấm Công Chuẩn Mẫu' },
    { key: 'CHAM_TRUC', name: '2. Bảng Chấm Trực (Ngày thường, T7/CN, Lễ tết)' },
    { key: 'SO_DOI_SOAT', name: '3. Sổ Theo Dõi & Đối Soát Nghỉ Bù' },
    { key: 'CHAM_THEM_GIO', name: '4. Bảng Chấm Thêm Giờ' },
    { key: 'CHAM_DOC_HAI', name: '5. Bảng Chấm Độc Hại & Bồi Dưỡng Hiện Vật' }
];

export function AttendanceDriveSyncModal({
    open,
    onClose,
    onOpenConfig,
    monthYear,
    ma_khoa,
    deptName = 'Khoa / Phòng',
    selectedDateStr
}: AttendanceDriveSyncModalProps) {
    const [status, setStatus] = useState<'IDLE' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [currentStepText, setCurrentStepText] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [logs, setLogs] = useState<Array<{ text: string; type: 'info' | 'success' | 'error' }>>([]);
    const [folderUrl, setFolderUrl] = useState<string | null>(null);

    // Cấu hình lựa chọn
    const [selectedKeys, setSelectedKeys] = useState<string[]>(['CHAM_CONG', 'CHAM_TRUC', 'SO_DOI_SOAT', 'CHAM_THEM_GIO', 'CHAM_DOC_HAI']);
    const [saveToComputer, setSaveToComputer] = useState<boolean>(true);
    const [syncToDrive, setSyncToDrive] = useState<boolean>(true);
    const [fileNamingStyle, setFileNamingStyle] = useState<'MONTHLY' | 'DAILY'>('MONTHLY');

    // Thư mục máy tính đã nhớ
    const [dirHandle, setDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [dirName, setDirName] = useState<string>('');
    const [fsSupported, setFsSupported] = useState<boolean>(false);
    const [driveConfigured, setDriveConfigured] = useState<boolean>(false);

    // Tải cấu hình và kiểm tra thư mục đã nhớ khi mở modal
    useEffect(() => {
        if (!open) return;

        setFsSupported(isFileSystemAccessSupported());

        // Kiểm tra thư mục máy tính đã nhớ trong IndexedDB
        getDirectoryHandle(ma_khoa).then((handle) => {
            if (handle) {
                setDirHandle(handle);
                setDirName(handle.name);
            } else {
                setDirHandle(null);
                setDirName('');
            }
        });

        // Kiểm tra cấu hình Drive của khoa
        const basePath = getBasePath();
        fetch(`${basePath}/api/staff/attendance/drive-sync/config?ma_khoa=${ma_khoa}`)
            .then(res => res.json())
            .then(data => {
                if (data.config) {
                    setDriveConfigured(Boolean(data.config.webhookUrl || data.config.folderId));
                    setSyncToDrive(Boolean(data.config.isEnabled && (data.config.webhookUrl || data.config.folderId)));
                    if (data.config.fileNamingStyle) {
                        setFileNamingStyle(data.config.fileNamingStyle);
                    }
                } else {
                    setDriveConfigured(false);
                    setSyncToDrive(false);
                }
            })
            .catch(() => {
                setDriveConfigured(false);
                setSyncToDrive(false);
            });

        // Reset trạng thái
        setStatus('IDLE');
        setProgressPercent(0);
        setCurrentStepText('');
        setErrorMessage('');
        setLogs([]);
        setFolderUrl(null);
    }, [open, ma_khoa]);

    // Chọn thư mục máy tính
    const handlePickDirectory = async () => {
        try {
            if (!isFileSystemAccessSupported()) {
                message.warning('Trình duyệt không hỗ trợ chọn thư mục trực tiếp. File sẽ được tải về dưới dạng gói nén ZIP.');
                return;
            }
            const handle = await (window as any).showDirectoryPicker({
                id: `bvdk_dir_${ma_khoa}`,
                mode: 'readwrite',
                startIn: 'documents'
            });
            await saveDirectoryHandle(ma_khoa, handle);
            setDirHandle(handle);
            setDirName(handle.name);
            message.success(`Đã nhớ thư mục máy tính: "${handle.name}". Các lần sau sẽ tự động lưu vào đây!`);
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                message.error('Không thể chọn thư mục: ' + err.message);
            }
        }
    };

    // Đổi hoặc quên thư mục
    const handleForgetDirectory = async () => {
        await clearDirectoryHandle(ma_khoa);
        setDirHandle(null);
        setDirName('');
        message.info('Đã xóa ghi nhớ thư mục máy tính.');
    };

    // Thực hiện Lưu máy tính & Đồng bộ Drive
    const handleStartExecute = async () => {
        if (!saveToComputer && !syncToDrive) {
            message.warning('Vui lòng chọn ít nhất 1 phương thức: Lưu vào máy tính hoặc Đồng bộ Google Drive');
            return;
        }

        try {
            setStatus('PROCESSING');
            setProgressPercent(15);
            setCurrentStepText('Đang kết xuất các bảng Excel chuẩn mẫu...');
            setErrorMessage('');
            const newLogs: Array<{ text: string; type: 'info' | 'success' | 'error' }> = [];

            const basePath = getBasePath();
            const targetDate = selectedDateStr || new Date().toISOString().split('T')[0];

            // 1. GỌI API KẾT XUẤT FILE EXCEL & TẠO GÓI ZIP
            const resZip = await fetch(`${basePath}/api/staff/attendance/export-zip`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    monthYear,
                    ma_khoa,
                    fileNamingStyle,
                    targetDate,
                    selectedKeys
                })
            });

            if (!resZip.ok) {
                const errData = await resZip.json();
                throw new Error(errData.error || 'Lỗi khi tạo file Excel');
            }

            const zipData = await resZip.json();
            const { files, zipBase64, zipFileName } = zipData;
            setProgressPercent(40);
            newLogs.push({ text: `Đã kết xuất ${files.length} file Excel chuẩn mẫu của ${deptName}.`, type: 'info' });
            setLogs([...newLogs]);

            // 2. LƯU VÀO MÁY TÍNH
            if (saveToComputer) {
                setCurrentStepText('Đang lưu tệp tin vào máy tính của bạn...');
                let savedDirectly = false;

                // Nếu có thư mục đã nhớ và trình duyệt hỗ trợ File System Access API
                if (dirHandle && fsSupported) {
                    try {
                        const writtenNames = await writeFilesToDirectory(dirHandle, files);
                        savedDirectly = true;
                        newLogs.push({
                            text: `Đã ghi trực tiếp ${writtenNames.length} file Excel vào thư mục máy tính: "${dirName}".`,
                            type: 'success'
                        });
                    } catch (fsErr: any) {
                        console.warn('Không thể ghi trực tiếp, chuyển sang tải file ZIP:', fsErr);
                    }
                }

                // Nếu chưa chọn thư mục hoặc không ghi trực tiếp được -> Tải file ZIP
                if (!savedDirectly) {
                    downloadBase64File(zipBase64, zipFileName, 'application/zip');
                    newLogs.push({
                        text: `Đã tải gói lưu trữ ZIP "${zipFileName}" về máy tính thành công!`,
                        type: 'success'
                    });
                }
            }

            setProgressPercent(70);
            setLogs([...newLogs]);

            // 3. ĐỒNG BỘ GOOGLE DRIVE (NẾU ĐƯỢC CHỌN)
            if (syncToDrive) {
                setCurrentStepText('Đang tải và cập nhật lên Google Drive...');
                const resDrive = await fetch(`${basePath}/api/staff/attendance/drive-sync/execute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        monthYear,
                        ma_khoa,
                        fileNamingStyle,
                        targetDate
                    })
                });

                const driveData = await resDrive.json();
                if (resDrive.ok && driveData.success) {
                    newLogs.push({
                        text: `Đồng bộ thành công lên Google Drive của ${deptName}!`,
                        type: 'success'
                    });
                    if (driveData.folderUrl) {
                        setFolderUrl(driveData.folderUrl);
                    }
                } else {
                    newLogs.push({
                        text: `Google Drive: ${driveData.error || 'Chưa thể đồng bộ lên Drive'}`,
                        type: 'error'
                    });
                }
            }

            setProgressPercent(100);
            setCurrentStepText('Hoàn tất quá trình lưu trữ!');
            setStatus('SUCCESS');
            setLogs([...newLogs]);
            message.success('Đã hoàn tất lưu trữ bảng chấm công!');

        } catch (err: any) {
            setStatus('ERROR');
            setErrorMessage(err.message || 'Có lỗi xảy ra trong quá trình lưu trữ');
            message.error(err.message || 'Lưu thất bại');
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800 text-base font-bold pb-2 border-b">
                    <SaveOutlined className="text-blue-600 text-xl" />
                    <span>Lưu Trữ & Sao Lưu Bảng Chấm Công - {deptName}</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={680}
            footer={null}
            destroyOnClose
        >
            <div className="space-y-4 pt-2">
                {/* 1. KHU VỰC THƯ MỤC MÁY TÍNH ĐÃ NHỚ */}
                <div className="border rounded-lg p-3 bg-slate-50 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                            <LaptopOutlined className="text-blue-600" />
                            <span>Vị trí lưu trên máy tính cá nhân:</span>
                        </span>
                        {dirHandle && (
                            <Button size="small" type="link" danger onClick={handleForgetDirectory} className="p-0 text-xs">
                                Đổi thư mục khác
                            </Button>
                        )}
                    </div>

                    {dirHandle ? (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded p-2.5">
                            <div className="flex items-center gap-2">
                                <CheckCircleOutlined className="text-emerald-600 text-base" />
                                <div>
                                    <div className="font-semibold text-xs text-emerald-900">
                                        Đã nhớ thư mục: <span className="font-mono underline text-emerald-700">{dirName}</span>
                                    </div>
                                    <div className="text-[11px] text-emerald-600">
                                        Mỗi ngày bấm lưu, hệ thống tự động ghi thẳng 5 file Excel vào thư mục này mà không cần chọn lại.
                                    </div>
                                </div>
                            </div>
                            <Button size="small" onClick={handlePickDirectory} className="text-xs">
                                Đổi
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded p-2.5">
                            <div className="flex items-center gap-2">
                                <FolderOpenOutlined className="text-amber-600 text-lg" />
                                <div>
                                    <div className="font-semibold text-xs text-amber-900">Chưa chọn thư mục máy tính để tự động nhớ</div>
                                    <div className="text-[11px] text-amber-700">
                                        {fsSupported
                                            ? 'Bấm nút bên cạnh để chọn 1 lần duy nhất, các lần sau tự động lưu thẳng vào máy.'
                                            : 'Trình duyệt sẽ tự động tải file ZIP về máy tính mỗi lần bấm lưu.'}
                                    </div>
                                </div>
                            </div>
                            {fsSupported && (
                                <Button
                                    type="primary"
                                    size="small"
                                    icon={<FolderOpenOutlined />}
                                    onClick={handlePickDirectory}
                                    className="bg-amber-600 hover:bg-amber-500 text-xs"
                                >
                                    Chọn thư mục
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* 2. QUY CÁCH ĐẶT TÊN TỆP TIN */}
                <div className="border rounded-lg p-3 bg-white space-y-2">
                    <div className="font-bold text-xs text-slate-800">Quy cách đặt tên tệp tin:</div>
                    <Radio.Group
                        value={fileNamingStyle}
                        onChange={(e) => setFileNamingStyle(e.target.value)}
                        className="flex flex-col gap-1.5"
                    >
                        <Radio value="MONTHLY" className="text-xs">
                            <span className="font-semibold text-slate-800">Lưu theo Tháng (Khuyên dùng):</span>
                            <span className="text-slate-500 ml-1">Mỗi ngày bấm lưu sẽ ghi đè snapshot mới nhất của tháng (tên dạng <code>..._T11_2026.xlsx</code>)</span>
                        </Radio>
                        <Radio value="DAILY" className="text-xs">
                            <span className="font-semibold text-slate-800">Lưu theo Ngày cụ thể:</span>
                            <span className="text-slate-500 ml-1">Lưu vết lịch sử riêng của từng ngày (tên dạng <code>..._T11_2026_{selectedDateStr || '2026-11-21'}.xlsx</code>)</span>
                        </Radio>
                    </Radio.Group>
                </div>

                {/* 3. TÙY CHỌN NƠI LƯU */}
                <div className="border rounded-lg p-3 bg-white space-y-2.5">
                    <div className="font-bold text-xs text-slate-800">Tùy chọn nơi lưu trữ:</div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 border rounded flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-2">
                                <LaptopOutlined className="text-blue-600 text-base" />
                                <div>
                                    <div className="font-bold text-xs text-slate-800">Lưu vào máy tính</div>
                                    <div className="text-[11px] text-slate-500">Ghi vào thư mục hoặc tải ZIP</div>
                                </div>
                            </div>
                            <Switch checked={saveToComputer} onChange={setSaveToComputer} checkedChildren="BẬT" unCheckedChildren="TẮT" />
                        </div>

                        <div className="p-2.5 border rounded flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-2">
                                <CloudSyncOutlined className="text-emerald-600 text-base" />
                                <div>
                                    <div className="font-bold text-xs text-slate-800">Đồng bộ Google Drive</div>
                                    <div className="text-[11px] text-slate-500">{driveConfigured ? 'Đã cài đặt Webhook' : 'Chưa cấu hình Drive'}</div>
                                </div>
                            </div>
                            <Switch checked={syncToDrive} onChange={setSyncToDrive} checkedChildren="BẬT" unCheckedChildren="TẮT" />
                        </div>
                    </div>
                </div>

                {/* 4. DANH SÁCH BẢNG CẦN LƯU */}
                <div className="border rounded-lg p-3 bg-white space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-800">Danh sách bảng Excel chuẩn mẫu ({selectedKeys.length}/5):</span>
                        <Button
                            type="link"
                            size="small"
                            className="p-0 text-xs"
                            onClick={() => setSelectedKeys(selectedKeys.length === 5 ? [] : ['CHAM_CONG', 'CHAM_TRUC', 'SO_DOI_SOAT', 'CHAM_THEM_GIO', 'CHAM_DOC_HAI'])}
                        >
                            {selectedKeys.length === 5 ? 'Bỏ chọn tất cả' : 'Chọn tất cả 5 bảng'}
                        </Button>
                    </div>

                    <Checkbox.Group
                        value={selectedKeys}
                        onChange={(vals) => setSelectedKeys(vals as string[])}
                        className="flex flex-col gap-1.5 pt-1"
                    >
                        {DEFAULT_SHEETS.map(item => (
                            <Checkbox key={item.key} value={item.key} className="text-xs">
                                <span className="text-slate-700">{item.name}</span>
                            </Checkbox>
                        ))}
                    </Checkbox.Group>
                </div>

                {/* TIẾN TRÌNH VÀ NHẬT KÝ */}
                {status !== 'IDLE' && (
                    <div className="p-3 border rounded bg-slate-50 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-700">{currentStepText}</span>
                            <span className="font-mono font-bold text-blue-600">{progressPercent}%</span>
                        </div>
                        <Progress percent={progressPercent} status={status === 'ERROR' ? 'exception' : status === 'SUCCESS' ? 'success' : 'active'} showInfo={false} />

                        {logs.length > 0 && (
                            <div className="max-h-28 overflow-y-auto space-y-1 text-xs pt-1">
                                {logs.map((log, idx) => (
                                    <div key={idx} className={`flex items-start gap-1.5 ${log.type === 'success' ? 'text-emerald-700' : log.type === 'error' ? 'text-rose-600' : 'text-slate-600'}`}>
                                        <span>•</span>
                                        <span>{log.text}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {folderUrl && (
                            <div className="pt-1 text-center">
                                <Button
                                    type="primary"
                                    icon={<FolderOpenOutlined />}
                                    onClick={() => window.open(folderUrl, '_blank')}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold"
                                >
                                    Mở thư mục trên Google Drive
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* NÚT THAO TÁC DƯỚI CÙNG */}
                <div className="flex items-center justify-between pt-2 border-t">
                    <Button
                        icon={<SettingOutlined />}
                        onClick={() => {
                            onClose();
                            onOpenConfig();
                        }}
                        size="small"
                        className="text-xs text-slate-500"
                    >
                        Cài đặt Google Drive
                    </Button>

                    <Space>
                        <Button onClick={onClose}>
                            Đóng
                        </Button>
                        <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            loading={status === 'PROCESSING'}
                            onClick={handleStartExecute}
                            disabled={selectedKeys.length === 0 || (!saveToComputer && !syncToDrive)}
                            className="bg-blue-600 hover:bg-blue-500 font-semibold px-5"
                        >
                            {status === 'PROCESSING' ? 'Đang thực hiện...' : '💾 Bắt Đầu Lưu'}
                        </Button>
                    </Space>
                </div>
            </div>
        </Modal>
    );
}

"use client";

import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileType, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getBasePath } from '@/utils/config';

export default function HoSoDaGuiPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const onDrop = (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setFile(acceptedFiles[0]);
            setResult(null);
            setError(null);
        }
    };

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls']
        },
        maxFiles: 1
    });

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${getBasePath()}/api/ho-so-da-gui/import`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setResult(data);
                setFile(null); // Clear file after successful upload
            } else {
                setError(data.error || 'Có lỗi xảy ra khi tải file lên');
            }
        } catch (err: any) {
            setError('Lỗi kết nối tới máy chủ');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">Import Hồ Sơ Đã Gửi (XML)</h1>
                <p className="text-slate-500 mt-2">
                    Tải lên file Excel kết xuất từ cổng BHXH. Hệ thống sẽ tự động thêm mới hoặc ghi nhận lịch sử thay đổi (không ghi đè dữ liệu cũ).
                </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                <div 
                    {...getRootProps()} 
                    className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50'
                    } ${file ? 'bg-slate-50' : ''}`}
                >
                    <input {...getInputProps()} />
                    
                    {file ? (
                        <div className="flex flex-col items-center">
                            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                                <FileType size={32} />
                            </div>
                            <p className="font-semibold text-slate-700 text-lg">{file.name}</p>
                            <p className="text-sm text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            <p className="text-sm text-blue-600 mt-4 cursor-pointer hover:underline">Nhấn hoặc kéo file khác vào đây để thay đổi</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-slate-500">
                            <UploadCloud size={48} className="mb-4 text-slate-400" />
                            <p className="text-lg font-medium text-slate-700">Kéo thả file Excel vào đây</p>
                            <p className="text-sm mt-1">hoặc nhấn để chọn file (.xlsx, .xls)</p>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        className={`px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors ${
                            !file || isUploading 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                        }`}
                    >
                        {isUploading ? (
                            <>
                                <RefreshCw className="animate-spin" size={18} />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <UploadCloud size={18} />
                                Bắt đầu Import
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                        <h3 className="font-medium text-red-800">Lỗi Import</h3>
                        <p className="text-red-600 text-sm mt-1">{error}</p>
                    </div>
                </div>
            )}

            {result && (
                <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <CheckCircle className="text-green-500" size={24} />
                        <h3 className="text-lg font-bold text-slate-800">Import Thành Công</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                            <p className="text-sm text-slate-500 font-medium">Tổng số dòng hợp lệ</p>
                            <p className="text-3xl font-bold text-slate-800 mt-1">{result.total}</p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <p className="text-sm text-blue-600 font-medium">Hồ sơ thêm mới tinh</p>
                            <p className="text-3xl font-bold text-blue-700 mt-1">+{result.newCount}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                            <p className="text-sm text-amber-600 font-medium">Lưu thêm lịch sử (Thay đổi)</p>
                            <p className="text-3xl font-bold text-amber-700 mt-1">+{result.historyCount}</p>
                        </div>
                        <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
                            <p className="text-sm text-slate-500 font-medium">Bỏ qua (Giống hệt)</p>
                            <p className="text-3xl font-bold text-slate-600 mt-1">{result.skipCount}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

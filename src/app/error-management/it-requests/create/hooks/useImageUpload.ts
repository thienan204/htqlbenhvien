import { useState } from 'react';
import { message } from 'antd';
import { getBasePath } from '@/utils/config';

export function useImageUpload(maxImageSizeMB: number) {
    const [fileList, setFileList] = useState<any[]>([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState('');
    const [uploadingFiles, setUploadingFiles] = useState(false);

    const resizeImage = (file: File): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas conversion failed'));
                    }, 'image/jpeg', 0.75);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    const uploadProps = {
        onRemove: (file: any) => {
            if (file.url && file.url.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(file.url);
                } catch (e) {
                    console.error('Error revoking object URL:', e);
                }
            }
            setFileList(prev => prev.filter(item => item.uid !== file.uid));
        },
        customRequest: async ({ file, onSuccess, onError }: any) => {
            try {
                if (file.size > maxImageSizeMB * 1024 * 1024) {
                    message.error(`Tệp quá lớn! Vui lòng chọn tệp dưới ${maxImageSizeMB}MB.`);
                    onError && onError(new Error('File too large'));
                    return;
                }

                const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                const blobUrl = isImage ? URL.createObjectURL(file) : undefined;
                
                const newFileItem = {
                    uid: file.uid || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    name: file.name,
                    status: 'done',
                    originFileObj: file,
                    url: blobUrl,
                    thumbUrl: blobUrl,
                    isDoc: !isImage,
                    isPending: true
                };

                setFileList(prev => [...prev, newFileItem]);
                message.success(`Đã chọn: ${file.name}`);
                onSuccess && onSuccess('ok');
            } catch (error: any) {
                console.error('Lỗi chuẩn bị tệp:', error);
                onError && onError(error);
            }
        },
        fileList,
        listType: "picture-card" as const,
        accept: "*",
        onPreview: async (file: any) => {
            const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name || file.url || '');
            if (isImage) {
                setPreviewImage(file.url || file.thumbUrl || file.preview);
                setPreviewOpen(true);
            } else if (file.url && !file.url.startsWith('blob:')) {
                window.open(file.url, '_blank');
            } else {
                message.info(`Tệp "${file.name}" đã được đính kèm và sẽ tải lên khi bạn nhấn Gửi yêu cầu.`);
            }
        }
    };

    // Hàm thực hiện upload tất cả các tệp đang chờ (chỉ gọi khi nhấn nút Gửi yêu cầu)
    const uploadPendingFiles = async (): Promise<string[]> => {
        if (!fileList || fileList.length === 0) return [];
        setUploadingFiles(true);
        const finalUrls: string[] = [];

        try {
            for (const item of fileList) {
                // Nếu đã là link server có sẵn (ví dụ khi sửa ticket)
                if (item.url && !item.isPending && !item.url.startsWith('blob:')) {
                    finalUrls.push(item.url);
                    continue;
                }

                const file: File = item.originFileObj;
                if (!file) {
                    if (item.url && !item.url.startsWith('blob:')) {
                        finalUrls.push(item.url);
                    }
                    continue;
                }

                const isImage = file.type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
                let fileToUpload: Blob = file;
                if (isImage) {
                    try {
                        fileToUpload = await resizeImage(file);
                    } catch (e) {
                        fileToUpload = file;
                    }
                }

                const formData = new FormData();
                formData.append('file', fileToUpload, file.name || (isImage ? 'upload.jpg' : 'file'));

                const res = await fetch(`${getBasePath()}/api/upload`, {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();
                if (res.ok && data.url) {
                    finalUrls.push(data.url);
                    if (item.url && item.url.startsWith('blob:')) {
                        try {
                            URL.revokeObjectURL(item.url);
                        } catch (e) {}
                    }
                } else {
                    message.error(data.error || `Lỗi tải tệp: ${file.name}`);
                    throw new Error(data.error || 'Upload error');
                }
            }
            return finalUrls;
        } finally {
            setUploadingFiles(false);
        }
    };

    const clearFiles = () => {
        fileList.forEach(item => {
            if (item.url && item.url.startsWith('blob:')) {
                try {
                    URL.revokeObjectURL(item.url);
                } catch (e) {}
            }
        });
        setFileList([]);
    };

    const handleFileChange = (e: any) => {
        if (e.target.files && e.target.files.length > 0) {
            Array.from(e.target.files).forEach((file: any) => {
                uploadProps.customRequest({ file });
            });
        }
        e.target.value = '';
    };

    return {
        fileList,
        setFileList,
        previewOpen,
        previewImage,
        setPreviewOpen,
        uploadProps,
        handleFileChange,
        uploadPendingFiles,
        uploadingFiles,
        clearFiles
    };
}

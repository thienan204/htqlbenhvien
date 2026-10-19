import type { TablePaginationConfig } from 'antd';

export interface PaginationOptions {
    current?: number;
    pageSize?: number;
    total?: number;
    defaultPageSize?: number;
    unit?: string; // Ví dụ: 'yêu cầu', 'công việc', 'bản ghi', 'lỗi'...
    pageSizeOptions?: string[];
    showSizeChanger?: boolean;
    onChange?: (page: number, pageSize: number) => void;
}

/**
 * Cấu hình phân trang chuẩn tiếng Việt dùng chung cho toàn bộ dự án
 * Tự động format: 10 / Trang, showSizeChanger, showTotal: '1-10 của 56 yêu cầu'...
 */
export function getDefaultPagination(options: PaginationOptions = {}): TablePaginationConfig {
    const {
        current,
        pageSize,
        total,
        defaultPageSize = 10,
        unit = 'bản ghi',
        pageSizeOptions = ['10', '20', '50', '100'],
        showSizeChanger = true,
        onChange
    } = options;

    return {
        ...(current !== undefined && { current }),
        ...(pageSize !== undefined && { pageSize }),
        ...(total !== undefined && { total }),
        defaultPageSize,
        showSizeChanger,
        pageSizeOptions,
        locale: {
            items_per_page: '/ Trang',
            jump_to: 'Đến',
            page: 'Trang'
        },
        showTotal: (totalCount: number, range: [number, number]) => 
            `${range[0]}-${range[1]} của ${totalCount} ${unit}`,
        onChange: (page: number, size: number) => {
            onChange?.(page, size);
        }
    };
}

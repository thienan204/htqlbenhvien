'use client';

import React from 'react';
import { Card, Table, Typography, Collapse, Tag } from 'antd';
import { DatabaseOutlined, TableOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const schemaData = [
  {
    category: '1. Các bảng Danh mục (Kiểm tra Mẫu 01 -> 06)',
    tables: [
      {
        name: 'Mau04Catalog',
        description: 'Danh mục Vật tư Y tế',
        columns: [
          { field: 'MA_VAT_TU', type: 'String', desc: 'Mã vật tư y tế (dùng để đối chiếu chính)' },
          { field: 'TEN_VAT_TU', type: 'String', desc: 'Tên vật tư y tế' },
          { field: 'NHOM_VAT_TU', type: 'String', desc: 'Nhóm vật tư y tế' },
          { field: 'DON_GIA', type: 'Float', desc: 'Đơn giá bệnh viện' },
          { field: 'DON_GIA_BH', type: 'Float', desc: 'Đơn giá Bảo hiểm thanh toán' },
          { field: 'MA_CSKCB', type: 'String', desc: 'Mã cơ sở khám chữa bệnh' },
          { field: 'QUY_CACH', type: 'String', desc: 'Quy cách đóng gói / sử dụng' },
        ]
      },
      {
        name: 'Mau03Catalog',
        description: 'Danh mục Thuốc',
        columns: [
          { field: 'MA_THUOC', type: 'String', desc: 'Mã thuốc (đối chiếu chính)' },
          { field: 'TEN_THUOC', type: 'String', desc: 'Tên thương mại của thuốc' },
          { field: 'TEN_HOAT_CHAT', type: 'String', desc: 'Tên hoạt chất' },
          { field: 'DON_GIA', type: 'Float', desc: 'Đơn giá bệnh viện' },
          { field: 'DON_GIA_BH', type: 'Float', desc: 'Đơn giá Bảo hiểm thanh toán' },
          { field: 'MA_DUONG_DUNG', type: 'String', desc: 'Mã đường dùng (VD: 1.01)' },
        ]
      },
      {
        name: 'Mau05Catalog',
        description: 'Danh mục Dịch vụ Kỹ thuật (DVKT)',
        columns: [
          { field: 'MA_DICH_VU', type: 'String', desc: 'Mã dịch vụ kỹ thuật' },
          { field: 'TEN_DICH_VU', type: 'String', desc: 'Tên dịch vụ kỹ thuật' },
          { field: 'DON_GIA', type: 'Float', desc: 'Đơn giá dịch vụ' },
          { field: 'GIA_THANH_TOAN', type: 'Float', desc: 'Giá thanh toán BHYT' },
          { field: 'QD_DVKT', type: 'String', desc: 'Số quyết định' },
        ]
      }
    ]
  },
  {
    category: '2. Các bảng Nhân sự & Khoa phòng',
    tables: [
      {
        name: 'Staff',
        description: 'Nhân sự / Bác sĩ',
        columns: [
          { field: 'ma_nv', type: 'String', desc: 'Mã nhân viên' },
          { field: 'ho_ten', type: 'String', desc: 'Họ và tên' },
          { field: 'ma_khoa', type: 'String', desc: 'Mã khoa trực thuộc' },
          { field: 'cccd', type: 'String', desc: 'Căn cước công dân' },
          { field: 'so_dien_thoai', type: 'String', desc: 'Số điện thoại' },
        ]
      },
      {
        name: 'PracticingCertificate',
        description: 'Chứng chỉ Hành nghề (CCHN)',
        columns: [
          { field: 'so_cchn', type: 'String', desc: 'Số chứng chỉ hành nghề' },
          { field: 'staffId', type: 'String', desc: 'ID nhân viên (liên kết Staff)' },
          { field: 'pham_vi_hanh_nghe', type: 'String', desc: 'Mã phạm vi chuyên môn' },
          { field: 'dich_vu_ky_thuat', type: 'String', desc: 'Danh sách dịch vụ được phép làm' },
        ]
      },
      {
        name: 'DoctorServiceMapping',
        description: 'Cấu hình Dịch vụ Bác sĩ được phép làm',
        columns: [
          { field: 'cchn', type: 'String', desc: 'Số CCHN của bác sĩ' },
          { field: 'ma_dich_vu', type: 'String', desc: 'Mã dịch vụ kỹ thuật' },
          { field: 'status', type: 'String', desc: 'Trạng thái (APPROVED, PENDING_REVIEW)' },
        ]
      },
      {
        name: 'Department',
        description: 'Danh mục Khoa Phòng',
        columns: [
          { field: 'ma_khoa', type: 'String', desc: 'Mã khoa' },
          { field: 'ten_khoa', type: 'String', desc: 'Tên khoa' },
          { field: 'ma_khoa_bv', type: 'String', desc: 'Mã khoa nội bộ BV' },
        ]
      }
    ]
  }
];

export default function SchemaViewerPage() {
  const columns = [
    {
      title: 'Tên Cột (Field)',
      dataIndex: 'field',
      key: 'field',
      width: '30%',
      render: (text: string) => <Text strong className="font-mono text-blue-600">{text}</Text>
    },
    {
      title: 'Kiểu Dữ Liệu',
      dataIndex: 'type',
      key: 'type',
      width: '20%',
      render: (text: string) => <Tag color={text === 'String' ? 'green' : 'orange'}>{text}</Tag>
    },
    {
      title: 'Mô tả',
      dataIndex: 'desc',
      key: 'desc',
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-8 text-white shadow-lg">
        <Title level={2} className="!text-white !mb-2 flex items-center gap-3">
          <DatabaseOutlined /> Từ Điển Dữ Liệu Hệ Thống (Schema)
        </Title>
        <Text className="text-blue-100 text-lg">
          Danh sách các bảng và trường dữ liệu quan trọng nhất dùng để cấu hình luật kiểm tra XML BHYT.
        </Text>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <Title level={4} className="mb-4">💡 Hướng dẫn sử dụng trong Rule BHYT</Title>
        <Paragraph className="text-slate-600 text-[15px]">
          Cú pháp chuẩn khi viết biểu thức logic: <Text code className="text-lg">Tên_Bảng.Tên_Cột</Text>
        </Paragraph>
        <ul className="list-disc pl-5 text-slate-600 space-y-2">
          <li>Kiểm tra sự tồn tại: <Text code>EXISTS_IN('Mau04Catalog.MA_VAT_TU', MA_VAT_TU)</Text></li>
          <li>Kiểm tra sai lệch giá: <Text code>CHECK_MISMATCH('Mau04Catalog.MA_VAT_TU:DON_GIA_BH', MA_VAT_TU, DON_GIA_BH)</Text></li>
        </ul>
      </div>

      {schemaData.map((category, idx) => (
        <div key={idx} className="mb-10">
          <Title level={3} className="!text-slate-700 !mb-6 border-b pb-2 border-slate-200">
            {category.category}
          </Title>
          <Collapse
            defaultActiveKey={['0']}
            size="large"
            className="bg-transparent border-none"
            items={category.tables.map((table, tIdx) => ({
              key: tIdx.toString(),
              label: (
                <div className="flex items-center gap-3">
                  <TableOutlined className="text-blue-500 text-xl" />
                  <span className="font-bold text-lg text-slate-800">{table.name}</span>
                  <span className="text-slate-500 font-normal ml-2">- {table.description}</span>
                </div>
              ),
              className: 'bg-white mb-4 rounded-xl shadow-sm border border-slate-200 overflow-hidden',
              children: (
                <div className="p-2">
                  <Table
                    columns={columns}
                    dataSource={table.columns}
                    pagination={false}
                    rowKey="field"
                    size="middle"
                    className="schema-table"
                  />
                </div>
              )
            }))}
          />
        </div>
      ))}
    </div>
  );
}

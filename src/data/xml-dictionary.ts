export interface XmlDictionaryItem {
    stt: number;
    chiTieu: string;
    kieuDuLieu: string;
    kichThuocToiDa: string;
    dienGiai130: string;
    dinhChinh4750: string;
    dieuChinh: string;
}

export const xmlDictionaryData: Record<string, XmlDictionaryItem[]> = {
    'XML1': [
        { stt: 1, chiTieu: 'MA_LK', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '100', dienGiai130: 'Là mã đợt điều trị duy nhất (dùng để liên kết giữa Bảng chỉ tiêu tổng hợp khám bệnh, chữa bệnh (bảng XML 1) và các bảng còn lại ban hành kèm theo Quyết định này trong một lần khám bệnh, chữa bệnh (PRIMARY KEY)).', dinhChinh4750: '', dieuChinh: '' },
        { stt: 2, chiTieu: 'STT', kieuDuLieu: 'Số', kichThuocToiDa: '10', dienGiai130: 'Là số thứ tự tăng từ 1 đến hết trong một lần gửi dữ liệu.', dinhChinh4750: '', dieuChinh: '' },
        { stt: 3, chiTieu: 'MA_BN', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '100', dienGiai130: 'Là mã người bệnh theo quy định của cơ sở KBCB', dinhChinh4750: '', dieuChinh: '' },
        { stt: 4, chiTieu: 'HO_TEN', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '255', dienGiai130: 'Là họ và tên của người bệnh.\n- Lưu ý: Trường hợp trẻ sau khi sinh ra được hưởng quyền lợi BHYT theo quy định của Luật BHYT nhưng chưa được cơ quan BHXH cấp thẻ BHYT do chưa làm thủ tục cấp giấy khai sinh thì cơ sở KBCB thực hiện ghi họ và tên của trẻ theo quy định tại điểm b khoản 1 Điều 10 Thông tư số 30/2020/TT-BYT ngày 31 tháng 12 năm 2020 của Bộ trưởng Bộ Y tế quy định chi tiết và hướng dẫn biện pháp thi hành một số điều của Luật BHYT, cụ thể:\n+ Nếu trẻ sơ sinh có mẹ hoặc cha (bố): ghi theo họ và tên của mẹ hoặc của cha (bố);\n+ Nếu trẻ sơ sinh không có mẹ hoặc cha (bố) nhưng có người giám hộ: ghi theo họ và tên của người giám hộ;\n+ Nếu trẻ sơ sinh không có người nhận hoặc bỏ rơi tại cơ sở khám bệnh, chữa bệnh: ghi theo họ và tên của người ghi trong biên bản bàn giao.', dinhChinh4750: '', dieuChinh: '' },
        { stt: 5, chiTieu: 'NGAY_SINH', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '12', dienGiai130: 'Ngày sinh', dinhChinh4750: '', dieuChinh: '' },
        { stt: 6, chiTieu: 'GIOI_TINH', kieuDuLieu: 'Số', kichThuocToiDa: '1', dienGiai130: 'Giới tính', dinhChinh4750: '', dieuChinh: '' },
        { stt: 7, chiTieu: 'DIA_CHI', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '1024', dienGiai130: 'Địa chỉ', dinhChinh4750: '', dieuChinh: '' },
        { stt: 8, chiTieu: 'MA_THE', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '15', dienGiai130: 'Mã thẻ', dinhChinh4750: '', dieuChinh: '' },
        { stt: 9, chiTieu: 'MA_THE_BHYT', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '15', dienGiai130: 'Mã thẻ BHYT', dinhChinh4750: '', dieuChinh: '' },
        { stt: 10, chiTieu: 'MA_DKBD', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '5', dienGiai130: 'Ghi mã cơ sở KBCB nơi người bệnh đăng ký ban đầu ghi trên thẻ BHYT, gồm có 05 ký tự. Lưu ý đối với một số trường hợp sau:- Trường hợp người bệnh chưa có thẻ BHYT nhưng được cơ quan BHXH cấp mã thẻ tạm thời: Ghi theo 02 ký tự cuối của mã đơn vị hành chính của tỉnh, thành phố trực thuộc Trung ương nơi người bệnh cư trú (Quy định tại Phụ lục 1 Thông tư số 07/2016/TT-BCA ngày 01 tháng 2 năm 2016 của Bộ trưởng Bộ Công an) + 000. Ví dụ: Hà Nội thì ghi là 01000.- Riêng đối với trẻ em hoặc người đã hiến bộ phận cơ thể người thì thực hiện theo quy định tại Điều 10 Thông tư số 30/2020/TT-BYT;- Trường hợp người bệnh không KBCB BHYT thì để trống trường thông tin này.', dinhChinh4750: '', dieuChinh: '' },
        { stt: 11, chiTieu: 'GT_THE_TU', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '8', dienGiai130: 'Ghi thời điểm thẻ BHYT bắt đầu có giá trị sử dụng, gồm 08 ký tự, bao gồm: 04 ký tự năm + 02 ký tự tháng + 02 ký tự ngày.\nLưu ý đối với một số trường hợp sau:\n- Trường hợp người bệnh KBCB BHYT nhưng chưa có thẻ BHYT: Thay thời điểm thẻ BHYT có giá trị bằng thời gian người bệnh vào cơ sở KBCB (gồm 08 ký tự, bao gồm: 04 ký tự năm + 02 ký tự tháng + 02 ký tự ngày);\n- Trường hợp thẻ BHYT các đối tượng có mã QN, HC, LS, XK, CY, CA do BHXH Bộ Quốc phòng, BHXH Bộ Công an cấp mà không tra cứu được thì ghi thời điểm thẻ có giá trị sử dụng ghi trên thẻ giấy;\n- Trường hợp người bệnh không KBCB BHYT thì để trống trường thông tin này.', dinhChinh4750: '', dieuChinh: '' },
        { stt: 12, chiTieu: 'GT_THE_DEN', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '8', dienGiai130: 'Ghi thời điểm thẻ BHYT hết giá trị sử dụng', dinhChinh4750: '', dieuChinh: '' },
        { stt: 13, chiTieu: 'MIEN_CUNG_CT', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '8', dienGiai130: 'Miễn cùng chi trả', dinhChinh4750: '', dieuChinh: '' },
        { stt: 14, chiTieu: 'TEN_BENH', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '2000', dienGiai130: 'Tên bệnh', dinhChinh4750: '', dieuChinh: '' },
        { stt: 15, chiTieu: 'MA_BENH', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '7', dienGiai130: 'Mã bệnh', dinhChinh4750: '', dieuChinh: '' },
        { stt: 16, chiTieu: 'MA_BENHKHAC', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '255', dienGiai130: 'Mã bệnh khác', dinhChinh4750: '', dieuChinh: '' },
        { stt: 17, chiTieu: 'MA_LYDO_VVIEN', kieuDuLieu: 'Số', kichThuocToiDa: '1', dienGiai130: 'Lý do vào viện', dinhChinh4750: '', dieuChinh: '' },
        { stt: 18, chiTieu: 'MA_NOI_CHUYEN', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '5', dienGiai130: 'Mã nơi chuyển', dinhChinh4750: '', dieuChinh: '' },
        { stt: 19, chiTieu: 'MA_TAI_NAN', kieuDuLieu: 'Số', kichThuocToiDa: '1', dienGiai130: 'Mã tai nạn', dinhChinh4750: '', dieuChinh: '' },
        { stt: 20, chiTieu: 'NGAY_VAO', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '12', dienGiai130: 'Ngày vào', dinhChinh4750: '', dieuChinh: '' },
        { stt: 21, chiTieu: 'NGAY_RA', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '12', dienGiai130: 'Ngày ra', dinhChinh4750: '', dieuChinh: '' },
        { stt: 22, chiTieu: 'SO_NGAY_DTRI', kieuDuLieu: 'Số', kichThuocToiDa: '4', dienGiai130: 'Số ngày điều trị', dinhChinh4750: '', dieuChinh: '' },
        { stt: 23, chiTieu: 'KET_QUA_DTRI', kieuDuLieu: 'Số', kichThuocToiDa: '1', dienGiai130: 'Kết quả điều trị', dinhChinh4750: '', dieuChinh: '' },
        { stt: 24, chiTieu: 'TINH_TRANG_RV', kieuDuLieu: 'Số', kichThuocToiDa: '1', dienGiai130: 'Tình trạng ra viện', dinhChinh4750: '', dieuChinh: '' },
        { stt: 25, chiTieu: 'NGAY_TTOAN', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '12', dienGiai130: 'Ngày thanh toán', dinhChinh4750: '', dieuChinh: '' },
        { stt: 26, chiTieu: 'T_TONGCHI', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tổng chi', dinhChinh4750: '', dieuChinh: '' },
        { stt: 27, chiTieu: 'T_XETNGHIEM', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền xét nghiệm', dinhChinh4750: '', dieuChinh: '' },
        { stt: 28, chiTieu: 'T_CDHA', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền CĐHA', dinhChinh4750: '', dieuChinh: '' },
        { stt: 29, chiTieu: 'T_THUOC', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền thuốc', dinhChinh4750: '', dieuChinh: '' },
        { stt: 30, chiTieu: 'T_MAU', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền máu', dinhChinh4750: '', dieuChinh: '' },
        { stt: 31, chiTieu: 'T_PTTT', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền PTTT', dinhChinh4750: '', dieuChinh: '' },
        { stt: 32, chiTieu: 'T_VTYT', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền VTYT', dinhChinh4750: '', dieuChinh: '' },
        { stt: 33, chiTieu: 'T_DVKT_TYLE', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền DVKT tỷ lệ', dinhChinh4750: '', dieuChinh: '' },
        { stt: 34, chiTieu: 'T_THUOC_TYLE', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền thuốc tỷ lệ', dinhChinh4750: '', dieuChinh: '' },
        { stt: 35, chiTieu: 'T_VTYT_TYLE', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền VTYT tỷ lệ', dinhChinh4750: '', dieuChinh: '' },
        { stt: 36, chiTieu: 'T_KHAM', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền khám', dinhChinh4750: '', dieuChinh: '' },
        { stt: 37, chiTieu: 'T_GIUONG', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền giường', dinhChinh4750: '', dieuChinh: '' },
        { stt: 38, chiTieu: 'T_VCHUYEN', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Tiền vận chuyển', dinhChinh4750: '', dieuChinh: '' },
        { stt: 39, chiTieu: 'T_BNTT', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Bệnh nhân thanh toán', dinhChinh4750: '', dieuChinh: '' },
        { stt: 40, chiTieu: 'T_BHTT', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Bảo hiểm thanh toán', dinhChinh4750: '', dieuChinh: '' },
        { stt: 41, chiTieu: 'T_NGUONKHAC', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Nguồn khác', dinhChinh4750: '', dieuChinh: '' },
        { stt: 42, chiTieu: 'T_NGOAIDS', kieuDuLieu: 'Số', kichThuocToiDa: '15', dienGiai130: 'Ngoài định suất', dinhChinh4750: '', dieuChinh: '' },
        { stt: 43, chiTieu: 'NAM_QT', kieuDuLieu: 'Số', kichThuocToiDa: '4', dienGiai130: 'Năm quyết toán', dinhChinh4750: '', dieuChinh: '' },
        { stt: 44, chiTieu: 'THANG_QT', kieuDuLieu: 'Số', kichThuocToiDa: '2', dienGiai130: 'Tháng quyết toán', dinhChinh4750: '', dieuChinh: '' },
        { stt: 45, chiTieu: 'MA_LOAI_KCB', kieuDuLieu: 'Số', kichThuocToiDa: '1', dienGiai130: 'Mã loại KCB', dinhChinh4750: '', dieuChinh: '' },
        { stt: 46, chiTieu: 'MA_KHOA', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '15', dienGiai130: 'Mã khoa', dinhChinh4750: '', dieuChinh: '' },
        { stt: 47, chiTieu: 'MA_CSKCB', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '5', dienGiai130: 'Mã cơ sở KCB', dinhChinh4750: '', dieuChinh: '' },
        { stt: 48, chiTieu: 'MA_KHUVUC', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '2', dienGiai130: 'Mã khu vực', dinhChinh4750: '', dieuChinh: '' },
        { stt: 49, chiTieu: 'MA_PTTT_QT', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '5', dienGiai130: 'Mã PTTT quyết toán', dinhChinh4750: '', dieuChinh: '' },
        { stt: 50, chiTieu: 'CAN_NANG', kieuDuLieu: 'Số', kichThuocToiDa: '5', dienGiai130: 'Cân nặng', dinhChinh4750: '', dieuChinh: '' },
        { stt: 51, chiTieu: 'MA_TTDV', kieuDuLieu: 'Chuỗi', kichThuocToiDa: '15', dienGiai130: 'Mã TTDV', dinhChinh4750: '', dieuChinh: 'Mới' }
    ],
    'XML2': [
        'MA_LK', 'STT', 'MA_THUOC', 'MA_NHOM', 'TEN_THUOC', 'DON_VI_TINH', 'HAM_LUONG',
        'DUONG_DUNG', 'LIEU_DUNG', 'SO_DANG_KY', 'TT_THAU', 'PHAM_VI', 'TY_LE_TT', 'SO_LUONG',
        'DON_GIA', 'THANH_TIEN', 'MUC_HUONG', 'T_NGUONKHAC', 'T_BNTT', 'T_BHTT', 'T_BNCCT',
        'T_NGOAIDS', 'MA_KHOA', 'MA_BAC_SI', 'MA_BENH', 'NGAY_YL', 'NGAY_KQ', 'MA_PTTT'
    ].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML3': [
        'MA_LK', 'STT', 'MA_DICH_VU', 'MA_VAT_TU', 'MA_NHOM', 'GOI_VTYT', 'TEN_VAT_TU', 'TEN_DICH_VU',
        'DON_VI_TINH', 'PHAM_VI', 'SO_LUONG', 'DON_GIA', 'DON_GIA_BH', 'TT_THAU', 'TY_LE_TT', 'TYLE_TT_BH', 'TYLE_TT_DV', 'THANH_TIEN',
        'THANH_TIEN_BH', 'THANH_TIEN_BV', 'T_TRANTT',
        'MUC_HUONG', 'T_NGUONKHAC', 'T_BNTT', 'T_BHTT', 'T_BNCCT', 'T_NGOAIDS', 'MA_KHOA', 'MA_GIUONG',
        'MA_BAC_SI', 'MA_BENH', 'NGAY_YL', 'NGAY_TH_YL', 'NGAY_KQ', 'MA_PTTT', 'MA_MAY', 'NGUOI_THUC_HIEN'
    ].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML4': [
        'MA_LK', 'STT', 'MA_DICH_VU', 'MA_CHI_SO', 'TEN_CHI_SO', 'GIA_TRI', 'DON_VI_DO',
        'MO_TA', 'KET_LUAN', 'NGAY_KQ', 'MA_BS_DOC_KQ', 'NGUOI_THUC_HIEN'
    ].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML5': [
        'MA_LK', 'STT', 'DIEN_BIEN', 'HOI_CHAN', 'PHAU_THUAT', 'NGAY_YL', 'NGUOI_THUC_HIEN'
    ].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML6': [],
    'XML7': [
        'MA_LK', 'SO_LUU_TRU', 'MA_YTE', 'MA_KHOA', 'NGAY_VAO', 'NGAY_RA', 'MA_BENH',
        'CHAN_DOAN', 'PP_DIEU_TRI', 'LOI_DAN_BS', 'GHI_CHU', 'MA_TTDV', 'NGAY_CT', 'MA_THE_TAM',
        'HO_TEN_CHA', 'HO_TEN_ME', 'NGUOI_GIAM_HO', 'MA_BS'
    ].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML8': [
        'MA_LK', 'MA_LOAI_KCB', 'HO_TEN_CHA', 'HO_TEN_ME', 'NGUOI_GIAM_HO',
        'DON_VI', 'NGAY_VAO', 'NGAY_RA', 'CHAN_DOAN_VAO', 'CHAN_DOAN_RV',
        'QT_BENHLY', 'TOMTAT_KQ', 'PP_DIEUTRI', 'NGAY_SINHCON', 'NGAY_CONCHET',
        'SO_CONCHET', 'KET_QUA_DTRI', 'GHI_CHU', 'MA_TTDV', 'NGAY_CT', 'MA_THE_TAM', 'DU_PHONG'
    ].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML9': [
        'MA_LK', 'MA_BHXH_NND', 'MA_THE_NND', 'HO_TEN_NND', 'NGAYSINH_NND', 'MA_DANTOC_NND',
        'SO_CCCD_NND', 'NGAYCAP_CCCD_NND', 'NOICAP_CCCD_NND', 'NOI_CU_TRU_NND', 'MA_QUOCTICH',
        'MATINH_CU_TRU', 'MAXA_CU_TRU', 'HO_TEN_CHA', 'MA_THE_TAM', 'HO_TEN_CON', 'GIOI_TINH_CON',
        'SO_CON', 'LAN_SINH', 'SO_CON_SONG', 'CAN_NANG_CON', 'NGAY_SINH_CON', 'NOI_SINH_CON',
        'TINH_TRANG_CON', 'SINHCON_PHAUTHUAT', 'SINHCON_DUOI32TUAN', 'GHI_CHU', 'NGUOI_DO_DE',
        'NGAY_CT', 'SO', 'QUYEN_SO', 'NGUOI_GHI_PHIEU'
    ].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML10': [],
    'XML11': [
        'MA_LK', 'S0_SERI', 'SO_CT', 'NGAY_CT', 'MA_NHOM', 'MA_DV', 'THANH_TIEN',
        'THUE_SUAT', 'TIEN_THUE', 'TONG_TIEN', 'TY_LE', 'MA_TIEU_CHI'
    ].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML12': [],
    'XML13': ['MA_LK', 'SO_HO_SO', 'MA_TTHC', 'MA_DOI_TUONG_KCB', 'NGAY_KY', 'NGUOI_KY'].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML14': ['MA_LK', 'SO_GIAY_HEN', 'NGAY_HEN'].map((field, idx) => ({ stt: idx + 1, chiTieu: field, kieuDuLieu: '', kichThuocToiDa: '', dienGiai130: '', dinhChinh4750: '', dieuChinh: '' })),
    'XML15': []
};

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getXmlDataList } from '@/lib/xml';
import { getCurrentUser } from '@/actions/auth';

function parseNumber(val: any): number {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(String(val).replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
}

export async function POST(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 });
        }

        const body = await req.json();
        const { maLk, postEditRecord } = body;

        if (!maLk) {
            return NextResponse.json({ error: 'Thiếu mã liên kết (MA_LK)' }, { status: 400 });
        }

        // 1. Tìm bản XML trước sửa (isPreEdit = true)
        const preEditXml1 = await (prisma as any).xml1.findFirst({
            where: {
                MA_LK: String(maLk),
                isPreEdit: true
            },
            include: {
                xml2Records: true,
                xml3Records: true,
                xml4Records: true,
                xml5Records: true,
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!preEditXml1) {
            return NextResponse.json({ 
                error: `Không tìm thấy bản XML trước sửa của hồ sơ ${maLk} trong Cơ sở dữ liệu.` 
            }, { status: 404 });
        }

        // 2. Lấy dữ liệu bản sau sửa: Hoặc từ postEditRecord gửi lên, hoặc tìm bản mới nhất trong DB
        let postXml1Data: any = null;
        let postXml2List: any[] = [];
        let postXml3List: any[] = [];

        if (postEditRecord) {
            // Nạp từ file người dùng upload
            postXml1Data = postEditRecord.summary || {};
            const g2 = postEditRecord.groups?.find((g: any) => g.type === 'XML2');
            const g3 = postEditRecord.groups?.find((g: any) => g.type === 'XML3');
            postXml2List = g2 ? getXmlDataList(g2) : [];
            postXml3List = g3 ? getXmlDataList(g3) : [];
        } else {
            // Tìm bản ghi mới nhất không phải preEdit trong DB
            const latestDbRecord = await (prisma as any).xml1.findFirst({
                where: {
                    MA_LK: String(maLk),
                    isPreEdit: false
                },
                include: {
                    xml2Records: true,
                    xml3Records: true,
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!latestDbRecord) {
                return NextResponse.json({ 
                    error: `Chưa có bản XML sau sửa của hồ sơ ${maLk}. Vui lòng tải file XML sau sửa lên để đối chiếu.` 
                }, { status: 404 });
            }

            postXml1Data = latestDbRecord;
            postXml2List = latestDbRecord.xml2Records || [];
            postXml3List = latestDbRecord.xml3Records || [];
        }

        // --- SO SÁNH XML1 ---
        const xml1Fields = [
            { key: 'HO_TEN', label: 'Họ tên người bệnh' },
            { key: 'NGAY_SINH', label: 'Ngày sinh' },
            { key: 'MA_THE_BHYT', label: 'Mã thẻ BHYT' },
            { key: 'NGAY_VAO', label: 'Ngày vào viện' },
            { key: 'NGAY_RA', label: 'Ngày ra viện' },
            { key: 'MA_BENH_CHINH', label: 'Mã bệnh chính' },
            { key: 'CHAN_DOAN_RV', label: 'Chẩn đoán ra viện' },
            { key: 'MA_BENH_KT', label: 'Mã bệnh kèm theo' },
            { key: 'T_TONGCHI_BV', label: 'Tổng chi phí BV' },
            { key: 'T_TONGCHI_BH', label: 'Tổng chi phí BH' },
            { key: 'T_BHTT', label: 'Bảo hiểm thanh toán' },
            { key: 'T_BNTT', label: 'Bệnh nhân thanh toán' },
            { key: 'T_BNCCT', label: 'Bệnh nhân cùng chi trả' },
        ];

        const xml1Diff = xml1Fields.map(f => {
            const preVal = String(preEditXml1[f.key] || '');
            const postVal = String(postXml1Data[f.key] || '');
            const isChanged = preVal.trim() !== postVal.trim();
            return {
                field: f.key,
                label: f.label,
                preValue: preVal,
                postValue: postVal,
                isChanged
            };
        });

        // --- SO SÁNH XML2 (THUỐC) ---
        const preXml2List: any[] = preEditXml1.xml2Records || [];
        const xml2Diff: any[] = [];

        // Map theo MA_THUOC + DON_GIA để nhận diện thuốc chính xác
        const preXml2Map = new Map<string, any>();
        preXml2List.forEach((item, idx) => {
            const key = `${item.MA_THUOC || ''}_${parseNumber(item.DON_GIA)}`;
            preXml2Map.set(key, { ...item, originalIdx: idx });
        });

        const matchedPreXml2Keys = new Set<string>();

        postXml2List.forEach((postItem, idx) => {
            const key = `${postItem.MA_THUOC || ''}_${parseNumber(postItem.DON_GIA)}`;
            const preItem = preXml2Map.get(key);

            if (preItem) {
                matchedPreXml2Keys.add(key);
                const preQty = parseNumber(preItem.SO_LUONG);
                const postQty = parseNumber(postItem.SO_LUONG);
                const preTien = parseNumber(preItem.THANH_TIEN);
                const postTien = parseNumber(postItem.THANH_TIEN);

                const isQtyChanged = Math.abs(preQty - postQty) > 0.001;
                const isTienChanged = Math.abs(preTien - postTien) > 1;

                xml2Diff.push({
                    type: isQtyChanged || isTienChanged ? 'MODIFIED' : 'UNCHANGED',
                    maThuoc: postItem.MA_THUOC,
                    tenThuoc: postItem.TEN_THUOC || preItem.TEN_THUOC,
                    donViTinh: postItem.DON_VI_TINH || preItem.DON_VI_TINH,
                    donGia: postItem.DON_GIA,
                    preSoLuong: preQty,
                    postSoLuong: postQty,
                    diffSoLuong: postQty - preQty,
                    preThanhTien: preTien,
                    postThanhTien: postTien,
                    diffThanhTien: postTien - preTien,
                    ngayYl: postItem.NGAY_YL || preItem.NGAY_YL,
                });
            } else {
                // Thêm mới
                const postQty = parseNumber(postItem.SO_LUONG);
                const postTien = parseNumber(postItem.THANH_TIEN);
                xml2Diff.push({
                    type: 'ADDED',
                    maThuoc: postItem.MA_THUOC,
                    tenThuoc: postItem.TEN_THUOC,
                    donViTinh: postItem.DON_VI_TINH,
                    donGia: postItem.DON_GIA,
                    preSoLuong: 0,
                    postSoLuong: postQty,
                    diffSoLuong: postQty,
                    preThanhTien: 0,
                    postThanhTien: postTien,
                    diffThanhTien: postTien,
                    ngayYl: postItem.NGAY_YL,
                });
            }
        });

        // Những thuốc có ở bản trước mà bản sau đã xóa
        preXml2List.forEach(preItem => {
            const key = `${preItem.MA_THUOC || ''}_${parseNumber(preItem.DON_GIA)}`;
            if (!matchedPreXml2Keys.has(key)) {
                const preQty = parseNumber(preItem.SO_LUONG);
                const preTien = parseNumber(preItem.THANH_TIEN);
                xml2Diff.push({
                    type: 'REMOVED',
                    maThuoc: preItem.MA_THUOC,
                    tenThuoc: preItem.TEN_THUOC,
                    donViTinh: preItem.DON_VI_TINH,
                    donGia: preItem.DON_GIA,
                    preSoLuong: preQty,
                    postSoLuong: 0,
                    diffSoLuong: -preQty,
                    preThanhTien: preTien,
                    postThanhTien: 0,
                    diffThanhTien: -preTien,
                    ngayYl: preItem.NGAY_YL,
                });
            }
        });

        // --- SO SÁNH XML3 (DVKT & VẬT TƯ) ---
        const preXml3List: any[] = preEditXml1.xml3Records || [];
        const xml3Diff: any[] = [];

        const preXml3Map = new Map<string, any>();
        preXml3List.forEach((item, idx) => {
            const key = `${item.MA_DICH_VU || item.MA_VAT_TU || ''}_${parseNumber(item.DON_GIA)}`;
            preXml3Map.set(key, { ...item, originalIdx: idx });
        });

        const matchedPreXml3Keys = new Set<string>();

        postXml3List.forEach(postItem => {
            const code = postItem.MA_DICH_VU || postItem.MA_VAT_TU || '';
            const key = `${code}_${parseNumber(postItem.DON_GIA)}`;
            const preItem = preXml3Map.get(key);

            if (preItem) {
                matchedPreXml3Keys.add(key);
                const preQty = parseNumber(preItem.SO_LUONG);
                const postQty = parseNumber(postItem.SO_LUONG);
                const preTien = parseNumber(preItem.THANH_TIEN);
                const postTien = parseNumber(postItem.THANH_TIEN);

                const isQtyChanged = Math.abs(preQty - postQty) > 0.001;
                const isTienChanged = Math.abs(preTien - postTien) > 1;

                xml3Diff.push({
                    type: isQtyChanged || isTienChanged ? 'MODIFIED' : 'UNCHANGED',
                    maDichVu: code,
                    tenDichVu: postItem.TEN_DICH_VU || postItem.TEN_VAT_TU || preItem.TEN_DICH_VU,
                    donGia: postItem.DON_GIA,
                    preSoLuong: preQty,
                    postSoLuong: postQty,
                    diffSoLuong: postQty - preQty,
                    preThanhTien: preTien,
                    postThanhTien: postTien,
                    diffThanhTien: postTien - preTien,
                    maKhoa: postItem.MA_KHOA || preItem.MA_KHOA,
                    ngayYl: postItem.NGAY_YL || preItem.NGAY_YL,
                });
            } else {
                const postQty = parseNumber(postItem.SO_LUONG);
                const postTien = parseNumber(postItem.THANH_TIEN);
                xml3Diff.push({
                    type: 'ADDED',
                    maDichVu: code,
                    tenDichVu: postItem.TEN_DICH_VU || postItem.TEN_VAT_TU,
                    donGia: postItem.DON_GIA,
                    preSoLuong: 0,
                    postSoLuong: postQty,
                    diffSoLuong: postQty,
                    preThanhTien: 0,
                    postThanhTien: postTien,
                    diffThanhTien: postTien,
                    maKhoa: postItem.MA_KHOA,
                    ngayYl: postItem.NGAY_YL,
                });
            }
        });

        preXml3List.forEach(preItem => {
            const code = preItem.MA_DICH_VU || preItem.MA_VAT_TU || '';
            const key = `${code}_${parseNumber(preItem.DON_GIA)}`;
            if (!matchedPreXml3Keys.has(key)) {
                const preQty = parseNumber(preItem.SO_LUONG);
                const preTien = parseNumber(preItem.THANH_TIEN);
                xml3Diff.push({
                    type: 'REMOVED',
                    maDichVu: code,
                    tenDichVu: preItem.TEN_DICH_VU || preItem.TEN_VAT_TU,
                    donGia: preItem.DON_GIA,
                    preSoLuong: preQty,
                    postSoLuong: 0,
                    diffSoLuong: -preQty,
                    preThanhTien: preTien,
                    postThanhTien: 0,
                    diffThanhTien: -preTien,
                    maKhoa: preItem.MA_KHOA,
                    ngayYl: preItem.NGAY_YL,
                });
            }
        });

        // --- TÍNH TỔNG QUAN BIẾN ĐỘNG CHI PHÍ ---
        const preTongChi = parseNumber(preEditXml1.T_TONGCHI_BV || preEditXml1.T_TONGCHI_BH);
        const postTongChi = parseNumber(postXml1Data.T_TONGCHI_BV || postXml1Data.T_TONGCHI_BH);
        const diffTongChi = postTongChi - preTongChi;

        const preBhtt = parseNumber(preEditXml1.T_BHTT);
        const postBhtt = parseNumber(postXml1Data.T_BHTT);
        const diffBhtt = postBhtt - preBhtt;

        const preBntt = parseNumber(preEditXml1.T_BNTT);
        const postBntt = parseNumber(postXml1Data.T_BNTT);
        const diffBntt = postBntt - preBntt;

        const preBncct = parseNumber(preEditXml1.T_BNCCT);
        const postBncct = parseNumber(postXml1Data.T_BNCCT);
        const diffBncct = postBncct - preBncct;

        const summary = {
            maLk,
            hoTen: postXml1Data.HO_TEN || preEditXml1.HO_TEN,
            maBn: postXml1Data.MA_BN || preEditXml1.MA_BN,
            editDept: preEditXml1.editDept || preEditXml1.MA_KHOA,
            editReason: preEditXml1.editReason,
            preEditSavedAt: preEditXml1.createdAt,
            preEditSavedBy: preEditXml1.preEditSavedBy,
            ngayDeNghiTT: preEditXml1.ngayDeNghiTT,
            
            preTongChi,
            postTongChi,
            diffTongChi,

            preBhtt,
            postBhtt,
            diffBhtt,

            preBntt,
            postBntt,
            diffBntt,

            preBncct,
            postBncct,
            diffBncct,

            soThuocThem: xml2Diff.filter(i => i.type === 'ADDED').length,
            soThuocXoa: xml2Diff.filter(i => i.type === 'REMOVED').length,
            soThuocSua: xml2Diff.filter(i => i.type === 'MODIFIED').length,

            soDvktThem: xml3Diff.filter(i => i.type === 'ADDED').length,
            soDvktXoa: xml3Diff.filter(i => i.type === 'REMOVED').length,
            soDvktSua: xml3Diff.filter(i => i.type === 'MODIFIED').length,

            hasIcdChanged: (preEditXml1.MA_BENH_CHINH || '') !== (postXml1Data.MA_BENH_CHINH || '')
        };

        return NextResponse.json({
            success: true,
            summary,
            xml1Diff,
            xml2Diff,
            xml3Diff
        });

    } catch (error: any) {
        console.error('Lỗi compare-pre-post-edit:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

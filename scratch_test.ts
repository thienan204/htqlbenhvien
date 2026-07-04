import { ValidationEngine, DEFAULT_RULES } from './src/lib/validation';

const record = {
    id: '1',
    summary: {
        MA_LK: 'LK1',
        NGAY_VAO: '202401010000',
        NGAY_RA: '202401020000'
    },
    groups: [
        {
            type: 'XML3',
            data: {
                CHITIEU_CHITIET_DVKT_VTYT: {
                    DSACH_CHI_TIET_DVKT: {
                        CHI_TIET_DVKT: [
                            { MA_DICH_VU: 'DV1', NGAY_YL: '202312310000', NGAY_KQ: null, NGAY_TH_YL: '202401030000' }
                        ]
                    }
                }
            }
        }
    ],
    validationResults: []
};

const engine = new ValidationEngine(DEFAULT_RULES, {});
engine.setContextRecords([record]);
const results = engine.validate(record);
console.log('Results:', results);

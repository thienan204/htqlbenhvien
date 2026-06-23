import { ValidationEngine } from './src/lib/validation';

const rule = {
    id: "test",
    active: true,
    type: "Xuất toán" as any,
    xmlType: "XML3",
    code: "!EXISTS_IN('Mau04Catalog.MA_VAT_TU', MA_VAT_TU)",
    conditionField: "MA_NHOM",
    conditionValue: "10",
    name: "test"
};

const record = {
    groups: [
        {
            type: "XML3",
            data: {
                CHITIEU_CHITIET_DVKT_VTYT: {
                    DSACH_CHI_TIET_DVKT: {
                        CHI_TIET_DVKT: [
                            { MA_NHOM: "10", MA_VAT_TU: "N04.03.030" }, // should pass (no error)
                            { MA_NHOM: "10", MA_VAT_TU: "FAKE" },      // should fail (error)
                            { MA_NHOM: "8", MA_VAT_TU: "FAKE" }        // should skip
                        ]
                    }
                }
            }
        }
    ]
};

const masterData = {
    "Mau04Catalog.MA_VAT_TU": new Set(["N04.03.030", "N04.04.010"])
};

const engine = new ValidationEngine([rule], masterData);
const results = engine.validate(record as any);
console.log(JSON.stringify(results, null, 2));

import { ValidationEngine } from '../src/lib/validation';

// Mock record
const record = {
    groups: [
        { type: 'XML1', data: { TONG_HOP: { MA_LOAI_KCB: '02' } } },
        { type: 'XML8', data: { TOM_TAT_BA: { MA_LK: '123' } } } // NGAY_CT is missing
    ]
};

// Test evaluateMath instead
const rulesMath = [
    {
        id: '2',
        active: true,
        type: 'Xuất toán',
        xmlType: 'XML8',
        name: 'Test Rule Math',
        mathExpression: "(XML1?.MA_LOAI_KCB == '02' || XML1?.MA_LOAI_KCB == '03') && (!XML8?.TOM_TAT_BA?.NGAY_CT)"
    }
];
const engine2 = new ValidationEngine(rulesMath, {});
const results2 = engine2.validate(record as any);
console.log("Results with math expression:", results2);

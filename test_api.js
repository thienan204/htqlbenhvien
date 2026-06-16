async function test() {
    const r1 = await fetch('http://localhost:3000/api/equipments');
    const eqs = await r1.json();
    console.log("Equipments count:", eqs.length);
    if (eqs.length > 0) {
        const id = eqs[0].id;
        console.log("Deleting id:", id);
        const r2 = await fetch('http://localhost:3000/api/equipments/' + id, { method: 'DELETE' });
        console.log("Delete status:", r2.status);
        console.log("Response:", await r2.text());
    }
}
test();

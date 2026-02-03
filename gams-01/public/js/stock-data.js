
const stockItems = [
    { id: 'ITM001', name: 'Kertas HVS A4 75 gr', unit: 'Rim', category: 'Office Supplies' },
    { id: 'ITM002', name: 'Baterai Alkaline A3', unit: 'Pcs', category: 'Electronics' },
    { id: 'ITM003', name: 'PP Pocket Bambi', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM004', name: 'Kertas HVS A3', unit: 'Rim', category: 'Office Supplies' },
    { id: 'ITM005', name: 'Tatakan Mouse', unit: 'Pcs', category: 'Computer Accessories' },
    { id: 'ITM006', name: 'Container Box', unit: 'Pcs', category: 'Storage' },
    { id: 'ITM007', name: 'Lakban Bening Besar', unit: 'Roll', category: 'Adhesives' },
    { id: 'ITM008', name: 'Keyboard Wireless (bluetooth) Logitech', unit: 'Pcs', category: 'Computer Accessories' },
    { id: 'ITM009', name: 'Mouse Wireless (bluetooth) Logitech M240', unit: 'Pcs', category: 'Computer Accessories' },
    { id: 'ITM010', name: 'Post It Plastic', unit: 'Pack', category: 'Office Supplies' },
    { id: 'ITM011', name: 'Tinta Isi Ulang (Tinta Trodat 7081 Blue)', unit: 'Btl', category: 'Office Supplies' },
    { id: 'ITM012', name: 'Paper Clips No.2', unit: 'Box', category: 'Office Supplies' },
    { id: 'ITM013', name: 'Binder Clip No.105', unit: 'Box', category: 'Office Supplies' },
    { id: 'ITM014', name: 'Tinta Stample Permanent (Nobu Ink Biru)', unit: 'Btl', category: 'Office Supplies' },
    { id: 'ITM015', name: 'Spidol Merah', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM016', name: 'Kenko Pulpen Retrocable Gel Pen', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM017', name: 'Pencabut Stapler', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM018', name: 'Tempat Pensil Clip Meja', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM019', name: 'Cable HDMI 1,5 M Vention', unit: 'Pcs', category: 'Electronics' },
    { id: 'ITM020', name: 'Clear Holder', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM021', name: 'Kop Surat', unit: 'Rim', category: 'Office Supplies' },
    { id: 'ITM022', name: 'Glue Stick Kenko Ukuran 25 gr', unit: 'Pcs', category: 'Adhesives' },
    { id: 'ITM023', name: 'Double Tape Foam 3mm - 18mm', unit: 'Roll', category: 'Adhesives' },
    { id: 'ITM024', name: 'Papan Ujian / Papan Jalan Model Kayu', unit: 'Pcs', category: 'Equipment' },
    { id: 'ITM025', name: 'Kalung name tag', unit: 'Pcs', category: 'Accessories' },
    { id: 'ITM026', name: 'Kertas Concorde A4 90 gr', unit: 'Rim', category: 'Office Supplies' },
    { id: 'ITM027', name: 'Bambi A4', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM028', name: 'Bambi F4', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM029', name: 'Roll Kabel Gulung', unit: 'Pcs', category: 'Electronics' },
    { id: 'ITM030', name: 'Acco Paper Fastener JENIA Putih/Ako Plastik/Pengikat Penjepit Kertas Plastik White', unit: 'Box', category: 'Office Supplies' },
    { id: 'ITM031', name: 'Joyko Stamp All Color', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM032', name: 'Staples Tembak Banner', unit: 'Box', category: 'Office Supplies' },
    { id: 'ITM033', name: 'Map Coklat A4', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM034', name: 'Card Case A4', unit: 'Pcs', category: 'Office Supplies' },
    { id: 'ITM035', name: 'Punch Blade Heavy Duty Punch (2 Hole) - HDP 260 N (Mata Pisau)', unit: 'Pcs', category: 'Equipment' },
    { id: 'ITM036', name: 'Isi Staples Tembak 13/4-6-8 Joyko', unit: 'Box', category: 'Office Supplies' },
    { id: 'ITM037', name: 'Pixma Canon (790 = C)', unit: 'Pcs', category: 'Electronics' },
    { id: 'ITM038', name: 'Papan Jalan', unit: 'Pcs', category: 'Equipment' },
    { id: 'ITM039', name: 'Lakban Anti Slip Tonata 5 cm x 5 meter', unit: 'Roll', category: 'Safety Equipment' },
    { id: 'ITM040', name: 'Lakban Vynil Lantai Kuning Hitam 33 meter', unit: 'Roll', category: 'Safety Equipment' },
    { id: 'ITM041', name: 'Police Line Safety', unit: 'Roll', category: 'Safety Equipment' },
    { id: 'ITM042', name: 'Type C to RJ45 Adapter', unit: 'Pcs', category: 'Electronics' },
    { id: 'ITM043', name: 'Paket Alat Lem Tembak Glue Gun Joyko 60 watt', unit: 'Set', category: 'Tools' },
    { id: 'ITM044', name: 'Joyko Tape Cutter TD - 3', unit: 'Pcs', category: 'Office Supplies' }
];


function generateStockReportData() {
    const departments = ['HRGA Legal', 'WH (Warehouse)', 'IT', 'Sales', 'FAT (Finance Accounting Tax)', 'Production', 'PPIC Warehouse EXIM (Export Import)', 'Maintenance'];
    const pics = ['Admin', 'CS Staff', 'Supervisor', 'Manager'];
    const receivers = ['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Brown', 'Charlie Davis', 'David Lee', 'Eva Green', 'Frank Miller', 'Grace Taylor', 'Henry Clark', 'Ivy Johnson', 'Jack Anderson', 'Kate Thompson', 'Liam Garcia', 'Mia Rodriguez'];
    const processes = ['Requested', 'Approved', 'Delivered', 'Pending'];

    const reportData = [];
    const today = new Date();

    stockItems.forEach((item, index) => {
        const transactionCount = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < transactionCount; i++) {
            const daysAgo = Math.floor(Math.random() * 60);
            const transactionDate = new Date(today.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
            const processDate = new Date(transactionDate.getTime() + (Math.floor(Math.random() * 5) * 24 * 60 * 60 * 1000));

            let maxQty = 10;
            let initialStock = 50;
            
            if (item.unit === 'Rim') {
                maxQty = 5;
                initialStock = 100;
            } else if (item.unit === 'Box') {
                maxQty = 3;
                initialStock = 25;
            } else if (item.unit === 'Roll') {
                maxQty = 8;
                initialStock = 40;
            } else if (item.category === 'Computer Accessories' || item.category === 'Electronics') {
                maxQty = 2;
                initialStock = 15;
            }

            const transaction = {
                transactionDate: transactionDate.toISOString().split('T')[0],
                itemId: item.id,
                itemName: item.name,
                initial: initialStock + Math.floor(Math.random() * 50),
                qty: Math.floor(Math.random() * maxQty) + 1,
                unit: item.unit,
                process: processes[Math.floor(Math.random() * processes.length)],
                processDate: processDate.toISOString().split('T')[0],
                dept: departments[Math.floor(Math.random() * departments.length)],
                pic: pics[Math.floor(Math.random() * pics.length)],
                reqDept: departments[Math.floor(Math.random() * departments.length)],
                receiver: receivers[Math.floor(Math.random() * receivers.length)],
                category: item.category
            };

            reportData.push(transaction);
        }
    });


    return reportData.sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
}


if (typeof module !== 'undefined' && module.exports) {
    module.exports = { stockItems, generateStockReportData };
}
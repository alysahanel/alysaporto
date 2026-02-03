const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
require('dotenv').config();

const { pool } = require('../src/config/database');
const itemModel = require('../src/models/itemModel');
const { generateNextItemId, validateItemIdFormat, itemIdExists } = require('../src/utils/itemIdGenerator');

function usage() {
  console.log('Usage: node scripts/importItemsFromExcel.js --file "C:\\path\\to\\file.xlsx" [--dry-run]');
}

function getArg(name, fallback) {
  const idx = process.argv.findIndex(a => a === `--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

// Try multiple header aliases for flexible mapping
const NAME_KEYS = ['item_name','Item Name','Nama','Name','Barang','Item','ATK Name','Nama Barang','Nama Item'];
const DETAIL_KEYS = ['detail','Detail','Brand','Merk','Description','Deskripsi','Keterangan','Spec','Spesifikasi'];
const UNIT_KEYS = ['unit','Unit','Satuan','UOM','uom','Units'];
const STOCK_KEYS = ['stock','Stock','Stok','Qty','Quantity','current_stock','Current Stock'];
const MIN_STOCK_KEYS = ['min_stock','Min Stock','Minimum','Reorder Level','reorder_level','Min'];
const ITEM_ID_KEYS = ['item_id','Item ID','Kode','Code'];

function pickField(row, keys) {
  const normalized = Object.keys(row).reduce((acc, k) => {
    acc[k.toLowerCase().trim()] = row[k];
    return acc;
  }, {});
  for (const key of keys) {
    const val = normalized[key.toLowerCase()];
    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
  }
  return '';
}

function toNumber(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = Number(String(value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return Number.isFinite(num) ? num : defaultValue;
}

async function existsByNameAndUnit(name, unit) {
  const [rows] = await pool.execute(
    'SELECT id FROM items WHERE (is_deleted IS NULL OR is_deleted = 0) AND item_name = ? AND unit = ? LIMIT 1',
    [name, unit]
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function run() {
  const defaultPath = 'C\\\Users\\micha\\Documents\\web ga\\ATK_cleaned_brand_first.xlsx';
  const fileArg = getArg('file', defaultPath);
  const dryRun = hasFlag('dry-run');

  if (!fileArg) {
    usage();
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error('❌ File not found:', filePath);
    process.exit(1);
  }

  console.log('📄 Reading Excel:', filePath);
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (!rows || rows.length === 0) {
    console.error('❌ No data rows found in the first sheet');
    process.exit(1);
  }

  console.log(`🔎 Detected ${rows.length} row(s). Starting import...${dryRun ? ' (dry-run)' : ''}`);

  let inserted = 0;
  let skipped = 0;
  let duplicates = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const itemName = pickField(r, NAME_KEYS);
    let detail = pickField(r, DETAIL_KEYS);
    const unit = pickField(r, UNIT_KEYS) || 'pcs';
    const stock = toNumber(pickField(r, STOCK_KEYS), 0);
    const minStock = toNumber(pickField(r, MIN_STOCK_KEYS), 10);
    let providedItemId = pickField(r, ITEM_ID_KEYS);

    if (!itemName) {
      skipped++;
      console.warn(`⚠️  Row ${i + 1}: missing item name. Skipping.`);
      continue;
    }

    // Normalize detail: keep it concise
    if (detail.length > 300) {
      detail = detail.slice(0, 300);
    }

    try {
      // Duplicate check by name + unit
      const existingId = await existsByNameAndUnit(itemName, unit);
      if (existingId) {
        duplicates++;
        console.log(`↩️  Duplicate found for "${itemName}" (${unit}). Skipping.`);
        continue;
      }

      // Determine final item_id
      let finalItemId = providedItemId;
      if (finalItemId) {
        if (!validateItemIdFormat(finalItemId) || await itemIdExists(finalItemId)) {
          // If invalid or exists, generate new
          finalItemId = await generateNextItemId();
        }
      } else {
        finalItemId = await generateNextItemId();
      }

      const itemData = {
        item_id: finalItemId,
        item_name: itemName,
        detail: detail || '',
        unit,
        stock,
        min_stock: minStock
      };

      if (dryRun) {
        console.log(`📝 [DRY] Would insert:`, itemData);
        inserted++;
      } else {
        await itemModel.createItem(itemData);
        inserted++;
        console.log(`✅ Inserted: ${itemName} (${finalItemId}) | ${stock} ${unit}`);
      }
    } catch (err) {
      errors.push({ row: i + 1, error: err.message });
      console.error(`❌ Row ${i + 1} failed:`, err.message);
    }
  }

  console.log('\n—— Import Summary ——');
  console.log('Inserted:', inserted);
  console.log('Duplicates skipped:', duplicates);
  console.log('Missing-name skipped:', skipped);
  if (errors.length) {
    console.log('Errors:', errors.length);
    errors.slice(0, 10).forEach(e => console.log(`  Row ${e.row}: ${e.error}`));
  }

  console.log(`\n🎉 Done. ${dryRun ? 'Dry-run only (no DB changes).' : 'Data inserted into items table.'}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
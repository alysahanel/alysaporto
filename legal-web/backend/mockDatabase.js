const mockData = {
    reg_hrga: [
        { id: 1, no: 1, regulasi: 'UU 13/2003', lingkup: 'Ketenagakerjaan', pasal: 'All', deskripsi: 'Aturan kerja', kriteria: 'Wajib', kepatuhan: 'patuh', jenisHukuman: '', warnaHukuman: 'green' }
    ],
    reg_it: [
        { id: 1, no: 1, regulasi: 'UU ITE', lingkup: 'Informasi & Transaksi Elektronik', pasal: '27', deskripsi: 'Larangan distribusi konten ilegal', kriteria: 'Wajib', kepatuhan: 'patuh', jenisHukuman: 'Pidana', warnaHukuman: 'red' }
    ],
    reg_hse: [
        { id: 1, no: 1, regulasi: 'PP 50/2012', lingkup: 'K3', pasal: 'All', deskripsi: 'Penerapan SMK3', kriteria: 'Wajib', kepatuhan: 'patuh', jenisHukuman: 'Administratif', warnaHukuman: 'yellow' }
    ],
    reg_maintenance: [],
    reg_legal_compliance: [],
    reg_ppic_dmw_warehouse: [],
    reg_fat: [],
    
    company_legal_entities: [
        { id: 1, doc_name: 'Akta Pendirian PT Alysa Milano', doc_number: 'AHU-0012345', category: 'Akta', institution: 'Kemenkumham', approval_date: '2020-01-01', inactive: 0, created_at: new Date() },
        { id: 2, doc_name: 'NIB', doc_number: '1234567890', category: 'Perizinan', institution: 'OSS', approval_date: '2021-06-15', inactive: 0, created_at: new Date() }
    ],
    operational_permits: [
        { id: 1, doc_name: 'Izin Usaha', type: 'SIUP', institution: 'Pemda DKI', start_date: '2023-01-01', expired_date: '2025-01-01', remind_date: '2024-12-01', status: 'active' },
        { id: 2, doc_name: 'Izin Lingkungan', type: 'AMDAL', institution: 'KLHK', start_date: '2022-01-01', expired_date: '2027-01-01', remind_date: '2026-06-01', status: 'active' }
    ],
    safety_licenses: [
        { id: 1, name: 'Budi Santoso', document: 'Sertifikat K3', type: 'Sertifikat', institution: 'Kemnaker', start_date: '2022-01-01', expired_date: '2025-01-01', remind_date: '2024-07-01', inactive: 0 }
    ],
    elibrary: [],
    elibrary_uu: [],
    elibrary_pp: [],
    elibrary_perpres: [],
    elibrary_perda: [],
    elibrary_kawasan: [],
    elibrary_lainnya: []
};

const pool = {
  execute: async (sql, params) => { return pool.query(sql, params); },
  query: async (sql, params) => {
    const sqlLower = String(sql).toLowerCase().trim();
    const findTable = () => {
      for (const t of Object.keys(mockData)) {
        if (sqlLower.includes(t)) return t;
      }
      return null;
    };
    if (sqlLower.includes('show columns')) {
      return [[{ Field: 'no' }, { Field: 'link' }, { Field: 'notes' }, { Field: 'regulasi' }, { Field: 'lingkup' }, { Field: 'pasal' }, { Field: 'id' }], []];
    }
    if (sqlLower.includes('create table') || sqlLower.includes('create database') || sqlLower.includes('alter table') || sqlLower.includes('drop table')) {
      return [{ warningStatus: 0, affectedRows: 1 }, []];
    }
    if (sqlLower.startsWith('truncate')) {
      const t = findTable();
      if (t && Array.isArray(mockData[t])) mockData[t] = [];
      return [{ affectedRows: 0 }, []];
    }
    if (sqlLower.startsWith('delete from')) {
      const t = findTable();
      if (!t) return [{ affectedRows: 0 }, []];
      const arr = mockData[t] || [];
      const hasWhereNo = sqlLower.includes('where no');
      const hasWhereId = sqlLower.includes('where id');
      if (!hasWhereNo && !hasWhereId) {
        const affected = arr.length;
        mockData[t] = [];
        return [{ affectedRows: affected }, []];
      }
      let affected = 0;
      if (hasWhereNo) {
        const noVal = Array.isArray(params) ? Number(params[0] || 0) : 0;
        const before = arr.length;
        mockData[t] = arr.filter(r => Number(r.no || 0) !== noVal);
        affected = before - mockData[t].length;
      } else if (hasWhereId) {
        const idVal = Array.isArray(params) ? Number(params[0] || 0) : 0;
        const before = arr.length;
        mockData[t] = arr.filter(r => Number(r.id || 0) !== idVal);
        affected = before - mockData[t].length;
      }
      return [{ affectedRows: affected }, []];
    }
    if (sqlLower.startsWith('update')) {
      const t = findTable();
      if (!t) return [{ affectedRows: 0 }, []];
      const arr = mockData[t] || [];
      const byId = sqlLower.includes('where id');
      const byNo = sqlLower.includes('where no');
      const setMatch = sqlLower.match(/set\s+(.+)\s+where/);
      const setPart = setMatch ? setMatch[1] : '';
      const fields = setPart.split(',').map(s => s.trim().split('=')[0].trim()).filter(Boolean);
      const values = Array.isArray(params) ? params.slice(0, fields.length) : [];
      const keyVal = Array.isArray(params) ? params[fields.length] : null;
      let updated = 0;
      for (const r of arr) {
        if ((byId && Number(r.id || 0) === Number(keyVal)) || (byNo && Number(r.no || 0) === Number(keyVal))) {
          fields.forEach((f, i) => { r[f] = String(values[i] || ''); });
          updated++;
        }
      }
      return [{ affectedRows: updated }, []];
    }
    if (sqlLower.startsWith('insert')) {
      const t = findTable();
      if (!t) return [{ affectedRows: 0, insertId: 0 }, []];
      const colsMatch = sql.match(/\(\s*([^)]+)\s*\)\s*values/i);
      const cols = colsMatch ? colsMatch[1].split(',').map(s => s.trim().replace(/`/g, '')) : [];
      const vals = Array.isArray(params) ? params.slice() : [];
      const perRow = cols.length || (vals.length > 0 ? vals.length : 0);
      const rows = [];
      for (let i = 0; i < vals.length; i += perRow) {
        const obj = {};
        for (let c = 0; c < cols.length; c++) obj[cols[c]] = vals[i + c];
        rows.push(obj);
      }
      if (rows.length === 0 && cols.length > 0 && vals.length === 0) {
        const obj = {};
        cols.forEach(c => { obj[c] = null; });
        rows.push(obj);
      }
      if (!Array.isArray(mockData[t])) mockData[t] = [];
      let lastId = mockData[t].reduce((m, r) => Math.max(m, Number(r.id || 0)), 0);
      const startLen = mockData[t].length;
      for (const obj of rows) {
        lastId += 1;
        const row = { id: lastId, no: Number(obj.no || startLen + 1), ...obj };
        mockData[t].push(row);
      }
      return [{ affectedRows: rows.length, insertId: lastId }, []];
    }
    if (sqlLower.includes('select count(*)')) {
      const t = findTable();
      const arr = t ? (mockData[t] || []) : [];
      let count = arr.length;
      if (sqlLower.includes('as articles')) {
        count = arr.filter(r => String(r.pasal || '').trim() !== '').length;
      }
      if (sqlLower.includes('as total')) return [[{ total: count }], []];
      if (sqlLower.includes('as articles')) return [[{ articles: count }], []];
      if (sqlLower.includes('as c')) return [[{ c: count }], []];
      if (sqlLower.includes('as cnt')) return [[{ cnt: count }], []];
      return [[{ c: count }], []];
    }
    if (sqlLower.startsWith('select')) {
      const t = findTable();
      const arr = t ? (mockData[t] || []) : [];
      const limitIdx = sqlLower.indexOf('limit');
      const offsetIdx = sqlLower.indexOf('offset');
      let limit = null;
      let offset = 0;
      if (Array.isArray(params) && params.length >= 1) {
        limit = Number(params[0] || null);
        if (params.length >= 2) offset = Number(params[1] || 0);
      } else {
        if (limitIdx !== -1) {
          const m = sqlLower.substring(limitIdx).match(/limit\s+(\d+)/);
          if (m) limit = Number(m[1]);
        }
        if (offsetIdx !== -1) {
          const m = sqlLower.substring(offsetIdx).match(/offset\s+(\d+)/);
          if (m) offset = Number(m[1]);
        }
      }
      let rows = arr.slice();
      if (typeof limit === 'number') rows = rows.slice(offset, offset + limit);
      return [rows, []];
    }
    return [{ affectedRows: 0 }, []];
  },
  getConnection: async () => {
      return {
          release: () => {},
          execute: pool.execute,
          query: pool.query,
          beginTransaction: async () => {},
          commit: async () => {},
          rollback: async () => {}
      };
  },
  on: () => {}
};

export { pool };

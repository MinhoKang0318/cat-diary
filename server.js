require('dotenv').config();
const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── DB 초기화 (환경에 따라 SQLite / PostgreSQL 선택) ──────
let db;

if (process.env.DATABASE_URL) {
  // ── Production: Neon 서버리스 드라이버 (Vercel 최적화) ──
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);

  const initDB = async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS records (
        date        DATE    PRIMARY KEY,
        urine_times TEXT    NOT NULL DEFAULT '[]',
        poop_times  TEXT    NOT NULL DEFAULT '[]',
        is_hospital BOOLEAN DEFAULT FALSE,
        notes       TEXT    DEFAULT ''
      )
    `;
    await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS urine_times TEXT NOT NULL DEFAULT '[]'`.catch(() => {});
    await sql`ALTER TABLE records ADD COLUMN IF NOT EXISTS poop_times  TEXT NOT NULL DEFAULT '[]'`.catch(() => {});
  };
  initDB().catch(console.error);

  const parseRow = r => ({
    ...r,
    date:        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10),
    urine_times: typeof r.urine_times === 'string' ? JSON.parse(r.urine_times) : (r.urine_times || []),
    poop_times:  typeof r.poop_times  === 'string' ? JSON.parse(r.poop_times)  : (r.poop_times  || [])
  });

  db = {
    async getMonth(year, month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const m = Number(month);
      const nextMonth = m === 12 ? `${Number(year) + 1}-01-01` : `${year}-${String(m + 1).padStart(2, '0')}-01`;
      const rows = await sql`SELECT * FROM records WHERE date >= ${start} AND date < ${nextMonth} ORDER BY date`;
      return rows.map(parseRow);
    },
    async getOne(date) {
      const rows = await sql`SELECT * FROM records WHERE date = ${date}`;
      return rows.length ? parseRow(rows[0]) : null;
    },
    async upsert(date, { urine_times, poop_times, is_hospital, notes }) {
      const ut = JSON.stringify(urine_times);
      const pt = JSON.stringify(poop_times);
      await sql`
        INSERT INTO records (date, urine_times, poop_times, is_hospital, notes)
        VALUES (${date}, ${ut}, ${pt}, ${is_hospital}, ${notes})
        ON CONFLICT (date) DO UPDATE SET
          urine_times = EXCLUDED.urine_times,
          poop_times  = EXCLUDED.poop_times,
          is_hospital = EXCLUDED.is_hospital,
          notes       = EXCLUDED.notes
      `;
    },
    async remove(date) {
      await sql`DELETE FROM records WHERE date = ${date}`;
    }
  };

} else {
  // ── Local: Node.js 내장 SQLite ─────────────────────────
  const { DatabaseSync } = require('node:sqlite');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const sqlite = new DatabaseSync(path.join(dataDir, 'cat_health.db'));
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS records (
      date        TEXT PRIMARY KEY,
      urine_times TEXT NOT NULL DEFAULT '[]',
      poop_times  TEXT NOT NULL DEFAULT '[]',
      is_hospital INTEGER DEFAULT 0,
      notes       TEXT DEFAULT ''
    )
  `);
  // 기존 테이블에 새 컬럼 추가 (이미 있으면 무시)
  try { sqlite.exec("ALTER TABLE records ADD COLUMN urine_times TEXT NOT NULL DEFAULT '[]'"); } catch(e) {}
  try { sqlite.exec("ALTER TABLE records ADD COLUMN poop_times  TEXT NOT NULL DEFAULT '[]'"); } catch(e) {}

  const parseRow = r => ({
    ...r,
    urine_times: JSON.parse(r.urine_times || '[]'),
    poop_times:  JSON.parse(r.poop_times  || '[]')
  });

  db = {
    async getMonth(year, month) {
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return sqlite.prepare('SELECT * FROM records WHERE date LIKE ?').all(`${prefix}%`).map(parseRow);
    },
    async getOne(date) {
      const row = sqlite.prepare('SELECT * FROM records WHERE date = ?').get(date);
      return row ? parseRow(row) : null;
    },
    async upsert(date, { urine_times, poop_times, is_hospital, notes }) {
      sqlite.prepare(`
        INSERT INTO records (date, urine_times, poop_times, is_hospital, notes)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          urine_times = excluded.urine_times,
          poop_times  = excluded.poop_times,
          is_hospital = excluded.is_hospital,
          notes       = excluded.notes
      `).run(date, JSON.stringify(urine_times), JSON.stringify(poop_times), is_hospital ? 1 : 0, notes);
    },
    async remove(date) {
      sqlite.prepare('DELETE FROM records WHERE date = ?').run(date);
    }
  };

  console.log('📦 로컬 모드: SQLite 사용 중 (data/cat_health.db)');
}

// ── API 라우트 ─────────────────────────────────────────────

app.get('/api/records/:year/:month', async (req, res) => {
  try {
    const records = await db.getMonth(req.params.year, req.params.month);
    res.json(records);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/records/:date', async (req, res) => {
  try {
    const record = await db.getOne(req.params.date);
    res.json(record || { date: req.params.date, urine_times: [], poop_times: [], is_hospital: false, notes: '' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/records/:date', async (req, res) => {
  try {
    const { urine_times = [], poop_times = [], is_hospital = false, notes = '' } = req.body;
    await db.upsert(req.params.date, { urine_times, poop_times, is_hospital, notes });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/records/:date', async (req, res) => {
  try {
    await db.remove(req.params.date);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ── Vercel 서버리스 export / 로컬 서버 실행 ───────────────
module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🐱 서버 실행 중: http://localhost:${PORT}`);
  });
}

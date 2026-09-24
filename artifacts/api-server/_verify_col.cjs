const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DO_DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  const c = await p.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' AND column_name='cascade_deleted_by'`);
  console.log('cascade_deleted_by column:', JSON.stringify(c.rows));
  // Show admins with their company users
  const r = await p.query(`
    SELECT u.id, u.username, u.role, u.company_id, u.deleted_at, u.cascade_deleted_by,
           bd.business_name
    FROM users u LEFT JOIN business_details bd ON bd.id=u.company_id
    WHERE u.role IN ('admin','user') ORDER BY u.company_id NULLS LAST, u.role DESC, u.id
  `);
  console.table(r.rows);
  await p.end();
})().catch(e => { console.error(e.message); process.exit(1); });

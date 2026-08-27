import { pool } from '../config/db.js';

const PUBLIC_FIELDS = 'id, name, email, role, status, last_login_at, created_at, updated_at';

/** Find a user by id (includes password + deleted_at for internal checks). */
export async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = :id LIMIT 1', { id });
  return rows[0] || null;
}

/** Find an active user by email (includes password hash for login). */
export async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = :email AND deleted_at IS NULL LIMIT 1',
    { email }
  );
  return rows[0] || null;
}

/** Public-safe projection by id. */
export async function getPublicById(id) {
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

/** Create a user. */
export async function create({ name, email, password, role = 'employee', status = 'active' }) {
  const [res] = await pool.execute(
    `INSERT INTO users (name, email, password, role, status)
     VALUES (:name, :email, :password, :role, :status)`,
    { name, email, password, role, status }
  );
  return getPublicById(res.insertId);
}

/** Update last login timestamp. */
export async function touchLogin(id) {
  await pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = :id', { id });
}

/** Update a user's password hash. */
export async function setPassword(id, passwordHash) {
  await pool.execute('UPDATE users SET password = :p WHERE id = :id', { p: passwordHash, id });
}

/** Count total users (for first-run seeding checks). */
export async function count() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM users WHERE deleted_at IS NULL');
  return rows[0].c;
}

const SAFE_USER_SORT = {
  name: 'name',
  email: 'email',
  role: 'role',
  created: 'created_at',
  last_login: 'last_login_at',
};

/** Paginated, filterable list of login accounts (public projection). */
export async function list({ search = '', role = '', status = '', sort = 'created', order = 'desc', page = 1, limit = 20 } = {}) {
  const where = ['deleted_at IS NULL'];
  const params = {};
  if (role) { where.push('role = :role'); params.role = role; }
  if (status) { where.push('status = :status'); params.status = status; }
  if (search) { where.push('(name LIKE :s OR email LIKE :s)'); params.s = `%${search}%`; }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sortCol = SAFE_USER_SORT[sort] || SAFE_USER_SORT.created;
  const sortDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (safePage - 1) * safeLimit;

  const [countRows] = await pool.query(`SELECT COUNT(*) AS c FROM users ${whereSql}`, params);
  const [rows] = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM users ${whereSql} ORDER BY ${sortCol} ${sortDir} LIMIT :limit OFFSET :offset`,
    { ...params, limit: safeLimit, offset }
  );
  return { rows, total: countRows[0].c, page: safePage, limit: safeLimit };
}

/** Update editable account fields (name, role, status). */
export async function update(id, { name, role, status }) {
  const sets = [];
  const params = { id };
  if (name !== undefined) { sets.push('name = :name'); params.name = name; }
  if (role !== undefined) { sets.push('role = :role'); params.role = role; }
  if (status !== undefined) { sets.push('status = :status'); params.status = status; }
  if (sets.length) {
    await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = :id AND deleted_at IS NULL`, params);
  }
  return getPublicById(id);
}

/** Soft-delete a login account and revoke its email uniqueness slot. */
export async function softDelete(id) {
  // Free the unique email by suffixing it, so a new account can reuse it later.
  await pool.execute(
    `UPDATE users
       SET deleted_at = NOW(), status = 'inactive',
           email = CONCAT(email, '.deleted.', id)
     WHERE id = :id AND deleted_at IS NULL`,
    { id }
  );
}

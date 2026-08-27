import { pool } from '../config/db.js';

const SAFE_SORT = {
  name: 'd.department_name',
  code: 'd.department_code',
  created: 'd.created_at',
  employees: 'employees_count',
};

/** List departments with live employee counts + head name. */
export async function list({ search = '', status = '', sort = 'name', order = 'asc', includeDeleted = false } = {}) {
  const where = [];
  const params = {};
  if (!includeDeleted) where.push('d.deleted_at IS NULL');
  if (status) {
    where.push('d.status = :status');
    params.status = status;
  }
  if (search) {
    where.push('(d.department_name LIKE :s OR d.department_code LIKE :s)');
    params.s = `%${search}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortCol = SAFE_SORT[sort] || SAFE_SORT.name;
  const sortDir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const [rows] = await pool.query(
    `SELECT d.*,
            CONCAT_WS(' ', h.first_name, h.last_name) AS head_name,
            (SELECT COUNT(*) FROM employees e
              WHERE e.department_id = d.id AND e.deleted_at IS NULL) AS employees_count
     FROM departments d
     LEFT JOIN employees h ON h.id = d.head_id
     ${whereSql}
     ORDER BY ${sortCol} ${sortDir}`,
    params
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT d.*,
            CONCAT_WS(' ', h.first_name, h.last_name) AS head_name,
            (SELECT COUNT(*) FROM employees e
              WHERE e.department_id = d.id AND e.deleted_at IS NULL) AS employees_count
     FROM departments d
     LEFT JOIN employees h ON h.id = d.head_id
     WHERE d.id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

export async function create(data) {
  const [res] = await pool.execute(
    `INSERT INTO departments (department_name, department_code, description, head_id, status)
     VALUES (:name, :code, :description, :headId, :status)`,
    {
      name: data.department_name,
      code: data.department_code || null,
      description: data.description || null,
      headId: data.head_id || null,
      status: data.status || 'active',
    }
  );
  return findById(res.insertId);
}

export async function update(id, data) {
  await pool.execute(
    `UPDATE departments SET
       department_name = :name,
       department_code = :code,
       description     = :description,
       head_id         = :headId,
       status          = :status
     WHERE id = :id AND deleted_at IS NULL`,
    {
      id,
      name: data.department_name,
      code: data.department_code || null,
      description: data.description || null,
      headId: data.head_id || null,
      status: data.status || 'active',
    }
  );
  return findById(id);
}

/** Count active employees still attached to a department. */
export async function employeeCount(id) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS c FROM employees WHERE department_id = :id AND deleted_at IS NULL',
    { id }
  );
  return rows[0].c;
}

/** Reassign all employees from one department to another (or null). */
export async function reassignEmployees(fromId, toId) {
  await pool.execute(
    'UPDATE employees SET department_id = :toId WHERE department_id = :fromId AND deleted_at IS NULL',
    { fromId, toId: toId || null }
  );
}

export async function softDelete(id) {
  await pool.execute(
    `UPDATE departments SET deleted_at = NOW(), status = 'inactive' WHERE id = :id`,
    { id }
  );
}

export async function setStatus(id, status) {
  await pool.execute('UPDATE departments SET status = :status WHERE id = :id', { id, status });
  return findById(id);
}

export async function restore(id) {
  await pool.execute(
    `UPDATE departments SET deleted_at = NULL, status = 'active' WHERE id = :id`,
    { id }
  );
  return findById(id);
}

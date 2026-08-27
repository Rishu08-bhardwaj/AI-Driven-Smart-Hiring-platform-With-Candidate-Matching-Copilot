import { pool } from '../config/db.js';

const SAFE_SORT = {
  name: 'ds.designation_name',
  level: 'ds.level',
  created: 'ds.created_at',
  employees: 'employees_count',
};

export async function list({ search = '', status = '', departmentId = '', sort = 'name', order = 'asc', includeDeleted = false } = {}) {
  const where = [];
  const params = {};
  if (!includeDeleted) where.push('ds.deleted_at IS NULL');
  if (status) {
    where.push('ds.status = :status');
    params.status = status;
  }
  if (departmentId) {
    where.push('ds.department_id = :departmentId');
    params.departmentId = departmentId;
  }
  if (search) {
    where.push('ds.designation_name LIKE :s');
    params.s = `%${search}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortCol = SAFE_SORT[sort] || SAFE_SORT.name;
  const sortDir = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const [rows] = await pool.query(
    `SELECT ds.*,
            d.department_name,
            (SELECT COUNT(*) FROM employees e
              WHERE e.designation_id = ds.id AND e.deleted_at IS NULL) AS employees_count
     FROM designations ds
     LEFT JOIN departments d ON d.id = ds.department_id
     ${whereSql}
     ORDER BY ${sortCol} ${sortDir}`,
    params
  );
  return rows;
}

export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT ds.*, d.department_name,
            (SELECT COUNT(*) FROM employees e
              WHERE e.designation_id = ds.id AND e.deleted_at IS NULL) AS employees_count
     FROM designations ds
     LEFT JOIN departments d ON d.id = ds.department_id
     WHERE ds.id = :id LIMIT 1`,
    { id }
  );
  return rows[0] || null;
}

export async function create(data) {
  const [res] = await pool.execute(
    `INSERT INTO designations (designation_name, department_id, level, description, status)
     VALUES (:name, :departmentId, :level, :description, :status)`,
    {
      name: data.designation_name,
      departmentId: data.department_id || null,
      level: data.level || null,
      description: data.description || null,
      status: data.status || 'active',
    }
  );
  return findById(res.insertId);
}

export async function update(id, data) {
  await pool.execute(
    `UPDATE designations SET
       designation_name = :name,
       department_id    = :departmentId,
       level            = :level,
       description      = :description,
       status           = :status
     WHERE id = :id AND deleted_at IS NULL`,
    {
      id,
      name: data.designation_name,
      departmentId: data.department_id || null,
      level: data.level || null,
      description: data.description || null,
      status: data.status || 'active',
    }
  );
  return findById(id);
}

export async function employeeCount(id) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS c FROM employees WHERE designation_id = :id AND deleted_at IS NULL',
    { id }
  );
  return rows[0].c;
}

export async function softDelete(id) {
  await pool.execute(
    `UPDATE designations SET deleted_at = NOW(), status = 'inactive' WHERE id = :id`,
    { id }
  );
}

export async function setStatus(id, status) {
  await pool.execute('UPDATE designations SET status = :status WHERE id = :id', { id, status });
  return findById(id);
}

export async function restore(id) {
  await pool.execute(
    `UPDATE designations SET deleted_at = NULL, status = 'active' WHERE id = :id`,
    { id }
  );
  return findById(id);
}

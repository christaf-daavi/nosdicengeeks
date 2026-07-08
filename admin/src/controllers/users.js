const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const USERS_FILE = path.join(__dirname, '../../data/users.json');

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

exports.getAll = (req, res) => {
  let users;
  try {
    users = readUsers();
  } catch {
    return res.status(500).json({ error: 'Error al leer usuarios' });
  }
  res.json(users.map(({ password, ...u }) => u));
};

exports.create = (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Usuario, contraseña y rol son requeridos' });
  }
  if (!['admin', 'editor'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }
  let users;
  try {
    users = readUsers();
  } catch {
    return res.status(500).json({ error: 'Error al leer usuarios' });
  }
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ error: 'El nombre de usuario ya existe' });
  }
  const newUser = {
    id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1,
    username,
    password: bcrypt.hashSync(password, 10),
    role,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  try {
    writeUsers(users);
  } catch {
    return res.status(500).json({ error: 'Error al guardar el usuario' });
  }
  const { password: _pw, ...safeUser } = newUser;
  res.status(201).json(safeUser);
};

exports.update = (req, res) => {
  const id = Number(req.params.id);
  const { username, role, newPassword } = req.body;
  if (role && !['admin', 'editor'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  if (newPassword && newPassword.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }
  let users;
  try {
    users = readUsers();
  } catch {
    return res.status(500).json({ error: 'Error al leer usuarios' });
  }
  const user = users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  if (username && username !== user.username && users.some((u) => u.username === username)) {
    return res.status(409).json({ error: 'El nombre de usuario ya existe' });
  }
  if (role && user.role === 'admin' && role !== 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'No se puede quitar el rol admin al último administrador' });
    }
  }
  if (username) user.username = username;
  if (role) user.role = role;
  if (newPassword) user.password = bcrypt.hashSync(newPassword, 10);
  try {
    writeUsers(users);
  } catch {
    return res.status(500).json({ error: 'Error al guardar el usuario' });
  }
  const { password, ...safeUser } = user;
  res.json(safeUser);
};

exports.remove = (req, res) => {
  const id = Number(req.params.id);
  let users;
  try {
    users = readUsers();
  } catch {
    return res.status(500).json({ error: 'Error al leer usuarios' });
  }
  const user = users.find((u) => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  if (user.role === 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'No se puede eliminar al último administrador' });
    }
  }
  const remaining = users.filter((u) => u.id !== id);
  try {
    writeUsers(remaining);
  } catch {
    return res.status(500).json({ error: 'Error al guardar los usuarios' });
  }
  res.json({ success: true, message: 'Usuario eliminado' });
};

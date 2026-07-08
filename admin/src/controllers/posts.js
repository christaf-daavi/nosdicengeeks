const { getAllPosts, getPost, createPost, updatePost, deletePost, unpublishPost, bulkDeletePosts } = require('../utils/fileSystem');
const { runBuild } = require('../utils/builder');

exports.getAll = (req, res) => {
  try {
    const posts = getAllPosts();
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = (req, res) => {
  try {
    const post = getPost(req.params.filename);
    res.json(post);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Post no encontrado' });
    res.status(500).json({ error: err.message });
  }
};

exports.create = (req, res) => {
  try {
    const filename = createPost(req.body);
    res.status(201).json({ filename, message: 'Post creado correctamente' });
  } catch (err) {
    if (err.message.startsWith('Ya existe')) return res.status(409).json({ error: err.message });
    if (err.message === 'El título es requerido') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  try {
    // DEBUG temporal — remover una vez resuelto el bug de guardado de TipTap
    const { content } = req.body;
    console.log('BODY recibido:', JSON.stringify(req.body).substring(0, 200));
    console.log('Content length:', content ? content.length : 'UNDEFINED');
    console.log('Content preview:', content ? content.substring(0, 100) : 'EMPTY');

    updatePost(req.params.filename, req.body);
    res.json({ message: 'Post actualizado correctamente' });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Post no encontrado' });
    res.status(500).json({ error: err.message });
  }
};

exports.remove = (req, res) => {
  try {
    deletePost(req.params.filename);
    res.json({ message: 'Post eliminado correctamente' });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Post no encontrado' });
    res.status(500).json({ error: err.message });
  }
};

exports.unpublish = (req, res) => {
  try {
    unpublishPost(req.params.filename);
    res.json({ message: 'Post despublicado (draft: true)' });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'Post no encontrado' });
    res.status(500).json({ error: err.message });
  }
};

exports.bulkRemove = (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores pueden hacer eliminación en bloque' });
  }
  const { filenames } = req.body;
  if (!Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de filenames no vacío' });
  }
  try {
    const result = bulkDeletePosts(filenames);
    res.json({ success: true, deleted: result.deleted, errors: result.errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.build = async (req, res) => {
  try {
    const result = await runBuild();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, output: err.output || '' });
  }
};

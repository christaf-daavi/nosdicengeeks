const { getAllPosts, getPost, createPost, updatePost, deletePost, unpublishPost } = require('../utils/fileSystem');
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

exports.build = async (req, res) => {
  try {
    const result = await runBuild();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, output: err.output || '' });
  }
};

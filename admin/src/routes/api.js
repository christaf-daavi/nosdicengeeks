const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth');
const postsController = require('../controllers/posts');
const mediaController = require('../controllers/media');
const authGuard = require('../middlewares/authGuard');
const upload = require('../middlewares/upload');

// Auth
router.post('/auth/login', authController.login);

// Posts (protegidas)
router.get('/posts', authGuard, postsController.getAll);
router.get('/posts/:filename', authGuard, postsController.getOne);
router.post('/posts', authGuard, postsController.create);
router.put('/posts/:filename', authGuard, postsController.update);
router.delete('/posts/:filename', authGuard, postsController.remove);
router.patch('/posts/:filename/unpublish', authGuard, postsController.unpublish);

// Media (protegida)
router.post('/media/upload', authGuard, upload.single('image'), mediaController.upload);

// Build (protegida)
router.post('/build', authGuard, postsController.build);

module.exports = router;

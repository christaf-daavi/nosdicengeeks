const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const postsController = require('../controllers/posts');
const mediaController = require('../controllers/media');
const usersController = require('../controllers/users');
const settingsController = require('../controllers/settings');
const pagesController = require('../controllers/pages');
const { authGuard, requireRole } = require('../middlewares/authGuard');
const upload = require('../middlewares/upload');
// Auth
router.post('/auth/login', authController.login);
router.post('/auth/change-password', authGuard, authController.changePassword);
// Posts (protegidas)
router.get('/posts', authGuard, postsController.getAll);
router.get('/posts/:filename', authGuard, postsController.getOne);
router.post('/posts', authGuard, postsController.create);
router.put('/posts/:filename', authGuard, postsController.update);
router.delete('/posts/bulk', authGuard, postsController.bulkRemove);
router.delete('/posts/:filename', authGuard, postsController.remove);
router.patch('/posts/:filename/unpublish', authGuard, postsController.unpublish);
// Media (protegidas)
router.post('/media/upload', authGuard, upload.single('image'), mediaController.upload);
router.get('/media', authGuard, mediaController.list);
router.delete('/media/bulk', authGuard, requireRole('admin'), mediaController.bulkDelete);
router.delete('/media/:filename', authGuard, mediaController.remove);
// Usuarios (solo admin)
router.get('/users', authGuard, requireRole('admin'), usersController.getAll);
router.post('/users', authGuard, requireRole('admin'), usersController.create);
router.put('/users/:id', authGuard, requireRole('admin'), usersController.update);
router.delete('/users/:id', authGuard, requireRole('admin'), usersController.remove);
// Settings - Logo
router.post('/settings/logo', authGuard, requireRole('admin'), upload.single('image'), settingsController.uploadLogo);
router.delete('/settings/logo', authGuard, requireRole('admin'), settingsController.removeLogo);
// Público: se usa en login.html antes de autenticar; no expone nada sensible
// (el logo también es público vía /images/logo/ en el blog real).
router.get('/settings/logo', settingsController.getLogo);
// Settings - Favicon
router.post('/settings/favicon', authGuard, requireRole('admin'), upload.single('favicon'), settingsController.uploadFavicon);
router.delete('/settings/favicon', authGuard, requireRole('admin'), settingsController.removeFavicon);
router.get('/settings/favicon', authGuard, settingsController.getFavicon);
// Settings - Site config (GTM, etc.)
router.get('/settings/site-config', authGuard, settingsController.getSiteConfig);
router.post('/settings/site-config', authGuard, requireRole('admin'), settingsController.updateSiteConfig);
// Pages (todos los roles, sin crear/eliminar)
router.get('/pages', authGuard, pagesController.getAll);
router.get('/pages/:filename', authGuard, pagesController.getOne);
router.put('/pages/:filename', authGuard, pagesController.update);
// Config pública (usada por el frontend del admin antes/sin autenticar)
router.get('/config', (req, res) => {
  res.json({ siteUrl: process.env.SITE_URL || 'https://nosdicengeeks.com' });
});
// Build (protegida)
router.post('/build', authGuard, postsController.build);
module.exports = router;

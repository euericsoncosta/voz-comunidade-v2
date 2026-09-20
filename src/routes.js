import { Router } from 'express';
import multer from 'multer';

import multerConfig from './config/multer.js';
import auth from './middlewares/auth.js';
import requireAdmin from './middlewares/requireAdmin.js';

import HomeController from './controllers/HomeController.js';
import ReportController from './controllers/ReportController.js';
import UserController from './controllers/UserController.js';
import SessionController from './controllers/SessionController.js';
import CommentController from './controllers/CommentController.js';
import LikeController from './controllers/LikeController.js';
import VerificationController from './controllers/VerificationController.js';
import PasswordResetController from './controllers/PasswordResetController.js';
import {
  passwordResetIpLimiter,
  passwordResetEmailLimiter,
} from './middlewares/rateLimit.js';

const upload = multer(multerConfig);
const routes = new Router();

// ===== ROTAS PÚBLICAS =====
routes.post('/login', SessionController.store);
routes.post('/signup', UserController.store);

// Verificação de e-mail (públicas).
routes.get('/verify-email/:token', VerificationController.verifyEmail);
routes.post('/resend-verification', VerificationController.resend);

// Redefinição de senha (públicas). O pedido passa por rate limit em duas
// camadas (IP e e-mail) antes de chegar no controller.
routes.post(
  '/forgot-password',
  passwordResetIpLimiter,
  passwordResetEmailLimiter,
  PasswordResetController.request
);
routes.get('/reset-password/:token', PasswordResetController.showForm);
routes.post('/reset-password', PasswordResetController.reset);

// ===== A PARTIR DAQUI, TUDO EXIGE JWT =====
routes.use(auth);

// --- Cidadão ---
routes.get('/', HomeController.index);
routes.get('/feed', ReportController.feed);
routes.get('/reports/view/:id', ReportController.show);
routes.post('/reports/store', upload.single('image'), ReportController.store);
routes.post('/reports/:id/like', LikeController.toggle);
routes.post('/reports/:reportId/comments', CommentController.store);
routes.post('/comments/delete/:id', CommentController.delete);
routes.post('/usuarios/update/:id', UserController.update);

// ===== A PARTIR DAQUI, TUDO EXIGE role='admin' =====
routes.use(requireAdmin);

routes.get('/admin/dashboard', ReportController.index);
routes.post('/reports/update/:id', ReportController.update);
routes.post('/reports/delete/:id', ReportController.delete);
routes.get('/usuarios', UserController.index);
routes.post('/usuarios/delete/:id', UserController.delete);

export default routes;

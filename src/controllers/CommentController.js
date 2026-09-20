import Comment from '../models/Comment.js';
import Report from '../models/Report.js';

/**
 * CommentController.
 * Identidade do usuário vem SEMPRE do JWT (req.userId, req.userName),
 * nunca do body. Isso impede comentar em nome de outra pessoa.
 */
class CommentController {
  async store(req, res) {
    try {
      const reportId = Number(req.params.reportId);
      const { content } = req.body;

      if (Number.isNaN(reportId)) {
        return res.status(400).json({
          status: 'error',
          message: 'ID de relato inválido.',
        });
      }

      if (!content || !content.trim()) {
        return res.status(400).json({
          status: 'error',
          message: 'O conteúdo do comentário não pode estar vazio.',
        });
      }

      const report = await Report.findByPk(reportId);
      if (!report) {
        return res.status(404).json({
          status: 'error',
          message: 'Relato não encontrado.',
        });
      }

      const newComment = await Comment.create({
        content: content.trim(),
        reportId,
        userId: req.userId,
        userName: req.userName,
      });

      return res.status(201).json({
        status: 'success',
        message: 'Comentário publicado.',
        data: newComment,
      });
    } catch (error) {
      console.error('[API COMMENT STORE ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao processar o comentário.',
      });
    }
  }

  async delete(req, res) {
    try {
      const commentId = Number(req.params.id);
      if (Number.isNaN(commentId)) {
        return res.status(400).json({ status: 'error', message: 'ID inválido.' });
      }

      const comment = await Comment.findByPk(commentId);
      if (!comment) {
        return res.status(404).json({ status: 'error', message: 'Comentário não encontrado.' });
      }

      // Permissão: dono do comentário OU admin.
      const isOwner = comment.userId === req.userId;
      const isAdmin = req.userRole === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          status: 'error',
          message: 'Você não tem permissão para remover este comentário.',
        });
      }

      await comment.destroy();
      return res.json({ status: 'success', message: 'Comentário removido.' });
    } catch (error) {
      console.error('[API COMMENT DELETE ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao remover o comentário.',
      });
    }
  }
}

export default new CommentController();

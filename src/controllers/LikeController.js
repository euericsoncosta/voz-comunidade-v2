import Like from '../models/Like.js';
import Report from '../models/Report.js';

/**
 * LikeController — toggle de apoio (curtida) em um relato.
 */
class LikeController {
  async toggle(req, res) {
    try {
      const reportId = Number(req.params.id);
      if (Number.isNaN(reportId)) {
        return res.status(400).json({
          status: 'error',
          message: 'ID de relato inválido.',
        });
      }

      const report = await Report.findByPk(reportId);
      if (!report) {
        return res.status(404).json({
          status: 'error',
          message: 'Relato não encontrado.',
        });
      }

      const userId = req.userId;
      const existing = await Like.findOne({ where: { reportId, userId } });

      let action;
      if (existing) {
        await existing.destroy();
        action = 'removed';
      } else {
        await Like.create({ reportId, userId });
        action = 'added';
      }

      return res.json({
        status: 'success',
        message: action === 'added' ? 'Apoio registrado.' : 'Apoio removido.',
        data: { action, reportId, userId },
      });
    } catch (error) {
      console.error('[API LIKE TOGGLE ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao processar o apoio.',
      });
    }
  }
}

export default new LikeController();

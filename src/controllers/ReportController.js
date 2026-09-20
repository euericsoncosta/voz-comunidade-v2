import { Op } from 'sequelize';
import fs from 'fs';
import Report from '../models/Report.js';
import Comment from '../models/Comment.js';
import Like from '../models/Like.js';
import cloudinary from '../config/cloudinary.js';

/**
 * ReportController — CRUD de relatos + feed + painel admin.
 *
 * Todas as rotas exigem autenticação (JWT).
 * Ações de moderação (update/delete/index admin) exigem role='admin'
 * — isso é feito no routes.js via requireAdmin, não aqui.
 */
class ReportController {
  constructor() {
    this.feed = this.feed.bind(this);
    this.index = this.index.bind(this);
    this.show = this.show.bind(this);
    this.store = this.store.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  /**
   * FEED — timeline para o app mobile.
   */
  async feed(req, res) {
    try {
      const { type, period } = req.query;
      const userId = req.userId; // vem do middleware auth

      const where = {};
      if (type) where.type = type;

      // Filtro de período (padrão 60 dias; 'all' desativa).
      if (period !== 'all') {
        const days = period ? Number(period) : 60;
        if (Number.isFinite(days) && days > 0) {
          const dateLimit = new Date();
          dateLimit.setDate(dateLimit.getDate() - days);
          where.created_at = { [Op.gte]: dateLimit };
        }
      }

      const rows = await Report.findAll({
        where,
        include: [
          { model: Comment, as: 'comments' },
          { model: Like, as: 'likes_list' },
        ],
        order: [['created_at', 'DESC']],
      });

      const reports = rows.map((r) => this._decorate(r, userId));
      return res.json({ status: 'success', data: reports });
    } catch (error) {
      console.error('[API FEED ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao carregar o feed.',
      });
    }
  }

  /**
   * INDEX (admin) — lista para o painel administrativo.
   */
  async index(req, res) {
    try {
      const rows = await Report.findAll({
        include: [
          { model: Comment, as: 'comments' },
          { model: Like, as: 'likes_list' },
        ],
        order: [['created_at', 'DESC']],
      });

      const reports = rows.map((r) => this._decorate(r, req.userId));
      return res.json({ status: 'success', data: reports });
    } catch (error) {
      console.error('[ADMIN INDEX ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Erro ao carregar dados do painel.',
      });
    }
  }

  async show(req, res) {
    try {
      const { id } = req.params;

      const row = await Report.findByPk(id, {
        include: [
          { model: Comment, as: 'comments' },
          { model: Like, as: 'likes_list' },
        ],
      });

      if (!row) {
        return res.status(404).json({ status: 'error', message: 'Relato não encontrado.' });
      }

      return res.json({ status: 'success', data: this._decorate(row, req.userId) });
    } catch (error) {
      console.error('[API REPORT SHOW ERROR]:', error);
      return res.status(500).json({ status: 'error', message: 'Erro nos detalhes do relato.' });
    }
  }

  /**
   * STORE — cria relato com moderação de IA nas imagens.
   */
  async store(req, res) {
    try {
      const { city, type, neighborhood, title, description, lat, lng } = req.body;

      // Validações mínimas.
      if (!title || !description || !type || !neighborhood || !lat || !lng) {
        if (req.file?.path) safeUnlink(req.file.path);
        return res.status(400).json({
          status: 'error',
          message: 'Campos obrigatórios ausentes.',
        });
      }

      let imageUrl = null;

      if (req.file) {
        try {
          const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'voz_comunidade',
            moderation: 'aws_rek',
          });

          if (result.moderation && result.moderation[0]?.status === 'rejected') {
            safeUnlink(req.file.path);
            return res.status(400).json({
              status: 'error',
              message: 'A imagem contém conteúdo impróprio e foi bloqueada.',
            });
          }

          imageUrl = result.secure_url;
          safeUnlink(req.file.path);
        } catch (imgError) {
          console.error('[CLOUDINARY ERROR]:', imgError);
          safeUnlink(req.file?.path);
          return res.status(500).json({
            status: 'error',
            message: 'Erro ao processar a imagem.',
          });
        }
      }

      const report = await Report.create({
        city: city || 'horizonte',
        type,
        neighborhood,
        title,
        description,
        imageUrl,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        userId: req.userId,          // <-- vem do JWT, não do body
        userName: req.userName,      // <-- idem
        status: 'pendente',
      });

      return res.status(201).json({ status: 'success', data: report });
    } catch (error) {
      console.error('[API REPORT STORE ERROR]:', error);
      return res.status(400).json({
        status: 'error',
        message: 'Falha ao registrar relato.',
      });
    }
  }

  /**
   * UPDATE (admin) — usado para marcar como resolvido.
   * Whitelist rígida: só permite mudar status e a nota de resolução.
   */
  async update(req, res) {
    try {
      const report = await Report.findByPk(req.params.id);
      if (!report) {
        return res.status(404).json({ status: 'error', message: 'Relato não encontrado.' });
      }

      const { status, resolutionNote } = req.body;
      const allowed = ['pendente', 'resolvido', 'rejeitado'];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          status: 'error',
          message: `Status inválido. Use um de: ${allowed.join(', ')}.`,
        });
      }

      const patch = { status };
      // undefined = campo não veio no body, mantém o que já estava.
      // string (mesmo vazia) = atualiza explicitamente.
      if (typeof resolutionNote === 'string') {
        patch.resolutionNote = resolutionNote.trim() || null;
      }

      await report.update(patch);
      return res.json({ status: 'success', data: report });
    } catch (error) {
      console.error('[API REPORT UPDATE ERROR]:', error);
      return res.status(400).json({ status: 'error', message: 'Falha ao atualizar relato.' });
    }
  }

  /**
   * DELETE (admin).
   */
  async delete(req, res) {
    try {
      const report = await Report.findByPk(req.params.id);
      if (!report) {
        return res.status(404).json({ status: 'error', message: 'Relato não encontrado.' });
      }
      await report.destroy();
      return res.json({ status: 'success', message: 'Relato removido.' });
    } catch (error) {
      console.error('[API REPORT DELETE ERROR]:', error);
      return res.status(500).json({ status: 'error', message: 'Erro ao remover relato.' });
    }
  }

  /**
   * Helper interno — adiciona counts e userLiked ao objeto plain.
   */
  _decorate(row, viewerId) {
    const item = row.get({ plain: true });
    item.likes_count = item.likes_list ? item.likes_list.length : 0;
    item.comments_count = item.comments ? item.comments.length : 0;
    item.userLiked =
      viewerId && item.likes_list
        ? item.likes_list.some((like) => String(like.userId) === String(viewerId))
        : false;
    return item;
  }
}

function safeUnlink(filepath) {
  if (!filepath) return;
  try {
    fs.unlinkSync(filepath);
  } catch {
    /* ignora se já foi removido */
  }
}

export default new ReportController();

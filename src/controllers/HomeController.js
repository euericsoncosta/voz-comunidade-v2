import Report from '../models/Report.js';
import Comment from '../models/Comment.js';
import Like from '../models/Like.js';

/**
 * HomeController — retorna dados do mapa da cidade + estatísticas.
 *
 * Identidade do usuário vem do JWT (req.userId), nunca do body.
 */
class HomeController {
  async index(req, res) {
    try {
      const cityId = req.query.city || 'horizonte';
      const typeFilter = req.query.type || '';
      const userId = req.userId;

      // Coordenadas por cidade (útil pro app centralizar o mapa).
      const cityCoordinates = {
        fortaleza: { lat: -3.7319, lng: -38.5267, zoom: 13 },
        horizonte: { lat: -4.1011, lng: -38.5086, zoom: 14 },
        sobral: { lat: -3.6888, lng: -40.3494, zoom: 14 },
        juazeiro: { lat: -7.2241, lng: -39.3134, zoom: 14 },
      };
      const currentCity = cityCoordinates[cityId] || cityCoordinates.horizonte;

      const where = { city: cityId };
      if (typeFilter) where.type = typeFilter;

      const rows = await Report.findAll({
        where,
        include: [
          { model: Comment, as: 'comments' },
          { model: Like, as: 'likes_list' },
        ],
        order: [['created_at', 'DESC']],
      });

      const reports = rows.map((r) => {
        const item = r.get({ plain: true });
        item.userLiked =
          userId && item.likes_list
            ? item.likes_list.some((like) => String(like.userId) === String(userId))
            : false;
        return item;
      });

      // Estatísticas.
      const total = reports.length;
      const resolved = reports.filter((r) => r.status === 'resolvido').length;
      const likesCount = reports.reduce(
        (acc, r) => acc + (r.likes_list ? r.likes_list.length : 0),
        0
      );
      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      // Ranking de bairros (top 5).
      const neighborhoods = {};
      reports.forEach((r) => {
        if (r.neighborhood) {
          neighborhoods[r.neighborhood] = (neighborhoods[r.neighborhood] || 0) + 1;
        }
      });
      const ranking = Object.entries(neighborhoods)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      return res.json({
        status: 'success',
        data: {
          cityInfo: { id: cityId, ...currentCity },
          filters: { activeType: typeFilter },
          stats: { total, likes: likesCount, resolutionRate, ranking },
          reports,
        },
      });
    } catch (error) {
      console.error('[API HOME ERROR]:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Falha ao carregar dados do mapa.',
      });
    }
  }
}

export default new HomeController();

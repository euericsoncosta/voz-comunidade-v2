import { Expo } from 'expo-server-sdk';
import User from '../models/User.js';

const expo = new Expo();

/**
 * Notifica o autor do relato quando ele é marcado como resolvido.
 * Nunca lança — falha de push não pode derrubar a resposta da API que
 * chamou isso (o admin resolvendo o relato tem que funcionar mesmo se
 * o push falhar).
 */
export async function notifyReportResolved(report) {
  try {
    if (!report?.userId) return;

    const user = await User.findByPk(report.userId);
    const token = user?.pushToken;
    if (!token || !Expo.isExpoPushToken(token)) return;

    const tickets = await expo.sendPushNotificationsAsync([
      {
        to: token,
        sound: 'default',
        title: 'Seu relato foi resolvido!',
        body: report.title,
        data: { type: 'report_resolved', reportId: report.id },
      },
    ]);

    // Token não existe mais no dispositivo (app desinstalado, etc.) — limpa
    // pra não tentar de novo à toa nas próximas resoluções.
    const ticket = tickets[0];
    if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      await user.update({ pushToken: null });
    }
  } catch (error) {
    console.error('[PUSH NOTIFICATION ERROR]:', error);
  }
}

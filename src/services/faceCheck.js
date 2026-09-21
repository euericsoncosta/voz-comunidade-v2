import cloudinary from '../config/cloudinary.js';

/**
 * Rostos em fotos de relato.
 *
 * O upload é feito com `faces: true`, e o Cloudinary devolve em
 * `result.coordinates.faces` as caixas dos rostos: [[x, y, largura, altura], ...].
 *
 *   - Rosto grande na foto (selfie / retrato) → o relato é recusado.
 *   - Rostos pequenos (gente ao fundo) → passam, mas a imagem é guardada
 *     com os rostos desfocados (efeito e_blur_faces do Cloudinary).
 *
 * Ajustável por env:
 *   FACE_MAX_AREA_RATIO  maior fração da foto que um rosto pode ocupar (padrão 0.08 = 8%).
 *                        0 desliga a recusa.
 *   FACE_BLUR            "false" desliga o desfoque dos rostos que passam.
 */

const DEFAULT_MAX_FACE_RATIO = 0.08;
const BLUR_STRENGTH = 1000; // 1–2000 no Cloudinary

export function maxFaceRatio() {
  const value = process.env.FACE_MAX_AREA_RATIO;
  if (value === undefined || value === '') return DEFAULT_MAX_FACE_RATIO;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_MAX_FACE_RATIO;
}

export function blurFacesEnabled() {
  return process.env.FACE_BLUR !== 'false';
}

/**
 * Lê o resultado do upload e devolve quantos rostos há e a maior fração da
 * área da foto ocupada por um único rosto (0 a 1).
 */
export function analyzeFaces(result) {
  const faces = Array.isArray(result?.coordinates?.faces) ? result.coordinates.faces : [];
  const photoArea = Number(result?.width) * Number(result?.height);

  if (faces.length === 0 || !(photoArea > 0)) return { count: faces.length, largestRatio: 0 };

  const largestRatio = Math.max(...faces.map(([, , width, height]) => (width * height) / photoArea));
  return { count: faces.length, largestRatio };
}

/** true se algum rosto ocupa mais da foto do que o limite configurado. */
export function hasTooLargeFace(analysis) {
  const limit = maxFaceRatio();
  return limit > 0 && analysis.largestRatio > limit;
}

/**
 * URL da imagem com os rostos desfocados (o original não é exposto pela API).
 *
 * A versão desfocada é pré-gerada aqui (eager). Sem isso o Cloudinary só a
 * processa na 1ª visualização — ~4 s numa foto de celular, e quem vê primeiro
 * costuma ser quem acabou de postar. Se a pré-geração falhar, a URL continua
 * válida: a imagem é gerada sob demanda.
 */
export async function blurredImageUrl(result) {
  const transformation = [{ effect: `blur_faces:${BLUR_STRENGTH}` }];

  try {
    const derived = await cloudinary.uploader.explicit(result.public_id, {
      type: 'upload',
      eager: transformation,
    });
    const url = derived?.eager?.[0]?.secure_url;
    if (url) return url;
  } catch (err) {
    console.error('[CLOUDINARY] Não pré-gerou a foto desfocada (será gerada na 1ª visualização):', err.message || err);
  }

  return cloudinary.url(result.public_id, {
    secure: true,
    version: result.version,
    format: result.format,
    transformation,
  });
}

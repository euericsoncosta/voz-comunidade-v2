import Sequelize, { Model } from 'sequelize';
import bcrypt from 'bcryptjs';

/**
 * Modelo User — cidadãos e administradores.
 *
 * Novos campos (v3):
 *   email_verified        — true depois que o usuário clica no link do email
 *   verification_token    — token único enviado por email (64 chars hex)
 *   verification_sent_at  — quando foi enviado (usado pra expirar em 24h)
 */
export default class User extends Model {
  static init(sequelize) {
    super.init(
      {
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
          validate: { isEmail: true },
        },
        password: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        role: {
          type: Sequelize.ENUM('citizen', 'admin'),
          defaultValue: 'citizen',
        },
        emailVerified: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'email_verified',
        },
        verificationToken: {
          type: Sequelize.STRING(128),
          allowNull: true,
          field: 'verification_token',
        },
        verificationSentAt: {
          type: Sequelize.DATE,
          allowNull: true,
          field: 'verification_sent_at',
        },
        // SHA-256 do token enviado por e-mail (nunca o token em claro).
        passwordResetToken: {
          type: Sequelize.STRING(64),
          allowNull: true,
          field: 'password_reset_token',
        },
        passwordResetExpiresAt: {
          type: Sequelize.DATE,
          allowNull: true,
          field: 'password_reset_expires_at',
        },
        // Token do Expo Push (ExponentPushToken[...]) do último dispositivo
        // em que o usuário fez login. Null = não recebe notificações push.
        pushToken: {
          type: Sequelize.STRING(255),
          allowNull: true,
          field: 'push_token',
        },
      },
      {
        sequelize,
        tableName: 'users',
        modelName: 'User',
        underscored: true,
        timestamps: true,
        hooks: {
          beforeSave: async (user) => {
            if (user.changed('password')) {
              user.password = await bcrypt.hash(user.password, 8);
            }
          },
        },
      }
    );

    return this;
  }

  checkPassword(password) {
    return bcrypt.compare(password, this.password);
  }

  /**
   * Retorna true se o token de verificação ainda está válido
   * (existe e foi emitido há menos de 24h).
   */
  isVerificationTokenValid() {
    if (!this.verificationToken || !this.verificationSentAt) return false;
    const ageMs = Date.now() - new Date(this.verificationSentAt).getTime();
    const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
    return ageMs < MAX_AGE_MS;
  }

  /**
   * Retorna true se existe um token de reset ainda dentro da validade.
   */
  isPasswordResetTokenValid() {
    if (!this.passwordResetToken || !this.passwordResetExpiresAt) return false;
    return new Date(this.passwordResetExpiresAt).getTime() > Date.now();
  }

  static associate(models) {
    this.hasMany(models.Report, { foreignKey: 'user_id', as: 'reports' });
    this.hasMany(models.Comment, { foreignKey: 'user_id', as: 'comments' });
    this.hasMany(models.Like, { foreignKey: 'user_id', as: 'likes' });
  }
}

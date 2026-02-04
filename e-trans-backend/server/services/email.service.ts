// server/services/email.service.ts

import { Resend } from 'resend';
import { env } from '../config/env.js';
import { log } from '../config/logger.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendVerificationEmail = async (
  to: string,
  code: string,
  companyName: string
): Promise<boolean> => {
  if (!resend) {
    log.warn('Email skipped - RESEND_API_KEY not configured', { to });
    return true;
  }

  try {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to,
      subject: `${code} - Votre code de vérification E-Trans`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 480px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 12px; margin: 0 auto 16px; }
            .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1d4ed8; text-align: center; padding: 24px; background: #f1f5f9; border-radius: 12px; margin: 24px 0; }
            .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 32px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo"></div>
              <h1 style="margin: 0; color: #0f172a;">E-Trans</h1>
              <p style="color: #64748b; margin: 4px 0 0;">Transit & Dédouanement</p>
            </div>
            
            <p>Bienvenue chez <strong>${companyName}</strong> !</p>
            <p>Voici votre code de vérification :</p>
            
            <div class="code">${code}</div>
            
            <p style="color: #64748b; font-size: 14px;">Ce code expire dans 15 minutes.</p>
            
            <div class="footer">
              <p>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
              <p>© 2026 E-Trans - Tous droits réservés</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    log.info('Verification email sent', { to });
    return true;
  } catch (error) {
    log.error('Failed to send verification email', error);
    return false;
  }
};

export const sendWelcomeEmail = async (
  to: string,
  firstName: string,
  companyName: string
): Promise<boolean> => {
  if (!resend) {
    log.warn('Email skipped - RESEND_API_KEY not configured', { to });
    return true;
  }

  try {
    await resend.emails.send({
      from: env.FROM_EMAIL,
      to,
      subject: `Bienvenue sur E-Trans, ${firstName} !`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 480px; margin: 0 auto; padding: 40px 20px; }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { width: 60px; height: 60px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); border-radius: 12px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; }
            .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 32px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">✓</div>
              <h1 style="margin: 0; color: #16a34a;">Compte activé !</h1>
            </div>
            
            <p>Bonjour <strong>${firstName}</strong>,</p>
            <p>Votre compte E-Trans pour <strong>${companyName}</strong> est maintenant actif.</p>
            
            <p>Vous pouvez dès à présent :</p>
            <ul>
              <li>Créer et gérer vos dossiers de transit</li>
              <li>Suivre vos conteneurs en temps réel</li>
              <li>Gérer votre comptabilité débours</li>
              <li>Générer vos factures clients</li>
            </ul>
            
            <div class="footer">
              <p>Besoin d'aide ? Contactez-nous à support@e-trans.app</p>
              <p>© 2026 E-Trans - Tous droits réservés</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    log.info('Welcome email sent', { to });
    return true;
  } catch (error) {
    log.error('Failed to send welcome email', error);
    return false;
  }
};

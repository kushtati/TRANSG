// server/routes/auth.ts

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { log } from '../config/logger.js';
import { auth } from '../middleware/auth.js';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies.js';
import { generateVerificationCode, sendVerificationEmail, sendWelcomeEmail } from '../services/email.service.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  companyName: z.string().min(2, 'Nom entreprise requis'),
  name: z.string().min(2, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe min 8 caractères'),
  phone: z.string().optional(),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

const resendCodeSchema = z.object({
  email: z.string().email(),
});

// Helpers
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

const generateTokens = (userId: string, role: string, companyId: string) => {
  const accessToken = jwt.sign(
    { userId, role, companyId },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// ============================================
// POST /api/auth/register
// ============================================

router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if email exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      if (!existingUser.emailVerified) {
        // Resend verification code
        const code = generateVerificationCode();
        const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await prisma.user.update({
          where: { id: existingUser.id },
          data: { verificationCode: code, codeExpiresAt },
        });

        const company = await prisma.company.findUnique({
          where: { id: existingUser.companyId },
        });

        await sendVerificationEmail(data.email, code, company?.name || 'E-Trans');

        return res.json({
          success: true,
          message: 'Code de vérification renvoyé',
          requiresVerification: true,
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé',
      });
    }

    // Generate unique slug
    let slug = generateSlug(data.companyName);
    let slugExists = await prisma.company.findUnique({ where: { slug } });
    let counter = 1;
    while (slugExists) {
      slug = `${generateSlug(data.companyName)}-${counter}`;
      slugExists = await prisma.company.findUnique({ where: { slug } });
      counter++;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create company and user
    const company = await prisma.company.create({
      data: {
        name: data.companyName,
        slug,
        users: {
          create: {
            email: data.email.toLowerCase(),
            password: hashedPassword,
            name: data.name,
            phone: data.phone,
            role: 'DIRECTOR',
            verificationCode,
            codeExpiresAt,
          },
        },
      },
      include: { users: true },
    });

    // Send verification email
    await sendVerificationEmail(data.email, verificationCode, data.companyName);

    log.audit('User registered', { email: data.email, company: data.companyName });

    res.status(201).json({
      success: true,
      message: 'Compte créé ! Vérifiez votre email.',
      requiresVerification: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      });
    }
    log.error('Register error', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'inscription' });
  }
});

// ============================================
// POST /api/auth/verify-email
// ============================================

router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { email, code } = verifyEmailSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: true },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Code invalide',
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email déjà vérifié',
      });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Code incorrect',
      });
    }

    if (user.codeExpiresAt && user.codeExpiresAt < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Code expiré',
      });
    }

    // Verify user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        isActive: true,
        verificationCode: null,
        codeExpiresAt: null,
      },
    });

    // Generate tokens
    const tokens = generateTokens(user.id, user.role, user.companyId);

    // Save refresh token
    await prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Set cookies
    setAuthCookies(res, tokens);

    // Send welcome email
    await sendWelcomeEmail(user.email, user.name.split(' ')[0], user.company.name);

    log.audit('Email verified', { userId: user.id, email: user.email });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: {
            id: user.company.id,
            name: user.company.name,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      });
    }
    log.error('Verify email error', error);
    res.status(500).json({ success: false, message: 'Erreur de vérification' });
  }
});

// ============================================
// POST /api/auth/resend-code
// ============================================

router.post('/resend-code', async (req: Request, res: Response) => {
  try {
    const { email } = resendCodeSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: true },
    });

    if (user && !user.emailVerified) {
      const code = generateVerificationCode();
      const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: code, codeExpiresAt },
      });

      await sendVerificationEmail(email, code, user.company.name);
    }

    // Always return success (security)
    res.json({
      success: true,
      message: 'Si ce compte existe, un code a été envoyé',
    });
  } catch (error) {
    res.json({ success: true, message: 'Si ce compte existe, un code a été envoyé' });
  }
});

// ============================================
// POST /api/auth/login
// ============================================

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect',
      });
    }

    // Check if locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Compte verrouillé. Réessayez dans ${minutesLeft} minute(s)`,
      });
    }

    // Check email verified
    if (!user.emailVerified) {
      const code = generateVerificationCode();
      const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode: code, codeExpiresAt },
      });

      await sendVerificationEmail(email, code, user.company.name);

      return res.status(403).json({
        success: false,
        message: 'Email non vérifié. Un nouveau code a été envoyé.',
        requiresVerification: true,
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Check active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      const newFailedAttempts = user.failedAttempts + 1;
      const shouldLock = newFailedAttempts >= 5;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: newFailedAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });

      return res.status(401).json({
        success: false,
        message: shouldLock
          ? 'Trop de tentatives. Compte verrouillé pour 15 minutes.'
          : 'Email ou mot de passe incorrect',
      });
    }

    // Generate tokens
    const tokens = generateTokens(user.id, user.role, user.companyId);

    // Save refresh token and reset failed attempts
    await prisma.$transaction([
      prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: null, lastLogin: new Date() },
      }),
    ]);

    // Set cookies
    setAuthCookies(res, tokens);

    log.audit('User logged in', { userId: user.id, email: user.email });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: {
            id: user.company.id,
            name: user.company.name,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
      });
    }
    log.error('Login error', error);
    res.status(500).json({ success: false, message: 'Erreur de connexion' });
  }
});

// ============================================
// POST /api/auth/refresh
// ============================================

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Token de rafraîchissement manquant',
      });
    }

    // Verify token
    const decoded = jwt.verify(refreshToken, env.REFRESH_TOKEN_SECRET) as { userId: string };

    // Check in database
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        userId: decoded.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré',
      });
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { userId: storedToken.user.id, role: storedToken.user.role, companyId: storedToken.user.companyId },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Set cookie
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 15 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token invalide',
    });
  }
});

// ============================================
// GET /api/auth/me
// ============================================

router.get('/me', auth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { company: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          company: {
            id: user.company.id,
            name: user.company.name,
            slug: user.company.slug,
            phone: user.company.phone,
            address: user.company.address,
          },
        },
      },
    });
  } catch (error) {
    log.error('Get me error', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ============================================
// POST /api/auth/logout
// ============================================

router.post('/logout', auth, async (req: Request, res: Response) => {
  try {
    // Revoke all refresh tokens
    await prisma.refreshToken.updateMany({
      where: { userId: req.user!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    clearAuthCookies(res);

    log.audit('User logged out', { userId: req.user!.id });

    res.json({ success: true });
  } catch (error) {
    log.error('Logout error', error);
    res.status(500).json({ success: false, message: 'Erreur de déconnexion' });
  }
});

export default router;

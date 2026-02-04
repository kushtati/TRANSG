// server/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

interface JwtPayload {
  userId: string;
  role: string;
  companyId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        companyId: string;
      };
    }
  }
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from cookie or header
    const token = req.cookies?.accessToken || 
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
        code: 'NO_TOKEN',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
        isActive: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Compte désactivé',
        code: 'ACCOUNT_DISABLED',
      });
    }

    if (!user.emailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Email non vérifié',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token expiré',
        code: 'TOKEN_EXPIRED',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Token invalide',
      code: 'INVALID_TOKEN',
    });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé',
      });
    }

    next();
  };
};

export const requireDirector = requireRole('DIRECTOR');
export const requireAccountant = requireRole('DIRECTOR', 'ACCOUNTANT');
export const requireAgent = requireRole('DIRECTOR', 'ACCOUNTANT', 'AGENT');

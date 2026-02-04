// server/config/env.ts

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  
  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret-change-in-production',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  
  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Email (Resend)
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@e-trans.app',
  
  // AI (Gemini)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';

// Validation
const validateEnv = () => {
  const required = ['DATABASE_URL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    if (isProduction) process.exit(1);
  }
  
  if (isProduction && env.JWT_SECRET.includes('dev-')) {
    console.error('❌ JWT_SECRET must be changed in production!');
    process.exit(1);
  }
  
  if (!env.RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY not set - emails will be skipped');
  }
  
  if (!env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not set - AI features disabled');
  }
};

validateEnv();

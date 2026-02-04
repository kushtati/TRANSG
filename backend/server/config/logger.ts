// server/config/logger.ts

import { isDevelopment } from './env.js';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const getTimestamp = () => {
  return new Date().toISOString().slice(11, 23);
};

const formatData = (data?: object) => {
  if (!data) return '';
  return ` ${JSON.stringify(data)}`;
};

export const log = {
  info: (message: string, data?: object) => {
    console.log(`${colors.gray}${getTimestamp()}${colors.reset} ${colors.green}INFO${colors.reset}  ${message}${formatData(data)}`);
  },
  
  warn: (message: string, data?: object) => {
    console.warn(`${colors.gray}${getTimestamp()}${colors.reset} ${colors.yellow}WARN${colors.reset}  ${message}${formatData(data)}`);
  },
  
  error: (message: string, error?: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`${colors.gray}${getTimestamp()}${colors.reset} ${colors.red}ERROR${colors.reset} ${message}: ${errorMessage}`);
  },
  
  debug: (message: string, data?: object) => {
    if (isDevelopment) {
      console.log(`${colors.gray}${getTimestamp()}${colors.reset} ${colors.magenta}DEBUG${colors.reset} ${message}${formatData(data)}`);
    }
  },
  
  http: (message: string, data?: object) => {
    if (isDevelopment) {
      console.log(`${colors.gray}${getTimestamp()}${colors.reset} ${colors.cyan}HTTP${colors.reset}  ${message}${formatData(data)}`);
    }
  },
  
  audit: (action: string, data?: object) => {
    console.log(`${colors.gray}${getTimestamp()}${colors.reset} ${colors.blue}AUDIT${colors.reset} ${action}${formatData(data)}`);
  },
};

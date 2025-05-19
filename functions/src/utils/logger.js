// src/utils/logger.js - Logging utilities

const winston = require('winston');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Add colors to winston
winston.addColors(colors);

// Custom format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define which transports to use
const transports = [
  // Console transport for all logs
  new winston.transports.Console(),
  
  // File transport for errors only
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }),
  
  // File transport for all logs
  new winston.transports.File({ filename: 'logs/all.log' })
];

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports
});

// For Cloud Functions, we need to ensure logs are written to stdout/stderr
if (process.env.FUNCTION_TARGET) {
  // Remove file transports in Cloud Functions environment
  logger.clear();
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

module.exports = logger;
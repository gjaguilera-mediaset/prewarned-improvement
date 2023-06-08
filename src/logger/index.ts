import winston from 'winston'

const customFormat = winston.format.printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

export default winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.Console(),
    ],
    format: winston.format.combine(winston.format.timestamp(), customFormat),
})
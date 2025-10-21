const winston = require('winston');
const path = require('path');
const fs = require('fs');

class AdvancedLogger {
    constructor(logDir = 'logs') {
        this.logDir = logDir;
        this.ensureLogDirectory();
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            defaultMeta: { service: 'object-detection' },
            transports: [
                new winston.transports.File({ 
                    filename: path.join(logDir, 'error.log'), 
                    level: 'error' 
                }),
                new winston.transports.File({ 
                    filename: path.join(logDir, 'combined.log') 
                }),
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ],
        });
        
        this.stats = {
            totalLogs: 0,
            errorCounts: {},
            logLevels: {}
        };
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    logDetectionEvent(eventType, details) {
        this.logger.info('Detection Event', {
            eventType,
            details,
            category: 'detection'
        });
    }

    logPerformanceMetric(metricName, value, metadata = {}) {
        this.logger.info('Performance Metric', {
            metricName,
            value,
            metadata,
            category: 'performance'
        });
    }

    logErrorWithContext(error, context) {
        this.logger.error('Error with Context', {
            error: error.message,
            stack: error.stack,
            context,
            category: 'error'
        });
    }

    getStatistics() {
        return this.stats;
    }

    getRecentLogs(count = 100) {
        // This would require reading log files
        return [`Recent ${count} logs would be retrieved from files`];
    }
}

const logger = new AdvancedLogger();

module.exports = { AdvancedLogger, logger };

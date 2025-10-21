const fs = require('fs');
const path = require('path');

class ConfigManager {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(__dirname, '../../config/config.json');
        this.config = this.loadConfig();
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(configData);
            } else {
                return this.getDefaultConfig();
            }
        } catch (error) {
            console.error('Failed to load config:', error);
            return this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            detection: {
                confidenceThreshold: 0.5,
                maxDetectionsPerImage: 100,
                modelPath: 'models/yolov5s/model.json',
                enableGPU: true
            },
            logging: {
                level: 'info',
                logDir: 'logs'
            },
            database: {
                type: 'supabase',
                url: process.env.SUPABASE_URL,
                key: process.env.SUPABASE_ANON_KEY
            },
            api: {
                port: 3000,
                host: 'localhost'
            }
        };
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            console.log('Configuration saved');
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }

    getConfig() {
        return this.config;
    }

    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
    }
}

const configManager = new ConfigManager();

module.exports = { ConfigManager, configManager };

const tf = require('@tensorflow/tfjs-node');
const cv = require('opencv4nodejs');
const fs = require('fs');
const path = require('path');

class EnhancedObjectDetector {
    constructor(modelPath = null, confidenceThreshold = 0.5) {
        this.confidenceThreshold = confidenceThreshold;
        this.modelPath = modelPath || path.join(__dirname, '../../models/yolov5s/model.json');
        this.model = null;
        this.detectionHistory = [];
        this.performanceMetrics = {
            totalDetections: 0,
            averageConfidence: 0.0,
            processingTimes: []
        };
        
        this.initializeModel();
    }

    async initializeModel() {
        try {
            if (fs.existsSync(this.modelPath)) {
                this.model = await tf.loadLayersModel(`file://${this.modelPath}`);
                console.log('Model loaded successfully');
            } else {
                console.log('Model not found, using fallback detection');
            }
        } catch (error) {
            console.error('Failed to load model:', error);
        }
    }

    async detectObjects(imagePath) {
        const startTime = Date.now();
        
        try {
            const image = cv.imread(imagePath);
            const detections = await this.performDetection(image);
            
            const processingTime = Date.now() - startTime;
            this.updateMetrics(detections, processingTime);
            
            this.detectionHistory.push({
                timestamp: new Date().toISOString(),
                imagePath,
                detections,
                processingTime
            });
            
            if (this.detectionHistory.length > 100) {
                this.detectionHistory = this.detectionHistory.slice(-100);
            }
            
            return {
                success: true,
                detections,
                processingTime,
                imageSize: [image.rows, image.cols],
                method: this.model ? 'tensorflow' : 'opencv'
            };
        } catch (error) {
            console.error('Detection failed:', error);
            return this.fallbackDetection(imagePath);
        }
    }

    async performDetection(image) {
        if (this.model) {
            return await this.tensorflowDetection(image);
        } else {
            return this.opencvDetection(image);
        }
    }

    async tensorflowDetection(image) {
        // Convert OpenCV image to TensorFlow tensor
        const tensor = tf.tidy(() => {
            const img = cv.cvtColor(image, cv.COLOR_BGR2RGB);
            const normalized = img.div(255.0);
            return tf.expandDims(normalized, 0);
        });
        
        const predictions = this.model.predict(tensor);
        const boxes = predictions[0].arraySync();
        const scores = predictions[1].arraySync();
        const classes = predictions[2].arraySync();
        
        const detections = [];
        for (let i = 0; i < scores[0].length; i++) {
            if (scores[0][i] > this.confidenceThreshold) {
                detections.push({
                    bbox: boxes[0][i],
                    confidence: scores[0][i],
                    class: Math.round(classes[0][i])
                });
            }
        }
        
        tf.dispose(tensor);
        return detections;
    }

    opencvDetection(image) {
        const gray = image.cvtColor(cv.COLOR_BGR2GRAY);
        const blurred = gray.gaussianBlur(new cv.Size(5, 5), 0);
        const edges = blurred.canny(50, 150);
        
        const contours = edges.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        const detections = [];
        
        for (const contour of contours) {
            const area = contour.area();
            if (area > 100) {
                const rect = contour.boundingRect();
                detections.push({
                    bbox: [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height],
                    confidence: 0.7,
                    class: 0
                });
            }
        }
        
        return detections;
    }

    fallbackDetection(imagePath) {
        return {
            success: false,
            detections: [],
            error: 'Detection failed',
            imagePath
        };
    }

    updateMetrics(detections, processingTime) {
        this.performanceMetrics.totalDetections += detections.length;
        this.performanceMetrics.processingTimes.push(processingTime);
        
        if (detections.length > 0) {
            const avgConfidence = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;
            this.performanceMetrics.averageConfidence = avgConfidence;
        }
    }

    getPerformanceStats() {
        const times = this.performanceMetrics.processingTimes;
        return {
            totalDetections: this.performanceMetrics.totalDetections,
            averageConfidence: this.performanceMetrics.averageConfidence,
            averageProcessingTime: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
            historyLength: this.detectionHistory.length
        };
    }
}

module.exports = EnhancedObjectDetector;

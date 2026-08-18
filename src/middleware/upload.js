const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

// File filter for images
const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

// File filter for videos and images
const videoOrImageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image or video files are allowed'), false);
    }
};

// Create multer instances
const uploadImage = multer({
    storage: storage,
    fileFilter: imageFilter,
    limits: { fileSize: 8 * 1024 * 1024 } // 8MB
});

const uploadMedia = multer({
    storage: storage,
    fileFilter: videoOrImageFilter,
    limits: { fileSize: 60 * 1024 * 1024 } // 60MB
});

// Main upload instance (for backward compatibility with upload.single())
const upload = uploadImage;

module.exports = {
    upload,
    uploadImage,
    uploadMedia
};

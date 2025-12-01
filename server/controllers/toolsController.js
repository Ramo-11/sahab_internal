const InvoiceNumber = require('../../models/InvoiceNumber');
const { logger } = require('../logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
});

/**
 * Show tools page
 */
const showTools = async (req, res) => {
    try {
        // Get recently generated invoice numbers
        const recentNumbers = await InvoiceNumber.find().sort('-createdAt').limit(20);

        res.render('tools/index', {
            title: 'Tools - Sahab Solutions',
            layout: 'layout',
            recentNumbers,
            additionalCSS: ['tools.css'],
            additionalJS: ['tools.js'],
            activeTab: 'tools',
        });
    } catch (error) {
        logger.error('Show tools error:', error);
        res.status(500).render('error', {
            title: 'Error',
            message: 'Failed to load tools page',
            layout: 'layout',
        });
    }
};

/**
 * Generate a new invoice number
 */
const generateInvoiceNumber = async (req, res) => {
    try {
        const { notes, usedFor } = req.body;
        const invoiceNumber = await InvoiceNumber.generateUniqueNumber();

        // Update with additional info if provided
        if (notes || usedFor) {
            invoiceNumber.notes = notes || '';
            invoiceNumber.usedFor = usedFor || '';
            await invoiceNumber.save();
        }

        logger.info(`Generated invoice number: ${invoiceNumber.number}`);

        res.json({
            success: true,
            data: invoiceNumber,
            message: 'Invoice number generated successfully',
        });
    } catch (error) {
        logger.error('Generate invoice number error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate invoice number',
        });
    }
};

/**
 * Get all generated invoice numbers
 */
const getInvoiceNumbers = async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [numbers, total] = await Promise.all([
            InvoiceNumber.find().sort('-createdAt').skip(skip).limit(parseInt(limit)),
            InvoiceNumber.countDocuments(),
        ]);

        res.json({
            success: true,
            data: numbers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        logger.error('Get invoice numbers error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch invoice numbers',
        });
    }
};

/**
 * Delete an invoice number
 */
const deleteInvoiceNumber = async (req, res) => {
    try {
        const { id } = req.params;
        const invoiceNumber = await InvoiceNumber.findByIdAndDelete(id);

        if (!invoiceNumber) {
            return res.status(404).json({
                success: false,
                message: 'Invoice number not found',
            });
        }

        logger.info(`Deleted invoice number: ${invoiceNumber.number}`);

        res.json({
            success: true,
            message: 'Invoice number deleted successfully',
        });
    } catch (error) {
        logger.error('Delete invoice number error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete invoice number',
        });
    }
};

/**
 * Update invoice number notes
 */
const updateInvoiceNumber = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes, usedFor } = req.body;

        const invoiceNumber = await InvoiceNumber.findById(id);

        if (!invoiceNumber) {
            return res.status(404).json({
                success: false,
                message: 'Invoice number not found',
            });
        }

        if (notes !== undefined) invoiceNumber.notes = notes;
        if (usedFor !== undefined) invoiceNumber.usedFor = usedFor;

        await invoiceNumber.save();

        res.json({
            success: true,
            data: invoiceNumber,
            message: 'Invoice number updated successfully',
        });
    } catch (error) {
        logger.error('Update invoice number error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update invoice number',
        });
    }
};

/**
 * Process PDF - remove footer/watermark
 */
const processPDF = async (req, res) => {
    let uploadedFilePath = null;
    let processedFilePath = null;

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No PDF file uploaded',
            });
        }

        uploadedFilePath = req.file.path;
        const footerHeight = parseInt(req.body.footerHeight) || 100;
        const originalName = req.file.originalname;

        // Create a processed file path
        const processedFileName = `processed-${Date.now()}-${originalName}`;
        processedFilePath = path.join(__dirname, '../../uploads', processedFileName);

        // Create Python script to process the PDF
        const pythonScript = `
import fitz
import sys

input_path = "${uploadedFilePath.replace(/\\/g, '\\\\')}"
output_path = "${processedFilePath.replace(/\\/g, '\\\\')}"
footer_height = ${footerHeight}

try:
    doc = fitz.open(input_path)
    
    for page in doc:
        page_height = page.rect.height
        rect = fitz.Rect(0, page_height - footer_height, page.rect.width, page_height)
        page.add_redact_annot(rect, fill=(1, 1, 1))
        page.apply_redactions()
    
    doc.save(output_path)
    doc.close()
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(1)
`;

        // Write the Python script to a temp file
        const scriptPath = path.join(__dirname, '../../uploads', `script-${Date.now()}.py`);
        fs.writeFileSync(scriptPath, pythonScript);

        try {
            // Execute the Python script
            const { stdout, stderr } = await execPromise(`python3 "${scriptPath}"`);

            // Clean up the script file
            fs.unlinkSync(scriptPath);

            if (stdout.includes('ERROR') || stderr) {
                throw new Error(stderr || stdout);
            }

            // Check if processed file exists
            if (!fs.existsSync(processedFilePath)) {
                throw new Error('Processed file was not created');
            }

            // Send the processed file
            res.download(processedFilePath, `cleaned-${originalName}`, (err) => {
                // Clean up files after download
                if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
                    fs.unlinkSync(uploadedFilePath);
                }
                if (processedFilePath && fs.existsSync(processedFilePath)) {
                    fs.unlinkSync(processedFilePath);
                }

                if (err) {
                    logger.error('Error sending processed file:', err);
                }
            });

            logger.info(`Processed PDF: ${originalName}`);
        } catch (execError) {
            // Clean up script file if it exists
            if (fs.existsSync(scriptPath)) {
                fs.unlinkSync(scriptPath);
            }
            throw execError;
        }
    } catch (error) {
        logger.error('Process PDF error:', error);

        // Clean up files on error
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
            fs.unlinkSync(uploadedFilePath);
        }
        if (processedFilePath && fs.existsSync(processedFilePath)) {
            fs.unlinkSync(processedFilePath);
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Failed to process PDF',
        });
    }
};

/**
 * Multer middleware for PDF upload
 */
const uploadPDF = upload.single('pdfFile');

module.exports = {
    showTools,
    generateInvoiceNumber,
    getInvoiceNumbers,
    deleteInvoiceNumber,
    updateInvoiceNumber,
    processPDF,
    uploadPDF,
};

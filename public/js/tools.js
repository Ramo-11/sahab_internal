// Tools JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initFileUpload();
    initFooterHeightPreview();
    initPdfForm();
    initInvoiceGenerator();
});

/**
 * Initialize file upload drag and drop
 */
function initFileUpload() {
    const uploadArea = document.getElementById('fileUploadArea');
    const fileInput = document.getElementById('pdfFileInput');
    const fileName = document.getElementById('selectedFileName');

    if (!uploadArea || !fileInput) return;

    // Handle file selection
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            fileName.textContent = file.name;
            uploadArea.classList.add('has-file');
        } else {
            fileName.textContent = 'No file selected';
            uploadArea.classList.remove('has-file');
        }
    });

    // Handle drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type === 'application/pdf') {
            fileInput.files = files;
            fileName.textContent = files[0].name;
            uploadArea.classList.add('has-file');
        } else {
            Common.showNotification('Please upload a PDF file', 'warning');
        }
    });
}

/**
 * Initialize footer height preview
 */
function initFooterHeightPreview() {
    const footerHeightInput = document.getElementById('footerHeight');
    const previewFooter = document.getElementById('previewFooter');

    if (!footerHeightInput || !previewFooter) return;

    // Set initial preview height
    updatePreviewHeight(100);

    footerHeightInput.addEventListener('input', (e) => {
        const height = parseInt(e.target.value) || 100;
        updatePreviewHeight(height);
    });

    function updatePreviewHeight(pdfHeight) {
        // Scale: 792 PDF points = 160px preview height
        // So the scaled height = (pdfHeight / 792) * 160
        const scaledHeight = Math.min(Math.max((pdfHeight / 792) * 160, 5), 140);
        previewFooter.style.height = scaledHeight + 'px';
    }
}

/**
 * Initialize PDF form submission
 */
function initPdfForm() {
    const form = document.getElementById('pdfProcessForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await processPDF();
    });
}

/**
 * Generate invoice number
 */
async function generateInvoiceNumber() {
    const usedFor = document.getElementById('invoiceUsedFor')?.value || '';
    const notes = document.getElementById('invoiceNotes')?.value || '';

    try {
        const response = await fetch('/api/tools/invoice-numbers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ usedFor, notes }),
        });

        const result = await response.json();

        if (result.success) {
            // Show the generated number
            const display = document.getElementById('generatedNumberDisplay');
            const numberEl = document.getElementById('generatedNumber');

            numberEl.textContent = result.data.number;
            display.style.display = 'block';

            // Add to recent numbers list
            addToRecentList(result.data);

            // Clear inputs
            document.getElementById('invoiceUsedFor').value = '';
            document.getElementById('invoiceNotes').value = '';

            Common.showNotification('Invoice number generated!', 'success');
        } else {
            Common.showNotification(result.message || 'Failed to generate number', 'error');
        }
    } catch (error) {
        console.error('Error generating invoice number:', error);
        Common.showNotification('Failed to generate invoice number', 'error');
    }
}

/**
 * Add generated number to recent list
 */
function addToRecentList(data) {
    const list = document.getElementById('recentNumbersList');
    if (!list) return;

    // Remove empty state if present
    const emptyState = list.querySelector('.empty-state-small');
    if (emptyState) {
        emptyState.remove();
    }

    // Create new item
    const item = document.createElement('div');
    item.className = 'number-item';
    item.dataset.id = data._id;

    const date = new Date(data.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    let usedForHtml = '';
    if (data.usedFor) {
        const truncated =
            data.usedFor.length > 30 ? data.usedFor.substring(0, 30) + '...' : data.usedFor;
        usedForHtml = `<span class="number-used-for" title="${escapeHtml(data.usedFor)}">
            <i class="fas fa-tag"></i> ${escapeHtml(truncated)}
        </span>`;
    }

    item.innerHTML = `
        <div class="number-info">
            <span class="number-badge">${data.number}</span>
            <span class="number-date">${date}</span>
            ${usedForHtml}
        </div>
        <div class="number-actions">
            <button class="btn btn-sm btn-icon" onclick="copyNumber('${data.number}')" title="Copy">
                <i class="fas fa-copy"></i>
            </button>
            <button class="btn btn-sm btn-icon text-danger" onclick="deleteNumber('${data._id}')" title="Delete">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;

    // Add to top of list
    list.insertBefore(item, list.firstChild);

    // Update count badge
    const badge = document.querySelector('.section-subtitle .badge');
    if (badge) {
        const currentCount = parseInt(badge.textContent) || 0;
        badge.textContent = currentCount + 1;
    }
}

/**
 * Copy number to clipboard
 */
function copyNumber(number) {
    navigator.clipboard
        .writeText(number)
        .then(() => {
            Common.showNotification('Copied to clipboard!', 'success');
        })
        .catch(() => {
            Common.showNotification('Failed to copy', 'error');
        });
}

/**
 * Copy generated number to clipboard
 */
function copyToClipboard() {
    const number = document.getElementById('generatedNumber')?.textContent;
    if (number) {
        copyNumber(number);
    }
}

/**
 * Delete invoice number
 */
async function deleteNumber(id) {
    Common.confirm('Delete this invoice number?', async () => {
        try {
            const response = await fetch(`/api/tools/invoice-numbers/${id}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (result.success) {
                // Remove from list
                const item = document.querySelector(`.number-item[data-id="${id}"]`);
                if (item) {
                    item.remove();
                }

                // Update count badge
                const badge = document.querySelector('.section-subtitle .badge');
                if (badge) {
                    const currentCount = parseInt(badge.textContent) || 0;
                    badge.textContent = Math.max(0, currentCount - 1);
                }

                // Show empty state if no items left
                const list = document.getElementById('recentNumbersList');
                if (list && list.querySelectorAll('.number-item').length === 0) {
                    list.innerHTML = `
                        <div class="empty-state-small">
                            <i class="fas fa-inbox"></i>
                            <p>No numbers generated yet</p>
                        </div>
                    `;
                }

                Common.showNotification('Invoice number deleted', 'success');
            } else {
                Common.showNotification(result.message || 'Failed to delete', 'error');
            }
        } catch (error) {
            console.error('Error deleting invoice number:', error);
            Common.showNotification('Failed to delete invoice number', 'error');
        }
    });
}

/**
 * Process PDF to remove watermark
 */
async function processPDF() {
    const fileInput = document.getElementById('pdfFileInput');
    const footerHeight = document.getElementById('footerHeight')?.value || 100;
    const processBtn = document.getElementById('processBtn');
    const processingStatus = document.getElementById('processingStatus');
    const processResult = document.getElementById('processResult');

    if (!fileInput.files[0]) {
        Common.showNotification('Please select a PDF file', 'warning');
        return;
    }

    // Show processing state
    processBtn.disabled = true;
    processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    processingStatus.style.display = 'flex';
    processResult.style.display = 'none';

    try {
        const formData = new FormData();
        formData.append('pdfFile', fileInput.files[0]);
        formData.append('footerHeight', footerHeight);

        const response = await fetch('/api/tools/process-pdf', {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            // Get the blob and create download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Get filename from Content-Disposition header if available
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'cleaned-invoice.pdf';
            if (contentDisposition) {
                const matches = contentDisposition.match(/filename="?([^";\n]+)"?/);
                if (matches && matches[1]) {
                    filename = matches[1];
                }
            }

            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // Show success
            processResult.innerHTML = `
                <i class="fas fa-check-circle text-success"></i>
                <span>PDF processed successfully! Download started.</span>
            `;
            processResult.classList.remove('error');
            processResult.style.display = 'flex';

            Common.showNotification('PDF processed and downloaded!', 'success');

            // Reset form
            fileInput.value = '';
            document.getElementById('selectedFileName').textContent = 'No file selected';
            document.getElementById('fileUploadArea').classList.remove('has-file');
        } else {
            const result = await response.json();
            throw new Error(result.message || 'Failed to process PDF');
        }
    } catch (error) {
        console.error('Error processing PDF:', error);

        processResult.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${escapeHtml(error.message || 'Failed to process PDF')}</span>
        `;
        processResult.classList.add('error');
        processResult.style.display = 'flex';

        Common.showNotification(error.message || 'Failed to process PDF', 'error');
    } finally {
        // Reset button state
        processBtn.disabled = false;
        processBtn.innerHTML = '<i class="fas fa-magic"></i> Process PDF';
        processingStatus.style.display = 'none';
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
window.generateInvoiceNumber = generateInvoiceNumber;
window.copyNumber = copyNumber;
window.copyToClipboard = copyToClipboard;
window.deleteNumber = deleteNumber;
window.processPDF = processPDF;

// ============================================
// INVOICE GENERATOR
// ============================================

// Company info for invoice header
const COMPANY_INFO = {
    name: 'Sahab Solutions',
    address: '12100 Parkview Court',
    city: 'Fishers, Indiana 46038',
    country: 'United States',
    phone: '574-406-4727',
    website: 'www.sahab-solutions.com',
    email: 'sahab@sahab-solutions.com',
    zelle: 'sahab@sahab-solutions.com'
};

// Store loaded clients
let invoiceClients = [];

// Current line item counter
let lineItemCounter = 0;

/**
 * Initialize Invoice Generator
 */
async function initInvoiceGenerator() {
    const form = document.getElementById('invoiceGeneratorForm');
    if (!form) return;

    // Set default dates
    const today = new Date();
    const dueDate = new Date();
    dueDate.setDate(today.getDate() + 30); // Net 30

    document.getElementById('invDate').value = formatDateForInput(today);
    document.getElementById('invDueDate').value = formatDateForInput(dueDate);

    // Load customers
    await loadInvoiceClients();

    // Auto-generate invoice number
    await generateNewInvoiceNumber();

    // Add initial line item
    addInvoiceLineItem();

    // Form submit handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateInvoicePDF();
    });
}

/**
 * Format date for input[type="date"]
 */
function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Load clients for dropdown (only active clients)
 */
async function loadInvoiceClients() {
    const select = document.getElementById('invCustomer');
    if (!select) return;

    try {
        // Only fetch active clients
        const response = await fetch('/api/clients?status=active&limit=1000');
        const result = await response.json();

        if (result.success && result.data) {
            invoiceClients = result.data;

            select.innerHTML = '<option value="">Select a customer...</option>';
            invoiceClients.forEach(client => {
                const displayName = client.company || client.name;
                const contactName = client.contactPerson?.name || client.name;
                select.innerHTML += `<option value="${client._id}" data-contact="${escapeHtml(contactName)}">${escapeHtml(displayName)}</option>`;
            });
        } else {
            select.innerHTML = '<option value="">No customers found</option>';
        }
    } catch (error) {
        console.error('Error loading clients:', error);
        select.innerHTML = '<option value="">Error loading customers</option>';
    }
}

/**
 * Generate a new invoice number
 */
async function generateNewInvoiceNumber() {
    const input = document.getElementById('invNumber');
    if (!input) return;

    input.placeholder = 'Generating...';
    input.value = '';

    try {
        const response = await fetch('/api/tools/invoice-numbers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usedFor: 'Invoice Generator Tool' })
        });

        const result = await response.json();

        if (result.success) {
            input.value = result.data.number;
            input.placeholder = 'Invoice Number';
        } else {
            input.placeholder = 'Enter manually';
            Common.showNotification('Could not auto-generate number', 'warning');
        }
    } catch (error) {
        console.error('Error generating invoice number:', error);
        input.placeholder = 'Enter manually';
    }
}

/**
 * Add a new line item row
 */
function addInvoiceLineItem() {
    const tbody = document.getElementById('lineItemsBody');
    if (!tbody) return;

    lineItemCounter++;
    const rowId = `lineItem_${lineItemCounter}`;

    const row = document.createElement('tr');
    row.id = rowId;
    row.className = 'line-item-row';
    row.innerHTML = `
        <td class="item-col">
            <input type="text" class="form-control item-name" placeholder="Item name" required />
            <input type="text" class="form-control item-description" placeholder="Description (optional)" />
        </td>
        <td class="qty-col">
            <input type="number" class="form-control item-qty" value="1" min="1" step="1" required onchange="calculateInvoiceTotals()" oninput="calculateInvoiceTotals()" />
        </td>
        <td class="price-col">
            <div class="input-group">
                <span class="input-group-text">$</span>
                <input type="number" class="form-control item-price" value="0.00" min="0" step="0.01" required onchange="calculateInvoiceTotals()" oninput="calculateInvoiceTotals()" />
            </div>
        </td>
        <td class="amount-col">
            <span class="item-amount">$0.00</span>
        </td>
        <td class="action-col">
            <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeInvoiceLineItem('${rowId}')" title="Remove">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
    calculateInvoiceTotals();
}

/**
 * Remove a line item row
 */
function removeInvoiceLineItem(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        calculateInvoiceTotals();
    }

    // Ensure at least one row exists
    const tbody = document.getElementById('lineItemsBody');
    if (tbody && tbody.children.length === 0) {
        addInvoiceLineItem();
    }
}

/**
 * Calculate invoice totals
 */
function calculateInvoiceTotals() {
    const rows = document.querySelectorAll('.line-item-row');
    let subtotal = 0;

    rows.forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.item-price')?.value) || 0;
        const amount = qty * price;

        const amountEl = row.querySelector('.item-amount');
        if (amountEl) {
            amountEl.textContent = formatCurrency(amount);
        }

        subtotal += amount;
    });

    const total = subtotal; // No tax for now
    const amountDue = total;

    document.getElementById('invSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('invTotal').textContent = formatCurrency(total);
    document.getElementById('invAmountDue').textContent = formatCurrency(amountDue);
}

/**
 * Format number as currency
 */
function formatCurrency(amount) {
    return '$' + amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

/**
 * Generate Invoice PDF
 */
async function generateInvoicePDF() {
    const btn = document.getElementById('generateInvoiceBtn');
    const status = document.getElementById('generationStatus');

    // Validate form
    const invoiceNumber = document.getElementById('invNumber').value.trim();
    const customerId = document.getElementById('invCustomer').value;
    const invoiceDate = document.getElementById('invDate').value;
    const dueDate = document.getElementById('invDueDate').value;
    const notes = document.getElementById('invNotes').value.trim();

    if (!invoiceNumber) {
        Common.showNotification('Please enter an invoice number', 'warning');
        return;
    }

    if (!customerId) {
        Common.showNotification('Please select a customer', 'warning');
        return;
    }

    // Get selected customer details
    const customer = invoiceClients.find(c => c._id === customerId);
    if (!customer) {
        Common.showNotification('Customer not found', 'error');
        return;
    }

    // Get line items
    const lineItems = [];
    const rows = document.querySelectorAll('.line-item-row');
    let hasValidItem = false;

    rows.forEach(row => {
        const name = row.querySelector('.item-name')?.value.trim();
        const description = row.querySelector('.item-description')?.value.trim();
        const qty = parseFloat(row.querySelector('.item-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.item-price')?.value) || 0;

        if (name && qty > 0) {
            hasValidItem = true;
            lineItems.push({
                name,
                description,
                quantity: qty,
                price: price,
                amount: qty * price
            });
        }
    });

    if (!hasValidItem) {
        Common.showNotification('Please add at least one valid line item', 'warning');
        return;
    }

    // Calculate total
    const total = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    if (status) status.style.display = 'flex';

    try {
        // Wait for jsPDF to be ready
        await waitForJsPDF();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter' // 612 x 792 points
        });

        const pageWidth = 612;
        const pageHeight = 792;
        const margin = 50;
        let y = margin;

        // Colors matching Wave invoice style
        const primaryColor = [113, 23, 242]; // Purple
        const textDark = [51, 51, 51];
        const textGray = [102, 102, 102];
        const lineGray = [221, 221, 221];

        // ========== HEADER SECTION ==========

        // Try to load logo, with a professional fallback
        try {
            const logoImg = await loadImage('/images/logo.png');
            doc.addImage(logoImg, 'PNG', margin, y, 120, 120);
        } catch (e) {
            // Draw a professional styled logo placeholder matching Wave's Sahab logo
            doc.setFillColor(113, 23, 242);
            doc.roundedRect(margin, y, 120, 120, 8, 8, 'F');

            // Draw cloud shape
            doc.setFillColor(255, 255, 255);
            doc.circle(margin + 40, y + 50, 20, 'F');
            doc.circle(margin + 60, y + 42, 25, 'F');
            doc.circle(margin + 85, y + 52, 18, 'F');
            doc.rect(margin + 28, y + 50, 70, 28, 'F');

            // Circuit dots and lines
            doc.setFillColor(113, 23, 242);
            const dotY = y + 65;
            const dots = [margin + 42, margin + 54, margin + 66, margin + 78];
            dots.forEach((dx, i) => {
                doc.circle(dx, dotY, 3, 'F');
                doc.setDrawColor(113, 23, 242);
                doc.setLineWidth(2);
                const lineLen = i % 2 === 0 ? 18 : 25;
                doc.line(dx, dotY + 3, dx, dotY + lineLen);
                doc.circle(dx, dotY + lineLen + 2, 2.5, 'F');
            });
        }

        // INVOICE title (right side, large)
        doc.setTextColor(...textDark);
        doc.setFontSize(42);
        doc.setFont('helvetica', 'bold');
        doc.text('INVOICE', pageWidth - margin, y + 35, { align: 'right' });

        // Company info (right side, below INVOICE)
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textDark);
        doc.text(COMPANY_INFO.name, pageWidth - margin, y + 58, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textGray);
        doc.text(COMPANY_INFO.address, pageWidth - margin, y + 73, { align: 'right' });
        doc.text(COMPANY_INFO.city, pageWidth - margin, y + 86, { align: 'right' });
        doc.text(COMPANY_INFO.country, pageWidth - margin, y + 99, { align: 'right' });

        doc.text(COMPANY_INFO.phone, pageWidth - margin, y + 118, { align: 'right' });
        doc.text(COMPANY_INFO.website, pageWidth - margin, y + 131, { align: 'right' });

        y += 155;

        // ========== HORIZONTAL DIVIDER ==========
        doc.setDrawColor(...lineGray);
        doc.setLineWidth(1);
        doc.line(margin, y, pageWidth - margin, y);

        y += 25;

        // ========== BILL TO & INVOICE DETAILS ROW ==========
        // Left side: BILL TO
        doc.setTextColor(...textGray);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('BILL TO', margin, y);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...textDark);
        doc.setFontSize(12);
        const customerName = customer.company || customer.name;
        doc.text(customerName, margin, y + 18);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...textGray);

        let billToY = y + 34;
        if (customer.contactPerson?.name && customer.contactPerson.name !== customerName) {
            doc.text(customer.contactPerson.name, margin, billToY);
            billToY += 14;
        }
        if (customer.phone) {
            doc.text(customer.phone, margin, billToY);
            billToY += 14;
        }
        if (customer.email) {
            doc.text(customer.email, margin, billToY);
        }

        // Right side: Invoice details box
        const boxWidth = 200;
        const boxX = pageWidth - margin - boxWidth;
        const boxY = y - 5;

        // Invoice details (no background box, just text aligned)
        doc.setFontSize(10);
        doc.setTextColor(...textGray);
        doc.setFont('helvetica', 'normal');

        const labelX = boxX + 10;
        const valueX = pageWidth - margin - 10;

        doc.text('Invoice Number:', labelX, boxY + 15);
        doc.text('Invoice Date:', labelX, boxY + 32);
        doc.text('Payment Due:', labelX, boxY + 49);

        doc.setTextColor(...textDark);
        doc.setFont('helvetica', 'bold');
        doc.text(invoiceNumber, valueX, boxY + 15, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(formatDisplayDate(invoiceDate), valueX, boxY + 32, { align: 'right' });
        doc.text(formatDisplayDate(dueDate), valueX, boxY + 49, { align: 'right' });

        // Amount due row with purple background
        doc.setFillColor(...primaryColor);
        doc.rect(labelX - 10, boxY + 58, boxWidth, 22, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Amount Due (USD):', labelX, boxY + 73);
        doc.text(formatCurrency(total), valueX, boxY + 73, { align: 'right' });

        y += 110;

        // ========== LINE ITEMS TABLE ==========
        const tableTop = y;
        const colItem = margin;
        const colQty = 360;
        const colPrice = 440;
        const colAmount = pageWidth - margin;

        // Table header with purple background
        doc.setFillColor(...primaryColor);
        doc.rect(margin, tableTop, pageWidth - 2 * margin, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Items', colItem + 12, tableTop + 18);
        doc.text('Quantity', colQty, tableTop + 18, { align: 'center' });
        doc.text('Price', colPrice, tableTop + 18, { align: 'center' });
        doc.text('Amount', colAmount - 12, tableTop + 18, { align: 'right' });

        y = tableTop + 28;

        // Table rows
        lineItems.forEach((item, index) => {
            const rowHeight = item.description ? 45 : 32;

            // Item name
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...textDark);
            doc.text(item.name, colItem + 12, y + 20);

            // Description (if any)
            if (item.description) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(...textGray);
                const descLines = doc.splitTextToSize(item.description, colQty - colItem - 40);
                doc.text(descLines, colItem + 12, y + 34);
            }

            // Quantity
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...textDark);
            doc.text(item.quantity.toString(), colQty, y + 20, { align: 'center' });

            // Price
            doc.text(formatCurrency(item.price), colPrice, y + 20, { align: 'center' });

            // Amount
            doc.text(formatCurrency(item.amount), colAmount - 12, y + 20, { align: 'right' });

            y += rowHeight;

            // Row bottom border (light gray dashed line)
            doc.setDrawColor(...lineGray);
            doc.setLineWidth(0.5);
            doc.setLineDashPattern([2, 2], 0);
            doc.line(margin, y, pageWidth - margin, y);
            doc.setLineDashPattern([], 0);
        });

        y += 25;

        // ========== TOTALS SECTION ==========
        const totalsLabelX = colPrice - 20;
        const totalsValueX = colAmount - 12;

        // Total row
        doc.setTextColor(...textGray);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Total:', totalsLabelX, y, { align: 'right' });
        doc.setTextColor(...textDark);
        doc.text(formatCurrency(total), totalsValueX, y, { align: 'right' });

        y += 25;

        // Amount Due row (bold, larger)
        doc.setTextColor(...textDark);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Amount Due (USD):', totalsLabelX, y, { align: 'right' });
        doc.text(formatCurrency(total), totalsValueX, y, { align: 'right' });

        y += 50;

        // ========== NOTES SECTION ==========
        if (notes) {
            doc.setTextColor(...primaryColor);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Notes / Terms', margin, y);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...textDark);
            doc.setFontSize(10);

            const maxWidth = pageWidth - 2 * margin;
            const noteLines = doc.splitTextToSize(notes, maxWidth);
            doc.text(noteLines, margin, y + 16);
        }

        // ========== SAVE PDF ==========
        const fileName = `Invoice_${invoiceNumber}_${invoiceDate}.pdf`;
        doc.save(fileName);

        Common.showNotification('Invoice PDF generated successfully!', 'success');

    } catch (error) {
        console.error('Error generating PDF:', error);
        Common.showNotification('Failed to generate PDF: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-pdf"></i> Generate Invoice PDF';
        if (status) status.style.display = 'none';
    }
}

/**
 * Wait for jsPDF library to load
 */
function waitForJsPDF() {
    return new Promise((resolve, reject) => {
        if (window.jspdf) {
            resolve();
            return;
        }

        let attempts = 0;
        const maxAttempts = 50;
        const interval = setInterval(() => {
            attempts++;
            if (window.jspdf) {
                clearInterval(interval);
                resolve();
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error('jsPDF library failed to load'));
            }
        }, 100);
    });
}

/**
 * Load an image as base64 for PDF
 */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Format date for display (e.g., "August 12, 2025")
 */
function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
}

// Make invoice generator functions globally available
window.generateNewInvoiceNumber = generateNewInvoiceNumber;
window.addInvoiceLineItem = addInvoiceLineItem;
window.removeInvoiceLineItem = removeInvoiceLineItem;
window.calculateInvoiceTotals = calculateInvoiceTotals;
window.generateInvoicePDF = generateInvoicePDF;

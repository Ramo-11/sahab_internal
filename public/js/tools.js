// Tools JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initFileUpload();
    initFooterHeightPreview();
    initPdfForm();
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

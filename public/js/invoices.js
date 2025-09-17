// Invoices JavaScript - All-in-one functionality
document.addEventListener('DOMContentLoaded', () => {
    const page = detectPage();

    switch (page) {
        case 'index':
            initInvoicesIndex();
            break;
        case 'new':
            initInvoiceForm();
            break;
    }
});

// Detect which invoice page we're on
function detectPage() {
    const path = window.location.pathname;
    if (path === '/invoices') return 'index';
    if (path === '/invoices/new') return 'new';
    return null;
}

// ========== Index Page Functions ==========
function initInvoicesIndex() {
    initSearch();
    attachFilterListeners();
}

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = Common.debounce(() => {
            applyFilters();
        }, 500);

        searchInput.addEventListener('input', debouncedSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
    }
}

function attachFilterListeners() {
    const statusFilter = document.getElementById('statusFilter');
    const clientFilter = document.getElementById('clientFilter');

    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    if (clientFilter) {
        clientFilter.addEventListener('change', applyFilters);
    }
}

function applyFilters() {
    const params = {
        search: document.getElementById('searchInput')?.value || '',
        status: document.getElementById('statusFilter')?.value || '',
        client: document.getElementById('clientFilter')?.value || '',
    };

    Object.keys(params).forEach((key) => {
        if (!params[key]) delete params[key];
    });

    Common.updateQueryParams(params);
    window.location.reload();
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('clientFilter').value = '';

    window.location.href = '/invoices';
}

// ========== Inline Edit Functions ==========
function editInvoice(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    // Hide view mode elements
    row.querySelectorAll('.view-mode').forEach((el) => {
        el.style.display = 'none';
    });
    row.querySelector('.view-actions').style.display = 'none';

    // Show edit mode elements
    row.querySelectorAll('.edit-mode').forEach((el) => {
        el.style.display = 'block';
    });
    row.querySelector('.edit-actions').style.display = 'flex';

    // Add editing class to row
    row.classList.add('editing');
}

function cancelEdit(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    // Reset values to original
    const originalInvoice = JSON.parse(row.dataset.invoice);

    row.querySelectorAll('.edit-mode[data-field]').forEach((input) => {
        const field = input.dataset.field;
        if (field === 'dueDate') {
            input.value = new Date(originalInvoice[field]).toISOString().split('T')[0];
        } else {
            input.value = originalInvoice[field] || '';
        }
    });

    // Show view mode elements
    row.querySelectorAll('.view-mode').forEach((el) => {
        el.style.display = 'block';
    });
    row.querySelector('.view-actions').style.display = 'flex';

    // Hide edit mode elements
    row.querySelectorAll('.edit-mode').forEach((el) => {
        el.style.display = 'none';
    });
    row.querySelector('.edit-actions').style.display = 'none';

    // Remove editing class
    row.classList.remove('editing');
}

async function saveInvoice(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    // Collect updated values
    const updates = {};
    row.querySelectorAll('.edit-mode[data-field]').forEach((input) => {
        const field = input.dataset.field;
        const value = input.value.trim();

        if (field === 'amount') {
            console.log('Parsing amount:', value);
            updates[field] = parseFloat(value) || 0;
        } else if (field === 'dueDate') {
            updates[field] = new Date(value).toISOString();
        } else {
            updates[field] = value;
        }
    });

    // Show loading state
    const saveBtn = row.querySelector('.edit-actions .btn-success');
    const originalHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const response = await API.invoices.update(id, updates);

        if (response.success) {
            Common.showNotification('Invoice updated successfully', 'success');

            // Update the displayed data
            updateInvoiceRow(row, response.data);

            // Update the stored invoice data
            row.dataset.invoice = JSON.stringify(response.data);

            // Exit edit mode
            cancelEdit(id);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to update invoice', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHTML;
    }
}

function updateInvoiceRow(row, invoice) {
    // Update title
    const titleCell = row.querySelector('.editable-cell .view-mode');
    if (titleCell) titleCell.textContent = invoice.title;

    // Update amount
    const amountCell = row.querySelectorAll('.editable-cell .view-mode')[1];
    if (amountCell) amountCell.textContent = `$${(invoice.amount / 1000).toFixed(1)}k`;

    // Update status badge
    const statusCell = row.querySelectorAll('.editable-cell .view-mode')[2];
    if (statusCell) {
        const badgeClass =
            invoice.status === 'paid'
                ? 'success'
                : invoice.status === 'overdue'
                ? 'danger'
                : invoice.status === 'sent'
                ? 'primary'
                : 'warning';
        statusCell.innerHTML = `<span class="badge badge-${badgeClass}">${invoice.status}</span>`;
    }

    // Update due date
    const dueDateCell = row.querySelectorAll('.editable-cell .view-mode')[3];
    if (dueDateCell) {
        let dateHTML = new Date(invoice.dueDate).toLocaleDateString();
        if (invoice.isOverdue && invoice.status !== 'paid') {
            dateHTML += ' <i class="fas fa-exclamation-triangle text-danger ml-1"></i>';
        }
        dueDateCell.innerHTML = dateHTML;
    }

    // Update action buttons based on status
    if (invoice.status === 'paid') {
        const markPaidBtn = row.querySelector('button[onclick*="markAsPaid"]');
        if (markPaidBtn) markPaidBtn.style.display = 'none';
    }
}

// ========== Form Page Functions ==========
function initInvoiceForm() {
    const form = document.getElementById('newInvoiceForm');
    if (form) {
        form.addEventListener('submit', handleInvoiceFormSubmit);

        // Set default due date (30 days from today)
        const dueDateInput = form.querySelector('input[name="dueDate"]');
        if (dueDateInput && !dueDateInput.value) {
            const date = new Date();
            date.setDate(date.getDate() + 30);
            dueDateInput.value = date.toISOString().split('T')[0];
        }
    }
}

async function handleInvoiceFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
    }

    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
        if (value !== '') {
            data[key] = value;
        }
    });

    console.log('Parsed amount before:', data.amount);
    if (data.amount) {
        data.amount = parseFloat(data.amount);
    }
    console.log('Parsed amount after:', data.amount);

    // Set default status to sent if not provided
    if (!data.status) {
        data.status = 'sent';
    }

    try {
        const response = await API.invoices.create(data);
        if (response.success) {
            Common.showNotification('Invoice created successfully', 'success');
            setTimeout(() => {
                window.location.href = '/invoices';
            }, 1000);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to create invoice', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Invoice';
        }
    }
}

// ========== Action Functions ==========
async function markAsPaid(id) {
    Common.confirm('Mark this invoice as paid?', async () => {
        try {
            const row = document.querySelector(`tr[data-id="${id}"]`);
            const invoice = row ? JSON.parse(row.dataset.invoice) : null;

            const response = await API.invoices.update(id, {
                status: 'paid',
                paidDate: new Date().toISOString(),
                amountPaid: invoice?.amount || 0,
            });

            if (response.success) {
                Common.showNotification('Invoice marked as paid', 'success');

                // Update the row
                if (row) {
                    updateInvoiceRow(row, response.data);
                    row.dataset.invoice = JSON.stringify(response.data);

                    // Hide the mark as paid button
                    const markPaidBtn = row.querySelector('button[onclick*="markAsPaid"]');
                    if (markPaidBtn) markPaidBtn.style.display = 'none';
                }
            }
        } catch (error) {
            Common.showNotification(error.message || 'Failed to update invoice', 'error');
        }
    });
}

async function deleteInvoice(id) {
    Common.confirm('Are you sure you want to delete this invoice?', async () => {
        try {
            const response = await API.invoices.delete(id);
            if (response.success) {
                Common.showNotification('Invoice deleted successfully', 'success');

                // Remove the row from the table
                const row = document.querySelector(`tr[data-id="${id}"]`);
                if (row) {
                    row.style.opacity = '0';
                    setTimeout(() => row.remove(), 300);
                }

                // Check if table is empty
                setTimeout(() => {
                    const tbody = document.querySelector('#invoicesTable tbody');
                    if (tbody && tbody.querySelectorAll('tr').length === 0) {
                        window.location.reload();
                    }
                }, 400);
            }
        } catch (error) {
            Common.showNotification(error.message || 'Failed to delete invoice', 'error');
        }
    });
}

async function exportData() {
    try {
        const params = Common.getQueryParams();
        params.type = 'invoices';
        params.format = 'csv';

        const queryString = new URLSearchParams(params).toString();
        window.location.href = `/api/analysis/export?${queryString}`;

        Common.showNotification('Export started', 'success');
    } catch (error) {
        Common.showNotification('Failed to export data', 'error');
    }
}

// Make functions globally available
window.editInvoice = editInvoice;
window.cancelEdit = cancelEdit;
window.saveInvoice = saveInvoice;
window.markAsPaid = markAsPaid;
window.deleteInvoice = deleteInvoice;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.exportData = exportData;

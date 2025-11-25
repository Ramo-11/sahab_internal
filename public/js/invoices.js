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

            // Refresh the page after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 1000);
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

    // Update amount - fix the calculation
    const amountCell = row.querySelectorAll('.editable-cell .view-mode')[1];
    if (amountCell) amountCell.textContent = `$${Number(invoice.amount).toFixed(2)}`;

    // Update status badge
    const statusCell = row.querySelectorAll('.editable-cell .view-mode')[2];
    if (statusCell) {
        const badgeClass =
            invoice.status === 'paid'
                ? 'success'
                : invoice.status === 'partial'
                ? 'warning'
                : invoice.status === 'overdue'
                ? 'danger'
                : invoice.status === 'sent'
                ? 'primary'
                : 'secondary';
        let statusHTML = `<span class="badge badge-${badgeClass}">${invoice.status}</span>`;

        // Add balance due for partial payments
        if (invoice.status === 'partial' && invoice.balanceDue) {
            statusHTML += `<small class="d-block text-muted mt-1">Balance: $${invoice.balanceDue.toFixed(
                2
            )}</small>`;
        }
        statusCell.innerHTML = statusHTML;
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
        const partialPayBtn = row.querySelector('button[onclick*="openPartialPaymentModal"]');
        if (markPaidBtn) markPaidBtn.style.display = 'none';
        if (partialPayBtn) partialPayBtn.style.display = 'none';
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
    Common.confirm('Mark this invoice as fully paid?', async () => {
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

                // Refresh the page
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
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

// Modal functions
function openNewInvoiceModal() {
    // Clear form
    document.getElementById('newInvoiceForm').reset();

    // Populate clients dropdown
    populateModalClients();

    // Show modal
    $('#newInvoiceModal').modal('show');
}

async function populateModalClients() {
    try {
        const response = await fetch('/api/clients?status=active');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('modalClientSelect');
            select.innerHTML = '<option value="">Select a client</option>';

            data.data.forEach((client) => {
                const option = document.createElement('option');
                option.value = client._id;
                option.textContent = client.company || client.name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

async function submitNewInvoice() {
    const form = document.getElementById('newInvoiceForm');
    const formData = new FormData(form);

    // Convert FormData to JSON
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    try {
        const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
            $('#newInvoiceModal').modal('hide');
            showAlert('Invoice created successfully', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showAlert(result.message || 'Failed to create invoice', 'danger');
        }
    } catch (error) {
        console.error('Error creating invoice:', error);
        showAlert('An error occurred while creating the invoice', 'danger');
    }
}

// Sorting state
let currentSort = { field: null, direction: 'asc' };

function sortTable(field) {
    // Toggle direction if same field
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }

    // Get all rows
    const tbody = document.querySelector('#invoicesTable tbody');
    const rows = Array.from(tbody.querySelectorAll('tr')).filter(
        (row) => !row.querySelector('.empty-state')
    );

    if (rows.length === 0) return;

    // Sort rows
    rows.sort((a, b) => {
        let aValue, bValue;

        const aInvoice = JSON.parse(a.dataset.invoice);
        const bInvoice = JSON.parse(b.dataset.invoice);

        switch (field) {
            case 'invoiceNumber':
                aValue = parseInt(aInvoice.invoiceNumber) || 0;
                bValue = parseInt(bInvoice.invoiceNumber) || 0;
                break;
            case 'title':
                aValue = aInvoice.title?.toLowerCase() || '';
                bValue = bInvoice.title?.toLowerCase() || '';
                break;
            case 'client':
                aValue = (aInvoice.client?.company || aInvoice.client?.name || '').toLowerCase();
                bValue = (bInvoice.client?.company || bInvoice.client?.name || '').toLowerCase();
                break;
            case 'amount':
                aValue = parseFloat(aInvoice.amount) || 0;
                bValue = parseFloat(bInvoice.amount) || 0;
                break;
            case 'status':
                // Custom sort order for status
                const statusOrder = { overdue: 0, sent: 1, partial: 2, draft: 3, paid: 4 };
                aValue = statusOrder[aInvoice.status] || 5;
                bValue = statusOrder[bInvoice.status] || 5;
                break;
            case 'dueDate':
                aValue = new Date(aInvoice.dueDate).getTime();
                bValue = new Date(bInvoice.dueDate).getTime();
                break;
            default:
                return 0;
        }

        if (aValue < bValue) return currentSort.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Update sort icons
    document.querySelectorAll('.sortable .sort-icon').forEach((icon) => {
        icon.className = 'fas fa-sort sort-icon';
    });

    const currentHeader = document.querySelector(`.sortable[onclick*="${field}"] .sort-icon`);
    if (currentHeader) {
        currentHeader.className = `fas fa-sort-${
            currentSort.direction === 'asc' ? 'up' : 'down'
        } sort-icon`;
    }

    // Re-append sorted rows
    rows.forEach((row) => tbody.appendChild(row));
}

// Partial payment functions
async function openPartialPaymentModal(invoiceId) {
    try {
        const response = await fetch(`/api/invoices/${invoiceId}`);
        const result = await response.json();

        if (result.success) {
            const invoice = result.data;
            const balanceDue = invoice.amount - (invoice.amountPaid || 0);

            document.getElementById('paymentInvoiceId').value = invoiceId;
            document.getElementById('totalDue').value = `$${invoice.amount.toFixed(2)}`;
            document.getElementById('alreadyPaid').value = `$${(invoice.amountPaid || 0).toFixed(
                2
            )}`;
            document.getElementById('remainingBalance').value = `$${balanceDue.toFixed(2)}`;
            document.getElementById('paymentAmount').value = '';
            document.getElementById('paymentAmount').max = balanceDue;
            document.getElementById('paymentMethod').value = '';
            document.getElementById('paymentReference').value = '';

            $('#partialPaymentModal').modal('show');
        } else {
            showAlert('Failed to load invoice details', 'danger');
        }
    } catch (error) {
        console.error('Error loading invoice:', error);
        showAlert('An error occurred while loading invoice details', 'danger');
    }
}

async function submitPartialPayment() {
    const invoiceId = document.getElementById('paymentInvoiceId').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const method = document.getElementById('paymentMethod').value;
    const reference = document.getElementById('paymentReference').value;
    const datePaid = document.getElementById('paymentDate').value;
    const notes = document.getElementById('paymentNotes').value;

    if (!amount || amount <= 0) {
        Common.showNotification('Please enter a valid payment amount', 'warning');
        return;
    }

    try {
        const response = await fetch(`/api/invoices/${invoiceId}/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount,
                method,
                reference,
                datePaid: datePaid || new Date().toISOString(),
                notes,
            }),
        });

        const result = await response.json();

        if (result.success) {
            $('#partialPaymentModal').modal('hide');
            Common.showNotification('Payment recorded successfully', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            Common.showNotification(result.message || 'Failed to record payment', 'error');
        }
    } catch (error) {
        console.error('Error recording payment:', error);
        Common.showNotification('An error occurred while recording payment', 'error');
    }
}

// Helper function to show alerts
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="close" data-dismiss="alert" aria-label="Close">
            <span aria-hidden="true">&times;</span>
        </button>
    `;

    const container = document.querySelector('.container');
    container.insertBefore(alertDiv, container.firstChild);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Store current invoice ID for notes editing
let currentDetailInvoiceId = null;

// Update the showInvoiceDetails function to store the invoice ID
async function showInvoiceDetails(invoiceId) {
    try {
        // Store the invoice ID for later use
        currentDetailInvoiceId = invoiceId;

        // Reset edit modes
        document.getElementById('notesViewMode').style.display = 'block';
        document.getElementById('notesEditMode').style.display = 'none';
        document.getElementById('internalNotesViewMode').style.display = 'block';
        document.getElementById('internalNotesEditMode').style.display = 'none';

        // Fetch invoice details
        const response = await fetch(`/api/invoices/${invoiceId}`);
        const result = await response.json();

        if (!result.success) {
            Common.showNotification('Failed to load invoice details', 'error');
            return;
        }

        const invoice = result.data;

        // Populate modal header
        document.getElementById('invoiceDetailsTitle').textContent = `Invoice #${
            invoice.invoiceNumber || 'N/A'
        } Details`;

        // Populate invoice information
        document.getElementById('detailInvoiceNumber').textContent = invoice.invoiceNumber || '-';
        document.getElementById('detailTitle').textContent = invoice.title || '-';

        // Status with badge
        const statusBadge = `<span class="badge badge-${
            invoice.status === 'paid'
                ? 'success'
                : invoice.status === 'partial'
                ? 'warning'
                : invoice.status === 'overdue' || invoice.isOverdue
                ? 'danger'
                : invoice.status === 'sent'
                ? 'primary'
                : 'secondary'
        }">${
            invoice.isOverdue && invoice.status !== 'paid'
                ? 'OVERDUE'
                : invoice.status.toUpperCase()
        }</span>`;
        document.getElementById('detailStatus').innerHTML = statusBadge;

        document.getElementById('detailIssueDate').textContent = new Date(
            invoice.issueDate
        ).toLocaleDateString();
        document.getElementById('detailDueDate').textContent = new Date(
            invoice.dueDate
        ).toLocaleDateString();
        document.getElementById('detailPaymentTerms').textContent =
            invoice.paymentTerms || 'Net 30';

        // Populate client information
        if (invoice.client) {
            document.getElementById('detailClientName').textContent =
                invoice.client.company || invoice.client.name || '-';
            document.getElementById('detailClientEmail').innerHTML = invoice.client.email
                ? `<a href="mailto:${invoice.client.email}">${invoice.client.email}</a>`
                : '-';
            document.getElementById('detailClientPhone').textContent = invoice.client.phone || '-';
        } else {
            document.getElementById('detailClientName').textContent = '-';
            document.getElementById('detailClientEmail').textContent = '-';
            document.getElementById('detailClientPhone').textContent = '-';
        }

        // Populate financial summary
        const amountPaid = invoice.amountPaid || 0;
        const balanceDue = invoice.amount - amountPaid;

        document.getElementById('detailAmount').textContent = `$${invoice.amount.toFixed(2)}`;
        document.getElementById('detailAmountPaid').textContent = `$${amountPaid.toFixed(2)}`;
        document.getElementById('detailBalanceDue').textContent = `$${balanceDue.toFixed(2)}`;

        // Show overpayment if applicable
        const overpaidRow = document.getElementById('overpaidRow');
        if (invoice.status === 'paid' && amountPaid > invoice.amount) {
            const overpaid = amountPaid - invoice.amount;
            document.getElementById('detailOverpaid').textContent = `+$${overpaid.toFixed(2)}`;
            overpaidRow.style.display = '';
        } else {
            overpaidRow.style.display = 'none';
        }

        // Populate payment history
        const paymentHistoryBody = document.getElementById('paymentHistoryBody');
        if (invoice.paymentHistory && invoice.paymentHistory.length > 0) {
            document.getElementById('paymentCount').textContent = `${
                invoice.paymentHistory.length
            } payment${invoice.paymentHistory.length > 1 ? 's' : ''}`;

            paymentHistoryBody.innerHTML = invoice.paymentHistory
                .map(
                    (payment) => `
                <tr>
                    <td>${new Date(payment.datePaid).toLocaleDateString()}</td>
                    <td class="font-weight-bold">$${payment.amount.toFixed(2)}</td>
                    <td><span class="badge badge-info">${
                        payment.method || 'unspecified'
                    }</span></td>
                    <td>${payment.reference || '-'}</td>
                    <td>${new Date(payment.dateRecorded).toLocaleDateString()}</td>
                    <td>${payment.notes || '-'}</td>
                </tr>
            `
                )
                .join('');
        } else if (invoice.status === 'paid') {
            // Show single payment entry for paid invoices without history
            document.getElementById('paymentCount').textContent = '1 payment';
            paymentHistoryBody.innerHTML = `
                <tr>
                    <td>${
                        invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString() : '-'
                    }</td>
                    <td class="font-weight-bold">$${invoice.amount.toFixed(2)}</td>
                    <td><span class="badge badge-info">${
                        invoice.paymentMethod || 'unspecified'
                    }</span></td>
                    <td>${invoice.paymentReference || '-'}</td>
                    <td>${
                        invoice.paidDate ? new Date(invoice.paidDate).toLocaleDateString() : '-'
                    }</td>
                    <td>Full payment</td>
                </tr>
            `;
        } else {
            document.getElementById('paymentCount').textContent = '0 payments';
            paymentHistoryBody.innerHTML =
                '<tr><td colspan="6" class="text-center text-muted">No payment history</td></tr>';
        }

        // Populate notes - both display and input fields
        document.getElementById('detailNotes').textContent = invoice.notes || 'No notes';
        document.getElementById('detailNotesInput').value = invoice.notes || '';

        document.getElementById('detailInternalNotes').textContent =
            invoice.internalNotes || 'No internal notes';
        document.getElementById('detailInternalNotesInput').value = invoice.internalNotes || '';

        // Document link
        if (invoice.documentUrl) {
            document.getElementById('documentLinkSection').style.display = 'block';
            document.getElementById('detailDocumentLink').href = invoice.documentUrl;
        } else {
            document.getElementById('documentLinkSection').style.display = 'none';
        }

        // Reminder history
        if (invoice.remindersSent && invoice.remindersSent.length > 0) {
            document.getElementById('reminderSection').style.display = 'block';
            document.getElementById('reminderCount').textContent = `${
                invoice.remindersSent.length
            } reminder${invoice.remindersSent.length > 1 ? 's' : ''}`;
            document.getElementById('reminderHistory').innerHTML = invoice.remindersSent
                .map(
                    (reminder) => `
                <div class="mb-2">
                    <i class="fas fa-envelope text-muted"></i>
                    Sent via ${reminder.method} on ${new Date(reminder.sentAt).toLocaleDateString()}
                    ${
                        reminder.notes
                            ? `<br><small class="text-muted">${reminder.notes}</small>`
                            : ''
                    }
                </div>
            `
                )
                .join('');
        } else {
            document.getElementById('reminderSection').style.display = 'none';
        }

        // Update action buttons
        const recordPaymentBtn = document.getElementById('detailRecordPaymentBtn');
        const markPaidBtn = document.getElementById('detailMarkPaidBtn');

        if (invoice.status === 'paid') {
            recordPaymentBtn.style.display = 'none';
            markPaidBtn.style.display = 'none';
        } else {
            recordPaymentBtn.style.display = 'inline-block';
            recordPaymentBtn.onclick = () => {
                $('#invoiceDetailsModal').modal('hide');
                openPartialPaymentModal(invoiceId);
            };

            markPaidBtn.style.display = 'inline-block';
            markPaidBtn.onclick = () => {
                $('#invoiceDetailsModal').modal('hide');
                markAsPaid(invoiceId);
            };
        }

        // Show the modal
        $('#invoiceDetailsModal').modal('show');
    } catch (error) {
        console.error('Error loading invoice details:', error);
        Common.showNotification('Failed to load invoice details', 'error');
    }
}

// Toggle between view and edit mode for notes
function toggleNotesEdit(type) {
    if (type === 'notes') {
        const viewMode = document.getElementById('notesViewMode');
        const editMode = document.getElementById('notesEditMode');

        if (editMode.style.display === 'none') {
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            document.getElementById('detailNotesInput').focus();
        } else {
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
            // Reset to original value
            const originalNotes = document.getElementById('detailNotes').textContent;
            document.getElementById('detailNotesInput').value =
                originalNotes === 'No notes' ? '' : originalNotes;
        }
    } else if (type === 'internal') {
        const viewMode = document.getElementById('internalNotesViewMode');
        const editMode = document.getElementById('internalNotesEditMode');

        if (editMode.style.display === 'none') {
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            document.getElementById('detailInternalNotesInput').focus();
        } else {
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
            // Reset to original value
            const originalNotes = document.getElementById('detailInternalNotes').textContent;
            document.getElementById('detailInternalNotesInput').value =
                originalNotes === 'No internal notes' ? '' : originalNotes;
        }
    }
}

// Save notes
async function saveNotes() {
    if (!currentDetailInvoiceId) {
        Common.showNotification('Error: Invoice ID not found', 'error');
        return;
    }

    const notes = document.getElementById('detailNotesInput').value.trim();
    const internalNotes = document.getElementById('detailInternalNotesInput').value.trim();

    try {
        const response = await API.invoices.updateNotes(currentDetailInvoiceId, {
            notes: notes,
            internalNotes: internalNotes,
        });

        if (response.success) {
            Common.showNotification('Notes updated successfully', 'success');

            // Update the display
            document.getElementById('detailNotes').textContent = notes || 'No notes';
            document.getElementById('detailInternalNotes').textContent =
                internalNotes || 'No internal notes';

            // Switch back to view mode
            document.getElementById('notesViewMode').style.display = 'block';
            document.getElementById('notesEditMode').style.display = 'none';
            document.getElementById('internalNotesViewMode').style.display = 'block';
            document.getElementById('internalNotesEditMode').style.display = 'none';

            // Update the invoice data in the table row if it exists
            const row = document.querySelector(`tr[data-id="${currentDetailInvoiceId}"]`);
            if (row) {
                const invoiceData = JSON.parse(row.dataset.invoice);
                invoiceData.notes = notes;
                invoiceData.internalNotes = internalNotes;
                row.dataset.invoice = JSON.stringify(invoiceData);
            }
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to update notes', 'error');
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
window.openNewInvoiceModal = openNewInvoiceModal;
window.submitNewInvoice = submitNewInvoice;
window.openPartialPaymentModal = openPartialPaymentModal;
window.submitPartialPayment = submitPartialPayment;
window.showInvoiceDetails = showInvoiceDetails;
window.toggleNotesEdit = toggleNotesEdit;
window.saveNotes = saveNotes;
window.sortTable = sortTable;

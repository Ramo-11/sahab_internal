// Clients JavaScript - Handles all client-related functionality
document.addEventListener('DOMContentLoaded', () => {
    const page = detectPage();

    // Initialize based on current page
    switch (page) {
        case 'index':
            initClientsIndex();
            break;
        case 'new':
        case 'edit':
            initClientForm();
            break;
        case 'view':
            initClientView();
            break;
    }
});

// Detect which client page we're on
function detectPage() {
    const path = window.location.pathname;
    if (path === '/clients') return 'index';
    if (path === '/clients/new') return 'new';
    if (path.includes('/clients/') && path.includes('/edit')) return 'edit';
    if (path.includes('/clients/') && !path.includes('/edit')) return 'view';
    return null;
}

// ========== Index Page Functions with Inline Editing ==========
function initClientsIndex() {
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
    const industryFilter = document.getElementById('industryFilter');

    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    if (industryFilter) {
        industryFilter.addEventListener('change', applyFilters);
    }
}

// ========== Inline Edit Functions for Index Page ==========
function editClient(id) {
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

function cancelInlineEdit(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    // Reset values to original
    const originalClient = JSON.parse(row.dataset.client);

    row.querySelectorAll('[data-field]').forEach((input) => {
        const field = input.dataset.field;
        input.value = originalClient[field] || '';
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

async function saveInlineClient(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    // Collect updated values
    const updates = {};
    row.querySelectorAll('[data-field]').forEach((input) => {
        const field = input.dataset.field;
        const value = input.value.trim();

        updates[field] = value || null;
    });

    // Show loading state
    const saveBtn = row.querySelector('.edit-actions .btn-success');
    const originalHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const response = await API.clients.update(id, updates);

        if (response.success) {
            Common.showNotification('Client updated successfully', 'success');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (error) {
        Common.showNotification(
            `Failed to update client: ${error.message || 'Failed to update client'}`,
            'error'
        );
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHTML;
    }
}

function updateClientRow(row, client) {
    // Update name
    const nameCell = row.querySelector('.editable-cell:first-child .view-mode');
    if (nameCell) {
        nameCell.innerHTML = `<a href="/clients/${client._id}" class="text-dark"><strong>${client.name}</strong></a>`;
    }

    // Update company
    const companyCell = row.querySelectorAll('.editable-cell')[1]?.querySelector('.view-mode');
    if (companyCell) {
        companyCell.textContent = client.company || '-';
    }

    // Update contact info
    const contactCell = row.querySelectorAll('.editable-cell')[2]?.querySelector('.view-mode');
    if (contactCell) {
        let contactHTML = '';
        if (client.email) {
            contactHTML += `<a href="mailto:${client.email}" class="d-block"><i class="fas fa-envelope"></i> ${client.email}</a>`;
        }
        if (client.phone) {
            const formattedPhone = formatPhone(client.phone);
            contactHTML += `<a href="tel:${client.phone.replace(
                /\D/g,
                ''
            )}" class="d-block"><i class="fas fa-phone"></i> ${formattedPhone}</a>`;
        }
        if (!client.email && !client.phone) {
            contactHTML = '<span class="text-muted">-</span>';
        }
        contactCell.innerHTML = contactHTML;
    }

    // Update status badge
    const statusCell = row.querySelectorAll('.editable-cell')[3]?.querySelector('.view-mode');
    if (statusCell) {
        const badgeClass =
            client.status === 'active'
                ? 'success'
                : client.status === 'lead'
                ? 'info'
                : client.status === 'inactive'
                ? 'warning'
                : 'secondary';
        statusCell.innerHTML = `<span class="badge badge-${badgeClass}">${client.status}</span>`;
    }
}

// Helper function to format phone numbers
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
}

function applyFilters() {
    const params = {};

    const search = document.getElementById('searchInput')?.value;
    const status = document.getElementById('statusFilter')?.value;
    const industry = document.getElementById('industryFilter')?.value;

    if (search) params.search = search;
    if (status) params.status = status;
    if (industry) params.industry = industry;

    // This will clear the URL if params is empty
    const queryString =
        Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : '';

    window.location.href = '/clients' + queryString;
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('industryFilter').value = '';
    applyFilters();
}

async function exportData() {
    try {
        const params = Common.getQueryParams();
        params.type = 'clients';
        params.format = 'csv';

        const queryString = new URLSearchParams(params).toString();
        window.location.href = `/api/analysis/export?${queryString}`;

        Common.showNotification('Export started', 'success');
    } catch (error) {
        Common.showNotification('Failed to export data', 'error');
    }
}

// ========== Form Page Functions (New/Edit) ==========
function initClientForm() {
    const form =
        document.getElementById('newClientForm') || document.getElementById('editClientForm');
    if (form) {
        form.addEventListener('submit', handleClientFormSubmit);
    }
}

async function handleClientFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const isEdit = form.id === 'editClientForm';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = isEdit
            ? '<i class="fas fa-spinner fa-spin"></i> Updating...'
            : '<i class="fas fa-spinner fa-spin"></i> Creating...';
    }

    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
        if (value === '') return;

        if (key.includes('.')) {
            const [parent, child] = key.split('.');
            if (!data[parent]) data[parent] = {};
            data[parent][child] = value;
        } else {
            data[key] = value;
        }
    });

    try {
        const clientId = form.dataset.clientId;
        const response = isEdit
            ? await API.clients.update(clientId, data)
            : await API.clients.create(data);

        if (response.success) {
            Common.showNotification(
                isEdit ? 'Client updated successfully' : 'Client created successfully',
                'success'
            );
            setTimeout(() => {
                window.location.href = `/clients/${response.data._id}`;
            }, 1000);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to save client', 'error');

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = isEdit
                ? '<i class="fas fa-save"></i> Update Client'
                : '<i class="fas fa-save"></i> Create Client';
        }
    }
}

// ========== View Page Functions ==========
function initClientView() {
    initTabs();
    loadClientHistory();
}

function initTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');

    tabLinks.forEach((tab) => {
        tab.addEventListener('click', (e) => {
            const targetTab = e.target.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-link').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-pane').forEach((pane) => {
        pane.classList.toggle('active', pane.id === tabName);
    });

    if (tabName === 'history') {
        loadClientHistory();
    }
}

// Toggle edit mode
function toggleEditMode() {
    const isEditing = document.body.classList.contains('editing');

    if (!isEditing) {
        // Enter edit mode
        document.body.classList.add('editing');
        document.getElementById('editBtn').style.display = 'none';
        document.getElementById('saveBtn').style.display = 'inline-flex';
        document.getElementById('cancelBtn').style.display = 'inline-flex';

        // Show all edit fields and hide view fields
        document.querySelectorAll('.view-mode').forEach((el) => {
            el.style.display = 'none';
        });
        document.querySelectorAll('.edit-mode').forEach((el) => {
            el.style.display = 'block';
        });
    }
}

// Cancel edit mode
function cancelEdit() {
    document.body.classList.remove('editing');
    document.getElementById('editBtn').style.display = 'inline-flex';
    document.getElementById('saveBtn').style.display = 'none';
    document.getElementById('cancelBtn').style.display = 'none';

    // Hide all edit fields and show view fields
    document.querySelectorAll('.view-mode').forEach((el) => {
        el.style.display = 'block';
    });
    document.querySelectorAll('.edit-mode').forEach((el) => {
        el.style.display = 'none';
    });

    // Reset values to original
    const clientData = document.getElementById('clientData');
    if (clientData) {
        const originalClient = JSON.parse(clientData.dataset.client);

        document.querySelectorAll('.edit-mode[data-field]').forEach((input) => {
            const field = input.dataset.field;
            input.value = originalClient[field] || '';
        });
    }
}

// Save client changes
async function saveClient() {
    const clientData = document.getElementById('clientData');
    const clientId = clientData.dataset.clientId;

    // Collect all changes
    const updates = {};
    document.querySelectorAll('.edit-mode[data-field]').forEach((input) => {
        const field = input.dataset.field;
        const value = input.value.trim();

        // Handle clearable fields
        if (field === 'email' || field === 'phone' || field === 'website' || field === 'company') {
            updates[field] = value || null;
        } else if (value || input.type === 'textarea') {
            updates[field] = value;
        }
    });

    // Show loading state
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const response = await API.clients.update(clientId, updates);

        if (response.success) {
            Common.showNotification('Client updated successfully', 'success');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to update client', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Save';
    }
}

// Update displayed data after save
function updateDisplayedData(client) {
    // Update all view-mode elements with new data
    document.querySelectorAll('.view-mode').forEach((el) => {
        const input = el.parentElement.querySelector('.edit-mode[data-field]');
        if (input) {
            const field = input.dataset.field;
            if (field === 'email') {
                el.innerHTML = client[field]
                    ? `<a href="mailto:${client[field]}">${client[field]}</a>`
                    : 'Not provided';
            } else if (field === 'website' && client[field]) {
                el.innerHTML = `<a href="${client[field]}" target="_blank">${client[field]}</a>`;
            } else if (field === 'website' && !client[field]) {
                el.textContent = 'Not provided';
            } else if (field === 'status') {
                const badgeClass =
                    client.status === 'active'
                        ? 'success'
                        : client.status === 'lead'
                        ? 'info'
                        : 'warning';
                el.innerHTML = `<span class="badge badge-${badgeClass}">${client.status}</span>`;
            } else {
                el.textContent = client[field] || 'Not provided';
            }
        }
    });

    // Update notes separately
    const notesView = document.querySelector('.card-body .view-mode p');
    if (notesView) {
        notesView.textContent = client.notes || 'No notes added yet.';
    }

    // Update page title
    const displayName = document.getElementById('displayName');
    if (displayName) {
        displayName.textContent = client.displayName || client.company || client.name;
    }

    // Update status badge in header
    const headerBadge = document.querySelector('.page-meta .badge');
    if (headerBadge) {
        headerBadge.className = `badge badge-${
            client.status === 'active' ? 'success' : client.status === 'lead' ? 'info' : 'warning'
        }`;
        headerBadge.textContent = client.status;
    }
}

async function loadClientHistory() {
    const clientData = document.getElementById('clientData');
    if (!clientData) return;

    const clientId = clientData.dataset.clientId;
    const historyContainer = document.getElementById('clientHistory');

    if (!historyContainer || historyContainer.dataset.loaded === 'true') return;

    try {
        const response = await API.clients.getHistory(clientId);

        if (response.success && response.data.length > 0) {
            const historyHTML = response.data
                .map(
                    (item) => `
                <div class="timeline-item">
                    <div class="timeline-date">
                        ${new Date(item.date).toLocaleDateString()}
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-title">
                            <i class="fas fa-${getHistoryIcon(item.type)}"></i>
                            ${item.title}
                        </div>
                        <div class="timeline-description">
                            Status: <span class="badge badge-${getStatusBadge(item.status)}">${
                        item.status
                    }</span>
                            ${item.amount ? `• Amount: $${(item.amount / 1000).toFixed(1)}k` : ''}
                        </div>
                    </div>
                </div>
            `
                )
                .join('');

            historyContainer.innerHTML = historyHTML;
            historyContainer.dataset.loaded = 'true';
        } else {
            historyContainer.innerHTML =
                '<p class="text-center text-muted">No history available</p>';
        }
    } catch (error) {
        historyContainer.innerHTML =
            '<p class="text-center text-danger">Failed to load history</p>';
    }
}

function getHistoryIcon(type) {
    const icons = {
        proposal: 'file-alt',
        invoice: 'file-invoice-dollar',
        payment: 'dollar-sign',
        note: 'sticky-note',
    };
    return icons[type] || 'info-circle';
}

function getStatusBadge(status) {
    const badges = {
        accepted: 'success',
        paid: 'success',
        sent: 'info',
        viewed: 'primary',
        rejected: 'danger',
        overdue: 'danger',
        pending: 'warning',
        draft: 'secondary',
    };
    return badges[status] || 'secondary';
}

// ========== Shared Functions (Global) ==========
async function deleteClient(id) {
    Common.confirm(
        'Are you sure you want to delete this client? This action cannot be undone.',
        async () => {
            try {
                const response = await API.clients.delete(id);
                if (response.success) {
                    Common.showNotification('Client deleted successfully', 'success');

                    // Remove the row from the table if on index page
                    const row = document.querySelector(`tr[data-id="${id}"]`);
                    if (row) {
                        row.style.opacity = '0';
                        setTimeout(() => row.remove(), 300);

                        // Check if table is empty
                        setTimeout(() => {
                            const tbody = document.querySelector('#clientsTable tbody');
                            if (tbody && tbody.querySelectorAll('tr').length === 0) {
                                window.location.reload();
                            }
                        }, 400);
                    } else {
                        // Redirect if on view page
                        setTimeout(() => {
                            window.location.href = '/clients';
                        }, 1000);
                    }
                }
            } catch (error) {
                Common.showNotification(error.message || 'Failed to delete client', 'error');
            }
        }
    );
}

// Make functions globally available for onclick handlers
window.editClient = editClient;
window.cancelInlineEdit = cancelInlineEdit;
window.saveInlineClient = saveInlineClient;
window.deleteClient = deleteClient;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.exportData = exportData;
window.toggleEditMode = toggleEditMode;
window.cancelEdit = cancelEdit;
window.saveClient = saveClient;

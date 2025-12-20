// Clients JavaScript - Modal-based functionality
let currentClientId = null;
let currentSort = { field: null, direction: 'asc' };

document.addEventListener('DOMContentLoaded', () => {
    initClientsPage();
});

function initClientsPage() {
    initSearch();
    attachFilterListeners();

    // Set up view to edit button
    document.getElementById('viewToEditBtn')?.addEventListener('click', () => {
        $('#viewClientModal').modal('hide');
        setTimeout(() => editClient(currentClientId), 300);
    });

    // Set up delete from edit button
    document.getElementById('deleteFromEditBtn')?.addEventListener('click', () => {
        $('#editClientModal').modal('hide');
        setTimeout(() => deleteClient(currentClientId), 300);
    });
}

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = Common.debounce(() => applyFilters(), 500);
        searchInput.addEventListener('input', debouncedSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') applyFilters();
        });
    }
}

function attachFilterListeners() {
    document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
    document.getElementById('industryFilter')?.addEventListener('change', applyFilters);
}

// ========== Sorting ==========
function sortTable(field) {
    const tbody = document.querySelector('#clientsTable tbody');
    const rows = Array.from(tbody.querySelectorAll('tr')).filter((row) => row.dataset.id);

    if (rows.length === 0) return;

    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }

    rows.sort((a, b) => {
        const aData = JSON.parse(a.dataset.client);
        const bData = JSON.parse(b.dataset.client);
        let aVal, bVal;

        switch (field) {
            case 'name':
                aVal = (aData.name || '').toLowerCase();
                bVal = (bData.name || '').toLowerCase();
                break;
            case 'company':
                aVal = (aData.company || '').toLowerCase();
                bVal = (bData.company || '').toLowerCase();
                break;
            case 'status':
                const statusOrder = { active: 0, lead: 1, paused: 2, lost: 3, completed: 4, inactive: 5, archived: 6 };
                aVal = statusOrder[aData.status] || 7;
                bVal = statusOrder[bData.status] || 7;
                break;
            case 'netTotal':
                aVal = (aData.totalRevenue || 0) - (aData.totalExpenses || 0);
                bVal = (bData.totalRevenue || 0) - (bData.totalExpenses || 0);
                break;
            case 'revenue':
                aVal = aData.totalRevenue || 0;
                bVal = bData.totalRevenue || 0;
                break;
            default:
                return 0;
        }

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;
        return currentSort.direction === 'asc' ? comparison : -comparison;
    });

    rows.forEach((row) => tbody.appendChild(row));
    updateSortIcons(field);
}

function updateSortIcons(activeField) {
    document.querySelectorAll('.sortable .sort-icon').forEach((icon) => {
        icon.className = 'fas fa-sort sort-icon';
    });
    const activeHeader = document.querySelector(`.sortable[onclick*="${activeField}"] .sort-icon`);
    if (activeHeader) {
        activeHeader.className = `fas fa-sort-${
            currentSort.direction === 'asc' ? 'up' : 'down'
        } sort-icon`;
    }
}

// ========== Filters ==========
function applyFilters() {
    const params = {};
    const search = document.getElementById('searchInput')?.value;
    const status = document.getElementById('statusFilter')?.value;
    const industry = document.getElementById('industryFilter')?.value;

    if (search) params.search = search;
    if (status) params.status = status;
    if (industry) params.industry = industry;

    const queryString =
        Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : '';
    window.location.href = '/clients' + queryString;
}

function clearFilters() {
    window.location.href = '/clients';
}

// ========== New Client Modal ==========
function openNewClientModal() {
    document.getElementById('newClientForm').reset();
    $('#newClientModal').modal('show');
}

async function submitNewClient() {
    const form = document.getElementById('newClientForm');
    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
        if (value !== '') {
            if (key.includes('.')) {
                const [parent, child] = key.split('.');
                if (!data[parent]) data[parent] = {};
                data[parent][child] = value;
            } else {
                data[key] = value;
            }
        }
    });

    const submitBtn = document.querySelector('#newClientModal .btn-primary');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        const response = await API.clients.create(data);
        if (response.success) {
            Common.showNotification('Client created successfully', 'success');
            $('#newClientModal').modal('hide');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to create client', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Client';
    }
}

// Helper function to format currency
function formatMoney(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount || 0);
}

// Helper function to get status badge class
function getStatusBadgeClass(status) {
    const statusClasses = {
        active: 'success',
        lead: 'info',
        paused: 'warning',
        lost: 'danger',
        completed: 'primary',
        inactive: 'secondary',
        archived: 'secondary',
    };
    return statusClasses[status] || 'secondary';
}

// ========== View Client Modal ==========
async function viewClient(id) {
    currentClientId = id;
    const row = document.querySelector(`tr[data-id="${id}"]`);

    if (!row) return;

    try {
        // Get basic data from row
        const client = JSON.parse(row.dataset.client);

        // Update modal with basic info
        document.getElementById('viewClientTitle').textContent = client.company || client.name;
        document.getElementById('viewClientName').textContent = client.name;
        document.getElementById('viewClientCompany').textContent = client.company || 'No company';

        const statusBadge = document.getElementById('viewClientStatus');
        statusBadge.textContent = client.status;
        statusBadge.className = `badge badge-${getStatusBadgeClass(client.status)}`;

        // Set initial financial values from row data
        const totalRevenue = client.totalRevenue || 0;
        const totalExpenses = client.totalExpenses || 0;
        const netTotal = totalRevenue - totalExpenses;

        document.getElementById('viewClientRevenue').textContent = formatMoney(totalRevenue);
        document.getElementById('viewClientExpenses').textContent = formatMoney(totalExpenses);
        const netTotalEl = document.getElementById('viewClientNetTotal');
        netTotalEl.textContent = formatMoney(netTotal);
        netTotalEl.className = `financial-amount ${netTotal >= 0 ? 'text-success' : 'text-danger'}`;

        document.getElementById('viewClientEmail').innerHTML = client.email
            ? `<a href="mailto:${client.email}">${client.email}</a>`
            : '-';
        document.getElementById('viewClientPhone').textContent = client.phone || '-';
        document.getElementById('viewClientWebsite').innerHTML = client.website
            ? `<a href="${client.website}" target="_blank">${client.website}</a>`
            : '-';
        document.getElementById('viewClientIndustry').textContent = client.industry || '-';
        document.getElementById('viewClientSize').textContent = client.companySize || '-';
        document.getElementById('viewClientCreated').textContent = new Date(
            client.createdAt
        ).toLocaleDateString();
        document.getElementById('viewClientNotes').textContent = client.notes || 'No notes';

        // Reset tabs
        document.getElementById('clientProposalsBody').innerHTML =
            '<tr><td colspan="4" class="text-center text-muted">Loading...</td></tr>';
        document.getElementById('clientInvoicesBody').innerHTML =
            '<tr><td colspan="4" class="text-center text-muted">Loading...</td></tr>';
        document.getElementById('clientExpensesBody').innerHTML =
            '<tr><td colspan="4" class="text-center text-muted">Loading...</td></tr>';

        $('#viewClientModal').modal('show');

        // Fetch full client data with proposals, invoices, and expenses
        const fullResponse = await API.clients.get(id);
        if (fullResponse.success) {
            const fullClient = fullResponse.data;

            // Update financial summary with accurate data from API
            const apiRevenue = fullClient.totalRevenue || 0;
            const apiExpenses = fullClient.totalExpenses || 0;
            const apiNetTotal = apiRevenue - apiExpenses;

            document.getElementById('viewClientRevenue').textContent = formatMoney(apiRevenue);
            document.getElementById('viewClientExpenses').textContent = formatMoney(apiExpenses);
            netTotalEl.textContent = formatMoney(apiNetTotal);
            netTotalEl.className = `financial-amount ${apiNetTotal >= 0 ? 'text-success' : 'text-danger'}`;

            // Update proposals tab
            const proposals = fullClient.proposals || [];
            document.getElementById('proposalCount').textContent = proposals.length;

            if (proposals.length > 0) {
                document.getElementById('clientProposalsBody').innerHTML = proposals
                    .map(
                        (p) => `
                    <tr>
                        <td>${p.title}</td>
                        <td>${formatMoney(p.pricing?.amount || 0)}</td>
                        <td><span class="badge badge-${
                            p.status === 'accepted' ? 'success' : 'info'
                        }">${p.status}</span></td>
                        <td>${new Date(p.createdAt).toLocaleDateString()}</td>
                    </tr>
                `
                    )
                    .join('');
            } else {
                document.getElementById('clientProposalsBody').innerHTML =
                    '<tr><td colspan="4" class="text-center text-muted">No proposals</td></tr>';
            }

            // Update invoices tab
            const invoices = fullClient.invoices || [];
            document.getElementById('invoiceCount').textContent = invoices.length;

            if (invoices.length > 0) {
                document.getElementById('clientInvoicesBody').innerHTML = invoices
                    .map(
                        (i) => `
                    <tr>
                        <td>#${i.invoiceNumber || '-'}</td>
                        <td>${formatMoney(i.amount || 0)}</td>
                        <td><span class="badge badge-${
                            i.status === 'paid'
                                ? 'success'
                                : i.status === 'partial'
                                ? 'info'
                                : i.status === 'overdue'
                                ? 'danger'
                                : 'warning'
                        }">${i.status}</span></td>
                        <td>${new Date(i.dueDate).toLocaleDateString()}</td>
                    </tr>
                `
                    )
                    .join('');
            } else {
                document.getElementById('clientInvoicesBody').innerHTML =
                    '<tr><td colspan="4" class="text-center text-muted">No invoices</td></tr>';
            }

            // Update expenses tab
            const expenses = fullClient.expenses || [];
            document.getElementById('expenseCount').textContent = expenses.length;

            if (expenses.length > 0) {
                document.getElementById('clientExpensesBody').innerHTML = expenses
                    .map(
                        (e) => `
                    <tr>
                        <td>${e.description || '-'}</td>
                        <td><span class="badge badge-secondary">${e.category || '-'}</span></td>
                        <td>${formatMoney(e.amount || 0)}</td>
                        <td>${new Date(e.expenseDate).toLocaleDateString()}</td>
                    </tr>
                `
                    )
                    .join('');
            } else {
                document.getElementById('clientExpensesBody').innerHTML =
                    '<tr><td colspan="4" class="text-center text-muted">No expenses</td></tr>';
            }
        }
    } catch (error) {
        console.error('Failed to load client details:', error);
        Common.showNotification('Failed to load client details', 'error');
    }
}

// ========== Edit Client Modal ==========
function editClient(id) {
    currentClientId = id;
    const row = document.querySelector(`tr[data-id="${id}"]`);

    if (!row) return;

    const client = JSON.parse(row.dataset.client);

    document.getElementById('editClientId').value = client._id;
    document.getElementById('editName').value = client.name || '';
    document.getElementById('editCompany').value = client.company || '';
    document.getElementById('editEmail').value = client.email || '';
    document.getElementById('editPhone').value = client.phone || '';
    document.getElementById('editWebsite').value = client.website || '';
    document.getElementById('editStatus').value = client.status || 'lead';
    document.getElementById('editIndustry').value = client.industry || 'other';
    document.getElementById('editCompanySize').value = client.companySize || '';
    document.getElementById('editNotes').value = client.notes || '';

    $('#editClientModal').modal('show');
}

async function submitEditClient() {
    const id = document.getElementById('editClientId').value;
    const form = document.getElementById('editClientForm');
    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
        if (key !== '_id') {
            data[key] = value || null;
        }
    });

    const submitBtn = document.querySelector('#editClientModal .btn-primary');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const response = await API.clients.update(id, data);
        if (response.success) {
            Common.showNotification('Client updated successfully', 'success');
            $('#editClientModal').modal('hide');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to update client', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}

// ========== Delete Client ==========
function deleteClient(id) {
    currentClientId = id;
    const row = document.querySelector(`tr[data-id="${id}"]`);

    if (!row) return;

    const client = JSON.parse(row.dataset.client);
    document.getElementById('deleteClientId').value = id;
    document.getElementById('deleteClientName').textContent = client.company || client.name;

    $('#deleteConfirmModal').modal('show');
}

async function confirmDelete() {
    const id = document.getElementById('deleteClientId').value;
    const deleteBtn = document.querySelector('#deleteConfirmModal .btn-danger');
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const response = await API.clients.delete(id);
        if (response.success) {
            Common.showNotification('Client deleted successfully', 'success');
            $('#deleteConfirmModal').modal('hide');

            const row = document.querySelector(`tr[data-id="${id}"]`);
            if (row) {
                row.style.opacity = '0';
                row.style.transition = 'opacity 0.3s';
                setTimeout(() => {
                    row.remove();
                    // Check if table is empty
                    const tbody = document.querySelector('#clientsTable tbody');
                    if (tbody && tbody.querySelectorAll('tr[data-id]').length === 0) {
                        window.location.reload();
                    }
                }, 300);
            }
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to delete client', 'error');
    } finally {
        deleteBtn.disabled = false;
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete';
    }
}

// ========== Export ==========
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

// Make functions globally available
window.openNewClientModal = openNewClientModal;
window.submitNewClient = submitNewClient;
window.viewClient = viewClient;
window.editClient = editClient;
window.submitEditClient = submitEditClient;
window.deleteClient = deleteClient;
window.confirmDelete = confirmDelete;
window.sortTable = sortTable;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.exportData = exportData;

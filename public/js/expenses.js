// Expense JavaScript
document.addEventListener('DOMContentLoaded', () => {
    initExpensePage();
    loadClients();
});

// Sorting state
let sortState = {
    column: null,
    direction: 'asc' // 'asc' or 'desc'
};

function initExpensePage() {
    initSearch();
    attachFilterListeners();
    initSorting();
}

// Initialize sorting
function initSorting() {
    const headers = document.querySelectorAll('#expensesTable thead th');
    const sortableColumns = ['Date', 'Description', 'Amount', 'Category', 'Client'];

    headers.forEach((header, index) => {
        const columnName = header.textContent.trim();
        if (sortableColumns.includes(columnName)) {
            header.style.cursor = 'pointer';
            header.style.userSelect = 'none';
            header.classList.add('sortable');

            // Add sort indicator span
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            indicator.innerHTML = ' <i class="fas fa-sort"></i>';
            header.appendChild(indicator);

            header.addEventListener('click', () => sortTable(columnName, index));
        }
    });
}

// Sort table
function sortTable(columnName, columnIndex) {
    const table = document.getElementById('expensesTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr')).filter(row => row.dataset.id);

    if (rows.length === 0) return;

    // Toggle sort direction
    if (sortState.column === columnName) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = columnName;
        sortState.direction = 'asc';
    }

    // Sort rows
    rows.sort((a, b) => {
        let aVal, bVal;

        switch (columnName) {
            case 'Date':
                const aData = JSON.parse(a.dataset.expense);
                const bData = JSON.parse(b.dataset.expense);
                aVal = new Date(aData.expenseDate).getTime();
                bVal = new Date(bData.expenseDate).getTime();
                break;
            case 'Description':
                aVal = a.querySelector('td:nth-child(2) .view-mode').textContent.trim().toLowerCase();
                bVal = b.querySelector('td:nth-child(2) .view-mode').textContent.trim().toLowerCase();
                break;
            case 'Amount':
                const aExpense = JSON.parse(a.dataset.expense);
                const bExpense = JSON.parse(b.dataset.expense);
                aVal = aExpense.amount;
                bVal = bExpense.amount;
                break;
            case 'Category':
                aVal = a.querySelector('td:nth-child(4) .category-badge').textContent.trim().toLowerCase();
                bVal = b.querySelector('td:nth-child(4) .category-badge').textContent.trim().toLowerCase();
                break;
            case 'Client':
                const aClient = a.querySelector('td:nth-child(5)').textContent.trim().toLowerCase();
                const bClient = b.querySelector('td:nth-child(5)').textContent.trim().toLowerCase();
                aVal = aClient === '-' ? '' : aClient;
                bVal = bClient === '-' ? '' : bClient;
                break;
        }

        // Compare values
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;

        return sortState.direction === 'asc' ? comparison : -comparison;
    });

    // Re-append rows in sorted order
    rows.forEach(row => tbody.appendChild(row));

    // Update sort indicators
    updateSortIndicators(columnIndex);
}

// Update sort indicators
function updateSortIndicators(activeIndex) {
    const headers = document.querySelectorAll('#expensesTable thead th');
    headers.forEach((header, index) => {
        const indicator = header.querySelector('.sort-indicator');
        if (indicator) {
            if (index === activeIndex) {
                const icon = sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
                indicator.innerHTML = ` <i class="fas ${icon}"></i>`;
            } else {
                indicator.innerHTML = ' <i class="fas fa-sort"></i>';
            }
        }
    });
}

// Load clients for dropdown
async function loadClients() {
    const clientSelect = document.getElementById('clientFilter');
    const quickClientSelect = document.getElementById('quickClient');

    try {
        const response = await API.clients.getAll();
        if (response.success) {
            const clientOptions =
                '<option value="">All Clients</option>' +
                response.data
                    .map(
                        (client) =>
                            `<option value="${client._id}">${
                                client.company || client.name
                            }</option>`
                    )
                    .join('');

            if (clientSelect) clientSelect.innerHTML = clientOptions;

            const quickClientOptions =
                '<option value="">No Client</option>' +
                response.data
                    .map(
                        (client) =>
                            `<option value="${client._id}">${
                                client.company || client.name
                            }</option>`
                    )
                    .join('');

            if (quickClientSelect) quickClientSelect.innerHTML = quickClientOptions;
        }
    } catch (error) {
        console.error('Failed to load clients:', error);
    }
}

// Search functionality
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = Common.debounce(() => {
            applyFilters();
        }, 500);

        searchInput.addEventListener('input', debouncedSearch);
    }
}

// Filter listeners
function attachFilterListeners() {
    const categoryFilter = document.getElementById('categoryFilter');
    const clientFilter = document.getElementById('clientFilter');
    const monthFilter = document.getElementById('monthFilter');

    if (categoryFilter) {
        categoryFilter.addEventListener('change', applyFilters);
    }
    if (clientFilter) {
        clientFilter.addEventListener('change', applyFilters);
    }
    if (monthFilter) {
        monthFilter.addEventListener('change', applyFilters);
    }
}

// Apply filters
function applyFilters() {
    const params = {};

    const search = document.getElementById('searchInput')?.value;
    const category = document.getElementById('categoryFilter')?.value;
    const client = document.getElementById('clientFilter')?.value;
    const month = document.getElementById('monthFilter')?.value;

    if (search) params.search = search;
    if (category) params.category = category;
    if (client) params.client = client;
    if (month) params.month = month;

    const queryString =
        Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : '';

    window.location.href = '/expenses' + queryString;
}
// Clear filters
function clearFilters() {
    window.location.href = '/expenses';
}

// Edit expense inline
function editExpense(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    row.querySelectorAll('.view-mode').forEach((el) => {
        el.style.display = 'none';
    });
    row.querySelector('.view-actions').style.display = 'none';

    row.querySelectorAll('.edit-mode').forEach((el) => {
        el.style.display = 'block';
    });
    row.querySelector('.edit-actions').style.display = 'flex';

    row.classList.add('editing');
}

// Cancel edit
function cancelEdit(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const originalExpense = JSON.parse(row.dataset.expense);

    row.querySelectorAll('.edit-mode[data-field]').forEach((input) => {
        const field = input.dataset.field;
        if (field === 'expenseDate' && originalExpense.expenseDate) {
            input.value = new Date(originalExpense.expenseDate).toISOString().split('T')[0];
        } else {
            input.value = originalExpense[field] || '';
        }
    });

    row.querySelectorAll('.view-mode').forEach((el) => {
        el.style.display = '';
    });
    row.querySelector('.view-actions').style.display = 'flex';

    row.querySelectorAll('.edit-mode').forEach((el) => {
        el.style.display = 'none';
    });
    row.querySelector('.edit-actions').style.display = 'none';

    row.classList.remove('editing');
}

// Save expense
async function saveExpense(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const updates = {};
    row.querySelectorAll('.edit-mode[data-field]').forEach((input) => {
        const field = input.dataset.field;
        const value = input.value.trim();

        if (field === 'amount') {
            updates[field] = parseFloat(value);
        } else if (field === 'expenseDate' && value) {
            updates[field] = new Date(value).toISOString();
        } else {
            updates[field] = value;
        }
    });

    const saveBtn = row.querySelector('.edit-actions .btn-success');
    const originalHTML = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const response = await API.expenses.update(id, updates);

        if (response.success) {
            Common.showNotification('Expense updated', 'success');
            window.location.reload();
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to update expense', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHTML;
    }
}

// Delete expense
async function deleteExpense(id) {
    Common.confirm('Delete this expense?', async () => {
        try {
            const response = await API.expenses.delete(id);
            if (response.success) {
                Common.showNotification('Expense deleted', 'success');
                window.location.reload();
            }
        } catch (error) {
            Common.showNotification(error.message || 'Failed to delete expense', 'error');
        }
    });
}

// Quick add expense
async function quickAddExpense() {
    const amount = document.getElementById('quickAmount').value;
    const description = document.getElementById('quickDescription').value;
    const category = document.getElementById('quickCategory').value;
    const client = document.getElementById('quickClient').value;

    if (!amount) {
        Common.showNotification('Amount is required', 'warning');
        return;
    }

    try {
        const data = {
            amount: parseFloat(amount),
            expenseDate: new Date().toISOString(),
            category: category || 'other',
        };

        if (description) data.description = description;
        if (client) data.client = client;

        const response = await API.expenses.create(data);

        if (response.success) {
            Common.showNotification('Expense added', 'success');
            window.location.reload();
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to add expense', 'error');
    }
}

// Make functions globally available
window.editExpense = editExpense;
window.cancelEdit = cancelEdit;
window.saveExpense = saveExpense;
window.deleteExpense = deleteExpense;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.quickAddExpense = quickAddExpense;

// Expenses JavaScript - Enhanced with Charts
document.addEventListener('DOMContentLoaded', () => {
    initExpensePage();
    initCharts();
});

/**
 * Safe number helper - prevents NaN
 */
const safeNumber = (value, defaultValue = 0) => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

/**
 * Format currency
 */
const formatCurrency = (value) => {
    const num = safeNumber(value);
    if (Math.abs(num) >= 1000) {
        return '$' + (num / 1000).toFixed(1) + 'k';
    }
    return '$' + num.toFixed(2);
};

// Sorting state
let sortState = {
    column: null,
    direction: 'asc',
};

// Chart instances
let trendChart = null;
let categoryChart = null;

/**
 * Initialize expense page
 */
function initExpensePage() {
    initSearch();
    attachFilterListeners();
    initSorting();
}

/**
 * Initialize charts
 */
function initCharts() {
    const dataEl = document.getElementById('expenseData');
    if (!dataEl) return;

    let stats;
    try {
        stats = JSON.parse(dataEl.dataset.stats || '{}');
    } catch (e) {
        console.error('Failed to parse stats data:', e);
        return;
    }

    initTrendChart(stats.trendData || []);
    initCategoryChart(stats.categoryData || []);
}

/**
 * Initialize trend chart
 */
function initTrendChart(trendData) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (trendChart) {
        trendChart.destroy();
    }

    // Prepare data
    const labels = trendData.map((d) => d.label || d.month);
    const data = trendData.map((d) => safeNumber(d.total));

    // Generate gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.02)');

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Expenses',
                    data,
                    borderColor: '#ef4444',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 13 },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: (context) => {
                            return 'Expenses: ' + formatCurrency(context.raw);
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#6b7280',
                    },
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                    },
                    ticks: {
                        font: { size: 11 },
                        color: '#6b7280',
                        callback: (value) => formatCurrency(value),
                    },
                },
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        },
    });
}

/**
 * Initialize category chart
 */
function initCategoryChart(categoryData) {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (categoryChart) {
        categoryChart.destroy();
    }

    // Filter out zero values
    const filteredData = categoryData.filter((d) => safeNumber(d.total) > 0);

    if (filteredData.length === 0) {
        // Show empty state
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText('No expense data', canvas.width / 2, canvas.height / 2);
        return;
    }

    // Category colors
    const categoryColors = {
        office: '#3b82f6',
        software: '#8b5cf6',
        travel: '#10b981',
        meals: '#f59e0b',
        drinks: '#ec4899',
        marketing: '#ef4444',
        contractors: '#6366f1',
        donation: '#22c55e',
        investment: '#facc15',
        other: '#6b7280',
    };

    const labels = filteredData.map((d) => d.category || 'other');
    const data = filteredData.map((d) => safeNumber(d.total));
    const colors = labels.map((cat) => categoryColors[cat] || categoryColors.other);

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map((l) => l.charAt(0).toUpperCase() + l.slice(1)),
            datasets: [
                {
                    data,
                    backgroundColor: colors,
                    borderColor: '#fff',
                    borderWidth: 2,
                    hoverOffset: 4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { size: 11 },
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            const value = safeNumber(context.raw);
                            const total = context.dataset.data.reduce(
                                (a, b) => a + safeNumber(b),
                                0
                            );
                            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${formatCurrency(value)} (${percent}%)`;
                        },
                    },
                },
            },
        },
    });
}

/**
 * Initialize sorting
 */
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

/**
 * Sort table
 */
function sortTable(columnName, columnIndex) {
    const table = document.getElementById('expensesTable');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr')).filter((row) => row.dataset.id);

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

        try {
            switch (columnName) {
                case 'Date':
                    const aData = JSON.parse(a.dataset.expense || '{}');
                    const bData = JSON.parse(b.dataset.expense || '{}');
                    aVal = new Date(aData.expenseDate || 0).getTime();
                    bVal = new Date(bData.expenseDate || 0).getTime();
                    break;
                case 'Description':
                    aVal = (a.querySelector('td:nth-child(2) .view-mode')?.textContent || '')
                        .trim()
                        .toLowerCase();
                    bVal = (b.querySelector('td:nth-child(2) .view-mode')?.textContent || '')
                        .trim()
                        .toLowerCase();
                    break;
                case 'Amount':
                    const aExpense = JSON.parse(a.dataset.expense || '{}');
                    const bExpense = JSON.parse(b.dataset.expense || '{}');
                    aVal = safeNumber(aExpense.amount);
                    bVal = safeNumber(bExpense.amount);
                    break;
                case 'Category':
                    aVal = (a.querySelector('td:nth-child(4) .category-badge')?.textContent || '')
                        .trim()
                        .toLowerCase();
                    bVal = (b.querySelector('td:nth-child(4) .category-badge')?.textContent || '')
                        .trim()
                        .toLowerCase();
                    break;
                case 'Client':
                    aVal = (a.querySelector('td:nth-child(5)')?.textContent || '')
                        .trim()
                        .toLowerCase();
                    bVal = (b.querySelector('td:nth-child(5)')?.textContent || '')
                        .trim()
                        .toLowerCase();
                    aVal = aVal === '-' ? '' : aVal;
                    bVal = bVal === '-' ? '' : bVal;
                    break;
                default:
                    aVal = '';
                    bVal = '';
            }
        } catch (e) {
            console.error('Sort error:', e);
            aVal = '';
            bVal = '';
        }

        // Compare values
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;

        return sortState.direction === 'asc' ? comparison : -comparison;
    });

    // Re-append rows in sorted order
    rows.forEach((row) => tbody.appendChild(row));

    // Update sort indicators
    updateSortIndicators(columnIndex);
}

/**
 * Update sort indicators
 */
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

/**
 * Search functionality
 */
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = Common.debounce(() => {
            applyFilters();
        }, 500);

        searchInput.addEventListener('input', debouncedSearch);
    }
}

/**
 * Filter listeners
 */
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

/**
 * Apply filters
 */
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

/**
 * Clear filters
 */
function clearFilters() {
    window.location.href = '/expenses';
}

/**
 * Edit expense inline
 */
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

/**
 * Cancel edit
 */
function cancelEdit(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    let originalExpense;
    try {
        originalExpense = JSON.parse(row.dataset.expense || '{}');
    } catch (e) {
        console.error('Failed to parse expense data:', e);
        return;
    }

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

/**
 * Save expense
 */
async function saveExpense(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    const updates = {};
    row.querySelectorAll('.edit-mode[data-field]').forEach((input) => {
        const field = input.dataset.field;
        const value = input.value.trim();

        if (field === 'amount') {
            updates[field] = safeNumber(parseFloat(value));
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

/**
 * Delete expense
 */
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

/**
 * Quick add expense
 */
async function quickAddExpense() {
    const amount = document.getElementById('quickAmount').value;
    const description = document.getElementById('quickDescription').value;
    const category = document.getElementById('quickCategory').value;
    const client = document.getElementById('quickClient').value;
    const date = document.getElementById('quickDate').value;

    if (!amount) {
        Common.showNotification('Amount is required', 'warning');
        return;
    }

    const addBtn = document.querySelector('.btn-add');
    if (addBtn) {
        addBtn.disabled = true;
        addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    }

    try {
        const data = {
            amount: safeNumber(parseFloat(amount)),
            expenseDate: date ? new Date(date).toISOString() : new Date().toISOString(),
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
        if (addBtn) {
            addBtn.disabled = false;
            addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
        }
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

// Investments JavaScript - Full functionality
document.addEventListener('DOMContentLoaded', () => {
    initInvestmentsPage();
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

// Chart instances
let trendChart = null;
let typeChart = null;

/**
 * Initialize investments page
 */
function initInvestmentsPage() {
    initSearch();
    attachFilterListeners();
}

/**
 * Initialize charts
 */
function initCharts() {
    const dataEl = document.getElementById('investmentData');
    if (!dataEl) return;

    let stats;
    try {
        stats = JSON.parse(dataEl.dataset.stats || '{}');
    } catch (e) {
        console.error('Failed to parse stats data:', e);
        return;
    }

    initTrendChart(stats.trendData || []);
    initTypeChart(stats.typeData || []);
}

/**
 * Initialize trend chart
 */
function initTrendChart(trendData) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (trendChart) {
        trendChart.destroy();
    }

    const labels = trendData.map((d) => d.label || d.month);
    const gains = trendData.map((d) => safeNumber(d.gains));
    const losses = trendData.map((d) => Math.abs(safeNumber(d.losses)));
    const totals = trendData.map((d) => safeNumber(d.total));

    trendChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Gains',
                    data: gains,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: '#10b981',
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: 'Losses',
                    data: losses,
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 11 },
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            const label = context.dataset.label;
                            const value = context.raw;
                            return `${label}: ${formatCurrency(value)}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 }, color: '#6b7280' },
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        font: { size: 11 },
                        color: '#6b7280',
                        callback: (value) => formatCurrency(value),
                    },
                },
            },
        },
    });
}

/**
 * Initialize type chart
 */
function initTypeChart(typeData) {
    const canvas = document.getElementById('typeChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (typeChart) {
        typeChart.destroy();
    }

    const filteredData = typeData.filter((d) => safeNumber(d.totalPrincipal) > 0);

    if (filteredData.length === 0) {
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'center';
        ctx.fillText('No investment data', canvas.width / 2, canvas.height / 2);
        return;
    }

    const typeColors = {
        stocks: '#3b82f6',
        bonds: '#8b5cf6',
        real_estate: '#10b981',
        crypto: '#f59e0b',
        mutual_fund: '#ec4899',
        business: '#6366f1',
        other: '#6b7280',
    };

    const labels = filteredData.map((d) => (d.type || 'other').replace('_', ' '));
    const data = filteredData.map((d) => safeNumber(d.totalPrincipal));
    const colors = filteredData.map((d) => typeColors[d.type] || typeColors.other);

    typeChart = new Chart(ctx, {
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
    const typeFilter = document.getElementById('typeFilter');
    const statusFilter = document.getElementById('statusFilter');

    if (typeFilter) {
        typeFilter.addEventListener('change', applyFilters);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
}

/**
 * Apply filters
 */
function applyFilters() {
    const params = {};

    const search = document.getElementById('searchInput')?.value;
    const type = document.getElementById('typeFilter')?.value;
    const status = document.getElementById('statusFilter')?.value;

    if (search) params.search = search;
    if (type) params.type = type;
    if (status) params.status = status;

    const queryString =
        Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : '';

    window.location.href = '/investments' + queryString;
}

/**
 * Clear filters
 */
function clearFilters() {
    window.location.href = '/investments';
}

/**
 * Open new investment modal
 */
function openNewInvestmentModal() {
    document.getElementById('newInvestmentForm').reset();
    document.getElementById('newInvestmentStartDate').value = new Date()
        .toISOString()
        .split('T')[0];
    $('#newInvestmentModal').modal('show');
}

/**
 * Submit new investment
 */
async function submitNewInvestment() {
    const form = document.getElementById('newInvestmentForm');
    const formData = new FormData(form);

    const data = {};
    formData.forEach((value, key) => {
        if (value !== '') {
            data[key] = value;
        }
    });

    if (data.principal) {
        data.principal = parseFloat(data.principal);
    }

    const submitBtn = document.querySelector('#newInvestmentModal .btn-primary');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

    try {
        const response = await API.investments.create(data);

        if (response.success) {
            Common.showNotification('Investment created successfully', 'success');
            $('#newInvestmentModal').modal('hide');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to create investment', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
    }
}

/**
 * Open add return modal
 */
function openAddReturnModal(investmentId, investmentName) {
    document.getElementById('returnInvestmentId').value = investmentId;
    document.getElementById('returnInvestmentName').textContent = investmentName;
    document.getElementById('addReturnForm').reset();
    document.getElementById('returnDate').value = new Date().toISOString().split('T')[0];
    $('#addReturnModal').modal('show');
}

/**
 * Submit new return
 */
async function submitNewReturn() {
    const investmentId = document.getElementById('returnInvestmentId').value;
    const amount = document.getElementById('returnAmount').value;
    const returnDate = document.getElementById('returnDate').value;
    const notes = document.getElementById('returnNotes').value;

    if (!amount) {
        Common.showNotification('Amount is required', 'warning');
        return;
    }

    const submitBtn = document.querySelector('#addReturnModal .btn-primary');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recording...';

    try {
        const response = await API.investments.addReturn(investmentId, {
            amount: parseFloat(amount),
            returnDate: returnDate || new Date().toISOString(),
            notes,
        });

        if (response.success) {
            Common.showNotification('Return recorded successfully', 'success');
            $('#addReturnModal').modal('hide');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to record return', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
    }
}

/**
 * Edit investment
 */
async function editInvestment(id) {
    try {
        const response = await API.investments.get(id);

        if (response.success) {
            const investment = response.data;

            document.getElementById('editInvestmentId').value = investment._id;
            document.getElementById('editInvestmentName').value = investment.name || '';
            document.getElementById('editInvestmentType').value = investment.type || 'other';
            document.getElementById('editInvestmentPrincipal').value = investment.principal || '';
            document.getElementById('editInvestmentStatus').value = investment.status || 'active';
            document.getElementById('editInvestmentStartDate').value = investment.startDate
                ? new Date(investment.startDate).toISOString().split('T')[0]
                : '';
            document.getElementById('editInvestmentDescription').value =
                investment.description || '';
            document.getElementById('editInvestmentNotes').value = investment.notes || '';

            $('#editInvestmentModal').modal('show');
        }
    } catch (error) {
        Common.showNotification('Failed to load investment details', 'error');
    }
}

/**
 * Submit edit investment
 */
async function submitEditInvestment() {
    const id = document.getElementById('editInvestmentId').value;
    const form = document.getElementById('editInvestmentForm');
    const formData = new FormData(form);

    const data = {};
    formData.forEach((value, key) => {
        if (key !== '_id') {
            data[key] = value || null;
        }
    });

    if (data.principal) {
        data.principal = parseFloat(data.principal);
    }

    const submitBtn = document.querySelector('#editInvestmentModal .btn-primary');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        const response = await API.investments.update(id, data);

        if (response.success) {
            Common.showNotification('Investment updated successfully', 'success');
            $('#editInvestmentModal').modal('hide');
            setTimeout(() => window.location.reload(), 500);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to update investment', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
    }
}

/**
 * Delete investment
 */
async function deleteInvestment(id) {
    Common.confirm(
        'Are you sure you want to delete this investment? All associated returns will also be deleted.',
        async () => {
            try {
                const response = await API.investments.delete(id);

                if (response.success) {
                    Common.showNotification('Investment deleted successfully', 'success');
                    setTimeout(() => window.location.reload(), 500);
                }
            } catch (error) {
                Common.showNotification(error.message || 'Failed to delete investment', 'error');
            }
        }
    );
}

/**
 * Toggle returns visibility
 */
function toggleReturns(investmentId) {
    const returnsSection = document.getElementById(`returns-${investmentId}`);
    const toggleBtn = document.querySelector(`[data-toggle-returns="${investmentId}"]`);

    if (returnsSection) {
        returnsSection.classList.toggle('show');

        if (toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            if (returnsSection.classList.contains('show')) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-up');
            } else {
                icon.classList.remove('fa-chevron-up');
                icon.classList.add('fa-chevron-down');
            }
        }
    }
}

/**
 * Delete return
 */
async function deleteReturn(investmentId, returnId) {
    Common.confirm('Delete this return entry?', async () => {
        try {
            const response = await API.investments.deleteReturn(investmentId, returnId);

            if (response.success) {
                Common.showNotification('Return deleted successfully', 'success');
                setTimeout(() => window.location.reload(), 500);
            }
        } catch (error) {
            Common.showNotification(error.message || 'Failed to delete return', 'error');
        }
    });
}

/**
 * View investment details
 */
async function viewInvestmentDetails(id) {
    try {
        const response = await API.investments.get(id);

        if (response.success) {
            const investment = response.data;

            document.getElementById('detailInvestmentName').textContent = investment.name;
            document.getElementById('detailInvestmentType').textContent = (
                investment.type || 'other'
            ).replace('_', ' ');
            document.getElementById('detailInvestmentPrincipal').textContent = formatCurrency(
                investment.principal
            );
            document.getElementById('detailInvestmentStatus').innerHTML = `
                <span class="investment-card-status ${investment.status}">${investment.status}</span>
            `;
            document.getElementById('detailInvestmentStartDate').textContent = investment.startDate
                ? new Date(investment.startDate).toLocaleDateString()
                : '-';
            document.getElementById('detailInvestmentDescription').textContent =
                investment.description || 'No description';

            const totalReturns = safeNumber(investment.totalReturns);
            document.getElementById('detailInvestmentTotalReturns').textContent =
                formatCurrency(totalReturns);
            document.getElementById('detailInvestmentTotalReturns').className =
                totalReturns >= 0 ? 'text-success' : 'text-danger';

            document.getElementById('detailInvestmentROI').textContent = investment.roi + '%';
            document.getElementById('detailInvestmentROI').className =
                parseFloat(investment.roi) >= 0 ? 'text-success' : 'text-danger';

            // Populate returns table
            const returnsBody = document.getElementById('detailReturnsBody');
            if (investment.returns && investment.returns.length > 0) {
                returnsBody.innerHTML = investment.returns
                    .map(
                        (ret) => `
                    <tr>
                        <td>${new Date(ret.returnDate).toLocaleDateString()}</td>
                        <td class="return-amount ${
                            ret.amount > 0 ? 'positive' : ret.amount < 0 ? 'negative' : 'zero'
                        }">
                            ${ret.amount >= 0 ? '+' : ''}${formatCurrency(ret.amount)}
                        </td>
                        <td>${ret.notes || '-'}</td>
                    </tr>
                `
                    )
                    .join('');
            } else {
                returnsBody.innerHTML =
                    '<tr><td colspan="3" class="text-center text-muted">No returns recorded</td></tr>';
            }

            $('#viewInvestmentModal').modal('show');
        }
    } catch (error) {
        Common.showNotification('Failed to load investment details', 'error');
    }
}

// Make functions globally available
window.openNewInvestmentModal = openNewInvestmentModal;
window.submitNewInvestment = submitNewInvestment;
window.openAddReturnModal = openAddReturnModal;
window.submitNewReturn = submitNewReturn;
window.editInvestment = editInvestment;
window.submitEditInvestment = submitEditInvestment;
window.deleteInvestment = deleteInvestment;
window.toggleReturns = toggleReturns;
window.deleteReturn = deleteReturn;
window.viewInvestmentDetails = viewInvestmentDetails;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;

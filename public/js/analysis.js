// Analysis JavaScript
let charts = {};
let analysisData = {};

document.addEventListener('DOMContentLoaded', async () => {
    loadAnalysisData();
    await loadRevenueData();
    await loadInvoiceData();
    initCharts();
    attachEventListeners();
    loadClientAnalysis();
});

// Load analysis data from hidden element
function loadAnalysisData() {
    const dataElement = document.getElementById('analysisData');
    if (dataElement) {
        analysisData.stats = JSON.parse(dataElement.dataset.stats || '{}');
        analysisData.period = dataElement.dataset.period || '30';
        analysisData.dateRange = JSON.parse(dataElement.dataset.dateRange || '{}');
    }
}

// Initialize all charts
function initCharts() {
    initRevenueChart();
    initClientCharts();
    initInvoiceCharts();
}

// Load revenue data from API
async function loadRevenueData() {
    try {
        const response = await API.analysis.getRevenue({ period: 'monthly' });
        if (response.success && response.data.revenue) {
            analysisData.revenueData = response.data.revenue;
        }
    } catch (error) {
        console.error('Failed to load revenue data:', error);
        analysisData.revenueData = [];
    }
}

// Load invoice data from API
async function loadInvoiceData() {
    try {
        const response = await API.analysis.getInvoices();
        if (response.success && response.data) {
            analysisData.invoiceData = response.data;
        }
    } catch (error) {
        console.error('Failed to load invoice data:', error);
        analysisData.invoiceData = {};
    }
}

// Helper function to format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value || 0);
}

// Initialize revenue chart
function initRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    // Use real data from API
    const revenueData = analysisData.revenueData || [];
    const labels = revenueData.map((d) => d._id);
    const data = revenueData.map((d) => d.revenue);

    charts.revenue = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels.length > 0 ? labels : generateMonthLabels(),
            datasets: [
                {
                    label: 'Revenue',
                    data: data.length > 0 ? data : [],
                    borderColor: '#7117f2',
                    backgroundColor: 'rgba(113, 23, 242, 0.1)',
                    tension: 0.4,
                    fill: true,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => formatCurrency(context.parsed.y),
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value),
                    },
                },
            },
        },
    });
}

// Initialize client charts
function initClientCharts() {
    // Client distribution chart
    const distCtx = document.getElementById('clientDistChart');
    if (distCtx) {
        const byStatus = analysisData.stats?.clients?.byStatus || [];
        const getStatusCount = (status) => byStatus.find((s) => s._id === status)?.count || 0;

        charts.clientDist = new Chart(distCtx.getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['Active', 'Lead', 'Paused', 'Lost', 'Completed', 'Inactive', 'Archived'],
                datasets: [
                    {
                        data: [
                            getStatusCount('active'),
                            getStatusCount('lead'),
                            getStatusCount('paused'),
                            getStatusCount('lost'),
                            getStatusCount('completed'),
                            getStatusCount('inactive'),
                            getStatusCount('archived'),
                        ],
                        backgroundColor: [
                            '#10b981', // Active - green
                            '#3b82f6', // Lead - blue
                            '#f59e0b', // Paused - amber
                            '#ef4444', // Lost - red
                            '#7117f2', // Completed - purple
                            '#6b7280', // Inactive - gray
                            '#374151', // Archived - dark gray
                        ],
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                },
            },
        });
    }

    // Client industry chart
    const indCtx = document.getElementById('clientIndustryChart');
    if (indCtx) {
        const industryData = analysisData.stats?.clients?.byIndustry || [];
        charts.clientIndustry = new Chart(indCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: industryData.map((i) => i._id || 'Other'),
                datasets: [
                    {
                        label: 'Clients',
                        data: industryData.map((i) => i.count),
                        backgroundColor: '#7117f2',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                },
            },
        });
    }
}

// Initialize invoice charts
function initInvoiceCharts() {
    const invoiceData = analysisData.invoiceData || {};
    const statusBreakdown = invoiceData.statusBreakdown || [];
    const agingData = invoiceData.aging || [];

    // Payment status chart
    const statusCtx = document.getElementById('paymentStatusChart');
    if (statusCtx) {
        // Map status breakdown to chart data
        const statusMap = {
            paid: { label: 'Paid', color: '#10b981' },
            pending: { label: 'Pending', color: '#f59e0b' },
            overdue: { label: 'Overdue', color: '#ef4444' },
            partial: { label: 'Partial', color: '#3b82f6' },
            draft: { label: 'Draft', color: '#6b7280' },
            cancelled: { label: 'Cancelled', color: '#374151' },
        };

        const labels = [];
        const data = [];
        const colors = [];

        statusBreakdown.forEach((s) => {
            const status = statusMap[s._id] || { label: s._id, color: '#6b7280' };
            labels.push(status.label);
            data.push(s.count);
            colors.push(status.color);
        });

        charts.paymentStatus = new Chart(statusCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: labels.length > 0 ? labels : ['No Data'],
                datasets: [
                    {
                        data: data.length > 0 ? data : [1],
                        backgroundColor: colors.length > 0 ? colors : ['#e5e7eb'],
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                },
            },
        });
    }

    // Aging chart
    const agingCtx = document.getElementById('agingChart');
    if (agingCtx) {
        // Map aging buckets to readable labels
        const agingLabels = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'];
        const agingAmounts = [0, 0, 0, 0, 0];

        agingData.forEach((bucket) => {
            if (bucket._id === -365 || bucket._id < 0) {
                agingAmounts[0] = bucket.amount || 0; // Current (not overdue)
            } else if (bucket._id === 0 || bucket._id < 30) {
                agingAmounts[1] = bucket.amount || 0; // 1-30 days
            } else if (bucket._id === 30 || bucket._id < 60) {
                agingAmounts[2] = bucket.amount || 0; // 31-60 days
            } else if (bucket._id === 60 || bucket._id < 90) {
                agingAmounts[3] = bucket.amount || 0; // 61-90 days
            } else {
                agingAmounts[4] = bucket.amount || 0; // 90+ days
            }
        });

        charts.aging = new Chart(agingCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: agingLabels,
                datasets: [
                    {
                        label: 'Amount',
                        data: agingAmounts,
                        backgroundColor: '#7117f2',
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => formatCurrency(context.parsed.y),
                        },
                    },
                },
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => formatCurrency(value),
                        },
                    },
                },
            },
        });
    }
}

// Attach event listeners
function attachEventListeners() {
    // Period selector
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
        periodSelect.addEventListener('change', (e) => {
            window.location.href = `/analysis?period=${e.target.value}`;
        });
    }

    // Tab navigation
    document.querySelectorAll('.tab-link').forEach((tab) => {
        tab.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // Chart view options
    document.querySelectorAll('.chart-option').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            updateChartView(view);

            document.querySelectorAll('.chart-option').forEach((b) => b.classList.remove('active'));
            e.target.classList.add('active');
        });
    });
}

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-link').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach((pane) => {
        pane.classList.toggle('active', pane.id === tabName);
    });
}

// Update chart view
async function updateChartView(view) {
    try {
        const response = await API.analysis.getRevenue({ period: view });
        if (response.success && response.data.revenue) {
            updateRevenueChart(response.data.revenue);
        }
    } catch (error) {
        console.error('Failed to update chart:', error);
    }
}

// Update revenue chart
function updateRevenueChart(data) {
    if (!charts.revenue) return;

    charts.revenue.data.labels = data.map((d) => d._id);
    charts.revenue.data.datasets[0].data = data.map((d) => d.revenue);
    charts.revenue.update();
}

// Load client analysis
async function loadClientAnalysis() {
    try {
        const response = await API.analysis.getClients({ groupBy: 'status' });
        if (response.success && response.data.topClients) {
            updateTopClientsTable(response.data.topClients);
        }
    } catch (error) {
        console.error('Failed to load client analysis:', error);
    }
}

// Update top clients table
function updateTopClientsTable(clients) {
    const tbody = document.getElementById('topClientsTable');
    if (!tbody) return;

    tbody.innerHTML = clients
        .map(
            (client) => `
        <tr>
            <td>${client.name || client.company}</td>
            <td>${client.industry || 'N/A'}</td>
            <td>${client.totalProjects || 0}</td>
            <td>${formatCurrency(client.totalRevenue || 0)}</td>
        </tr>
    `
        )
        .join('');
}

// Refresh analysis
function refreshAnalysis() {
    window.location.reload();
}

// Export data
async function exportData(type) {
    try {
        const params = {
            type: type,
            format: 'csv',
            startDate: analysisData.dateRange.start,
            endDate: analysisData.dateRange.end,
        };

        const queryString = new URLSearchParams(params).toString();
        window.location.href = `/api/analysis/export?${queryString}`;

        Common.showNotification(`Exporting ${type} data...`, 'success');
    } catch (error) {
        Common.showNotification('Failed to export data', 'error');
    }
}

// Helper functions
function generateMonthLabels() {
    const labels = [];
    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    }
    return labels;
}

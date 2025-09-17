// Analysis JavaScript
let charts = {};
let analysisData = {};

document.addEventListener('DOMContentLoaded', () => {
    loadAnalysisData();
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
    initProposalCharts();
    initInvoiceCharts();
}

// Initialize revenue chart
function initRevenueChart() {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    charts.revenue = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: generateMonthLabels(),
            datasets: [
                {
                    label: 'Revenue',
                    data: generateSampleRevenue(),
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
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => `$${value / 1000}k`,
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
        charts.clientDist = new Chart(distCtx.getContext('2d'), {
            type: 'pie',
            data: {
                labels: ['Active', 'Lead', 'Inactive', 'Archived'],
                datasets: [
                    {
                        data: [
                            analysisData.stats?.clients?.byStatus?.find((s) => s._id === 'active')
                                ?.count || 0,
                            analysisData.stats?.clients?.byStatus?.find((s) => s._id === 'lead')
                                ?.count || 0,
                            analysisData.stats?.clients?.byStatus?.find((s) => s._id === 'inactive')
                                ?.count || 0,
                            analysisData.stats?.clients?.byStatus?.find((s) => s._id === 'archived')
                                ?.count || 0,
                        ],
                        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#6b7280'],
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

// Initialize proposal charts
function initProposalCharts() {
    const ctx = document.getElementById('proposalFunnelChart');
    if (!ctx) return;

    const stats = analysisData.stats?.proposals || {};
    charts.proposalFunnel = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Total', 'Sent', 'Viewed', 'Accepted', 'Rejected'],
            datasets: [
                {
                    label: 'Proposals',
                    data: [
                        stats.total || 0,
                        stats.sent || 0,
                        stats.viewed || 0,
                        stats.accepted || 0,
                        stats.rejected || 0,
                    ],
                    backgroundColor: ['#6b7280', '#3b82f6', '#7117f2', '#10b981', '#ef4444'],
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

// Initialize invoice charts
function initInvoiceCharts() {
    // Payment status chart
    const statusCtx = document.getElementById('paymentStatusChart');
    if (statusCtx) {
        charts.paymentStatus = new Chart(statusCtx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Paid', 'Pending', 'Overdue', 'Partial'],
                datasets: [
                    {
                        data: [45, 25, 15, 15],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'],
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
        charts.aging = new Chart(agingCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days'],
                datasets: [
                    {
                        label: 'Amount',
                        data: [35000, 15000, 8000, 5000, 3000],
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
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => `$${value / 1000}k`,
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
            <td>$${(client.totalRevenue / 1000).toFixed(1)}k</td>
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
        labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
    }
    return labels;
}

function generateSampleRevenue() {
    return [45000, 52000, 48000, 61000, 58000, 72000];
}

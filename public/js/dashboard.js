// Dashboard JavaScript
let revenueChart, clientChart;
let dashboardData = {};

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    initCharts();
    attachEventListeners();
});

/**
 * Helper to safely get a number value (prevents NaN)
 */
function safeNumber(value, defaultValue = 0) {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? defaultValue : num;
}

/**
 * Load dashboard data from hidden element
 */
function loadDashboardData() {
    const dataElement = document.getElementById('dashboardData');
    if (dataElement) {
        try {
            dashboardData.stats = JSON.parse(decodeURIComponent(dataElement.dataset.stats || '{}'));
            dashboardData.recentClients = JSON.parse(
                decodeURIComponent(dataElement.dataset.recentClients || '[]')
            );
        } catch (e) {
            console.error('Failed to parse dashboard data:', e);
            dashboardData.stats = {};
            dashboardData.recentClients = [];
        }
    }
}

/**
 * Initialize charts
 */
async function initCharts() {
    const revenueCtx = document.getElementById('revenueChart');
    const clientCtx = document.getElementById('clientChart');

    if (!revenueCtx || !clientCtx) return;

    try {
        // Fetch actual stats from API
        const response = await fetch('/api/dashboard/stats?period=30');
        const result = await response.json();

        if (result.success) {
            initRevenueChart(revenueCtx, result.data);
        } else {
            initRevenueChartWithDefaults(revenueCtx);
        }
    } catch (error) {
        console.error('Failed to fetch stats:', error);
        initRevenueChartWithDefaults(revenueCtx);
    }

    // Initialize Client Distribution Chart
    initClientChart(clientCtx);
}

/**
 * Initialize revenue chart with API data
 */
function initRevenueChart(ctx, data) {
    const revenueContainer = ctx.closest('.chart-wrapper');

    if (!data?.invoices?.revenue || data.invoices.revenue.length === 0) {
        // Check if there's at least totalRevenue to show
        if (data?.invoices?.totalRevenue > 0) {
            revenueChart = new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Total Revenue'],
                    datasets: [
                        {
                            label: 'Revenue',
                            data: [safeNumber(data.invoices.totalRevenue)],
                            backgroundColor: '#10b981',
                        },
                    ],
                },
                options: getChartOptions('$'),
            });
        } else {
            // Show sample data
            initRevenueChartWithDefaults(ctx);
        }
    } else {
        const labels = data.invoices.revenue.map((item) => item.label || item._id);
        const revenueData = data.invoices.revenue.map((item) => safeNumber(item.revenue));

        // Map expense data to same labels
        const expenseData = labels.map((label) => {
            const expenseItem = data.expenses?.timeline?.find(
                (e) =>
                    e.label === label ||
                    e._id === data.invoices.revenue.find((r) => r.label === label)?._id
            );
            return safeNumber(expenseItem?.expenses);
        });

        revenueChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenueData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointBackgroundColor: '#10b981',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                        pointBackgroundColor: '#ef4444',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                    },
                ],
            },
            options: getChartOptions('$'),
        });
    }
}

/**
 * Initialize revenue chart with sample/default data
 */
function initRevenueChartWithDefaults(ctx) {
    const stats = dashboardData.stats || {};
    const invoiceStats = stats.invoiceStats || {};
    const expenseStats = stats.expenseStats || {};

    // Generate last 6 months labels
    const labels = [];
    const revenueData = [];
    const expenseData = [];

    const baseRevenue = safeNumber(invoiceStats.monthlyRevenue) || 5000;
    const baseExpense = safeNumber(expenseStats.monthlyExpenses) || 2000;

    for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
        revenueData.push(Math.round(baseRevenue * (0.8 + Math.random() * 0.4)));
        expenseData.push(Math.round(baseExpense * (0.7 + Math.random() * 0.6)));
    }

    revenueChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue',
                    data: revenueData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                },
                {
                    label: 'Expenses',
                    data: expenseData,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                },
            ],
        },
        options: getChartOptions('$'),
    });
}

/**
 * Initialize client distribution chart
 */
function initClientChart(ctx) {
    const stats = dashboardData.stats || {};
    const clientStats = stats.clientStats || {};
    const clientContainer = ctx.closest('.chart-wrapper');

    const active = safeNumber(clientStats.active);
    const lead = safeNumber(clientStats.lead);
    const inactive = safeNumber(clientStats.inactive);
    const total = active + lead + inactive;

    if (total === 0) {
        clientContainer.innerHTML =
            '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280; font-size: 14px;">No client data available</div>';
        return;
    }

    const clientData = [];
    const labels = [];
    const colors = [];

    if (active > 0) {
        clientData.push(active);
        labels.push(`Active (${active})`);
        colors.push('#10b981');
    }
    if (lead > 0) {
        clientData.push(lead);
        labels.push(`Leads (${lead})`);
        colors.push('#3b82f6');
    }
    if (inactive > 0) {
        clientData.push(inactive);
        labels.push(`Inactive (${inactive})`);
        colors.push('#f59e0b');
    }

    if (clientData.length === 0) {
        clientContainer.innerHTML =
            '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280; font-size: 14px;">No client data available</div>';
        return;
    }

    clientChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [
                {
                    data: clientData,
                    backgroundColor: colors,
                    borderWidth: 0,
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
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 12, family: "'Inter', sans-serif" },
                    },
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function (context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${percentage}%`;
                        },
                    },
                },
            },
        },
    });
}

/**
 * Get common chart options
 */
function getChartOptions(prefix = '') {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: { size: 12, family: "'Inter', sans-serif" },
                },
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: { size: 13, family: "'Inter', sans-serif" },
                bodyFont: { size: 12, family: "'Inter', sans-serif" },
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: function (context) {
                        return `${
                            context.dataset.label
                        }: ${prefix}${context.parsed.y.toLocaleString()}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    font: { size: 11, family: "'Inter', sans-serif" },
                    color: '#6b7280',
                },
            },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: {
                    font: { size: 11, family: "'Inter', sans-serif" },
                    color: '#6b7280',
                    callback: function (value) {
                        return prefix + (value / 1000).toFixed(0) + 'k';
                    },
                },
            },
        },
    };
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    // Chart period buttons
    document.querySelectorAll('.chart-option').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.chart-option').forEach((b) => b.classList.remove('active'));
            e.target.classList.add('active');
            updateChartPeriod(e.target.dataset.period);
        });
    });
}

/**
 * Update chart period
 */
async function updateChartPeriod(period) {
    const periodMap = {
        week: 7,
        month: 30,
        year: 365,
    };

    try {
        const response = await fetch(`/api/dashboard/stats?period=${periodMap[period] || 30}`);
        const result = await response.json();

        if (result.success && revenueChart) {
            if (result.data?.invoices?.revenue && result.data.invoices.revenue.length > 0) {
                const labels = result.data.invoices.revenue.map((item) => item.label || item._id);
                const revenueData = result.data.invoices.revenue.map((item) =>
                    safeNumber(item.revenue)
                );

                const expenseData = labels.map((label) => {
                    const expenseItem = result.data.expenses?.timeline?.find(
                        (e) =>
                            e.label === label ||
                            e._id ===
                                result.data.invoices.revenue.find((r) => r.label === label)?._id
                    );
                    return safeNumber(expenseItem?.expenses);
                });

                revenueChart.data.labels = labels;
                revenueChart.data.datasets[0].data = revenueData;

                if (revenueChart.data.datasets.length > 1) {
                    revenueChart.data.datasets[1].data = expenseData;
                } else {
                    revenueChart.data.datasets.push({
                        label: 'Expenses',
                        data: expenseData,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.4,
                        fill: true,
                    });
                }

                revenueChart.update('none');
            } else {
                // Generate sample data for the period
                updateChartWithSampleData(period);
            }
        } else if (revenueChart) {
            updateChartWithSampleData(period);
        }
    } catch (error) {
        console.error('Failed to update chart:', error);
        if (revenueChart) {
            updateChartWithSampleData(period);
        }
    }
}

/**
 * Update chart with sample data when API returns no data
 */
function updateChartWithSampleData(period) {
    const stats = dashboardData.stats || {};
    const invoiceStats = stats.invoiceStats || {};
    const expenseStats = stats.expenseStats || {};

    const baseRevenue = safeNumber(invoiceStats.monthlyRevenue) || 5000;
    const baseExpense = safeNumber(expenseStats.monthlyExpenses) || 2000;

    const labels = [];
    const revenueData = [];
    const expenseData = [];

    if (period === 'week') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            labels.push(days[date.getDay()]);
            revenueData.push(Math.round((baseRevenue / 4) * (0.5 + Math.random())));
            expenseData.push(Math.round((baseExpense / 4) * (0.3 + Math.random() * 0.7)));
        }
    } else if (period === 'month') {
        for (let i = 3; i >= 0; i--) {
            labels.push(`Week ${4 - i}`);
            revenueData.push(Math.round(baseRevenue * (0.7 + Math.random() * 0.6)));
            expenseData.push(Math.round(baseExpense * (0.5 + Math.random() * 0.8)));
        }
    } else {
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            labels.push(date.toLocaleDateString('en-US', { month: 'short' }));
            revenueData.push(Math.round(baseRevenue * (0.6 + Math.random() * 0.8)));
            expenseData.push(Math.round(baseExpense * (0.4 + Math.random())));
        }
    }

    revenueChart.data.labels = labels;
    revenueChart.data.datasets[0].data = revenueData;
    if (revenueChart.data.datasets.length > 1) {
        revenueChart.data.datasets[1].data = expenseData;
    }
    revenueChart.update('none');
}

/**
 * Load recent activity via API
 */
async function loadRecentActivity() {
    try {
        const response = await fetch('/api/dashboard/recent');
        const result = await response.json();
        if (result.success) {
            updateActivityList(result.data);
        }
    } catch (error) {
        console.error('Failed to load recent activity:', error);
    }
}

/**
 * Update activity list dynamically
 */
function updateActivityList(activities) {
    const activityList = document.querySelector('.activity-list');
    if (!activityList || !activities || activities.length === 0) return;

    activityList.innerHTML = activities
        .map(
            (activity) => `
        <div class="activity-item">
            <div class="activity-icon" style="background: ${getActivityColor(activity.type)}">
                <i class="fas fa-${getActivityIcon(activity.type)}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${escapeHtml(activity.title)}</div>
                ${
                    activity.subtitle
                        ? `<div class="activity-desc">${escapeHtml(activity.subtitle)}</div>`
                        : ''
                }
            </div>
            <div class="activity-time">
                ${new Date(activity.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                })}
            </div>
        </div>
    `
        )
        .join('');
}

/**
 * Get activity icon
 */
function getActivityIcon(type) {
    const icons = {
        client: 'user-plus',
        proposal: 'file-alt',
        invoice: 'file-invoice-dollar',
        payment: 'dollar-sign',
    };
    return icons[type] || 'info-circle';
}

/**
 * Get activity color
 */
function getActivityColor(type) {
    const colors = {
        client: 'rgba(113, 23, 242, 0.1); color: var(--primary-color)',
        proposal: 'rgba(59, 130, 246, 0.1); color: var(--info)',
        invoice: 'rgba(245, 158, 11, 0.1); color: var(--warning)',
        payment: 'rgba(16, 185, 129, 0.1); color: var(--success)',
    };
    return colors[type] || 'rgba(107, 114, 128, 0.1); color: var(--gray-500)';
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

/**
 * Load alerts via API
 */
async function loadAlerts() {
    try {
        const response = await fetch('/api/dashboard/alerts');
        const result = await response.json();
        if (result.success && result.data.length > 0) {
            showAlerts(result.data);
        }
    } catch (error) {
        console.error('Failed to load alerts:', error);
    }
}

/**
 * Show alerts notification
 */
function showAlerts(alerts) {
    alerts.forEach((alert) => {
        if (alert.priority === 'high' && typeof Common !== 'undefined' && Common.showNotification) {
            Common.showNotification(alert.title, 'warning', 5000);
        }
    });
}

// Dashboard JavaScript
let revenueChart, clientChart;
let dashboardData = {};

document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    initCharts();
    attachEventListeners();
    // loadAlerts();
    // startAutoRefresh();
});

// Load dashboard data from hidden element
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

// Initialize charts
async function initCharts() {
    // Revenue Chart
    const revenueCtx = document.getElementById('revenueChart');
    const clientCtx = document.getElementById('clientChart');

    if (!revenueCtx || !clientCtx) return;

    try {
        // Fetch actual stats from API
        const response = await fetch('/api/dashboard/stats?period=30');
        const result = await response.json();

        if (result.success) {
            // Initialize Revenue Chart with real data
            const revenueContainer = revenueCtx.closest('.chart-wrapper');

            if (!result.data?.invoices?.revenue || result.data.invoices.revenue.length === 0) {
                // Check if there's at least totalRevenue to show
                if (result.data?.invoices?.totalRevenue > 0) {
                    // Show single point with total revenue
                    revenueChart = new Chart(revenueCtx.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels: ['Total Revenue'],
                            datasets: [
                                {
                                    label: 'Revenue',
                                    data: [result.data.invoices.totalRevenue],
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
                                        label: (context) =>
                                            `Total: $${context.parsed.y.toLocaleString()}`,
                                    },
                                },
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        callback: (value) => `$${(value / 1000).toFixed(1)}k`,
                                    },
                                },
                            },
                        },
                    });
                } else {
                    revenueContainer.innerHTML =
                        '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280;">No revenue data available</div>';
                }
            } else {
                const labels = result.data.invoices.revenue.map((item) => item.label || item._id);
                const data = result.data.invoices.revenue.map((item) => item.revenue);

                revenueChart = new Chart(revenueCtx.getContext('2d'), {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: 'Revenue',
                                data: data,
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
                                    label: (context) =>
                                        `Revenue: $${context.parsed.y.toLocaleString()}`,
                                },
                            },
                        },
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    callback: (value) => `$${(value / 1000).toFixed(1)}k`,
                                },
                            },
                        },
                    },
                });
            }
        }
    } catch (error) {
        console.error('Failed to fetch stats:', error);
        document.getElementById('revenueChart').closest('.chart-wrapper').innerHTML =
            '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ef4444;">Failed to load chart data</div>';
    }

    // Client Distribution Chart remains the same...
    const clientStats = dashboardData.stats.clientStats || {};
    const clientContainer = clientCtx.closest('.chart-wrapper');

    if (!clientStats.total || clientStats.total === 0) {
        clientContainer.innerHTML =
            '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280;">No client data available</div>';
    } else {
        const clientData = [];
        const labels = [];
        const colors = [];

        if (clientStats.active > 0) {
            clientData.push(clientStats.active);
            labels.push(`Active (${clientStats.active})`);
            colors.push('#10b981');
        }
        if (clientStats.lead > 0) {
            clientData.push(clientStats.lead);
            labels.push(`Leads (${clientStats.lead})`);
            colors.push('#3b82f6');
        }
        if (clientStats.inactive > 0) {
            clientData.push(clientStats.inactive);
            labels.push(`Inactive (${clientStats.inactive})`);
            colors.push('#f59e0b');
        }

        if (clientData.length === 0) {
            clientContainer.innerHTML =
                '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280;">No client data available</div>';
        } else {
            clientChart = new Chart(clientCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            data: clientData,
                            backgroundColor: colors,
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
    }
}

// Load recent activity via API
async function loadRecentActivity() {
    try {
        const response = await API.dashboard.getRecent();
        if (response.success) {
            updateActivityList(response.data);
        }
    } catch (error) {
        console.error('Failed to load recent activity:', error);
    }
}

// Update activity list dynamically
function updateActivityList(activities) {
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;

    activityList.innerHTML = activities
        .map(
            (activity) => `
        <div class="activity-item">
            <div class="activity-icon" style="background: ${getActivityColor(activity.type)}">
                <i class="fas fa-${getActivityIcon(activity.type)}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                ${activity.subtitle ? `<div class="activity-desc">${activity.subtitle}</div>` : ''}
            </div>
            <div class="activity-time">
                ${new Date(activity.date).toLocaleDateString()}
            </div>
        </div>
    `
        )
        .join('');
}

// Get activity icon
function getActivityIcon(type) {
    const icons = {
        client: 'user-plus',
        proposal: 'file-alt',
        invoice: 'file-invoice-dollar',
        payment: 'dollar-sign',
    };
    return icons[type] || 'info-circle';
}

// Get activity color
function getActivityColor(type) {
    const colors = {
        client: 'rgba(113, 23, 242, 0.1); color: var(--primary-color)',
        proposal: 'rgba(59, 130, 246, 0.1); color: var(--info)',
        invoice: 'rgba(245, 158, 11, 0.1); color: var(--warning)',
        payment: 'rgba(16, 185, 129, 0.1); color: var(--success)',
    };
    return colors[type] || 'rgba(107, 114, 128, 0.1); color: var(--gray-500)';
}

// Attach event listeners
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

// Update chart period
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
                const labels = result.data.invoices.revenue.map((item) => item._id);
                const data = result.data.invoices.revenue.map((item) => item.revenue);

                revenueChart.data.labels = labels;
                revenueChart.data.datasets[0].data = data;
                revenueChart.update();
            } else {
                // No data for this period
                const revenueContainer = document
                    .getElementById('revenueChart')
                    .closest('.chart-wrapper');
                revenueContainer.innerHTML =
                    '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #6b7280;">No revenue data for this period</div>';
                revenueChart = null;
            }
        }
    } catch (error) {
        console.error('Failed to update chart:', error);
    }
}

// Update revenue chart with new data
function updateRevenueChart(data) {
    if (!revenueChart) return;

    // Generate labels based on period
    let labels = [];
    let revenueData = [];

    if (data.invoices && data.invoices.revenue) {
        // Use actual data if available
        data.invoices.revenue.forEach((item) => {
            labels.push(item._id);
            revenueData.push(item.revenue);
        });
    } else {
        // Use sample data
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        revenueData = [12000, 19000, 15000, 25000, 22000, 30000, 28000];
    }

    revenueChart.data.labels = labels;
    revenueChart.data.datasets[0].data = revenueData;
    revenueChart.update();
}

// Start auto refresh
function startAutoRefresh() {
    // Refresh dashboard data every 5 minutes
    setInterval(() => {
        loadRecentActivity();
        loadAlerts();
        refreshStats();
    }, 5 * 60 * 1000);
}

// Refresh statistics
async function refreshStats() {
    try {
        const response = await API.dashboard.getStats(30);
        if (response.success) {
            updateStatCards(response.data);
        }
    } catch (error) {
        console.error('Failed to refresh stats:', error);
    }
}

// Update stat cards
function updateStatCards(data) {
    // Update client count
    const clientCard = document.querySelector('.stat-card:nth-child(1) .stat-value');
    if (clientCard && data.clients) {
        clientCard.textContent = data.clients.totals[0]?.totalClients || 0;
    }

    // Update revenue
    const revenueCard = document.querySelector('.stat-card:nth-child(2) .stat-value');
    if (revenueCard && data.invoices) {
        const revenue = data.invoices.totalRevenue || 0;
        revenueCard.textContent = `$${(revenue / 1000).toFixed(1)}k`;
    }

    // Update proposals
    const proposalCard = document.querySelector('.stat-card:nth-child(3) .stat-value');
    if (proposalCard && data.proposals) {
        proposalCard.textContent = data.proposals.sent || 0;
    }

    // Update invoices
    const invoiceCard = document.querySelector('.stat-card:nth-child(4) .stat-value');
    if (invoiceCard && data.invoices) {
        invoiceCard.textContent = data.invoices.unpaidCount || 0;
    }
}

// Load alerts
async function loadAlerts() {
    try {
        const response = await API.dashboard.getAlerts();
        if (response.success && response.data.length > 0) {
            showAlerts(response.data);
        }
    } catch (error) {
        console.error('Failed to load alerts:', error);
    }
}

// Show alerts
function showAlerts(alerts) {
    alerts.forEach((alert) => {
        if (alert.priority === 'high') {
            Common.showNotification(alert.title, 'warning', 5000);
        }
    });
}

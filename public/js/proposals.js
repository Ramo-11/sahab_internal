// Proposals JavaScript - All-in-one functionality
document.addEventListener('DOMContentLoaded', () => {
    const page = detectPage();

    switch (page) {
        case 'index':
            initProposalsIndex();
            break;
        case 'new':
            initProposalForm();
            break;
    }
});

// Detect which proposal page we're on
function detectPage() {
    const path = window.location.pathname;
    if (path === '/proposals') return 'index';
    if (path === '/proposals/new') return 'new';
    return null;
}

// ========== Index Page Functions ==========
function initProposalsIndex() {
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

    window.location.href = '/proposals';
}

// ========== Inline Edit Functions ==========
function editProposal(id) {
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
    const originalProposal = JSON.parse(row.dataset.proposal);

    row.querySelectorAll('.edit-mode[data-field]').forEach((input) => {
        const field = input.dataset.field;
        if (field === 'expiryDate' && originalProposal.expiryDate) {
            input.value = new Date(originalProposal.expiryDate).toISOString().split('T')[0];
        } else if (field === 'pricing.amount') {
            input.value = originalProposal.pricing?.amount || 0;
        } else {
            input.value = originalProposal[field] || '';
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

async function saveProposal(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    // Collect updated values
    const updates = {};
    row.querySelectorAll('.edit-mode[data-field]').forEach((input) => {
        const field = input.dataset.field;
        const value = input.value.trim();

        if (field === 'pricing.amount') {
            if (!updates.pricing) updates.pricing = {};
            updates.pricing.amount = parseFloat(value) || 0;
        } else if (field === 'expiryDate' && value) {
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
        const response = await API.proposals.update(id, updates);

        if (response.success) {
            Common.showNotification('Proposal updated successfully', 'success');

            // Update the displayed data
            updateProposalRow(row, response.data);

            // Update the stored proposal data
            row.dataset.proposal = JSON.stringify(response.data);

            // Exit edit mode
            cancelEdit(id);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to update proposal', 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalHTML;
    }
}

function updateProposalRow(row, proposal) {
    // Update title
    const titleCell = row.querySelector('.editable-cell .view-mode');
    if (titleCell) {
        let titleHTML = `<strong>${proposal.title}</strong>`;
        if (proposal.proposalNumber) {
            titleHTML += ` <small class="text-muted">#${proposal.proposalNumber}</small>`;
        }
        titleCell.innerHTML = titleHTML;
    }

    // Update amount
    const amountCell = row.querySelectorAll('.editable-cell')[1]?.querySelector('.view-mode');
    if (amountCell) {
        if (proposal.pricing?.amount && proposal.pricing.amount > 0) {
            amountCell.textContent = `$${(proposal.pricing.amount / 1000).toFixed(1)}k`;
            amountCell.classList.remove('text-muted');
        } else {
            amountCell.textContent = '-';
            amountCell.classList.add('text-muted');
        }
    }

    // Update status badge
    const statusCell = row.querySelectorAll('.editable-cell')[2]?.querySelector('.view-mode');
    if (statusCell) {
        const badgeClass =
            proposal.status === 'accepted'
                ? 'success'
                : proposal.status === 'rejected'
                ? 'danger'
                : proposal.status === 'sent'
                ? 'info'
                : proposal.status === 'viewed'
                ? 'primary'
                : 'warning';
        statusCell.innerHTML = `<span class="badge badge-${badgeClass}">${proposal.status}</span>`;
    }

    // Update expiry date
    const expiryCell = row.querySelectorAll('.editable-cell')[3]?.querySelector('.view-mode');
    if (expiryCell) {
        if (proposal.expiryDate) {
            let dateHTML = new Date(proposal.expiryDate).toLocaleDateString();
            if (proposal.isExpired) {
                dateHTML += ' <i class="fas fa-exclamation-triangle text-warning ml-1"></i>';
            }
            expiryCell.innerHTML = dateHTML;
            expiryCell.classList.remove('text-muted');
        } else {
            expiryCell.textContent = '-';
            expiryCell.classList.add('text-muted');
        }
    }

    // Update action buttons based on status
    if (proposal.status === 'accepted' || proposal.status === 'rejected') {
        const markAcceptedBtn = row.querySelector('button[onclick*="markAsAccepted"]');
        if (markAcceptedBtn) markAcceptedBtn.style.display = 'none';
    }
}

// ========== Form Page Functions ==========
function initProposalForm() {
    const form = document.getElementById('newProposalForm');
    if (form) {
        form.addEventListener('submit', handleProposalFormSubmit);

        // Set default expiry date (30 days from today)
        const expiryDateInput = form.querySelector('input[name="expiryDate"]');
        if (expiryDateInput && !expiryDateInput.value) {
            const date = new Date();
            date.setDate(date.getDate() + 30);
            expiryDateInput.value = date.toISOString().split('T')[0];
        }
    }
}

async function handleProposalFormSubmit(e) {
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
            if (key === 'pricing.amount') {
                if (!data.pricing) data.pricing = {};
                data.pricing.amount = parseFloat(value) || 0;
                data.pricing.model = 'fixed';
                data.pricing.currency = 'USD';
            } else {
                data[key] = value;
            }
        }
    });

    // Set default status to sent if not provided
    if (!data.status) {
        data.status = 'sent';
    }

    try {
        const response = await API.proposals.create(data);
        if (response.success) {
            Common.showNotification('Proposal created successfully', 'success');
            setTimeout(() => {
                window.location.href = '/proposals';
            }, 1000);
        }
    } catch (error) {
        Common.showNotification(error.message || 'Failed to create proposal', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Create Proposal';
        }
    }
}

// ========== Action Functions ==========
async function markAsAccepted(id) {
    Common.confirm('Mark this proposal as accepted?', async () => {
        try {
            const response = await API.proposals.updateStatus(id, { status: 'accepted' });

            if (response.success) {
                Common.showNotification('Proposal marked as accepted', 'success');

                // Update the row
                const row = document.querySelector(`tr[data-id="${id}"]`);
                if (row) {
                    updateProposalRow(row, response.data);
                    row.dataset.proposal = JSON.stringify(response.data);

                    // Hide the mark as accepted button
                    const markAcceptedBtn = row.querySelector('button[onclick*="markAsAccepted"]');
                    if (markAcceptedBtn) markAcceptedBtn.style.display = 'none';
                }
            }
        } catch (error) {
            Common.showNotification(error.message || 'Failed to update proposal', 'error');
        }
    });
}

async function deleteProposal(id) {
    Common.confirm('Are you sure you want to delete this proposal?', async () => {
        try {
            const response = await API.proposals.delete(id);
            if (response.success) {
                Common.showNotification('Proposal deleted successfully', 'success');

                // Remove the row from the table
                const row = document.querySelector(`tr[data-id="${id}"]`);
                if (row) {
                    row.style.opacity = '0';
                    setTimeout(() => row.remove(), 300);
                }

                // Check if table is empty
                setTimeout(() => {
                    const tbody = document.querySelector('#proposalsTable tbody');
                    if (tbody && tbody.querySelectorAll('tr').length === 0) {
                        window.location.reload();
                    }
                }, 400);
            }
        } catch (error) {
            Common.showNotification(error.message || 'Failed to delete proposal', 'error');
        }
    });
}

async function exportData() {
    try {
        const params = Common.getQueryParams();
        params.type = 'proposals';
        params.format = 'csv';

        const queryString = new URLSearchParams(params).toString();
        window.location.href = `/api/analysis/export?${queryString}`;

        Common.showNotification('Export started', 'success');
    } catch (error) {
        Common.showNotification('Failed to export data', 'error');
    }
}

// Make functions globally available
window.editProposal = editProposal;
window.cancelEdit = cancelEdit;
window.saveProposal = saveProposal;
window.markAsAccepted = markAsAccepted;
window.deleteProposal = deleteProposal;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.exportData = exportData;

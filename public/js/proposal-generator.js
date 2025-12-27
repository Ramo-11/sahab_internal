// ============================================
// PROPOSAL GENERATOR
// ============================================

// Store loaded clients and proposals
let proposalClients = [];
let savedProposals = [];
let currentProposalId = null;

// Counters for dynamic elements
let propScopeSectionCounter = 0;
let propDeliverableCounter = 0;
let propPaymentItemCounter = 0;
let propRetainerIncludeCounter = 0;
let propRecurringCostCounter = 0;

/**
 * Initialize Proposal Generator
 */
async function initProposalGenerator() {
    const form = document.getElementById('proposalGeneratorForm');
    if (!form) return;

    // Set default date
    const today = new Date();
    document.getElementById('propPreparedDate').value = formatDateForInput(today);

    // Load clients
    await loadProposalClients();

    // Add initial scope section and deliverable
    addProposalScopeSection();
    addProposalDeliverable();

    // Handle payment type change
    document.getElementById('propPaymentType')?.addEventListener('change', (e) => {
        const scheduleSection = document.getElementById('propPaymentScheduleSection');
        if (e.target.value === 'installments') {
            scheduleSection.style.display = 'block';
            if (document.getElementById('propPaymentSchedule').children.length === 0) {
                addProposalPaymentItem();
            }
        } else {
            scheduleSection.style.display = 'none';
        }
    });

    // Form submit handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateProposalPDF();
    });

    // Initialize drag and drop for cost sections
    initCostSectionDragDrop();

    // Initialize drag and drop for all main sections
    initSectionDragDrop();
}

/**
 * Initialize drag and drop for cost estimate sections
 */
function initCostSectionDragDrop() {
    const container = document.getElementById('propCostItemsContainer');
    if (!container) return;

    const costBoxes = container.querySelectorAll('.cost-item-box');

    costBoxes.forEach((box) => {
        const handle = box.querySelector('.drag-handle');
        if (!handle) return;

        handle.addEventListener('mousedown', () => {
            box.setAttribute('draggable', 'true');
        });

        handle.addEventListener('mouseup', () => {
            box.setAttribute('draggable', 'false');
        });

        box.addEventListener('dragstart', (e) => {
            box.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', box.id);
        });

        box.addEventListener('dragend', () => {
            box.classList.remove('dragging');
            box.setAttribute('draggable', 'false');
            container.querySelectorAll('.cost-item-box').forEach((b) => {
                b.classList.remove('drag-over');
            });
        });

        box.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const dragging = container.querySelector('.dragging');
            if (dragging && dragging !== box) {
                box.classList.add('drag-over');
            }
        });

        box.addEventListener('dragleave', () => {
            box.classList.remove('drag-over');
        });

        box.addEventListener('drop', (e) => {
            e.preventDefault();
            box.classList.remove('drag-over');
            const dragging = container.querySelector('.dragging');
            if (dragging && dragging !== box) {
                const boxes = [...container.querySelectorAll('.cost-item-box')];
                const dragIdx = boxes.indexOf(dragging);
                const dropIdx = boxes.indexOf(box);

                if (dragIdx < dropIdx) {
                    box.after(dragging);
                } else {
                    box.before(dragging);
                }
            }
        });
    });
}

/**
 * Initialize drag and drop for main proposal sections
 */
function initSectionDragDrop() {
    const container = document.getElementById('propSectionsContainer');
    if (!container) return;

    const sections = container.querySelectorAll('.draggable-section');

    sections.forEach((section) => {
        const handle = section.querySelector('.section-drag-handle');
        if (!handle) return;

        handle.addEventListener('mousedown', () => {
            section.setAttribute('draggable', 'true');
        });

        handle.addEventListener('mouseup', () => {
            section.setAttribute('draggable', 'false');
        });

        section.addEventListener('dragstart', (e) => {
            section.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', section.id);
        });

        section.addEventListener('dragend', () => {
            section.classList.remove('dragging');
            section.setAttribute('draggable', 'false');
            container.querySelectorAll('.draggable-section').forEach((s) => {
                s.classList.remove('drag-over');
            });
        });

        section.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const dragging = container.querySelector('.dragging');
            if (dragging && dragging !== section) {
                section.classList.add('drag-over');
            }
        });

        section.addEventListener('dragleave', () => {
            section.classList.remove('drag-over');
        });

        section.addEventListener('drop', (e) => {
            e.preventDefault();
            section.classList.remove('drag-over');
            const dragging = container.querySelector('.dragging');
            if (dragging && dragging !== section) {
                const allSections = [...container.querySelectorAll('.draggable-section')];
                const dragIdx = allSections.indexOf(dragging);
                const dropIdx = allSections.indexOf(section);

                if (dragIdx < dropIdx) {
                    section.after(dragging);
                } else {
                    section.before(dragging);
                }
            }
        });
    });
}

/**
 * Load clients for dropdown (only active clients)
 */
async function loadProposalClients() {
    const select = document.getElementById('propClient');
    if (!select) return;

    try {
        // Only fetch active clients
        const response = await fetch('/api/clients?status');
        const result = await response.json();

        if (result.success && result.data) {
            proposalClients = result.data;

            select.innerHTML = '<option value="">Select a client...</option>';
            proposalClients.forEach((client) => {
                const displayName = client.company || client.name;
                select.innerHTML += `<option value="${client._id}">${escapeHtml(
                    displayName
                )}</option>`;
            });
        } else {
            select.innerHTML = '<option value="">No clients found</option>';
        }
    } catch (error) {
        console.error('Error loading clients:', error);
        select.innerHTML = '<option value="">Error loading clients</option>';
    }
}

/**
 * Add a scope of work section
 */
function addProposalScopeSection() {
    const container = document.getElementById('propScopeOfWork');
    if (!container) return;

    propScopeSectionCounter++;
    const sectionId = `propScope_${propScopeSectionCounter}`;

    const section = document.createElement('div');
    section.className = 'scope-section';
    section.id = sectionId;
    section.innerHTML = `
        <div class="scope-section-header">
            <input type="text" class="form-control scope-title" placeholder="Section Title (e.g., Platform Features)" />
            <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeProposalScopeSection('${sectionId}')" title="Remove Section">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="form-group">
            <textarea class="form-control scope-description" rows="2" placeholder="Section description (optional)"></textarea>
        </div>
        <div class="scope-items" id="${sectionId}_items">
            <!-- Items added dynamically -->
        </div>
        <button type="button" class="btn btn-sm btn-secondary" onclick="addProposalScopeItem('${sectionId}')">
            <i class="fas fa-plus"></i> Add Item
        </button>
    `;

    container.appendChild(section);

    // Add first item
    addProposalScopeItem(sectionId);
}

/**
 * Remove a scope section
 */
function removeProposalScopeSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.remove();
    }
}

/**
 * Add an item to a scope section
 */
function addProposalScopeItem(sectionId) {
    const container = document.getElementById(`${sectionId}_items`);
    if (!container) return;

    const itemId = `${sectionId}_item_${container.children.length + 1}`;

    const item = document.createElement('div');
    item.className = 'scope-item';
    item.id = itemId;
    item.innerHTML = `
        <span class="scope-item-bullet">•</span>
        <input type="text" class="form-control" placeholder="Feature or item description" />
        <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeProposalScopeItem('${itemId}')" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(item);
}

/**
 * Remove a scope item
 */
function removeProposalScopeItem(itemId) {
    const item = document.getElementById(itemId);
    if (item) {
        item.remove();
    }
}

/**
 * Add a deliverable
 */
function addProposalDeliverable() {
    const container = document.getElementById('propDeliverables');
    if (!container) return;

    propDeliverableCounter++;
    const itemId = `propDeliverable_${propDeliverableCounter}`;

    const item = document.createElement('div');
    item.className = 'list-item';
    item.id = itemId;
    item.innerHTML = `
        <span class="list-item-bullet">•</span>
        <input type="text" class="form-control" placeholder="e.g., Fully functional booking platform" />
        <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeListItem('${itemId}')" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(item);
}

/**
 * Add a payment schedule item
 */
function addProposalPaymentItem() {
    const container = document.getElementById('propPaymentSchedule');
    if (!container) return;

    propPaymentItemCounter++;
    const itemId = `propPayment_${propPaymentItemCounter}`;

    const item = document.createElement('div');
    item.className = 'payment-item';
    item.id = itemId;
    item.innerHTML = `
        <div class="payment-item-row">
            <input type="text" class="form-control payment-desc" placeholder="Payment description" />
            <div class="input-group payment-amount">
                <span class="input-group-text">$</span>
                <input type="number" class="form-control" min="0" step="0.01" placeholder="0.00" />
            </div>
            <input type="date" class="form-control payment-date" />
            <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeListItem('${itemId}')" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.appendChild(item);
}

/**
 * Toggle retainer section visibility
 */
function toggleProposalRetainer() {
    const enabled = document.getElementById('propRetainerEnabled').checked;
    const section = document.getElementById('propRetainerSection');
    section.style.display = enabled ? 'block' : 'none';

    if (enabled && document.getElementById('propRetainerIncludes').children.length === 0) {
        addProposalRetainerInclude();
    }
}

/**
 * Add a retainer include item
 */
function addProposalRetainerInclude() {
    const container = document.getElementById('propRetainerIncludes');
    if (!container) return;

    propRetainerIncludeCounter++;
    const itemId = `propRetainerInclude_${propRetainerIncludeCounter}`;

    const item = document.createElement('div');
    item.className = 'list-item';
    item.id = itemId;
    item.innerHTML = `
        <span class="list-item-bullet">•</span>
        <input type="text" class="form-control" placeholder="e.g., Server maintenance and monitoring" />
        <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeListItem('${itemId}')" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(item);
}

/**
 * Remove a list item (generic)
 */
function removeListItem(itemId) {
    const item = document.getElementById(itemId);
    if (item) {
        item.remove();
    }
}

/**
 * Add a recurring cost item (e.g., Monthly Retainer)
 */
function addProposalRecurringCost() {
    const container = document.getElementById('propRecurringCosts');
    if (!container) return;

    propRecurringCostCounter++;
    const itemId = `propRecurringCost_${propRecurringCostCounter}`;

    const item = document.createElement('div');
    item.className = 'recurring-cost-item';
    item.id = itemId;
    item.innerHTML = `
        <div class="recurring-cost-header">
            <input type="text" class="form-control recurring-cost-name" placeholder="e.g., Monthly Retainer, Hosting Fee" />
            <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeRecurringCost('${itemId}')" title="Remove">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="recurring-cost-row">
            <div class="form-group">
                <label class="form-label">Amount</label>
                <div class="amount-range-group">
                    <div class="input-group">
                        <span class="input-group-text">$</span>
                        <input type="number" class="form-control recurring-cost-min" min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <label class="range-toggle">
                        <input type="checkbox" class="recurring-cost-range-toggle" onchange="toggleRecurringCostRange('${itemId}', this.checked)" />
                        <span>Range</span>
                    </label>
                    <div class="input-group recurring-cost-max-group" style="display: none;">
                        <span class="input-group-text">to $</span>
                        <input type="number" class="form-control recurring-cost-max" min="0" step="0.01" placeholder="0.00" />
                    </div>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label">Frequency</label>
                <select class="form-control recurring-cost-frequency">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekly">Weekly</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label class="form-label">Includes <span class="text-muted">(Optional)</span></label>
            <div class="recurring-cost-includes" id="${itemId}_includes">
                <!-- Include items added dynamically -->
            </div>
            <button type="button" class="btn btn-sm btn-secondary mt-1" onclick="addRecurringCostInclude('${itemId}')">
                <i class="fas fa-plus"></i> Add Include
            </button>
        </div>
    `;

    container.appendChild(item);
}

/**
 * Toggle range input for recurring cost
 */
function toggleRecurringCostRange(itemId, showRange) {
    const item = document.getElementById(itemId);
    if (!item) return;

    const maxGroup = item.querySelector('.recurring-cost-max-group');
    if (maxGroup) {
        maxGroup.style.display = showRange ? 'flex' : 'none';
    }
}

/**
 * Remove a recurring cost item
 */
function removeRecurringCost(itemId) {
    const item = document.getElementById(itemId);
    if (item) {
        item.remove();
    }
}

/**
 * Add an include item to a recurring cost
 */
function addRecurringCostInclude(itemId) {
    const container = document.getElementById(`${itemId}_includes`);
    if (!container) return;

    const includeId = `${itemId}_include_${container.children.length + 1}`;

    const item = document.createElement('div');
    item.className = 'list-item';
    item.id = includeId;
    item.innerHTML = `
        <span class="list-item-bullet">•</span>
        <input type="text" class="form-control" placeholder="e.g., Server maintenance and monitoring" />
        <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeListItem('${includeId}')" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(item);
}

/**
 * Collect proposal data from form
 */
function collectProposalData() {
    const clientId = document.getElementById('propClient').value;
    const client = proposalClients.find((c) => c._id === clientId);

    // Collect scope of work sections
    const scopeOfWork = [];
    document.querySelectorAll('#propScopeOfWork .scope-section').forEach((section) => {
        const sectionTitle = section.querySelector('.scope-title')?.value.trim();
        const description = section.querySelector('.scope-description')?.value.trim();
        const items = [];

        section.querySelectorAll('.scope-item input').forEach((input) => {
            const value = input.value.trim();
            if (value) items.push(value);
        });

        if (sectionTitle || items.length > 0) {
            scopeOfWork.push({ sectionTitle, description, items });
        }
    });

    // Collect deliverables
    const deliverables = [];
    document.querySelectorAll('#propDeliverables .list-item input').forEach((input) => {
        const value = input.value.trim();
        if (value) deliverables.push(value);
    });

    // Collect payment schedule
    const paymentSchedule = [];
    document.querySelectorAll('#propPaymentSchedule .payment-item').forEach((item) => {
        const description = item.querySelector('.payment-desc')?.value.trim();
        const amount = parseFloat(item.querySelector('.payment-amount input')?.value) || 0;
        const dueDate = item.querySelector('.payment-date')?.value;

        if (description || amount > 0) {
            paymentSchedule.push({ description, amount, dueDate });
        }
    });

    // Collect retainer includes (legacy - keeping for backward compatibility)
    const retainerIncludes = [];
    document.querySelectorAll('#propRetainerIncludes .list-item input').forEach((input) => {
        const value = input.value.trim();
        if (value) retainerIncludes.push(value);
    });

    // Collect recurring costs
    const recurringCosts = [];
    document.querySelectorAll('#propRecurringCosts .recurring-cost-item').forEach((item) => {
        const name = item.querySelector('.recurring-cost-name')?.value.trim();
        const minAmount = parseFloat(item.querySelector('.recurring-cost-min')?.value) || 0;
        const isRange = item.querySelector('.recurring-cost-range-toggle')?.checked || false;
        const maxAmount = isRange
            ? parseFloat(item.querySelector('.recurring-cost-max')?.value) || 0
            : null;
        const frequency = item.querySelector('.recurring-cost-frequency')?.value || 'monthly';

        // Collect includes for this recurring cost
        const includes = [];
        item.querySelectorAll('.recurring-cost-includes .list-item input').forEach((input) => {
            const value = input.value.trim();
            if (value) includes.push(value);
        });

        if (name || minAmount > 0) {
            recurringCosts.push({
                name,
                minAmount,
                maxAmount,
                isRange,
                frequency,
                includes,
            });
        }
    });

    // Get cost note
    const costNote = document.getElementById('propCostNote')?.value.trim() || '';

    // Get custom section titles
    const initialCostTitle =
        document.getElementById('propInitialCostTitle')?.value.trim() || 'Project Cost';
    const recurringCostTitle =
        document.getElementById('propRecurringCostTitle')?.value.trim() || 'Recurring Costs';

    // Get cost section order from DOM
    const costItemsContainer = document.getElementById('propCostItemsContainer');
    const costSectionOrder = [];
    if (costItemsContainer) {
        costItemsContainer.querySelectorAll('.cost-item-box').forEach((box) => {
            costSectionOrder.push(box.dataset.costType);
        });
    }

    // Get main section order from DOM
    const sectionsContainer = document.getElementById('propSectionsContainer');
    const sectionOrder = [];
    if (sectionsContainer) {
        sectionsContainer.querySelectorAll('.draggable-section').forEach((section) => {
            sectionOrder.push(section.dataset.sectionType);
        });
    }

    return {
        client: clientId,
        clientData: client,
        title: document.getElementById('propTitle').value.trim(),
        projectName: document.getElementById('propProjectName').value.trim(),
        preparedDate: document.getElementById('propPreparedDate').value,
        executiveSummary: document.getElementById('propExecutiveSummary').value.trim(),
        scopeOfWork,
        deliverables,
        pricing: {
            totalAmount: parseFloat(document.getElementById('propTotalAmount').value) || 0,
            description: document.getElementById('propPricingDescription').value.trim(),
            isOneTime: document.getElementById('propPaymentType').value === 'one-time',
            paymentSchedule,
        },
        retainer: {
            enabled: document.getElementById('propRetainerEnabled')?.checked || false,
            amount: parseFloat(document.getElementById('propRetainerAmount')?.value) || 0,
            frequency: document.getElementById('propRetainerFrequency')?.value || 'monthly',
            includes: retainerIncludes,
        },
        recurringCosts,
        costNote,
        initialCostTitle,
        recurringCostTitle,
        costSectionOrder,
        sectionOrder,
        timeline: document.getElementById('propTimeline').value.trim(),
        closingText: document.getElementById('propClosingText').value.trim(),
        internalNotes: document.getElementById('propInternalNotes').value.trim(),
        preparedBy: 'Sahab Solutions',
        contactEmail: 'sahab@sahab-solutions.com',
        contactWebsite: 'sahab-solutions.com',
    };
}

/**
 * Save proposal as draft
 */
async function saveProposalDraft() {
    const data = collectProposalData();

    if (!data.client) {
        Common.showNotification('Please select a client', 'warning');
        return;
    }

    if (!data.title) {
        Common.showNotification('Please enter a proposal title', 'warning');
        return;
    }

    try {
        const url = currentProposalId
            ? `/api/tools/generated-proposals/${currentProposalId}`
            : '/api/tools/generated-proposals';
        const method = currentProposalId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.success) {
            currentProposalId = result.data._id;
            Common.showNotification('Proposal saved successfully!', 'success');
        } else {
            Common.showNotification(result.message || 'Failed to save proposal', 'error');
        }
    } catch (error) {
        console.error('Error saving proposal:', error);
        Common.showNotification('Failed to save proposal', 'error');
    }
}

/**
 * Generate Proposal PDF
 */
async function generateProposalPDF() {
    const btn = document.querySelector('#proposalGeneratorForm button[type="submit"]');
    const status = document.getElementById('proposalGenerationStatus');

    const data = collectProposalData();

    // Validate
    if (!data.client) {
        Common.showNotification('Please select a client', 'warning');
        return;
    }

    if (!data.title) {
        Common.showNotification('Please enter a proposal title', 'warning');
        return;
    }

    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    if (status) status.style.display = 'flex';

    try {
        await waitForJsPDF();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter',
        });

        const pageWidth = 612;
        const pageHeight = 792;
        const margin = 50;
        let y = margin;

        // Colors
        const primaryColor = [113, 23, 242];
        const textDark = [51, 51, 51];
        const textGray = [102, 102, 102];
        const lineGray = [200, 200, 200];

        // ========== HEADER ==========
        // Try to load logo, with a professional fallback
        try {
            const logoImg = await loadImage('/images/logo.png');
            doc.addImage(logoImg, 'PNG', margin, y, 80, 80);
        } catch (e) {
            // Draw a professional styled logo placeholder
            doc.setFillColor(...primaryColor);
            doc.roundedRect(margin, y, 80, 80, 6, 6, 'F');

            // Cloud icon in logo
            doc.setFillColor(255, 255, 255);
            doc.circle(margin + 28, y + 35, 14, 'F');
            doc.circle(margin + 42, y + 30, 17, 'F');
            doc.circle(margin + 58, y + 36, 12, 'F');
            doc.rect(margin + 18, y + 35, 48, 18, 'F');
        }

        // Company name
        doc.setTextColor(...textDark);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text('Sahab Solutions', margin + 95, y + 35);

        // Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textGray);
        doc.text(data.title, margin + 95, y + 55);

        y += 100;

        // Divider
        doc.setDrawColor(...lineGray);
        doc.setLineWidth(1);
        doc.line(margin, y, pageWidth - margin, y);

        y += 25;

        // Metadata
        doc.setFontSize(10);
        doc.setTextColor(...textGray);
        doc.text(`Prepared by: ${data.preparedBy}`, margin, y);
        doc.text(`Date: ${formatDisplayDate(data.preparedDate)}`, margin, y + 14);
        doc.text(`Contact: ${data.contactEmail} | ${data.contactWebsite}`, margin, y + 28);

        // Client info on right
        if (data.clientData) {
            const clientCompany = data.clientData.company || data.clientData.name;
            const clientContact = data.clientData.name || '';
            doc.text('Prepared for:', pageWidth - margin - 150, y);
            doc.setTextColor(...textDark);
            doc.setFont('helvetica', 'bold');
            doc.text(clientCompany, pageWidth - margin - 150, y + 14);
            // Add contact name under company name if different
            if (clientContact && clientContact !== clientCompany) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...textGray);
                doc.text(clientContact, pageWidth - margin - 150, y + 28);
            }
        }

        y += 55;

        const contentWidth = pageWidth - 2 * margin;

        // Get section order (default order if not set)
        const mainSectionOrder = data.sectionOrder || [
            'executiveSummary',
            'scopeOfWork',
            'deliverables',
            'costEstimate',
            'timeline',
            'closing',
        ];

        // Get cost section order (default: initial first, then recurring)
        const costOrder = data.costSectionOrder || ['initial', 'recurring'];

        // Helper function to render Executive Summary
        const renderExecutiveSummary = () => {
            if (!data.executiveSummary) return;
            y = addPDFSection(
                doc,
                'Executive Summary',
                y,
                margin,
                pageWidth,
                primaryColor,
                textDark
            );

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...textDark);
            const summaryLines = doc.splitTextToSize(data.executiveSummary, pageWidth - 2 * margin);
            doc.text(summaryLines, margin, y);
            y += summaryLines.length * 14 + 20;

            y = checkPageBreak(doc, y, pageHeight, margin);
        };

        // Helper function to render Scope of Work
        const renderScopeOfWork = () => {
            if (data.scopeOfWork.length === 0) return;
            y = addPDFSection(doc, 'Scope of Work', y, margin, pageWidth, primaryColor, textDark);

            data.scopeOfWork.forEach((section) => {
                y = checkPageBreak(doc, y, pageHeight, margin);

                if (section.sectionTitle) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    doc.setTextColor(...textDark);
                    doc.text(section.sectionTitle, margin, y);
                    y += 16;
                }

                if (section.description) {
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(...textGray);
                    const descLines = doc.splitTextToSize(
                        section.description,
                        pageWidth - 2 * margin - 20
                    );
                    doc.text(descLines, margin + 10, y);
                    y += descLines.length * 12 + 8;
                }

                section.items.forEach((item) => {
                    y = checkPageBreak(doc, y, pageHeight, margin);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(...textDark);
                    doc.text('•', margin + 10, y);
                    const itemLines = doc.splitTextToSize(item, pageWidth - 2 * margin - 35);
                    doc.text(itemLines, margin + 25, y);
                    y += itemLines.length * 12 + 4;
                });

                y += 10;
            });

            y += 10;
        };

        // Helper function to render Deliverables
        const renderDeliverables = () => {
            if (data.deliverables.length === 0) return;
            y = checkPageBreak(doc, y, pageHeight, margin);
            y = addPDFSection(doc, 'Deliverables', y, margin, pageWidth, primaryColor, textDark);

            data.deliverables.forEach((item) => {
                y = checkPageBreak(doc, y, pageHeight, margin);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...textDark);
                doc.text('•', margin + 10, y);
                const itemLines = doc.splitTextToSize(item, pageWidth - 2 * margin - 35);
                doc.text(itemLines, margin + 25, y);
                y += itemLines.length * 12 + 4;
            });

            y += 15;
        };

        // Helper function to render initial cost section
        const renderInitialCost = () => {
            // Initial Project Cost - styled box
            const initialCostBoxY = y;
            const initialCostBoxHeight = 55;

            // Draw background box for initial cost
            doc.setFillColor(248, 246, 255); // Light purple background
            doc.roundedRect(margin, initialCostBoxY, contentWidth, initialCostBoxHeight, 4, 4, 'F');

            // Use custom title (uppercase for display)
            const initialTitle = (data.initialCostTitle || 'Project Cost').toUpperCase();
            y += 18;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...primaryColor);
            doc.text(initialTitle, margin + 15, y);

            // Amount
            y += 22;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(...textDark);
            doc.text(formatCurrency(data.pricing.totalAmount), margin + 15, y);

            // Add description label if provided
            if (data.pricing.description) {
                const amtWidth = doc.getTextWidth(formatCurrency(data.pricing.totalAmount));
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
                doc.setTextColor(...textGray);
                doc.text(`(${data.pricing.description})`, margin + 25 + amtWidth, y);
            }

            y = initialCostBoxY + initialCostBoxHeight + 15;

            // Payment Schedule (if installments)
            if (!data.pricing.isOneTime && data.pricing.paymentSchedule.length > 0) {
                y = checkPageBreak(doc, y, pageHeight, margin);

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...textDark);
                doc.text('Payment Schedule', margin, y);
                y += 18;

                data.pricing.paymentSchedule.forEach((payment, index) => {
                    y = checkPageBreak(doc, y, pageHeight, margin);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(...textDark);

                    const dateStr = payment.dueDate
                        ? `  —  Due: ${formatDisplayDate(payment.dueDate)}`
                        : '';
                    doc.text(`${index + 1}.`, margin + 10, y);
                    doc.text(`${payment.description}:`, margin + 25, y);

                    doc.setFont('helvetica', 'bold');
                    doc.text(formatCurrency(payment.amount), margin + 180, y);

                    if (dateStr) {
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(...textGray);
                        doc.text(dateStr, margin + 250, y);
                    }

                    y += 16;
                });
                y += 10;
            }
        };

        // Helper function to render recurring costs section
        const renderRecurringCosts = () => {
            if (!data.recurringCosts || data.recurringCosts.length === 0) return;

            y = checkPageBreak(doc, y, pageHeight, margin);

            // Draw a subtle divider if not first section
            if (costOrder.indexOf('recurring') > 0) {
                doc.setDrawColor(...lineGray);
                doc.setLineWidth(0.5);
                doc.line(margin, y, margin + contentWidth, y);
                y += 20;
            }

            // Use custom title (uppercase for display)
            const recurringTitle = (data.recurringCostTitle || 'Recurring Costs').toUpperCase();
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...primaryColor);
            doc.text(recurringTitle, margin, y);
            y += 20;

            data.recurringCosts.forEach((recurring) => {
                y = checkPageBreak(doc, y, pageHeight, margin);

                // Draw a light background box for each recurring cost
                const recurringBoxHeight =
                    recurring.includes && recurring.includes.length > 0
                        ? 45 + recurring.includes.length * 14
                        : 45;

                doc.setFillColor(250, 250, 250);
                doc.roundedRect(margin, y - 5, contentWidth, recurringBoxHeight, 3, 3, 'F');

                // Recurring cost name
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(...textDark);
                const recurringName = recurring.name || 'Recurring Cost';
                doc.text(recurringName, margin + 12, y + 12);

                // Format amount (with range support)
                let amountStr;
                if (recurring.isRange && recurring.maxAmount) {
                    amountStr = `${formatCurrency(recurring.minAmount)} — ${formatCurrency(
                        recurring.maxAmount
                    )} / ${recurring.frequency}`;
                } else {
                    amountStr = `${formatCurrency(recurring.minAmount)} / ${recurring.frequency}`;
                }

                // Amount on the right side
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.setTextColor(...primaryColor);
                const amtWidth = doc.getTextWidth(amountStr);
                doc.text(amountStr, margin + contentWidth - amtWidth - 12, y + 12);

                y += 28;

                // Includes list
                if (recurring.includes && recurring.includes.length > 0) {
                    doc.setFont('helvetica', 'italic');
                    doc.setFontSize(9);
                    doc.setTextColor(...textGray);
                    doc.text('Includes:', margin + 12, y);
                    y += 14;

                    doc.setFont('helvetica', 'normal');
                    recurring.includes.forEach((item) => {
                        y = checkPageBreak(doc, y, pageHeight, margin);
                        doc.text(`•  ${item}`, margin + 20, y);
                        y += 14;
                    });
                }

                y += 15;
            });
        };

        // Helper function to render Cost Estimate section
        const renderCostEstimate = () => {
            y = checkPageBreak(doc, y, pageHeight, margin);
            y = addPDFSection(doc, 'Cost Estimate', y, margin, pageWidth, primaryColor, textDark);

            // Render cost sections in order
            costOrder.forEach((sectionType) => {
                if (sectionType === 'initial') {
                    renderInitialCost();
                } else if (sectionType === 'recurring') {
                    renderRecurringCosts();
                }
            });

            // Cost Note (if any)
            if (data.costNote) {
                y = checkPageBreak(doc, y, pageHeight, margin);
                y += 8;

                doc.setFont('helvetica', 'italic');
                doc.setFontSize(10);
                doc.setTextColor(...textGray);
                const noteLines = doc.splitTextToSize(data.costNote, contentWidth - 10);
                doc.text(noteLines, margin + 5, y);
                y += noteLines.length * 14 + 10;
            }

            y += 15;
        };

        // Helper function to render Timeline
        const renderTimeline = () => {
            if (!data.timeline) return;
            y = checkPageBreak(doc, y, pageHeight, margin);
            y = addPDFSection(doc, 'Timeline', y, margin, pageWidth, primaryColor, textDark);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...textDark);
            const timelineLines = doc.splitTextToSize(data.timeline, pageWidth - 2 * margin);
            doc.text(timelineLines, margin, y);
            y += timelineLines.length * 12 + 15;
        };

        // Helper function to render Closing
        const renderClosing = () => {
            if (!data.closingText) return;
            y = checkPageBreak(doc, y, pageHeight, margin);
            y = addPDFSection(doc, 'Ready to Start?', y, margin, pageWidth, primaryColor, textDark);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...textDark);
            doc.text(data.closingText, margin, y);
            y += 30;
        };

        // Render all sections in order
        mainSectionOrder.forEach((sectionType) => {
            switch (sectionType) {
                case 'executiveSummary':
                    renderExecutiveSummary();
                    break;
                case 'scopeOfWork':
                    renderScopeOfWork();
                    break;
                case 'deliverables':
                    renderDeliverables();
                    break;
                case 'costEstimate':
                    renderCostEstimate();
                    break;
                case 'timeline':
                    renderTimeline();
                    break;
                case 'closing':
                    renderClosing();
                    break;
            }
        });

        // ========== FOOTER ==========
        y = checkPageBreak(doc, y, pageHeight, margin);

        doc.setDrawColor(...lineGray);
        doc.line(margin, y, pageWidth - margin, y);
        y += 15;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('Sahab Solutions', margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textGray);
        doc.text(data.contactWebsite, margin, y + 12);
        doc.text(data.contactEmail, margin, y + 24);

        // Save PDF
        const fileName = `Proposal_${data.projectName || data.title}_${
            data.preparedDate
        }.pdf`.replace(/\s+/g, '_');
        doc.save(fileName);

        Common.showNotification('Proposal PDF generated successfully!', 'success');
    } catch (error) {
        console.error('Error generating PDF:', error);
        Common.showNotification('Failed to generate PDF: ' + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-file-pdf"></i> Generate PDF';
        if (status) status.style.display = 'none';
    }
}

/**
 * Add a section header to PDF
 */
function addPDFSection(doc, title, y, margin, pageWidth, primaryColor, textDark) {
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y, 4, 16, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...textDark);
    doc.text(title, margin + 12, y + 12);

    return y + 28;
}

/**
 * Check for page break and add new page if needed
 */
function checkPageBreak(doc, y, pageHeight, margin) {
    if (y > pageHeight - 80) {
        doc.addPage();
        return margin;
    }
    return y;
}

/**
 * Toggle saved proposals modal
 */
async function toggleSavedProposals() {
    $('#savedProposalsModal').modal('show');
    await loadSavedProposals();
}

/**
 * Load saved proposals
 */
async function loadSavedProposals() {
    const container = document.getElementById('savedProposalsList');

    try {
        const response = await fetch('/api/tools/generated-proposals');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            savedProposals = result.data;

            container.innerHTML = result.data
                .map(
                    (proposal) => `
                <div class="saved-item" data-id="${proposal._id}">
                    <div class="saved-item-info">
                        <div class="saved-item-title">${escapeHtml(proposal.title)}</div>
                        <div class="saved-item-meta">
                            <span class="badge badge-${getStatusBadgeClass(proposal.status)}">${
                        proposal.status
                    }</span>
                            <span>${proposal.proposalNumber || 'Draft'}</span>
                            <span>${formatDisplayDate(proposal.preparedDate)}</span>
                            <span>${formatCurrency(proposal.pricing?.totalAmount || 0)}</span>
                        </div>
                    </div>
                    <div class="saved-item-actions">
                        <button class="btn btn-sm btn-primary" onclick="loadProposal('${
                            proposal._id
                        }')" title="Load">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-info" onclick="regenerateProposalPDF('${
                            proposal._id
                        }')" title="Generate PDF">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteProposal('${
                            proposal._id
                        }')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `
                )
                .join('');
        } else {
            container.innerHTML = `
                <div class="empty-state-small">
                    <i class="fas fa-folder-open"></i>
                    <p>No saved proposals yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading proposals:', error);
        container.innerHTML = `
            <div class="empty-state-small">
                <i class="fas fa-exclamation-circle text-danger"></i>
                <p>Error loading proposals</p>
            </div>
        `;
    }
}

/**
 * Load a proposal into the form
 */
async function loadProposal(id) {
    try {
        const response = await fetch(`/api/tools/generated-proposals/${id}`);
        const result = await response.json();

        if (result.success) {
            const proposal = result.data;
            currentProposalId = id;

            // Fill form fields
            document.getElementById('propClient').value = proposal.client?._id || proposal.client;
            document.getElementById('propTitle').value = proposal.title || '';
            document.getElementById('propProjectName').value = proposal.projectName || '';
            document.getElementById('propPreparedDate').value = proposal.preparedDate
                ? proposal.preparedDate.split('T')[0]
                : '';
            document.getElementById('propExecutiveSummary').value = proposal.executiveSummary || '';
            document.getElementById('propTotalAmount').value = proposal.pricing?.totalAmount || 0;
            document.getElementById('propPricingDescription').value =
                proposal.pricing?.description || 'One-Time';
            document.getElementById('propPaymentType').value = proposal.pricing?.isOneTime
                ? 'one-time'
                : 'installments';
            document.getElementById('propTimeline').value = proposal.timeline || '';
            document.getElementById('propClosingText').value = proposal.closingText || '';
            document.getElementById('propInternalNotes').value = proposal.internalNotes || '';

            // Handle retainer
            document.getElementById('propRetainerEnabled').checked =
                proposal.retainer?.enabled || false;
            toggleProposalRetainer();
            if (proposal.retainer?.enabled) {
                document.getElementById('propRetainerAmount').value = proposal.retainer.amount || 0;
                document.getElementById('propRetainerFrequency').value =
                    proposal.retainer.frequency || 'monthly';

                // Load retainer includes
                const includesContainer = document.getElementById('propRetainerIncludes');
                includesContainer.innerHTML = '';
                (proposal.retainer.includes || []).forEach((item) => {
                    addProposalRetainerInclude();
                    const inputs = includesContainer.querySelectorAll('.list-item input');
                    inputs[inputs.length - 1].value = item;
                });
            }

            // Load scope of work
            const scopeContainer = document.getElementById('propScopeOfWork');
            scopeContainer.innerHTML = '';
            propScopeSectionCounter = 0;
            (proposal.scopeOfWork || []).forEach((section) => {
                addProposalScopeSection();
                const sectionEl = scopeContainer.lastElementChild;
                sectionEl.querySelector('.scope-title').value = section.sectionTitle || '';
                sectionEl.querySelector('.scope-description').value = section.description || '';

                const itemsContainer = sectionEl.querySelector('.scope-items');
                itemsContainer.innerHTML = '';
                (section.items || []).forEach((item) => {
                    const sectionId = sectionEl.id;
                    addProposalScopeItem(sectionId);
                    const inputs = itemsContainer.querySelectorAll('.scope-item input');
                    inputs[inputs.length - 1].value = item;
                });
            });

            // Load deliverables
            const deliverablesContainer = document.getElementById('propDeliverables');
            deliverablesContainer.innerHTML = '';
            propDeliverableCounter = 0;
            (proposal.deliverables || []).forEach((item) => {
                addProposalDeliverable();
                const inputs = deliverablesContainer.querySelectorAll('.list-item input');
                inputs[inputs.length - 1].value = item;
            });

            // Load payment schedule
            if (!proposal.pricing?.isOneTime) {
                document.getElementById('propPaymentScheduleSection').style.display = 'block';
                const scheduleContainer = document.getElementById('propPaymentSchedule');
                scheduleContainer.innerHTML = '';
                propPaymentItemCounter = 0;
                (proposal.pricing?.paymentSchedule || []).forEach((payment) => {
                    addProposalPaymentItem();
                    const items = scheduleContainer.querySelectorAll('.payment-item');
                    const lastItem = items[items.length - 1];
                    lastItem.querySelector('.payment-desc').value = payment.description || '';
                    lastItem.querySelector('.payment-amount input').value = payment.amount || 0;
                    if (payment.dueDate) {
                        lastItem.querySelector('.payment-date').value =
                            payment.dueDate.split('T')[0];
                    }
                });
            }

            $('#savedProposalsModal').modal('hide');
            Common.showNotification('Proposal loaded successfully!', 'success');
        }
    } catch (error) {
        console.error('Error loading proposal:', error);
        Common.showNotification('Failed to load proposal', 'error');
    }
}

/**
 * Delete a proposal
 */
async function deleteProposal(id) {
    Common.confirm('Delete this proposal?', async () => {
        try {
            const response = await fetch(`/api/tools/generated-proposals/${id}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (result.success) {
                if (currentProposalId === id) {
                    currentProposalId = null;
                }
                await loadSavedProposals();
                Common.showNotification('Proposal deleted', 'success');
            } else {
                Common.showNotification(result.message || 'Failed to delete', 'error');
            }
        } catch (error) {
            console.error('Error deleting proposal:', error);
            Common.showNotification('Failed to delete proposal', 'error');
        }
    });
}

/**
 * Regenerate PDF for a saved proposal
 */
async function regenerateProposalPDF(id) {
    await loadProposal(id);
    $('#savedProposalsModal').modal('hide');
    setTimeout(() => {
        generateProposalPDF();
    }, 500);
}

/**
 * Get status badge class
 */
function getStatusBadgeClass(status) {
    const classes = {
        draft: 'secondary',
        sent: 'info',
        viewed: 'primary',
        accepted: 'success',
        rejected: 'danger',
        signed: 'success',
    };
    return classes[status] || 'secondary';
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initProposalGenerator();
});

// Make functions globally available
window.addProposalScopeSection = addProposalScopeSection;
window.removeProposalScopeSection = removeProposalScopeSection;
window.addProposalScopeItem = addProposalScopeItem;
window.removeProposalScopeItem = removeProposalScopeItem;
window.addProposalDeliverable = addProposalDeliverable;
window.addProposalPaymentItem = addProposalPaymentItem;
window.toggleProposalRetainer = toggleProposalRetainer;
window.addProposalRetainerInclude = addProposalRetainerInclude;
window.addProposalRecurringCost = addProposalRecurringCost;
window.toggleRecurringCostRange = toggleRecurringCostRange;
window.removeRecurringCost = removeRecurringCost;
window.addRecurringCostInclude = addRecurringCostInclude;
window.removeListItem = removeListItem;
window.saveProposalDraft = saveProposalDraft;
window.generateProposalPDF = generateProposalPDF;
window.toggleSavedProposals = toggleSavedProposals;
window.loadProposal = loadProposal;
window.deleteProposal = deleteProposal;
window.regenerateProposalPDF = regenerateProposalPDF;

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
}

/**
 * Load clients for dropdown (only active clients)
 */
async function loadProposalClients() {
    const select = document.getElementById('propClient');
    if (!select) return;

    try {
        // Only fetch active clients
        const response = await fetch('/api/clients');
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

    // Collect retainer includes
    const retainerIncludes = [];
    document.querySelectorAll('#propRetainerIncludes .list-item input').forEach((input) => {
        const value = input.value.trim();
        if (value) retainerIncludes.push(value);
    });

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
            enabled: document.getElementById('propRetainerEnabled').checked,
            amount: parseFloat(document.getElementById('propRetainerAmount')?.value) || 0,
            frequency: document.getElementById('propRetainerFrequency')?.value || 'monthly',
            includes: retainerIncludes,
        },
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
        // Logo placeholder
        doc.setFillColor(...primaryColor);
        doc.roundedRect(margin, y, 80, 80, 6, 6, 'F');

        // Cloud icon in logo
        doc.setFillColor(255, 255, 255);
        doc.circle(margin + 28, y + 35, 14, 'F');
        doc.circle(margin + 42, y + 30, 17, 'F');
        doc.circle(margin + 58, y + 36, 12, 'F');
        doc.rect(margin + 18, y + 35, 48, 18, 'F');

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
            const clientName = data.clientData.company || data.clientData.name;
            doc.text('Prepared for:', pageWidth - margin - 150, y);
            doc.setTextColor(...textDark);
            doc.setFont('helvetica', 'bold');
            doc.text(clientName, pageWidth - margin - 150, y + 14);
        }

        y += 55;

        // ========== EXECUTIVE SUMMARY ==========
        if (data.executiveSummary) {
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
        }

        // ========== SCOPE OF WORK ==========
        if (data.scopeOfWork.length > 0) {
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
        }

        // ========== DELIVERABLES ==========
        if (data.deliverables.length > 0) {
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
        }

        // ========== COST ESTIMATE ==========
        y = checkPageBreak(doc, y, pageHeight, margin);
        y = addPDFSection(doc, 'Cost Estimate', y, margin, pageWidth, primaryColor, textDark);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(...textDark);
        doc.text(
            `Total Project Cost: ${formatCurrency(data.pricing.totalAmount)} (${
                data.pricing.description
            })`,
            margin,
            y
        );
        y += 20;

        if (!data.pricing.isOneTime && data.pricing.paymentSchedule.length > 0) {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Payment Schedule:', margin, y);
            y += 16;

            data.pricing.paymentSchedule.forEach((payment) => {
                y = checkPageBreak(doc, y, pageHeight, margin);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                const dateStr = payment.dueDate
                    ? ` - Due: ${formatDisplayDate(payment.dueDate)}`
                    : '';
                doc.text(
                    `• ${payment.description}: ${formatCurrency(payment.amount)}${dateStr}`,
                    margin + 10,
                    y
                );
                y += 14;
            });
        }

        y += 15;

        // ========== RETAINER ==========
        if (data.retainer.enabled) {
            y = checkPageBreak(doc, y, pageHeight, margin);
            y = addPDFSection(
                doc,
                'Maintenance Retainer',
                y,
                margin,
                pageWidth,
                primaryColor,
                textDark
            );

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(...textDark);
            doc.text(
                `${formatCurrency(data.retainer.amount)}/${data.retainer.frequency}`,
                margin,
                y
            );
            y += 18;

            if (data.retainer.includes.length > 0) {
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text('Includes:', margin, y);
                y += 14;

                data.retainer.includes.forEach((item) => {
                    y = checkPageBreak(doc, y, pageHeight, margin);
                    doc.text(`• ${item}`, margin + 10, y);
                    y += 12;
                });
            }

            y += 15;
        }

        // ========== TIMELINE ==========
        if (data.timeline) {
            y = checkPageBreak(doc, y, pageHeight, margin);
            y = addPDFSection(doc, 'Timeline', y, margin, pageWidth, primaryColor, textDark);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...textDark);
            const timelineLines = doc.splitTextToSize(data.timeline, pageWidth - 2 * margin);
            doc.text(timelineLines, margin, y);
            y += timelineLines.length * 12 + 15;
        }

        // ========== CLOSING ==========
        if (data.closingText) {
            y = checkPageBreak(doc, y, pageHeight, margin);
            y = addPDFSection(doc, 'Ready to Start?', y, margin, pageWidth, primaryColor, textDark);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...textDark);
            doc.text(data.closingText, margin, y);
            y += 30;
        }

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
window.removeListItem = removeListItem;
window.saveProposalDraft = saveProposalDraft;
window.generateProposalPDF = generateProposalPDF;
window.toggleSavedProposals = toggleSavedProposals;
window.loadProposal = loadProposal;
window.deleteProposal = deleteProposal;
window.regenerateProposalPDF = regenerateProposalPDF;

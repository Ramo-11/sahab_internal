// ============================================
// CONTRACT GENERATOR
// ============================================

// Store loaded data
let contractClients = [];
let contractProposals = [];
let savedContracts = [];
let currentContractId = null;

// Counters for dynamic elements
let contScopeSectionCounter = 0;
let contDeliverableCounter = 0;
let contPaymentItemCounter = 0;
let contRetainerIncludeCounter = 0;
let contTermCounter = 0;

// Default terms and conditions
const DEFAULT_TERMS = [
    'The client agrees to provide all necessary content, assets, and feedback promptly.',
    'Sahab Solutions may display the project in its portfolio unless otherwise agreed in writing.',
    'Ongoing maintenance covers bug fixes and optimization; new features or redesigns are billed separately.',
    'Sahab Solutions retains ownership of the codebase unless a buyout agreement is made.',
    'If the client wishes to buy out the codebase, the terms and price will be determined in a separate, newly drafted agreement.',
    'Sahab Solutions is not liable for indirect or consequential damages or downtime.',
    'Both parties agree to maintain confidentiality regarding project details, system credentials, and intellectual property.',
    'Delays caused by the client may extend the timeline.',
    'All intellectual property will be transferred upon full payment and upon request, except for the codebase itself, which requires a separate buyout agreement.'
];

/**
 * Initialize Contract Generator
 */
async function initContractGenerator() {
    const form = document.getElementById('contractGeneratorForm');
    if (!form) return;

    // Load clients
    await loadContractClients();

    // Load proposals for linking
    await loadContractProposals();

    // Add initial sections
    addContractScopeSection();
    addContractDeliverable();

    // Add default terms
    DEFAULT_TERMS.forEach(term => {
        addContractTerm(term);
    });

    // Form submit handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateContractPDF();
    });

    // Client change handler - auto-fill company name
    document.getElementById('contClient')?.addEventListener('change', (e) => {
        const client = contractClients.find(c => c._id === e.target.value);
        if (client) {
            document.getElementById('contClientCompanyName').value = client.company || client.name;
            const contactName = client.contactPerson?.name || client.name;
            document.getElementById('contClientRepName').value = contactName;
            document.getElementById('contSignClientName').value = contactName;
            document.getElementById('contSignClientTitle').value = client.company || '';
        }
    });
}

/**
 * Load clients for dropdown
 */
async function loadContractClients() {
    const select = document.getElementById('contClient');
    if (!select) return;

    try {
        const response = await fetch('/api/clients');
        const result = await response.json();

        if (result.success && result.data) {
            contractClients = result.data;

            select.innerHTML = '<option value="">Select a client...</option>';
            contractClients.forEach(client => {
                const displayName = client.company || client.name;
                select.innerHTML += `<option value="${client._id}">${escapeHtml(displayName)}</option>`;
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
 * Load proposals for linking
 */
async function loadContractProposals() {
    const select = document.getElementById('contLinkedProposal');
    if (!select) return;

    try {
        const response = await fetch('/api/tools/generated-proposals');
        const result = await response.json();

        if (result.success && result.data) {
            contractProposals = result.data;

            select.innerHTML = '<option value="">None (create from scratch)</option>';
            contractProposals.forEach(proposal => {
                const displayName = proposal.title || proposal.proposalNumber;
                select.innerHTML += `<option value="${proposal._id}">${escapeHtml(displayName)}</option>`;
            });
        }
    } catch (error) {
        console.error('Error loading proposals:', error);
    }
}

/**
 * Load proposal data into contract form
 */
async function loadProposalIntoContract() {
    const proposalId = document.getElementById('contLinkedProposal').value;
    if (!proposalId) return;

    try {
        const response = await fetch(`/api/tools/generated-proposals/${proposalId}`);
        const result = await response.json();

        if (result.success) {
            const proposal = result.data;

            // Set client
            document.getElementById('contClient').value = proposal.client?._id || proposal.client;
            document.getElementById('contClient').dispatchEvent(new Event('change'));

            // Set basic info
            document.getElementById('contTitle').value = `Service Agreement for ${proposal.projectName || proposal.title}`;
            document.getElementById('contProjectName').value = proposal.projectName || '';
            document.getElementById('contProjectDescription').value = proposal.executiveSummary || '';

            // Set payment
            document.getElementById('contTotalAmount').value = proposal.pricing?.totalAmount || 0;
            document.getElementById('contPaymentDescription').value = proposal.pricing?.description || 'One-Time';

            // Load scope of work
            const scopeContainer = document.getElementById('contScopeOfWork');
            scopeContainer.innerHTML = '';
            contScopeSectionCounter = 0;
            (proposal.scopeOfWork || []).forEach(section => {
                addContractScopeSection();
                const sectionEl = scopeContainer.lastElementChild;
                sectionEl.querySelector('.scope-title').value = section.sectionTitle || '';
                sectionEl.querySelector('.scope-description').value = section.description || '';

                const itemsContainer = sectionEl.querySelector('.scope-items');
                itemsContainer.innerHTML = '';
                (section.items || []).forEach(item => {
                    const sectionId = sectionEl.id;
                    addContractScopeItem(sectionId);
                    const inputs = itemsContainer.querySelectorAll('.scope-item input');
                    inputs[inputs.length - 1].value = item;
                });
            });

            // Load deliverables
            const deliverablesContainer = document.getElementById('contDeliverables');
            deliverablesContainer.innerHTML = '';
            contDeliverableCounter = 0;
            (proposal.deliverables || []).forEach(item => {
                addContractDeliverable();
                const inputs = deliverablesContainer.querySelectorAll('.list-item input');
                inputs[inputs.length - 1].value = item;
            });

            // Load payment schedule
            const scheduleContainer = document.getElementById('contPaymentSchedule');
            scheduleContainer.innerHTML = '';
            contPaymentItemCounter = 0;
            (proposal.pricing?.paymentSchedule || []).forEach(payment => {
                addContractPaymentItem();
                const items = scheduleContainer.querySelectorAll('.payment-item');
                const lastItem = items[items.length - 1];
                lastItem.querySelector('.payment-desc').value = payment.description || '';
                lastItem.querySelector('.payment-amount input').value = payment.amount || 0;
                if (payment.dueDate) {
                    lastItem.querySelector('.payment-date').value = payment.dueDate.split('T')[0];
                }
            });

            // Load retainer
            if (proposal.retainer?.enabled) {
                document.getElementById('contRetainerEnabled').checked = true;
                toggleContractRetainer();
                document.getElementById('contRetainerAmount').value = proposal.retainer.amount || 0;
                document.getElementById('contRetainerFrequency').value = proposal.retainer.frequency || 'monthly';

                const includesContainer = document.getElementById('contRetainerIncludes');
                includesContainer.innerHTML = '';
                (proposal.retainer.includes || []).forEach(item => {
                    addContractRetainerInclude();
                    const inputs = includesContainer.querySelectorAll('.list-item input');
                    inputs[inputs.length - 1].value = item;
                });
            }

            Common.showNotification('Proposal data loaded into contract', 'success');
        }
    } catch (error) {
        console.error('Error loading proposal:', error);
        Common.showNotification('Failed to load proposal data', 'error');
    }
}

/**
 * Add a scope of work section
 */
function addContractScopeSection() {
    const container = document.getElementById('contScopeOfWork');
    if (!container) return;

    contScopeSectionCounter++;
    const sectionId = `contScope_${contScopeSectionCounter}`;

    const section = document.createElement('div');
    section.className = 'scope-section';
    section.id = sectionId;
    section.innerHTML = `
        <div class="scope-section-header">
            <input type="text" class="form-control scope-title" placeholder="Section Title" />
            <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeContractScopeSection('${sectionId}')" title="Remove">
                <i class="fas fa-trash"></i>
            </button>
        </div>
        <div class="form-group">
            <textarea class="form-control scope-description" rows="2" placeholder="Section description (optional)"></textarea>
        </div>
        <div class="scope-items" id="${sectionId}_items"></div>
        <button type="button" class="btn btn-sm btn-secondary" onclick="addContractScopeItem('${sectionId}')">
            <i class="fas fa-plus"></i> Add Item
        </button>
    `;

    container.appendChild(section);
    addContractScopeItem(sectionId);
}

/**
 * Remove a scope section
 */
function removeContractScopeSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) section.remove();
}

/**
 * Add an item to a scope section
 */
function addContractScopeItem(sectionId) {
    const container = document.getElementById(`${sectionId}_items`);
    if (!container) return;

    const itemId = `${sectionId}_item_${container.children.length + 1}`;

    const item = document.createElement('div');
    item.className = 'scope-item';
    item.id = itemId;
    item.innerHTML = `
        <span class="scope-item-bullet">•</span>
        <input type="text" class="form-control" placeholder="Feature or item" />
        <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeContractScopeItem('${itemId}')" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(item);
}

/**
 * Remove a scope item
 */
function removeContractScopeItem(itemId) {
    const item = document.getElementById(itemId);
    if (item) item.remove();
}

/**
 * Add a deliverable
 */
function addContractDeliverable() {
    const container = document.getElementById('contDeliverables');
    if (!container) return;

    contDeliverableCounter++;
    const itemId = `contDeliverable_${contDeliverableCounter}`;

    const item = document.createElement('div');
    item.className = 'list-item';
    item.id = itemId;
    item.innerHTML = `
        <span class="list-item-bullet">•</span>
        <input type="text" class="form-control" placeholder="Deliverable item" />
        <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeContractListItem('${itemId}')" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(item);
}

/**
 * Add a payment schedule item
 */
function addContractPaymentItem() {
    const container = document.getElementById('contPaymentSchedule');
    if (!container) return;

    contPaymentItemCounter++;
    const itemId = `contPayment_${contPaymentItemCounter}`;

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
            <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeContractListItem('${itemId}')" title="Remove">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.appendChild(item);
}

/**
 * Toggle retainer section
 */
function toggleContractRetainer() {
    const enabled = document.getElementById('contRetainerEnabled').checked;
    const section = document.getElementById('contRetainerSection');
    section.style.display = enabled ? 'block' : 'none';

    if (enabled && document.getElementById('contRetainerIncludes').children.length === 0) {
        addContractRetainerInclude();
    }
}

/**
 * Add a retainer include item
 */
function addContractRetainerInclude() {
    const container = document.getElementById('contRetainerIncludes');
    if (!container) return;

    contRetainerIncludeCounter++;
    const itemId = `contRetainerInclude_${contRetainerIncludeCounter}`;

    const item = document.createElement('div');
    item.className = 'list-item';
    item.id = itemId;
    item.innerHTML = `
        <span class="list-item-bullet">•</span>
        <input type="text" class="form-control" placeholder="e.g., Server maintenance" />
        <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeContractListItem('${itemId}')" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(item);
}

/**
 * Add a term/condition
 */
function addContractTerm(defaultValue = '') {
    const container = document.getElementById('contTermsAndConditions');
    if (!container) return;

    contTermCounter++;
    const itemId = `contTerm_${contTermCounter}`;

    const item = document.createElement('div');
    item.className = 'list-item numbered';
    item.id = itemId;
    item.innerHTML = `
        <span class="list-item-number">${container.children.length + 1}.</span>
        <input type="text" class="form-control" placeholder="Term or condition" value="${escapeHtml(defaultValue)}" />
        <button type="button" class="btn btn-sm btn-icon text-danger" onclick="removeContractTerm('${itemId}')" title="Remove">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(item);
}

/**
 * Remove a term and renumber
 */
function removeContractTerm(itemId) {
    const item = document.getElementById(itemId);
    if (item) {
        item.remove();
        renumberContractTerms();
    }
}

/**
 * Renumber terms after removal
 */
function renumberContractTerms() {
    const items = document.querySelectorAll('#contTermsAndConditions .list-item');
    items.forEach((item, index) => {
        const numberSpan = item.querySelector('.list-item-number');
        if (numberSpan) {
            numberSpan.textContent = `${index + 1}.`;
        }
    });
}

/**
 * Remove a list item (generic)
 */
function removeContractListItem(itemId) {
    const item = document.getElementById(itemId);
    if (item) item.remove();
}

/**
 * Collect contract data from form
 */
function collectContractData() {
    const clientId = document.getElementById('contClient').value;
    const client = contractClients.find(c => c._id === clientId);

    // Collect scope of work
    const scopeOfWork = [];
    document.querySelectorAll('#contScopeOfWork .scope-section').forEach(section => {
        const sectionTitle = section.querySelector('.scope-title')?.value.trim();
        const description = section.querySelector('.scope-description')?.value.trim();
        const items = [];

        section.querySelectorAll('.scope-item input').forEach(input => {
            const value = input.value.trim();
            if (value) items.push(value);
        });

        if (sectionTitle || items.length > 0) {
            scopeOfWork.push({ sectionTitle, description, items });
        }
    });

    // Collect deliverables
    const deliverables = [];
    document.querySelectorAll('#contDeliverables .list-item input').forEach(input => {
        const value = input.value.trim();
        if (value) deliverables.push(value);
    });

    // Collect payment schedule
    const paymentSchedule = [];
    document.querySelectorAll('#contPaymentSchedule .payment-item').forEach(item => {
        const description = item.querySelector('.payment-desc')?.value.trim();
        const amount = parseFloat(item.querySelector('.payment-amount input')?.value) || 0;
        const dueDate = item.querySelector('.payment-date')?.value;

        if (description || amount > 0) {
            paymentSchedule.push({ description, amount, dueDate });
        }
    });

    // Collect retainer includes
    const retainerIncludes = [];
    document.querySelectorAll('#contRetainerIncludes .list-item input').forEach(input => {
        const value = input.value.trim();
        if (value) retainerIncludes.push(value);
    });

    // Collect terms
    const termsAndConditions = [];
    document.querySelectorAll('#contTermsAndConditions .list-item input').forEach(input => {
        const value = input.value.trim();
        if (value) termsAndConditions.push(value);
    });

    return {
        client: clientId,
        clientData: client,
        linkedProposal: document.getElementById('contLinkedProposal').value || null,
        title: document.getElementById('contTitle').value.trim(),
        clientCompanyName: document.getElementById('contClientCompanyName').value.trim(),
        clientRepresentativeName: document.getElementById('contClientRepName').value.trim(),
        projectName: document.getElementById('contProjectName').value.trim(),
        projectDescription: document.getElementById('contProjectDescription').value.trim(),
        scopeOfWork,
        deliverables,
        payment: {
            totalAmount: parseFloat(document.getElementById('contTotalAmount').value) || 0,
            description: document.getElementById('contPaymentDescription').value.trim(),
            schedule: paymentSchedule,
            operationalCostsNote: document.getElementById('contOperationalCostsNote').value.trim(),
            paymentInstructions: document.getElementById('contPaymentInstructions').value.trim()
        },
        retainer: {
            enabled: document.getElementById('contRetainerEnabled').checked,
            amount: parseFloat(document.getElementById('contRetainerAmount')?.value) || 0,
            frequency: document.getElementById('contRetainerFrequency')?.value || 'monthly',
            startsAfter: document.getElementById('contRetainerStartsAfter')?.value.trim() || 'after the final installment payment is made',
            includes: retainerIncludes
        },
        resaleRights: document.getElementById('contResaleRights').value.trim(),
        termsAndConditions,
        signatures: {
            sahabName: document.getElementById('contSahabName').value.trim(),
            sahabTitle: document.getElementById('contSahabTitle').value.trim(),
            clientName: document.getElementById('contSignClientName').value.trim(),
            clientTitle: document.getElementById('contSignClientTitle').value.trim()
        },
        internalNotes: document.getElementById('contInternalNotes').value.trim(),
        preparedBy: 'Sahab Solutions',
        contactEmail: 'sahab@sahab-solutions.com',
        contactWebsite: 'sahab-solutions.com'
    };
}

/**
 * Save contract as draft
 */
async function saveContractDraft() {
    const data = collectContractData();

    if (!data.client) {
        Common.showNotification('Please select a client', 'warning');
        return;
    }

    if (!data.title) {
        Common.showNotification('Please enter a contract title', 'warning');
        return;
    }

    try {
        const url = currentContractId
            ? `/api/tools/generated-contracts/${currentContractId}`
            : '/api/tools/generated-contracts';
        const method = currentContractId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            currentContractId = result.data._id;
            Common.showNotification('Contract saved successfully!', 'success');
        } else {
            Common.showNotification(result.message || 'Failed to save contract', 'error');
        }
    } catch (error) {
        console.error('Error saving contract:', error);
        Common.showNotification('Failed to save contract', 'error');
    }
}

/**
 * Generate Contract PDF
 */
async function generateContractPDF() {
    const btn = document.querySelector('#contractGeneratorForm button[type="submit"]');
    const status = document.getElementById('contractGenerationStatus');

    const data = collectContractData();

    // Validate
    if (!data.client) {
        Common.showNotification('Please select a client', 'warning');
        return;
    }

    if (!data.title) {
        Common.showNotification('Please enter a contract title', 'warning');
        return;
    }

    // Show loading
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    if (status) status.style.display = 'flex';

    try {
        await waitForJsPDF();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter'
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
        // Logo
        doc.setFillColor(...primaryColor);
        doc.roundedRect(margin, y, 70, 70, 5, 5, 'F');

        doc.setFillColor(255, 255, 255);
        doc.circle(margin + 22, y + 30, 11, 'F');
        doc.circle(margin + 35, y + 25, 14, 'F');
        doc.circle(margin + 50, y + 31, 10, 'F');
        doc.rect(margin + 14, y + 30, 42, 15, 'F');

        // Title
        doc.setTextColor(...textDark);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Sahab Solutions', margin + 82, y + 30);

        doc.setFontSize(14);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textGray);
        doc.text('Service Agreement', margin + 82, y + 48);

        y += 90;

        // Divider
        doc.setDrawColor(...lineGray);
        doc.setLineWidth(1);
        doc.line(margin, y, pageWidth - margin, y);

        y += 25;

        // ========== PARTIES ==========
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...textDark);
        doc.text('This Agreement is entered into between:', margin, y);
        y += 20;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Provider: Sahab Solutions ("Sahab")', margin + 15, y);
        y += 14;
        doc.text(`Client: ${data.clientCompanyName || data.clientData?.company || data.clientData?.name || ''} ("Client")`, margin + 15, y);
        y += 25;

        // ========== PROJECT OVERVIEW ==========
        if (data.projectName || data.projectDescription) {
            y = addContractSection(doc, 'Project Overview', y, margin, pageWidth, primaryColor, textDark);

            if (data.projectName) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text(`Project: ${data.projectName}`, margin, y);
                y += 16;
            }

            if (data.projectDescription) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                const descLines = doc.splitTextToSize(data.projectDescription, pageWidth - 2 * margin);
                doc.text(descLines, margin, y);
                y += descLines.length * 12 + 15;
            }
        }

        // ========== SCOPE OF WORK ==========
        if (data.scopeOfWork.length > 0) {
            y = checkContractPageBreak(doc, y, pageHeight, margin);
            y = addContractSection(doc, 'Scope of Work', y, margin, pageWidth, primaryColor, textDark);

            data.scopeOfWork.forEach(section => {
                y = checkContractPageBreak(doc, y, pageHeight, margin);

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
                    const descLines = doc.splitTextToSize(section.description, pageWidth - 2 * margin - 15);
                    doc.text(descLines, margin + 10, y);
                    y += descLines.length * 12 + 6;
                }

                section.items.forEach(item => {
                    y = checkContractPageBreak(doc, y, pageHeight, margin);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(...textDark);
                    doc.text('•', margin + 10, y);
                    const itemLines = doc.splitTextToSize(item, pageWidth - 2 * margin - 30);
                    doc.text(itemLines, margin + 22, y);
                    y += itemLines.length * 12 + 3;
                });

                y += 8;
            });
        }

        // ========== DELIVERABLES ==========
        if (data.deliverables.length > 0) {
            y = checkContractPageBreak(doc, y, pageHeight, margin);
            y = addContractSection(doc, 'Deliverables', y, margin, pageWidth, primaryColor, textDark);

            data.deliverables.forEach(item => {
                y = checkContractPageBreak(doc, y, pageHeight, margin);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...textDark);
                doc.text('•', margin + 10, y);
                const itemLines = doc.splitTextToSize(item, pageWidth - 2 * margin - 30);
                doc.text(itemLines, margin + 22, y);
                y += itemLines.length * 12 + 3;
            });

            y += 12;
        }

        // ========== PAYMENT ==========
        y = checkContractPageBreak(doc, y, pageHeight, margin);
        y = addContractSection(doc, 'Payment', y, margin, pageWidth, primaryColor, textDark);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...textDark);
        doc.text(`Total Project Fee: ${formatCurrency(data.payment.totalAmount)} (${data.payment.description})`, margin, y);
        y += 20;

        if (data.payment.schedule.length > 0) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('Payment Schedule:', margin, y);
            y += 14;

            data.payment.schedule.forEach(payment => {
                y = checkContractPageBreak(doc, y, pageHeight, margin);
                doc.setFont('helvetica', 'normal');
                const dateStr = payment.dueDate ? ` - Due: ${formatDisplayDate(payment.dueDate)}` : '';
                doc.text(`• ${payment.description}: ${formatCurrency(payment.amount)}${dateStr}`, margin + 10, y);
                y += 12;
            });

            y += 8;
        }

        if (data.payment.operationalCostsNote) {
            y = checkContractPageBreak(doc, y, pageHeight, margin);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(...textGray);
            const noteLines = doc.splitTextToSize(data.payment.operationalCostsNote, pageWidth - 2 * margin);
            doc.text(noteLines, margin, y);
            y += noteLines.length * 11 + 10;
        }

        if (data.payment.paymentInstructions) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...textDark);
            doc.text(data.payment.paymentInstructions, margin, y);
            y += 20;
        }

        // ========== RETAINER ==========
        if (data.retainer.enabled) {
            y = checkContractPageBreak(doc, y, pageHeight, margin);
            y = addContractSection(doc, 'Maintenance & Hosting Retainer', y, margin, pageWidth, primaryColor, textDark);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...textDark);
            doc.text(`${formatCurrency(data.retainer.amount)}/${data.retainer.frequency}`, margin, y);
            y += 16;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.text(`Begins ${data.retainer.startsAfter}`, margin, y);
            y += 16;

            if (data.retainer.includes.length > 0) {
                doc.text('Includes:', margin, y);
                y += 14;

                data.retainer.includes.forEach(item => {
                    y = checkContractPageBreak(doc, y, pageHeight, margin);
                    doc.text(`• ${item}`, margin + 10, y);
                    y += 12;
                });
            }

            y += 10;
        }

        // ========== RESALE RIGHTS ==========
        if (data.resaleRights) {
            y = checkContractPageBreak(doc, y, pageHeight, margin);
            y = addContractSection(doc, 'Resale Rights & Revenue Sharing', y, margin, pageWidth, primaryColor, textDark);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...textDark);
            const resaleLines = doc.splitTextToSize(data.resaleRights, pageWidth - 2 * margin);
            doc.text(resaleLines, margin, y);
            y += resaleLines.length * 12 + 15;
        }

        // ========== TERMS AND CONDITIONS ==========
        if (data.termsAndConditions.length > 0) {
            y = checkContractPageBreak(doc, y, pageHeight, margin);
            y = addContractSection(doc, 'Terms and Conditions', y, margin, pageWidth, primaryColor, textDark);

            data.termsAndConditions.forEach((term, index) => {
                y = checkContractPageBreak(doc, y, pageHeight, margin);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                doc.setTextColor(...textDark);

                const numWidth = doc.getTextWidth(`${index + 1}. `);
                doc.text(`${index + 1}.`, margin, y);
                const termLines = doc.splitTextToSize(term, pageWidth - 2 * margin - numWidth - 5);
                doc.text(termLines, margin + numWidth + 5, y);
                y += termLines.length * 12 + 6;
            });

            y += 10;
        }

        // ========== SIGNATURES ==========
        y = checkContractPageBreak(doc, y, pageHeight, margin + 120);
        y = addContractSection(doc, 'Signatures', y, margin, pageWidth, primaryColor, textDark);

        const sigWidth = (pageWidth - 2 * margin - 40) / 2;

        // Sahab signature
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...textDark);
        doc.text('Sahab Solutions', margin, y);

        doc.setFont('helvetica', 'normal');
        doc.setDrawColor(...lineGray);
        doc.line(margin, y + 40, margin + sigWidth, y + 40);
        doc.text('Signature', margin, y + 52);

        doc.text(data.signatures.sahabName || 'Omar Abdelalim', margin, y + 70);
        doc.text(data.signatures.sahabTitle || 'Sahab Solutions', margin, y + 82);
        doc.text('Date: ____________________', margin, y + 100);

        // Client signature
        const clientSigX = margin + sigWidth + 40;
        doc.setFont('helvetica', 'bold');
        doc.text('Client', clientSigX, y);

        doc.setFont('helvetica', 'normal');
        doc.line(clientSigX, y + 40, clientSigX + sigWidth, y + 40);
        doc.text('Signature', clientSigX, y + 52);

        doc.text(data.signatures.clientName || '________________________', clientSigX, y + 70);
        doc.text(data.signatures.clientTitle || '________________________', clientSigX, y + 82);
        doc.text('Date: ____________________', clientSigX, y + 100);

        // Save PDF
        const fileName = `Contract_${data.projectName || data.title}_${new Date().toISOString().split('T')[0]}.pdf`.replace(/\s+/g, '_');
        doc.save(fileName);

        Common.showNotification('Contract PDF generated successfully!', 'success');

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
 * Add section header to contract PDF
 */
function addContractSection(doc, title, y, margin, pageWidth, primaryColor, textDark) {
    doc.setFillColor(...primaryColor);
    doc.rect(margin, y, 3, 14, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...textDark);
    doc.text(title, margin + 10, y + 11);

    return y + 25;
}

/**
 * Check for page break
 */
function checkContractPageBreak(doc, y, pageHeight, margin) {
    if (y > pageHeight - 80) {
        doc.addPage();
        return margin;
    }
    return y;
}

/**
 * Toggle saved contracts modal
 */
async function toggleSavedContracts() {
    $('#savedContractsModal').modal('show');
    await loadSavedContracts();
}

/**
 * Load saved contracts
 */
async function loadSavedContracts() {
    const container = document.getElementById('savedContractsList');

    try {
        const response = await fetch('/api/tools/generated-contracts');
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            savedContracts = result.data;

            container.innerHTML = result.data.map(contract => `
                <div class="saved-item" data-id="${contract._id}">
                    <div class="saved-item-info">
                        <div class="saved-item-title">${escapeHtml(contract.title)}</div>
                        <div class="saved-item-meta">
                            <span class="badge badge-${getContractStatusBadgeClass(contract.status)}">${contract.status}</span>
                            <span>${contract.contractNumber || 'Draft'}</span>
                            <span>${formatCurrency(contract.payment?.totalAmount || 0)}</span>
                        </div>
                    </div>
                    <div class="saved-item-actions">
                        <button class="btn btn-sm btn-primary" onclick="loadContract('${contract._id}')" title="Load">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="regenerateContractPDF('${contract._id}')" title="Generate PDF">
                            <i class="fas fa-file-pdf"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteContract('${contract._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = `
                <div class="empty-state-small">
                    <i class="fas fa-folder-open"></i>
                    <p>No saved contracts yet</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading contracts:', error);
        container.innerHTML = `
            <div class="empty-state-small">
                <i class="fas fa-exclamation-circle text-danger"></i>
                <p>Error loading contracts</p>
            </div>
        `;
    }
}

/**
 * Load contract into form
 */
async function loadContract(id) {
    try {
        const response = await fetch(`/api/tools/generated-contracts/${id}`);
        const result = await response.json();

        if (result.success) {
            const contract = result.data;
            currentContractId = id;

            // Fill basic fields
            document.getElementById('contClient').value = contract.client?._id || contract.client;
            document.getElementById('contLinkedProposal').value = contract.linkedProposal || '';
            document.getElementById('contTitle').value = contract.title || '';
            document.getElementById('contClientCompanyName').value = contract.clientCompanyName || '';
            document.getElementById('contClientRepName').value = contract.clientRepresentativeName || '';
            document.getElementById('contProjectName').value = contract.projectName || '';
            document.getElementById('contProjectDescription').value = contract.projectDescription || '';
            document.getElementById('contTotalAmount').value = contract.payment?.totalAmount || 0;
            document.getElementById('contPaymentDescription').value = contract.payment?.description || 'One-Time';
            document.getElementById('contOperationalCostsNote').value = contract.payment?.operationalCostsNote || '';
            document.getElementById('contPaymentInstructions').value = contract.payment?.paymentInstructions || '';
            document.getElementById('contResaleRights').value = contract.resaleRights || '';
            document.getElementById('contSahabName').value = contract.signatures?.sahabName || 'Omar Abdelalim';
            document.getElementById('contSahabTitle').value = contract.signatures?.sahabTitle || 'Sahab Solutions';
            document.getElementById('contSignClientName').value = contract.signatures?.clientName || '';
            document.getElementById('contSignClientTitle').value = contract.signatures?.clientTitle || '';
            document.getElementById('contInternalNotes').value = contract.internalNotes || '';

            // Load scope of work
            const scopeContainer = document.getElementById('contScopeOfWork');
            scopeContainer.innerHTML = '';
            contScopeSectionCounter = 0;
            (contract.scopeOfWork || []).forEach(section => {
                addContractScopeSection();
                const sectionEl = scopeContainer.lastElementChild;
                sectionEl.querySelector('.scope-title').value = section.sectionTitle || '';
                sectionEl.querySelector('.scope-description').value = section.description || '';

                const itemsContainer = sectionEl.querySelector('.scope-items');
                itemsContainer.innerHTML = '';
                (section.items || []).forEach(item => {
                    addContractScopeItem(sectionEl.id);
                    const inputs = itemsContainer.querySelectorAll('.scope-item input');
                    inputs[inputs.length - 1].value = item;
                });
            });

            // Load deliverables
            const deliverablesContainer = document.getElementById('contDeliverables');
            deliverablesContainer.innerHTML = '';
            contDeliverableCounter = 0;
            (contract.deliverables || []).forEach(item => {
                addContractDeliverable();
                const inputs = deliverablesContainer.querySelectorAll('.list-item input');
                inputs[inputs.length - 1].value = item;
            });

            // Load payment schedule
            const scheduleContainer = document.getElementById('contPaymentSchedule');
            scheduleContainer.innerHTML = '';
            contPaymentItemCounter = 0;
            (contract.payment?.schedule || []).forEach(payment => {
                addContractPaymentItem();
                const items = scheduleContainer.querySelectorAll('.payment-item');
                const lastItem = items[items.length - 1];
                lastItem.querySelector('.payment-desc').value = payment.description || '';
                lastItem.querySelector('.payment-amount input').value = payment.amount || 0;
                if (payment.dueDate) {
                    lastItem.querySelector('.payment-date').value = payment.dueDate.split('T')[0];
                }
            });

            // Load retainer
            document.getElementById('contRetainerEnabled').checked = contract.retainer?.enabled || false;
            toggleContractRetainer();
            if (contract.retainer?.enabled) {
                document.getElementById('contRetainerAmount').value = contract.retainer.amount || 0;
                document.getElementById('contRetainerFrequency').value = contract.retainer.frequency || 'monthly';
                document.getElementById('contRetainerStartsAfter').value = contract.retainer.startsAfter || '';

                const includesContainer = document.getElementById('contRetainerIncludes');
                includesContainer.innerHTML = '';
                (contract.retainer.includes || []).forEach(item => {
                    addContractRetainerInclude();
                    const inputs = includesContainer.querySelectorAll('.list-item input');
                    inputs[inputs.length - 1].value = item;
                });
            }

            // Load terms
            const termsContainer = document.getElementById('contTermsAndConditions');
            termsContainer.innerHTML = '';
            contTermCounter = 0;
            (contract.termsAndConditions || []).forEach(term => {
                addContractTerm(term);
            });

            $('#savedContractsModal').modal('hide');
            Common.showNotification('Contract loaded successfully!', 'success');
        }
    } catch (error) {
        console.error('Error loading contract:', error);
        Common.showNotification('Failed to load contract', 'error');
    }
}

/**
 * Delete contract
 */
async function deleteContract(id) {
    Common.confirm('Delete this contract?', async () => {
        try {
            const response = await fetch(`/api/tools/generated-contracts/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                if (currentContractId === id) {
                    currentContractId = null;
                }
                await loadSavedContracts();
                Common.showNotification('Contract deleted', 'success');
            } else {
                Common.showNotification(result.message || 'Failed to delete', 'error');
            }
        } catch (error) {
            console.error('Error deleting contract:', error);
            Common.showNotification('Failed to delete contract', 'error');
        }
    });
}

/**
 * Regenerate PDF for saved contract
 */
async function regenerateContractPDF(id) {
    await loadContract(id);
    $('#savedContractsModal').modal('hide');
    setTimeout(() => {
        generateContractPDF();
    }, 500);
}

/**
 * Get status badge class
 */
function getContractStatusBadgeClass(status) {
    const classes = {
        'draft': 'secondary',
        'sent': 'info',
        'signed': 'success'
    };
    return classes[status] || 'secondary';
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initContractGenerator();
});

// Make functions globally available
window.addContractScopeSection = addContractScopeSection;
window.removeContractScopeSection = removeContractScopeSection;
window.addContractScopeItem = addContractScopeItem;
window.removeContractScopeItem = removeContractScopeItem;
window.addContractDeliverable = addContractDeliverable;
window.addContractPaymentItem = addContractPaymentItem;
window.toggleContractRetainer = toggleContractRetainer;
window.addContractRetainerInclude = addContractRetainerInclude;
window.addContractTerm = addContractTerm;
window.removeContractTerm = removeContractTerm;
window.removeContractListItem = removeContractListItem;
window.loadProposalIntoContract = loadProposalIntoContract;
window.saveContractDraft = saveContractDraft;
window.generateContractPDF = generateContractPDF;
window.toggleSavedContracts = toggleSavedContracts;
window.loadContract = loadContract;
window.deleteContract = deleteContract;
window.regenerateContractPDF = regenerateContractPDF;

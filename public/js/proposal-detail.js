// Proposal Detail Page JavaScript - Enhanced with all new features

function updateStatus(newStatus) {
    if (confirm(`Are you sure you want to mark this proposal as ${newStatus}?`)) {
        // Get proposal data directly from data attributes
        const proposalId = document.querySelector('[data-proposal-id]')?.getAttribute('data-proposal-id');
        const clientId = document.querySelector('[data-client-id]')?.getAttribute('data-client-id');
        const title = document.querySelector('[data-proposal-title]')?.getAttribute('data-proposal-title');
        const description = document.querySelector('[data-proposal-description]')?.getAttribute('data-proposal-description');
        const amount = document.querySelector('[data-proposal-amount]')?.getAttribute('data-proposal-amount');
        const validUntil = document.querySelector('[data-proposal-valid-until]')?.getAttribute('data-proposal-valid-until');
        const technicalHighlights = document.querySelector('[data-technical-highlights]')?.getAttribute('data-technical-highlights');
        const proposedTimeline = document.querySelector('[data-proposed-timeline]')?.getAttribute('data-proposed-timeline');
        const startDate = document.querySelector('[data-start-date]')?.getAttribute('data-start-date');
        const dueDate = document.querySelector('[data-due-date]')?.getAttribute('data-due-date');
        const projectFeatures = document.querySelector('[data-project-features]')?.getAttribute('data-project-features');
        
        if (!proposalId) {
            alert('Error: Could not find proposal ID');
            return;
        }
        
        // Show loading state
        const button = event.target;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Updating...';
        
        fetch(`/proposals/${proposalId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                title: title,
                description: description || '',
                technical_highlights: technicalHighlights || '',
                amount: amount || 0,
                status: newStatus,
                valid_until: validUntil || '',
                proposed_timeline: proposedTimeline || '',
                start_date: startDate || '',
                due_date: dueDate || '',
                project_features: projectFeatures || ''
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else if (data.success) {
                location.reload();
            } else {
                throw new Error(data.error || 'Update failed');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error updating status. Please try again.');
            
            // Reset button state
            button.disabled = false;
            button.textContent = originalText;
        });
    }
}

function duplicateProposal() {
    if (confirm('Create a copy of this proposal?')) {
        // Get proposal data directly from data attributes
        const clientId = document.querySelector('[data-client-id]')?.getAttribute('data-client-id');
        const title = document.querySelector('[data-proposal-title]')?.getAttribute('data-proposal-title');
        const description = document.querySelector('[data-proposal-description]')?.getAttribute('data-proposal-description');
        const amount = document.querySelector('[data-proposal-amount]')?.getAttribute('data-proposal-amount');
        const technicalHighlights = document.querySelector('[data-technical-highlights]')?.getAttribute('data-technical-highlights');
        const proposedTimeline = document.querySelector('[data-proposed-timeline]')?.getAttribute('data-proposed-timeline');
        const projectFeatures = document.querySelector('[data-project-features]')?.getAttribute('data-project-features');
        
        // Redirect to new proposal form with pre-filled data
        const params = new URLSearchParams({
            client_id: clientId || '',
            title: `Copy of ${title || 'Proposal'}`,
            description: description || '',
            technical_highlights: technicalHighlights || '',
            proposed_timeline: proposedTimeline || '',
            amount: amount || 0,
            project_features: projectFeatures || ''
        });
        
        window.location.href = `/proposals/new?${params.toString()}`;
    }
}

function printProposal() {
    // Hide all no-print elements before printing
    const noPrintElements = document.querySelectorAll('.no-print');
    noPrintElements.forEach(element => {
        element.style.display = 'none';
    });
    
    // Store original title
    const originalTitle = document.title;
    
    // Update title for print
    const proposalTitle = document.querySelector('[data-proposal-title]')?.getAttribute('data-proposal-title');
    const proposalId = document.querySelector('[data-proposal-id]')?.getAttribute('data-proposal-id');
    if (proposalTitle && proposalId) {
        document.title = `Proposal #${proposalId} - ${proposalTitle}`;
    }
    
    // Add print-specific styles
    const printStyle = document.createElement('style');
    printStyle.id = 'print-styles';
    printStyle.textContent = `
        @media print {
            @page {
                margin: 0.5in;
                size: letter;
            }
            
            body {
                font-size: 12pt;
                line-height: 1.4;
                color: #000 !important;
                background: white !important;
            }
            
            .proposal-document {
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
            }
            
            .proposal-document .card-body {
                padding: 0 !important;
            }
            
            .proposal-title {
                font-size: 24pt !important;
                color: #000 !important;
            }
            
            .proposal-subtitle {
                font-size: 18pt !important;
                color: #000 !important;
            }
            
            .section-title {
                font-size: 16pt !important;
                color: #000 !important;
                border-bottom: 2px solid #000 !important;
                break-after: avoid;
            }
            
            .investment-summary {
                background: #f5f5f5 !important;
                color: #000 !important;
                border: 1px solid #ccc !important;
                break-inside: avoid;
            }
            
            .investment-summary .section-title,
            .investment-label,
            .investment-amount,
            .investment-timeline {
                color: #000 !important;
            }
            
            .company-section,
            .client-section {
                background: #f9f9f9 !important;
                border: 1px solid #ddd !important;
                break-inside: avoid;
            }
            
            .proposal-description,
            .technical-highlights,
            .proposal-terms {
                background: #f9f9f9 !important;
                border: 1px solid #ddd !important;
                break-inside: avoid;
            }
            
            .feature-item {
                background: #f5f5f5 !important;
                border: 1px solid #ddd !important;
                break-inside: avoid;
            }
            
            .feature-icon {
                color: #000 !important;
            }
            
            .proposal-meta-grid {
                background: #f9f9f9 !important;
                break-inside: avoid;
            }
            
            .signature-section {
                break-before: auto;
                page-break-inside: avoid;
            }
            
            .signature-line {
                border-bottom: 1px solid #000 !important;
                height: 2px !important;
            }
            
            /* Ensure proper page breaks */
            .client-information-section,
            .project-details-section {
                break-inside: avoid;
            }
            
            /* Grid layouts for print */
            .grid-2 {
                display: block !important;
            }
            
            .grid-2 > div {
                margin-bottom: 20pt;
                break-inside: avoid;
            }
            
            .features-grid {
                display: block !important;
            }
            
            .features-grid .feature-item {
                display: block !important;
                margin-bottom: 8pt;
            }
        }
    `;
    document.head.appendChild(printStyle);
    
    // Wait a moment for styles to apply, then print
    setTimeout(() => {
        window.print();
        
        // Clean up after printing
        setTimeout(() => {
            // Remove print styles
            const printStyleElement = document.getElementById('print-styles');
            if (printStyleElement) {
                printStyleElement.remove();
            }
            
            // Restore no-print elements
            noPrintElements.forEach(element => {
                element.style.display = '';
            });
            
            // Restore original title
            document.title = originalTitle;
        }, 1000);
    }, 100);
}

// Email proposal functionality
function emailProposal() {
    const clientEmail = document.querySelector('.client-info a[href^="mailto:"]')?.textContent;
    const proposalTitle = document.querySelector('[data-proposal-title]')?.getAttribute('data-proposal-title');
    const proposalId = document.querySelector('[data-proposal-id]')?.getAttribute('data-proposal-id');
    
    if (!clientEmail) {
        alert('Client email not found. Please add an email address to the client profile.');
        return;
    }
    
    const subject = `Proposal #${proposalId}: ${proposalTitle}`;
    const body = `Dear Client,

Please find attached our proposal for "${proposalTitle}".

We've carefully crafted this proposal to meet your specific needs and requirements. Please review all sections and let us know if you have any questions or need clarifications.

We look forward to working with you on this project.

Best regards,
${document.querySelector('.company-info strong')?.textContent || 'Your Company'}`;
    
    const mailtoLink = `mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
}

// Export proposal as PDF (requires external service or library)
function exportToPDF() {
    alert('PDF export functionality would require integration with a PDF generation service. For now, please use the Print function and save as PDF from your browser.');
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + P for print
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            printProposal();
        }
        
        // Ctrl/Cmd + E for email (if available)
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            const clientEmail = document.querySelector('.client-info a[href^="mailto:"]');
            if (clientEmail) {
                emailProposal();
            }
        }
    });
    
    // Add tooltips to action buttons
    const actionButtons = document.querySelectorAll('.quick-actions .btn');
    actionButtons.forEach(button => {
        if (!button.title) {
            const text = button.textContent.trim();
            switch (text) {
                case 'Mark as Sent':
                    button.title = 'Mark this proposal as sent to client';
                    break;
                case 'Mark as Accepted':
                    button.title = 'Mark this proposal as accepted by client';
                    break;
                case 'Mark as Rejected':
                    button.title = 'Mark this proposal as rejected by client';
                    break;
                case 'Create Invoice':
                    button.title = 'Generate an invoice based on this proposal';
                    break;
                case 'Edit Proposal':
                    button.title = 'Modify this proposal';
                    break;
                case 'Duplicate':
                    button.title = 'Create a copy of this proposal';
                    break;
            }
        }
    });
    
    // Add print button tooltip
    const printButton = document.querySelector('button[onclick="printProposal()"]');
    if (printButton && !printButton.title) {
        printButton.title = 'Print this proposal (Ctrl+P)';
    }
});

// Handle browser back/forward navigation
window.addEventListener('popstate', function(event) {
    // Refresh the page to ensure we have the latest data
    location.reload();
});

// Auto-save functionality for status changes
let statusChangeTimeout;
function debounceStatusChange(callback, delay = 500) {
    clearTimeout(statusChangeTimeout);
    statusChangeTimeout = setTimeout(callback, delay);
}

// Export functions for global access
window.updateStatus = updateStatus;
window.duplicateProposal = duplicateProposal;
window.printProposal = printProposal;
window.emailProposal = emailProposal;
window.exportToPDF = exportToPDF;
// Proposal Detail Page JavaScript

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
        
        if (!proposalId) {
            alert('Error: Could not find proposal ID');
            return;
        }
        
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
                valid_until: validUntil || ''
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
        
        // Redirect to new proposal form with pre-filled data
        const params = new URLSearchParams({
            client_id: clientId || '',
            title: `Copy of ${title || 'Proposal'}`,
            description: description || '',
            technical_highlights: technicalHighlights || '',
            amount: amount || 0
        });
        
        window.location.href = `/proposals/new?${params.toString()}`;
    }
}

function printProposal() {
    window.print();
}
// Proposal Form JavaScript - Enhanced with all new features

let selectedFeatures = [];

// Initialize form
document.addEventListener('DOMContentLoaded', function() {
    // Handle URL parameters for pre-filling form (for duplicate functionality)
    const urlParams = new URLSearchParams(window.location.search);
    
    // Pre-fill form fields from URL parameters
    const fieldsToPreFill = [
        'client_id', 'title', 'description', 'amount', 'technical_highlights', 
        'proposed_timeline', 'start_date', 'due_date'
    ];
    
    fieldsToPreFill.forEach(field => {
        if (urlParams.get(field)) {
            const element = document.getElementById(field);
            if (element) {
                element.value = urlParams.get(field);
            }
        }
    });
    
    // Handle project features from URL
    if (urlParams.get('project_features')) {
        try {
            selectedFeatures = JSON.parse(urlParams.get('project_features'));
            updateFeaturesDisplay();
            updateFeaturesInput();
        } catch (e) {
            // Fallback for simple string format
            selectedFeatures = urlParams.get('project_features').split(',').map(f => f.trim()).filter(f => f);
            updateFeaturesDisplay();
            updateFeaturesInput();
        }
    }
    
    // Load existing features if editing
    loadExistingFeatures();
    
    // Set default dates if creating new proposal
    if (!document.querySelector('input[name="_method"]')) {
        setDefaultDates();
    }
});

// Feature management functions
function addFeature(featureName) {
    if (!selectedFeatures.includes(featureName)) {
        selectedFeatures.push(featureName);
        updateFeaturesDisplay();
        updateFeaturesInput();
    }
}

function addCustomFeature() {
    const input = document.getElementById('customFeature');
    const featureName = input.value.trim();
    
    if (featureName && !selectedFeatures.includes(featureName)) {
        selectedFeatures.push(featureName);
        updateFeaturesDisplay();
        updateFeaturesInput();
        input.value = '';
    }
}

function removeFeature(featureName) {
    const index = selectedFeatures.indexOf(featureName);
    if (index > -1) {
        selectedFeatures.splice(index, 1);
        updateFeaturesDisplay();
        updateFeaturesInput();
    }
}

function updateFeaturesDisplay() {
    const container = document.getElementById('selectedFeatures');
    container.innerHTML = '';
    
    if (selectedFeatures.length === 0) {
        container.innerHTML = '<span class="text-muted">No features selected</span>';
        return;
    }
    
    selectedFeatures.forEach(feature => {
        const featureElement = document.createElement('div');
        featureElement.className = 'selected-feature';
        featureElement.innerHTML = `
            ${feature}
            <button type="button" class="remove-feature" onclick="removeFeature('${feature.replace(/'/g, "\\'")}')">&times;</button>
        `;
        container.appendChild(featureElement);
    });
}

function updateFeaturesInput() {
    const input = document.getElementById('project_features');
    input.value = JSON.stringify(selectedFeatures);
}

function loadExistingFeatures() {
    const featuresInput = document.getElementById('project_features');
    const existingFeatures = featuresInput.getAttribute('data-existing-features');
    
    if (existingFeatures && existingFeatures.trim()) {
        try {
            selectedFeatures = JSON.parse(existingFeatures);
        } catch (e) {
            // Fallback for comma-separated string
            selectedFeatures = existingFeatures.split(',').map(f => f.trim()).filter(f => f);
        }
        updateFeaturesDisplay();
        updateFeaturesInput();
    }
}

// Set default dates for new proposals
function setDefaultDates() {
    const today = new Date();
    const validUntilElement = document.getElementById('valid_until');
    const startDateElement = document.getElementById('start_date');
    
    // Set valid until to 30 days from now if not set
    if (validUntilElement && !validUntilElement.value) {
        const validUntil = new Date();
        validUntil.setDate(today.getDate() + 30);
        validUntilElement.value = validUntil.toISOString().split('T')[0];
    }
    
    // Set start date to next Monday if not set
    if (startDateElement && !startDateElement.value) {
        const nextMonday = new Date();
        const daysUntilMonday = (8 - nextMonday.getDay()) % 7;
        nextMonday.setDate(today.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
        startDateElement.value = nextMonday.toISOString().split('T')[0];
    }
}

// Auto-calculate due date based on timeline
function calculateDueDate() {
    const timelineElement = document.getElementById('proposed_timeline');
    const startDateElement = document.getElementById('start_date');
    const dueDateElement = document.getElementById('due_date');
    
    if (!timelineElement.value || !startDateElement.value || dueDateElement.value) {
        return; // Don't auto-calculate if due date is already set
    }
    
    const timeline = timelineElement.value.toLowerCase();
    const startDate = new Date(startDateElement.value);
    
    if (isNaN(startDate.getTime())) return;
    
    let daysToAdd = 0;
    
    // Parse common timeline formats
    if (timeline.includes('week')) {
        const weeks = parseInt(timeline.match(/(\d+)/)?.[1] || '0');
        daysToAdd = weeks * 7;
    } else if (timeline.includes('month')) {
        const months = parseInt(timeline.match(/(\d+)/)?.[1] || '0');
        daysToAdd = months * 30; // Approximate
    } else if (timeline.includes('day')) {
        const days = parseInt(timeline.match(/(\d+)/)?.[1] || '0');
        daysToAdd = days;
    }
    
    if (daysToAdd > 0) {
        const dueDate = new Date(startDate);
        dueDate.setDate(startDate.getDate() + daysToAdd);
        dueDateElement.value = dueDate.toISOString().split('T')[0];
    }
}

// Event listeners for date calculations
document.addEventListener('DOMContentLoaded', function() {
    const timelineElement = document.getElementById('proposed_timeline');
    const startDateElement = document.getElementById('start_date');
    
    if (timelineElement) {
        timelineElement.addEventListener('blur', calculateDueDate);
    }
    
    if (startDateElement) {
        startDateElement.addEventListener('change', calculateDueDate);
    }
});

// Form validation
function validateForm() {
    const requiredFields = [
        { id: 'client_id', name: 'Client' },
        { id: 'title', name: 'Proposal Title' },
        { id: 'description', name: 'Project Description' },
        { id: 'proposed_timeline', name: 'Timeline' },
        { id: 'amount', name: 'Total Cost' }
    ];
    
    const errors = [];
    
    requiredFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element.value.trim()) {
            errors.push(field.name + ' is required');
            element.classList.add('is-invalid');
        } else {
            element.classList.remove('is-invalid');
        }
    });
    
    // Validate amount is positive
    const amountElement = document.getElementById('amount');
    if (amountElement.value && parseFloat(amountElement.value) <= 0) {
        errors.push('Total cost must be greater than 0');
        amountElement.classList.add('is-invalid');
    }
    
    // Validate dates
    const startDate = document.getElementById('start_date').value;
    const dueDate = document.getElementById('due_date').value;
    
    if (startDate && dueDate && new Date(startDate) >= new Date(dueDate)) {
        errors.push('Due date must be after start date');
        document.getElementById('due_date').classList.add('is-invalid');
    } else {
        document.getElementById('due_date').classList.remove('is-invalid');
    }
    
    if (errors.length > 0) {
        alert('Please fix the following errors:\n\n' + errors.join('\n'));
        return false;
    }
    
    return true;
}

// Form submission
document.getElementById('proposalForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
        return;
    }
    
    const formData = new FormData(this);
    const method = this.querySelector('input[name="_method"]')?.value || 'POST';
    
    // Convert FormData to regular object for JSON
    const data = {};
    
    formData.forEach((value, key) => {
        if (key !== '_method') {
            data[key] = value;
        }
    });
    
    // Show loading state
    const submitButton = this.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
    
    fetch(this.action, {
        method: method === 'PUT' ? 'PUT' : 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
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
        } else {
            throw new Error(data.error || 'Save failed');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error saving proposal. Please try again.');
        
        // Reset button state
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    });
});

// Add styles for validation
const style = document.createElement('style');
style.textContent = `
    .form-control.is-invalid {
        border-color: var(--danger-color);
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
    }
    
    .form-control.is-invalid:focus {
        border-color: var(--danger-color);
        box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
    }
`;
document.head.appendChild(style);
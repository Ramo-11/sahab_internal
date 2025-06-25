// Proposal Form JavaScript (Simplified - No Line Items)

let selectedFeatures = [];

// Initialize form
document.addEventListener('DOMContentLoaded', function() {
    // Handle URL parameters for pre-filling form (for duplicate functionality)
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('client_id')) {
        document.getElementById('client_id').value = urlParams.get('client_id');
    }
    if (urlParams.get('title')) {
        document.getElementById('title').value = urlParams.get('title');
    }
    if (urlParams.get('description')) {
        document.getElementById('description').value = urlParams.get('description');
    }
    if (urlParams.get('amount')) {
        document.getElementById('amount').value = urlParams.get('amount');
    }
    if (urlParams.get('technical_highlights')) {
        document.getElementById('technical_highlights').value = urlParams.get('technical_highlights');
    }
    if (urlParams.get('proposed_timeline')) {
        document.getElementById('proposed_timeline').value = urlParams.get('proposed_timeline');
    }
    
    // Load existing features if editing
    loadExistingFeatures();
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
            <button type="button" class="remove-feature" onclick="removeFeature('${feature}')">&times;</button>
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
    
    if (existingFeatures) {
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

// Form submission
document.getElementById('proposalForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const method = this.querySelector('input[name="_method"]')?.value || 'POST';
    
    // Convert FormData to regular object for JSON
    const data = {};
    
    formData.forEach((value, key) => {
        if (key !== '_method') {
            data[key] = value;
        }
    });
    
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
    });
});
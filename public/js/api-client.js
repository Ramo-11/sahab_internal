// API Client for making requests
const API = {
    // Base request method
    request: async (url, options = {}) => {
        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
                body: options.body,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    },

    // GET request
    get: (url, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        const fullUrl = queryString ? `${url}?${queryString}` : url;
        return API.request(fullUrl, { method: 'GET' });
    },

    // POST request
    post: (url, data = {}) => {
        return API.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
    },

    // PUT request
    put: (url, data = {}) => {
        return API.request(url, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    // DELETE request
    delete: (url) => {
        return API.request(url, { method: 'DELETE' });
    },

    // Client endpoints
    clients: {
        getAll: (params) => API.get('/api/clients', params),
        get: (id) => API.get(`/api/clients/${id}`),
        create: (data) => API.post('/api/clients', data),
        update: (id, data) => API.put(`/api/clients/${id}`, data),
        delete: (id) => API.delete(`/api/clients/${id}`),
        updateNotes: (id, notes) => API.post(`/api/clients/${id}/notes`, notes),
        getHistory: (id) => API.get(`/api/clients/${id}/history`),
    },

    // Proposal endpoints
    proposals: {
        getAll: (params) => API.get('/api/proposals', params),
        get: (id) => API.get(`/api/proposals/${id}`),
        create: (data) => API.post('/api/proposals', data),
        update: (id, data) => API.put(`/api/proposals/${id}`, data),
        delete: (id) => API.delete(`/api/proposals/${id}`),
        send: (id) => API.post(`/api/proposals/${id}/send`),
        updateStatus: (id, status) => API.post(`/api/proposals/${id}/status`, status),
    },

    // Invoice endpoints
    invoices: {
        getAll: (params) => API.get('/api/invoices', params),
        get: (id) => API.get(`/api/invoices/${id}`),
        create: (data) => API.post('/api/invoices', data),
        update: (id, data) => API.put(`/api/invoices/${id}`, data),
        delete: (id) => API.delete(`/api/invoices/${id}`),
        send: (id) => API.post(`/api/invoices/${id}/send`),
        recordPayment: (id, payment) => API.post(`/api/invoices/${id}/payment`, payment),
        sendReminder: (id, data) => API.post(`/api/invoices/${id}/reminder`, data),
    },

    // Dashboard endpoints
    dashboard: {
        getStats: (period) => API.get('/api/dashboard/stats', { period }),
        getRecent: () => API.get('/api/dashboard/recent'),
        getAlerts: () => API.get('/api/dashboard/alerts'),
    },

    // Analysis endpoints
    analysis: {
        getRevenue: (params) => API.get('/api/analysis/revenue', params),
        getClients: (params) => API.get('/api/analysis/clients', params),
        getProposals: (params) => API.get('/api/analysis/proposals', params),
        getInvoices: (params) => API.get('/api/analysis/invoices', params),
        getTrends: (params) => API.get('/api/analysis/trends', params),
        export: (params) => API.get('/api/analysis/export', params),
    },
};

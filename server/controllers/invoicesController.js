const { db } = require('../../models/database');

const getAllInvoices = (req, res) => {
  try {
    const query = `
      SELECT 
        i.*,
        c.name as client_name,
        c.company as client_company,
        p.title as proposal_title
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN proposals p ON i.proposal_id = p.id
      ORDER BY i.created_at DESC
    `;

    db.all(query, (err, invoices) => {
      if (err) {
        console.error('Error fetching invoices:', err);
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      res.render('invoices/index', {
        title: 'Invoices',
        appName: process.env.APP_NAME,
        invoices: invoices || []
      });
    });
  } catch (error) {
    console.error('Error in getAllInvoices:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

const getInvoiceById = (req, res) => {
  try {
    const invoiceId = req.params.id;

    // Get invoice with client details
    const invoiceQuery = `
      SELECT 
        i.*,
        c.name as client_name,
        c.company as client_company,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        c.city as client_city,
        c.state as client_state,
        c.zip_code as client_zip_code,
        p.title as proposal_title
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      LEFT JOIN proposals p ON i.proposal_id = p.id
      WHERE i.id = ?
    `;

    db.get(invoiceQuery, [invoiceId], (err, invoice) => {
      if (err) {
        console.error('Error fetching invoice:', err);
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      if (!invoice) {
        return res.status(404).render('404', {
          title: '404 - Invoice Not Found',
          appName: process.env.APP_NAME
        });
      }

      // Get invoice items
      db.all('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', 
        [invoiceId], 
        (err, items) => {
          if (err) {
            console.error('Error fetching invoice items:', err);
            items = [];
          }

          res.render('invoices/detail', {
            title: `${invoice.invoice_number} - Invoice Details`,
            appName: process.env.APP_NAME,
            invoice,
            items: items || []
          });
        }
      );
    });
  } catch (error) {
    console.error('Error in getInvoiceById:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

const createInvoice = (req, res) => {
  try {
    const {
      client_id,
      proposal_id,
      title,
      description,
      amount,
      tax_amount,
      due_date,
      items
    } = req.body;

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}`;
    const totalAmount = (parseFloat(amount) || 0) + (parseFloat(tax_amount) || 0);

    const query = `
      INSERT INTO invoices (
        client_id, proposal_id, invoice_number, title, description, 
        amount, tax_amount, total_amount, due_date, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const values = [
      client_id,
      proposal_id || null,
      invoiceNumber,
      title,
      description || null,
      amount || 0,
      tax_amount || 0,
      totalAmount,
      due_date || null
    ];

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error creating invoice:', err);
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      const invoiceId = this.lastID;

      // Insert invoice items if provided
      if (items && Array.isArray(items) && items.length > 0) {
        const itemQuery = `
          INSERT INTO invoice_items (invoice_id, description, quantity, rate, amount)
          VALUES (?, ?, ?, ?, ?)
        `;

        let completedItems = 0;
        const totalItems = items.length;

        items.forEach(item => {
          const itemAmount = (item.quantity || 1) * (item.rate || 0);
          db.run(itemQuery, [
            invoiceId,
            item.description,
            item.quantity || 1,
            item.rate || 0,
            itemAmount
          ], (err) => {
            if (err) {
              console.error('Error inserting invoice item:', err);
            }
            
            completedItems++;
            if (completedItems === totalItems) {
              res.redirect(`/invoices/${invoiceId}`);
            }
          });
        });
      } else {
        res.redirect(`/invoices/${invoiceId}`);
      }
    });
  } catch (error) {
    console.error('Error in createInvoice:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

const updateInvoice = (req, res) => {
  try {
    const invoiceId = req.params.id;
    const {
      client_id,
      proposal_id,
      title,
      description,
      amount,
      tax_amount,
      status,
      due_date
    } = req.body;

    const totalAmount = (parseFloat(amount) || 0) + (parseFloat(tax_amount) || 0);

    const query = `
      UPDATE invoices 
      SET client_id = ?, proposal_id = ?, title = ?, description = ?, 
          amount = ?, tax_amount = ?, total_amount = ?, status = ?, 
          due_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    const values = [
      client_id,
      proposal_id || null,
      title,
      description || null,
      amount || 0,
      tax_amount || 0,
      totalAmount,
      status || 'pending',
      due_date || null,
      invoiceId
    ];

    db.run(query, values, function(err) {
      if (err) {
        console.error('Error updating invoice:', err);
        return res.status(500).render('error', {
          title: 'Error',
          appName: process.env.APP_NAME,
          error: err
        });
      }

      res.redirect(`/invoices/${invoiceId}`);
    });
  } catch (error) {
    console.error('Error in updateInvoice:', error);
    res.status(500).render('error', {
      title: 'Error',
      appName: process.env.APP_NAME,
      error
    });
  }
};

const markInvoicePaid = (req, res) => {
  try {
    const invoiceId = req.params.id;

    const query = `
      UPDATE invoices 
      SET status = 'paid', paid_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;

    db.run(query, [invoiceId], function(err) {
      if (err) {
        console.error('Error marking invoice as paid:', err);
        return res.status(500).json({ error: 'Failed to mark invoice as paid' });
      }

      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error in markInvoicePaid:', error);
    res.status(500).json({ error: 'Failed to mark invoice as paid' });
  }
};

const deleteInvoice = (req, res) => {
  try {
    const invoiceId = req.params.id;

    // Delete invoice items first
    db.run('DELETE FROM invoice_items WHERE invoice_id = ?', [invoiceId], (err) => {
      if (err) {
        console.error('Error deleting invoice items:', err);
        return res.status(500).json({ error: 'Failed to delete invoice' });
      }

      // Then delete the invoice
      db.run('DELETE FROM invoices WHERE id = ?', [invoiceId], function(err) {
        if (err) {
          console.error('Error deleting invoice:', err);
          return res.status(500).json({ error: 'Failed to delete invoice' });
        }

        res.json({ success: true });
      });
    });
  } catch (error) {
    console.error('Error in deleteInvoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
};

module.exports = {
  getAllInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  markInvoicePaid,
  deleteInvoice
};
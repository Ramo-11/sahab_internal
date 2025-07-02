const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

class PDFService {
  constructor() {
    this.browser = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async generateProposalPDF(proposal, items = [], clientInfo = {}) {
    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      // Generate HTML content for the proposal
      const htmlContent = this.generateProposalHTML(proposal, items, clientInfo);

      // Set content and wait for it to load
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      // Generate PDF with custom styling
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
            <span class="title">${proposal.title}</span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; width: 100%; text-align: center; color: #666; margin-top: 10px;">
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
            <span style="float: right; margin-right: 15mm;">Generated on ${new Date().toLocaleDateString()}</span>
          </div>
        `
      });

      return pdfBuffer;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF: ' + error.message);
    }
  }

  generateProposalHTML(proposal, items, clientInfo) {
    const currentDate = new Date().toLocaleDateString();
    const validUntil = proposal.valid_until ? new Date(proposal.valid_until).toLocaleDateString() : 'No expiry date';
    
    let itemsHTML = '';
    let subtotal = 0;

    if (items && items.length > 0) {
      items.forEach(item => {
        const amount = item.amount || 0;
        subtotal += amount;
        itemsHTML += `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${item.description || ''}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity || 1}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${(item.rate || 0).toFixed(2)}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${amount.toFixed(2)}</td>
          </tr>
        `;
      });
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Proposal - ${proposal.title}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #1f2937;
            background: white;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
          }
          
          .proposal-title {
            font-size: 36px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          
          .proposal-subtitle {
            font-size: 16px;
            color: #6b7280;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 40px;
          }
          
          .info-section h3 {
            font-size: 18px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 5px;
          }
          
          .info-section p {
            margin-bottom: 8px;
            color: #4b5563;
          }
          
          .company-info {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
          }
          
          .content-section {
            margin-bottom: 40px;
          }
          
          .content-section h2 {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 20px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 10px;
          }
          
          .description {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #10b981;
            margin-bottom: 30px;
            line-height: 1.8;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          }
          
          .items-table th {
            background: #f3f4f6;
            padding: 15px 12px;
            text-align: left;
            font-weight: bold;
            color: #1f2937;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .items-table th:last-child,
          .items-table td:last-child {
            text-align: right;
          }
          
          .items-table th:nth-child(3),
          .items-table td:nth-child(3) {
            text-align: center;
          }
          
          .total-section {
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
            border: 2px solid #e5e7eb;
            text-align: right;
            margin-bottom: 40px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 16px;
          }
          
          .total-final {
            font-size: 20px;
            font-weight: bold;
            color: #10b981;
            border-top: 2px solid #e5e7eb;
            padding-top: 15px;
            margin-top: 15px;
          }
          
          .terms-section {
            background: #fefbf3;
            padding: 25px;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
            margin-top: 40px;
          }
          
          .terms-section h3 {
            color: #92400e;
            margin-bottom: 15px;
          }
          
          .signature-section {
            margin-top: 60px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
          }
          
          .signature-box {
            text-align: center;
            padding: 20px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }
          
          .signature-line {
            border-bottom: 2px solid #6b7280;
            margin: 40px 0 10px 0;
            height: 2px;
          }
          
          @media print {
            .container {
              padding: 0;
            }
            
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1 class="proposal-title">BUSINESS PROPOSAL</h1>
            <p class="proposal-subtitle">Professional Services Proposal</p>
          </div>
          
          <!-- Company and Client Info -->
          <div class="info-grid">
            <div class="info-section">
              <div class="company-info">
                <h3>From:</h3>
                <p><strong>${process.env.COMPANY_NAME || 'Your Company Name'}</strong></p>
                <p>${process.env.COMPANY_ADDRESS || 'Your Company Address'}</p>
                <p>${process.env.COMPANY_CITY || 'City'}, ${process.env.COMPANY_STATE || 'State'} ${process.env.COMPANY_ZIP || 'ZIP'}</p>
                <p>Email: ${process.env.COMPANY_EMAIL || 'contact@company.com'}</p>
                <p>Phone: ${process.env.COMPANY_PHONE || '(555) 123-4567'}</p>
              </div>
            </div>
            
            <div class="info-section">
              <h3>To:</h3>
              <p><strong>${clientInfo.name || proposal.client_name || 'Client Name'}</strong></p>
              ${clientInfo.company ? `<p>${clientInfo.company}</p>` : ''}
              ${clientInfo.address ? `<p>${clientInfo.address}</p>` : ''}
              ${clientInfo.city || clientInfo.state || clientInfo.zip_code ? 
                `<p>${clientInfo.city || ''} ${clientInfo.state || ''} ${clientInfo.zip_code || ''}</p>` : ''}
              ${clientInfo.email ? `<p>Email: ${clientInfo.email}</p>` : ''}
              ${clientInfo.phone ? `<p>Phone: ${clientInfo.phone}</p>` : ''}
              
              <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                <p><strong>Proposal Date:</strong> ${currentDate}</p>
                <p><strong>Valid Until:</strong> ${validUntil}</p>
                <p><strong>Proposal ID:</strong> #${proposal.id}</p>
              </div>
            </div>
          </div>
          
          <!-- Project Title -->
          <div class="content-section">
            <h2>${proposal.title || 'Project Proposal'}</h2>
            ${proposal.description ? `
              <div class="description">
                ${proposal.description.replace(/\n/g, '<br>')}
              </div>
            ` : ''}
          </div>
          
          <!-- Items and Services -->
          ${items && items.length > 0 ? `
            <div class="content-section">
              <h2>Scope of Work & Pricing</h2>
              <table class="items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th style="text-align: center;">Quantity</th>
                    <th style="text-align: right;">Rate</th>
                    <th style="text-align: right;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHTML}
                </tbody>
              </table>
              
              <div class="total-section">
                <div class="total-row">
                  <span>Subtotal:</span>
                  <span>$${subtotal.toFixed(2)}</span>
                </div>
                <div class="total-row total-final">
                  <span>Total Project Cost:</span>
                  <span>$${(proposal.amount || subtotal).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ` : ''}
          
          <!-- Terms and Conditions -->
          <div class="terms-section">
            <h3>Terms & Conditions</h3>
            <p><strong>Proposal Validity:</strong> This proposal is valid until ${validUntil}.</p>
            <p><strong>Payment Terms:</strong> 50% deposit required upon project acceptance, remaining 50% due upon completion.</p>
            <p><strong>Project Timeline:</strong> Work will commence within 5 business days of signed agreement and deposit receipt.</p>
            <p><strong>Scope Changes:</strong> Any changes to the agreed scope will be documented and may affect timeline and cost.</p>
            <p><strong>Acceptance:</strong> This proposal becomes a binding agreement upon client signature and deposit payment.</p>
          </div>
          
          <!-- Signature Section -->
          <div class="signature-section">
            <div class="signature-box">
              <p><strong>Client Acceptance</strong></p>
              <div class="signature-line"></div>
              <p>Signature</p>
              <br>
              <div class="signature-line"></div>
              <p>Date</p>
            </div>
            
            <div class="signature-box">
              <p><strong>Company Representative</strong></p>
              <div class="signature-line"></div>
              <p>${process.env.COMPANY_REP_NAME || 'Your Name'}</p>
              <p>${process.env.COMPANY_REP_TITLE || 'Title'}</p>
              <br>
              <div class="signature-line"></div>
              <p>Date</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async generateInvoicePDF(invoice, items = [], clientInfo = {}) {
    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      const htmlContent = this.generateInvoiceHTML(invoice, items, clientInfo);

      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
            <span>Invoice ${invoice.invoice_number}</span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `
      });

      return pdfBuffer;
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw new Error('Failed to generate invoice PDF: ' + error.message);
    }
  }

  generateInvoiceHTML(invoice, items, clientInfo) {
    // Similar structure to proposal but for invoices
    // Implementation details for invoice PDF generation
    return `<!-- Invoice HTML template similar to proposal but simpler -->`;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = new PDFService();
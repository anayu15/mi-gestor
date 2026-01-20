import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { query } from '../config/database';
import config from '../config';

interface InvoiceData {
  id: string;
  numero_factura: string;
  fecha_emision: string;
  concepto: string;
  descripcion_detallada?: string;
  periodo_facturacion_inicio?: string;
  periodo_facturacion_fin?: string;
  base_imponible: number;
  tipo_iva: number;
  cuota_iva: number;
  tipo_irpf: number;
  cuota_irpf: number;
  total_factura: number;
  // Company data
  razon_social?: string;
  nombre_completo: string;
  nif: string;
  direccion?: string;
  codigo_postal?: string;
  ciudad?: string;
  provincia?: string;
  telefono?: string;
  email_facturacion?: string;
  iban?: string;
  logo_url?: string;
  notas_factura?: string;
  // Client data
  cliente_razon_social: string;
  cliente_cif: string;
  cliente_direccion?: string;
  cliente_cp?: string;
  cliente_ciudad?: string;
  cliente_provincia?: string;
  cliente_email?: string;
  cliente_telefono?: string;
  cliente_persona_contacto?: string;
}

export class InvoicePDFService {
  /**
   * Generate PDF for an invoice
   * @param invoiceId Invoice UUID
   * @param userId User UUID
   * @returns Relative path to generated PDF
   */
  static async generateInvoicePDF(invoiceId: string, userId: string): Promise<string> {
    console.log(`PDF Service: Received invoiceId=${invoiceId}, userId=${userId}`);

    // Fetch complete invoice data with billing config
    // Priority: 1) Specific billing config on invoice, 2) Active billing config, 3) Users table
    const result = await query(
      `SELECT
        i.*,
        c.nombre as cliente_razon_social,
        c.cif as cliente_cif,
        c.direccion as cliente_direccion,
        c.codigo_postal as cliente_cp,
        c.ciudad as cliente_ciudad,
        c.provincia as cliente_provincia,
        c.email as cliente_email,
        c.telefono as cliente_telefono,
        c.persona_contacto as cliente_persona_contacto,
        COALESCE(df_specific.razon_social, df_active.razon_social, u.razon_social) as razon_social,
        u.nombre_completo,
        COALESCE(df_specific.nif, df_active.nif, u.nif) as nif,
        COALESCE(df_specific.direccion, df_active.direccion, u.direccion) as direccion,
        COALESCE(df_specific.codigo_postal, df_active.codigo_postal, u.codigo_postal) as codigo_postal,
        COALESCE(df_specific.ciudad, df_active.ciudad, u.ciudad) as ciudad,
        COALESCE(df_specific.provincia, df_active.provincia, u.provincia) as provincia,
        COALESCE(df_specific.telefono, df_active.telefono, u.telefono) as telefono,
        COALESCE(df_specific.email_facturacion, df_active.email_facturacion, u.email_facturacion) as email_facturacion,
        COALESCE(df_specific.iban, df_active.iban, u.iban) as iban,
        COALESCE(df_specific.logo_url, df_active.logo_url, u.logo_url) as logo_url,
        COALESCE(df_specific.notas_factura, df_active.notas_factura, u.notas_factura) as notas_factura
      FROM facturas_emitidas i
      INNER JOIN clientes c ON i.cliente_id = c.id
      INNER JOIN users u ON i.user_id = u.id
      LEFT JOIN datos_facturacion df_specific ON i.datos_facturacion_id = df_specific.id
      LEFT JOIN datos_facturacion df_active ON df_active.user_id = i.user_id AND df_active.activo = true AND i.datos_facturacion_id IS NULL
      WHERE i.id = $1 AND i.user_id = $2`,
      [invoiceId, userId]
    );

    console.log(`PDF Service: Query returned ${result.rows.length} rows`);

    if (result.rows.length === 0) {
      throw new Error('Factura no encontrada');
    }

    const invoice: InvoiceData = result.rows[0];

    // Validate required company data
    if (!invoice.direccion || !invoice.ciudad) {
      throw new Error(
        'Faltan datos de empresa. Configure su dirección en Ajustes → Configuración de Facturación'
      );
    }

    if (!invoice.iban) {
      throw new Error(
        'Falta el IBAN. Configure su cuenta bancaria en Ajustes → Configuración de Facturación'
      );
    }

    // Create PDF
    const pdfPath = await this.createPDF(invoice, userId);

    // Update database
    await query(
      'UPDATE facturas_emitidas SET pdf_url = $1, pdf_generado = true WHERE id = $2',
      [pdfPath, invoiceId]
    );

    return pdfPath;
  }

  /**
   * Create the PDF document
   * @param invoice Invoice data
   * @param userId User ID
   * @returns Relative path to PDF
   */
  private static async createPDF(invoice: InvoiceData, userId: string): Promise<string> {
    // Setup file path
    const year = new Date(invoice.fecha_emision).getFullYear();
    const userIdStr = String(userId);
    const pdfDir = path.join(config.upload.dir, 'invoices', userIdStr, year.toString());

    // Ensure directory exists with proper error handling
    try {
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
        console.log(`PDF Service: Created directory ${pdfDir}`);
      }
    } catch (dirError: any) {
      throw new Error(`No se pudo crear el directorio para PDFs: ${dirError.message}`);
    }

    const filename = `factura_${invoice.numero_factura.replace(/[\/\\]/g, '_')}.pdf`;
    const pdfPath = path.join(pdfDir, filename);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Factura ${invoice.numero_factura}`,
        Author: invoice.razon_social || invoice.nombre_completo,
        Subject: `Factura ${invoice.numero_factura}`,
        Creator: 'MiGestor',
      },
    });

    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // Build PDF content
    await this.buildPDFContent(doc, invoice);

    doc.end();

    // Wait for file to be written with timeout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout al generar PDF. El proceso tardó demasiado.'));
      }, 30000); // 30 second timeout

      stream.on('finish', () => {
        clearTimeout(timeout);
        console.log(`PDF Service: File written successfully to ${pdfPath}`);
        resolve();
      });

      stream.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Error al escribir PDF: ${err.message}`));
      });
    });

    // Verify file was created
    if (!fs.existsSync(pdfPath)) {
      throw new Error('El archivo PDF no se creó correctamente');
    }

    // Return relative path
    return path.join('invoices', userIdStr, year.toString(), filename);
  }

  /**
   * Build the PDF content with elegant professional styling
   * @param doc PDF document
   * @param invoice Invoice data
   */
  private static async buildPDFContent(doc: typeof PDFDocument, invoice: InvoiceData) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 45;
    const contentWidth = pageWidth - 2 * margin;

    // Elegant color palette
    const accentColor = '#2563eb';      // Clean blue
    const textDark = '#1f2937';         // Dark gray for main text
    const textMuted = '#6b7280';        // Muted gray for secondary
    const lineColor = '#d1d5db';        // Light gray for lines

    let y = margin;

    // ========== HEADER: Two columns ==========
    const rightColWidth = 150;
    const leftColWidth = contentWidth - rightColWidth - 20;
    const rightColX = pageWidth - margin - rightColWidth;

    // Left column: Company info with logo
    const logoSize = 50;
    let logoDrawn = false;

    if (invoice.logo_url) {
      const logoPath = path.join(config.upload.dir, invoice.logo_url);
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, margin, y, { width: logoSize, height: logoSize, fit: [logoSize, logoSize] });
          logoDrawn = true;
        } catch (error) {
          console.error('Error loading logo:', error);
        }
      }
    }

    if (!logoDrawn) {
      const companyName = invoice.razon_social || invoice.nombre_completo;
      const initials = this.getInitials(companyName);
      doc.roundedRect(margin, y, logoSize, logoSize, 6).fill(accentColor);
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#ffffff')
        .text(initials, margin, y + 15, { width: logoSize, align: 'center' });
    }

    // Company details next to logo
    const companyX = margin + logoSize + 15;
    const companyTextWidth = leftColWidth - logoSize - 15;
    const companyName = invoice.razon_social || invoice.nombre_completo;

    doc.fontSize(13).font('Helvetica-Bold').fillColor(textDark)
      .text(companyName, companyX, y, { width: companyTextWidth });

    let infoY = y + 16;
    doc.fontSize(8.5).font('Helvetica').fillColor(textMuted);
    doc.text(`NIF/CIF: ${invoice.nif}`, companyX, infoY);
    infoY += 11;

    if (invoice.direccion) {
      const addressLine = [invoice.direccion, invoice.codigo_postal, invoice.ciudad].filter(Boolean).join(', ');
      doc.text(addressLine, companyX, infoY, { width: companyTextWidth });
      infoY += 11;
    }

    // Contact info (email and phone)
    const contactParts: string[] = [];
    if (invoice.telefono) contactParts.push(invoice.telefono);
    if (invoice.email_facturacion) contactParts.push(invoice.email_facturacion);
    if (contactParts.length > 0) {
      doc.text(contactParts.join('  |  '), companyX, infoY, { width: companyTextWidth });
    }

    // Right column: Invoice title and details
    doc.fontSize(22).font('Helvetica-Bold').fillColor(textDark)
      .text('FACTURA', rightColX, y, { width: rightColWidth, align: 'right' });

    doc.fontSize(10).font('Helvetica').fillColor(textMuted);
    doc.text(`N.º ${invoice.numero_factura}`, rightColX, y + 26, { width: rightColWidth, align: 'right' });
    doc.text(this.formatDate(invoice.fecha_emision), rightColX, y + 40, { width: rightColWidth, align: 'right' });

    y += 75;

    // Separator line
    doc.moveTo(margin, y).lineTo(pageWidth - margin, y).lineWidth(0.5).strokeColor(lineColor).stroke();
    y += 18;

    // ========== CLIENT INFO ==========
    doc.fontSize(9).font('Helvetica-Bold').fillColor(accentColor).text('FACTURAR A', margin, y);
    y += 14;

    doc.fontSize(12).font('Helvetica-Bold').fillColor(textDark)
      .text(invoice.cliente_razon_social, margin, y);
    y += 15;

    doc.fontSize(9).font('Helvetica').fillColor(textMuted);
    doc.text(`NIF/CIF: ${invoice.cliente_cif}`, margin, y);
    y += 12;

    if (invoice.cliente_direccion) {
      const clientAddressLine = [
        invoice.cliente_direccion,
        invoice.cliente_cp,
        invoice.cliente_ciudad,
        invoice.cliente_provincia
      ].filter(Boolean).join(', ');
      doc.text(clientAddressLine, margin, y, { width: contentWidth });
      y += 12;
    }

    // Client contact info
    const clientContactParts: string[] = [];
    if (invoice.cliente_telefono) clientContactParts.push(invoice.cliente_telefono);
    if (invoice.cliente_email) clientContactParts.push(invoice.cliente_email);
    if (clientContactParts.length > 0) {
      doc.text(clientContactParts.join('  |  '), margin, y);
      y += 12;
    }

    y += 12;

    // ========== CONCEPT ==========
    doc.fontSize(9).font('Helvetica-Bold').fillColor(accentColor).text('CONCEPTO', margin, y);
    y += 14;

    doc.fontSize(10).font('Helvetica').fillColor(textDark)
      .text(invoice.concepto, margin, y, { width: contentWidth });
    y += doc.heightOfString(invoice.concepto, { width: contentWidth }) + 3;

    if (invoice.descripcion_detallada) {
      doc.fontSize(9).fillColor(textMuted)
        .text(invoice.descripcion_detallada, margin, y, { width: contentWidth });
      y += doc.heightOfString(invoice.descripcion_detallada, { width: contentWidth }) + 3;
    }

    if (invoice.periodo_facturacion_inicio && invoice.periodo_facturacion_fin) {
      doc.fontSize(8).font('Helvetica-Oblique').fillColor(textMuted)
        .text(`Periodo: ${this.formatDate(invoice.periodo_facturacion_inicio)} - ${this.formatDate(invoice.periodo_facturacion_fin)}`, margin, y);
      y += 12;
    }

    y += 18;

    // ========== AMOUNTS - Right aligned clean style ==========
    const amountsX = margin + contentWidth * 0.50;
    const amountsWidth = contentWidth * 0.50;
    const labelWidth = amountsWidth * 0.55;
    const valueWidth = amountsWidth * 0.45;
    const rowH = 20;

    // Base Imponible
    doc.fontSize(9.5).font('Helvetica').fillColor(textDark)
      .text('Base Imponible', amountsX, y, { width: labelWidth })
      .text(this.formatEuro(invoice.base_imponible), amountsX + labelWidth, y, { width: valueWidth, align: 'right' });
    y += rowH;

    // IVA
    doc.fontSize(9.5).font('Helvetica').fillColor(textDark)
      .text(`IVA (${this.formatPercentage(invoice.tipo_iva)})`, amountsX, y, { width: labelWidth })
      .text(this.formatEuro(invoice.cuota_iva), amountsX + labelWidth, y, { width: valueWidth, align: 'right' });
    y += rowH;

    // IRPF (if applicable)
    if (invoice.cuota_irpf > 0) {
      doc.fontSize(9.5).font('Helvetica').fillColor('#dc2626')
        .text(`Retención IRPF (${this.formatPercentage(invoice.tipo_irpf)})`, amountsX, y, { width: labelWidth })
        .text(`-${this.formatEuro(invoice.cuota_irpf)}`, amountsX + labelWidth, y, { width: valueWidth, align: 'right' });
      y += rowH;
    }

    // Line before total
    y += 5;
    doc.moveTo(amountsX, y).lineTo(pageWidth - margin, y).lineWidth(1).strokeColor(textDark).stroke();
    y += 12;

    // Total
    doc.fontSize(13).font('Helvetica-Bold').fillColor(textDark)
      .text('TOTAL', amountsX, y, { width: labelWidth })
      .text(this.formatEuro(invoice.total_factura), amountsX + labelWidth, y, { width: valueWidth, align: 'right' });

    y += 35;

    // ========== PAYMENT INFO ==========
    doc.fontSize(9).font('Helvetica-Bold').fillColor(accentColor).text('FORMA DE PAGO', margin, y);
    y += 14;

    doc.fontSize(9.5).font('Helvetica').fillColor(textDark)
      .text('Transferencia bancaria', margin, y);
    y += 14;

    if (invoice.iban) {
      doc.fontSize(9.5).font('Helvetica').fillColor(textMuted).text('IBAN: ', margin, y, { continued: true })
        .font('Helvetica-Bold').fillColor(textDark).text(this.formatIBAN(invoice.iban));
    }

    // ========== FOOTER ==========
    const footerY = pageHeight - margin - 25;

    doc.moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).lineWidth(0.5).strokeColor(lineColor).stroke();

    const noteText = invoice.notas_factura ||
      'En aplicación del régimen especial de criterio de caja para el IVA, la fecha de devengo del impuesto será la fecha de cobro de la factura.';

    doc.fontSize(7).font('Helvetica-Oblique').fillColor(textMuted)
      .text(noteText, margin, footerY + 8, { width: contentWidth, align: 'center' });
  }

  /**
   * Get initials from company name for logo placeholder
   * @param name Company or person name
   * @returns 1-2 character initials
   */
  private static getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '?';
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  /**
   * Format number as Euro currency
   * @param amount Amount in euros
   * @returns Formatted string
   */
  private static formatEuro(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  /**
   * Format date to Spanish format DD/MM/YYYY
   * @param dateString ISO date string
   * @returns Formatted date
   */
  private static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Format percentage
   * @param value Percentage value
   * @returns Formatted percentage
   */
  private static formatPercentage(value: number): string {
    return `${value}%`;
  }

  /**
   * Format IBAN with spaces every 4 characters
   * @param iban IBAN string
   * @returns Formatted IBAN
   */
  private static formatIBAN(iban: string): string {
    const cleanedIBAN = iban.replace(/\s/g, '');
    return cleanedIBAN.match(/.{1,4}/g)?.join(' ') || iban;
  }
}

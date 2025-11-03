// src/features/jobs/utils/offerPdfExport.ts
import jsPDF from 'jspdf'
import type { OfferDetail } from '../types'

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 2,
  }).format(amount)
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('nb-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Export an offer as PDF
 */
export async function exportOfferAsPDF(offer: OfferDetail): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Helper to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
    }
  }

  // Title
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text(offer.title, margin, yPos)
  yPos += 10

  // Offer metadata
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Version: ${offer.version_number}`, margin, yPos)
  yPos += 5
  doc.text(`Status: ${offer.status}`, margin, yPos)
  yPos += 5
  doc.text(`Type: ${offer.offer_type === 'technical' ? 'Technical' : 'Pretty'}`, margin, yPos)
  yPos += 5
  if (offer.created_at) {
    doc.text(`Created: ${formatDate(offer.created_at)}`, margin, yPos)
    yPos += 5
  }
  yPos += 5

  // Equipment section
  if (offer.groups && offer.groups.length > 0) {
    checkPageBreak(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Equipment', margin, yPos)
    yPos += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    for (const group of offer.groups) {
      checkPageBreak(20)
      
      // Group header
      doc.setFont('helvetica', 'bold')
      doc.text(group.group_name, margin, yPos)
      yPos += 6

      // Items in group
      doc.setFont('helvetica', 'normal')
      if (group.items && group.items.length > 0) {
        const startX = margin + 5
        for (const item of group.items) {
          checkPageBreak(8)
          const itemName = item.item?.name || 'Unknown Item'
          const qty = item.quantity
          const unitPrice = formatCurrency(item.unit_price)
          const total = formatCurrency(item.unit_price * item.quantity)
          
          doc.text(`${itemName}`, startX, yPos)
          const qtyX = startX + 80
          const priceX = startX + 95
          const totalX = startX + 130
          doc.text(`Qty: ${qty}`, qtyX, yPos)
          doc.text(`@ ${unitPrice}`, priceX, yPos)
          doc.text(total, totalX, yPos)
          yPos += 5
        }
      } else {
        doc.text('No items in this group', margin + 5, yPos)
        yPos += 5
      }
      yPos += 3
    }
    yPos += 5
  }

  // Crew section
  if (offer.crew_items && offer.crew_items.length > 0) {
    checkPageBreak(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Crew', margin, yPos)
    yPos += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    for (const crew of offer.crew_items) {
      checkPageBreak(15)
      const days = Math.ceil(
        (new Date(crew.end_date).getTime() -
          new Date(crew.start_date).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      const total = formatCurrency(crew.total_price)

      doc.text(`${crew.role_title}`, margin, yPos)
      doc.text(`Count: ${crew.crew_count}`, margin + 50, yPos)
      doc.text(
        `${formatDate(crew.start_date)} - ${formatDate(crew.end_date)}`,
        margin + 80,
        yPos,
      )
      doc.text(`Daily rate: ${formatCurrency(crew.daily_rate)}`, margin + 120, yPos)
      yPos += 5
      doc.text(`Days: ${days}`, margin, yPos)
      doc.text(`Total: ${total}`, margin + 50, yPos)
      yPos += 6
    }
    yPos += 5
  }

  // Transport section
  if (offer.transport_items && offer.transport_items.length > 0) {
    checkPageBreak(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Transport', margin, yPos)
    yPos += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    for (const transport of offer.transport_items) {
      checkPageBreak(15)
      const days = Math.ceil(
        (new Date(transport.end_date).getTime() -
          new Date(transport.start_date).getTime()) /
          (1000 * 60 * 60 * 24),
      )
      const total = formatCurrency(transport.total_price)

      doc.text(`${transport.vehicle_name}`, margin, yPos)
      doc.text(
        `${formatDate(transport.start_date)} - ${formatDate(transport.end_date)}`,
        margin + 60,
        yPos,
      )
      doc.text(`Daily rate: ${formatCurrency(transport.daily_rate)}`, margin + 110, yPos)
      yPos += 5
      doc.text(`Days: ${days}`, margin, yPos)
      doc.text(`Total: ${total}`, margin + 50, yPos)
      yPos += 6
    }
    yPos += 5
  }

  // Pretty sections (for pretty offers)
  if (offer.pretty_sections && offer.pretty_sections.length > 0) {
    checkPageBreak(30)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('Content Sections', margin, yPos)
    yPos += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    for (const section of offer.pretty_sections.sort(
      (a, b) => a.sort_order - b.sort_order,
    )) {
      checkPageBreak(25)

      if (section.title) {
        doc.setFont('helvetica', 'bold')
        doc.text(section.title, margin, yPos)
        yPos += 6
      }

      if (section.content) {
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(section.content, contentWidth)
        for (const line of lines) {
          checkPageBreak(6)
          doc.text(line, margin, yPos)
          yPos += 5
        }
        yPos += 3
      }

      yPos += 5
    }
    yPos += 5
  }

  // Totals section
  checkPageBreak(40)
  yPos += 5
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('Totals', margin, yPos)
  yPos += 8

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const subtotalX = margin + 100
  doc.text('Equipment Subtotal:', margin, yPos)
  doc.text(formatCurrency(offer.equipment_subtotal), subtotalX, yPos, {
    align: 'right',
  })
  yPos += 6

  doc.text('Crew Subtotal:', margin, yPos)
  doc.text(formatCurrency(offer.crew_subtotal), subtotalX, yPos, { align: 'right' })
  yPos += 6

  doc.text('Transport Subtotal:', margin, yPos)
  doc.text(formatCurrency(offer.transport_subtotal), subtotalX, yPos, {
    align: 'right',
  })
  yPos += 6

  doc.text('Total Before Discount:', margin, yPos)
  doc.text(formatCurrency(offer.total_before_discount), subtotalX, yPos, {
    align: 'right',
  })
  yPos += 6

  if (offer.discount_percent > 0) {
    const discountAmount =
      offer.total_before_discount - offer.total_after_discount
    doc.text(`Discount (${offer.discount_percent}%):`, margin, yPos)
    doc.text(`-${formatCurrency(discountAmount)}`, subtotalX, yPos, {
      align: 'right',
    })
    yPos += 6
  }

  doc.text('Total After Discount:', margin, yPos)
  doc.text(formatCurrency(offer.total_after_discount), subtotalX, yPos, {
    align: 'right',
  })
  yPos += 6

  doc.text(`VAT (${offer.vat_percent}%):`, margin, yPos)
  const vatAmount = offer.total_with_vat - offer.total_after_discount
  doc.text(formatCurrency(vatAmount), subtotalX, yPos, { align: 'right' })
  yPos += 8

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Total With VAT:', margin, yPos)
  doc.text(formatCurrency(offer.total_with_vat), subtotalX, yPos, {
    align: 'right',
  })

  // Generate filename
  const filename = `${offer.title.replace(/[^a-z0-9]/gi, '_')}_v${offer.version_number}.pdf`

  // Save PDF
  doc.save(filename)
}


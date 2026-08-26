import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';

import { COVER_BASE64 } from './coverBase64';
import { LAST_PAGE_BASE64 } from './lastPageBase64';

export async function downloadTicketPdf(ticket: any) {
  const doc = new jsPDF();

  try {
    const img = new Image();
    img.src = '/logo.png';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    // Add logo to top right, maintaining aspect ratio
    const maxWidth = 40;
    const maxHeight = 20;
    const ratio = (img.width || 1) / (img.height || 1);
    
    let renderWidth = maxWidth;
    let renderHeight = renderWidth / ratio;
    
    if (renderHeight > maxHeight) {
      renderHeight = maxHeight;
      renderWidth = renderHeight * ratio;
    }
    
    doc.addImage(img, 'PNG', 190 - renderWidth, 10, renderWidth, renderHeight, undefined, 'MEDIUM');
  } catch (error) {
    console.log('Logo could not be loaded for PDF');
  }

  // Header Section
  doc.setFontSize(20);
  doc.setTextColor(40);
  doc.text('PrintField - Service Ticket', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  const ticketDateStr = ticket.ticketDate ? format(parseISO(ticket.ticketDate), 'MMM d, yyyy h:mm a') : 'N/A';
  doc.text(`Ticket No: ${ticket.ticketNumber || ticket.id.substring(0, 8)}`, 14, 30);
  doc.text(`Created on: ${ticketDateStr}`, 14, 35);

  // Split details into two columns
  const col1X = 14;
  const col2X = 110;
  let startY = 48;

  doc.setFontSize(14);
  doc.setTextColor(40);
  doc.text('Customer Details', col1X, startY);
  doc.text('Order Details', col2X, startY);

  startY += 7;
  doc.setFontSize(10);
  doc.setTextColor(60);

  // Col 1 Customer
  doc.text(`Company Name: ${ticket.customerName || 'N/A'}`, col1X, startY);
  doc.text(`Requestor Name: ${ticket.requesterName || 'N/A'}`, col1X, startY + 6);
  doc.text(`Phone Number: ${ticket.requesterPhone || 'N/A'}`, col1X, startY + 12);
  doc.text(`PO Number: ${ticket.purchaseOrderNumber || 'N/A'}`, col1X, startY + 18);

  // Col 2 Order Details
  const handoverDateStr = ticket.handoverDate ? format(parseISO(ticket.handoverDate), 'MMM d, yyyy') : 'N/A';
  doc.text(`Status: ${ticket.status === 'done' ? 'Done' : 'Pending'}`, col2X, startY);
  doc.text(`Handover Date: ${handoverDateStr}`, col2X, startY + 6);

  if (ticket.newHandoverDate) {
    const newHandoverStr = format(parseISO(ticket.newHandoverDate), 'MMM d, yyyy');
    doc.text(`Revised Handover: ${newHandoverStr}`, col2X, startY + 12);
  }

  if (ticket.delayReason) {
    const delayLines = doc.splitTextToSize(`Delay Reason: ${ticket.delayReason}`, 80);
    doc.text(delayLines, col2X, startY + 18);
  }

  // Generate Table
  const tableData = ticket.items.map((item: any, index: number) => {
    let desc = item.productName || '';
    if (item.description) desc += `\n(${item.description})`;

    const gstRate = item.gstRate || 5;
    const baseTotal = Number(item.quantity) * Number(item.price);
    const itemTotal = (baseTotal * (1 + gstRate / 100)).toFixed(2);
    
    return [
      index + 1,
      desc,
      item.quantity,
      `Rs. ${Number(item.price).toFixed(2)}`,
      `${gstRate}%`,
      `Rs. ${itemTotal}`
    ];
  });

  const totalAmount = ticket.items.reduce((sum: number, item: any) => {
    const gstRate = item.gstRate || 5;
    return sum + (Number(item.quantity) * Number(item.price) * (1 + gstRate / 100));
  }, 0);

  autoTable(doc, {
    startY: 80,
    head: [['#', 'Description', 'Qty', 'Unit Price', 'GST', 'Total']],
    body: tableData,
    foot: [['', '', '', '', 'Grand Total', `Rs. ${totalAmount.toFixed(2)}`]],
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
    footStyles: { fillColor: [240, 240, 240], textColor: [40, 40, 40], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 35, halign: 'right' },
    },
  });

  // Footer text
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text('This is a computer-generated document.', 14, finalY + 15);

  // Generate file name
  const cleanCompanyName = (ticket.customerName || 'Unknown_Company').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanRequestor = (ticket.requesterName || 'Req').replace(/[^a-zA-Z0-9_-]/g, '_');
  let fileName = `${cleanCompanyName}_${cleanRequestor}.pdf`.replace(/_&/g, '_').replace(/_+/g, '_');
  if (fileName.startsWith('_')) fileName = fileName.substring(1);

  doc.save(fileName);
}


function cropTo43(img: HTMLImageElement): string | HTMLImageElement {
  try {
    const canvas = document.createElement('canvas');
    const targetRatio = 4 / 3;
    
    // Set canvas size (high quality)
    const tw = 1600;
    const th = 1200;
    canvas.width = tw;
    canvas.height = th;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return img;
    
    const imgRatio = (img.width || 1) / (img.height || 1);
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    
    if (imgRatio > targetRatio) {
      // Image is wider than 4:3, crop left/right
      sw = img.height * targetRatio;
      sx = (img.width - sw) / 2;
    } else {
      // Image is taller than 4:3, crop top/bottom
      sh = img.width / targetRatio;
      sy = (img.height - sh) / 2;
    }
    
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
    return canvas.toDataURL('image/jpeg', 0.95);
  } catch (error) {
    console.warn("Canvas crop to 4:3 failed, falling back to original HTMLImageElement:", error);
    return img;
  }
}

export async function downloadCartPdf(cartItems: any[], user: any, showBrandName: boolean = false) {
  const doc = new jsPDF();
  
  // 1. Preload logo, cover, last_page, and product images
  let logoImg: HTMLImageElement | null = null;
  let coverImg: HTMLImageElement | null = null;
  let lastPageImg: HTMLImageElement | null = null;
  const productImagesMap: { [key: string]: HTMLImageElement } = {};

  const loadImage = (src: string, anonymous: boolean = true): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (anonymous && (src.startsWith('http') || src.startsWith('//'))) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        if (anonymous && (src.startsWith('http') || src.startsWith('//'))) {
          // Retry without crossOrigin
          const retryImg = new Image();
          retryImg.onload = () => resolve(retryImg);
          retryImg.onerror = () => reject(e);
          retryImg.src = src;
        } else {
          reject(e);
        }
      };
      img.src = src;
    });
  };

  try {
    const logoPromise = loadImage('/logo.png').then(img => { logoImg = img; }).catch(() => {});
    const coverPromise = loadImage(COVER_BASE64).then(img => { coverImg = img; }).catch(() => {});
    const lastPagePromise = loadImage(LAST_PAGE_BASE64).then(img => { lastPageImg = img; }).catch(() => {});

        const productPromises = cartItems.map((item) => {
      if (item.imageUrl) {
        const url = item.imageUrl.includes('amazonaws.com') 
          ? `/api/proxy-image?url=${encodeURIComponent(item.imageUrl)}`
          : item.imageUrl;
        return loadImage(url)
          .then((img) => {
             // Compress image to ensure PDF stays small (< 25MB)
             try {
               const canvas = document.createElement('canvas');
               const maxDim = 1600; // max dimension for catalogue images
               let w = img.width || 1;
               let h = img.height || 1;
               if (w > maxDim || h > maxDim) {
                 const ratio = w / h;
                 if (w > h) {
                   w = maxDim;
                   h = maxDim / ratio;
                 } else {
                   h = maxDim;
                   w = maxDim * ratio;
                 }
               }
               canvas.width = w;
               canvas.height = h;
               const ctx = canvas.getContext('2d');
               if (ctx) {
                 ctx.fillStyle = '#FFFFFF';
                 ctx.fillRect(0, 0, w, h);
                 ctx.drawImage(img, 0, 0, w, h);
                 // Aggressive compression to keep file size down
                 const compressedBase64 = canvas.toDataURL('image/jpeg', 0.9);
                 
                 // Create a new image from the compressed base64 so we can store it in map
                 return new Promise<void>((resolve) => {
                   const cImg = new Image();
                   cImg.onload = () => {
                     productImagesMap[item.id] = cImg;
                     resolve();
                   };
                   cImg.onerror = () => {
                     // Fallback to original
                     productImagesMap[item.id] = img;
                     resolve();
                   };
                   cImg.src = compressedBase64;
                 });
               }
             } catch (e) {
               console.warn("Failed to compress image", e);
             }
             productImagesMap[item.id] = img;
          })
          .catch((err) => {
            console.log(`Failed to load image for product ${item.name}:`, err);
          });
      }
      return Promise.resolve();
    });

    // Wait for everything with a timeout to avoid blocking forever
    await Promise.race([
      Promise.all([logoPromise, coverPromise, lastPagePromise, ...productPromises]),
      new Promise((resolve) => setTimeout(resolve, 6000)) // 6-second max wait
    ]);
  } catch (error) {
    console.log('Error preloading images:', error);
  }

  // Define Colors
  const DEEP_PURPLE = [45, 31, 102];      // #2D1F66
  const PURPLE = [139, 92, 246];          // #8B5CF6
  const TEXT_DARK = [30, 41, 59];         // #1E293B
  const TEXT_MUTED = [100, 116, 139];     // #64748B
  const BG_LIGHT = [248, 250, 252];       // #F8FAFC
  const ACCENT_LIGHT = [243, 232, 255];   // #F3E8FF

  // Utility to draw header & footer on content pages
  const drawPageHeaderFooter = (pageNum: number, categoryTitle: string) => {
    // Header
    if (logoImg) {
      const maxWidth = 35;
      const maxHeight = 12;
      const ratio = logoImg.width && logoImg.height ? logoImg.width / logoImg.height : 1.275;
      let rW = maxWidth;
      let rH = rW / ratio;
      if (rH > maxHeight) {
        rH = maxHeight;
        rW = rH * ratio;
      }
      const startY = 10 + (maxHeight - rH) / 2;
      try {
        doc.addImage(logoImg, 'PNG', 15, startY, rW, rH, undefined, 'MEDIUM');
      } catch (e) {
        console.warn("Header logo addImage failed, using text fallback:", e);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
        doc.text('PRINTFIELD', 15, 18);
      }
    } else {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
      doc.text('PRINTFIELD', 15, 18);
    }

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
    doc.text(categoryTitle, 195, 18, { align: 'right' });

    doc.setDrawColor(PURPLE[0], PURPLE[1], PURPLE[2]);
    doc.setLineWidth(0.75);
    doc.line(15, 24, 195, 24);

    // Footer
    doc.setDrawColor(226, 232, 240); // gray-200
    doc.setLineWidth(0.5);
    doc.line(15, 275, 195, 275);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text('Email: aryan@printfield.in | Phone: +91-9606371222 | Address: Minivilla, Borewell Road whitefield-66', 15, 281);
    doc.text(`Page ${pageNum}`, 195, 281, { align: 'right' });
  };

  // Helper to draw beautiful camera vector icon inside image container
  const drawCameraPlaceholder = (cx: number, cy: number, label: string) => {
    // Body of camera
    doc.setFillColor(243, 232, 255); // light purple
    doc.setDrawColor(216, 180, 254); // purple-300
    doc.setLineWidth(0.5);
    doc.roundedRect(cx - 9, cy - 5, 18, 11, 1.5, 1.5, 'FD');

    // Camera lens
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy + 0.5, 4, 'FD');
    doc.setFillColor(139, 92, 246); // purple-500
    doc.circle(cx, cy + 0.5, 1.8, 'F');

    // Camera shutter button
    doc.setFillColor(139, 92, 246);
    doc.rect(cx - 5, cy - 6.5, 3, 1.5, 'F');

    // Label Text
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text('Add Real Image:', cx, cy + 12, { align: 'center' });
    
    doc.setFont('Helvetica', 'boldOblique');
    doc.setTextColor(PURPLE[0], PURPLE[1], PURPLE[2]);
    const truncatedLabel = label.length > 15 ? label.substring(0, 12) + '...' : label;
    doc.text(truncatedLabel, cx, cy + 16, { align: 'center' });
  };

  // Helper to draw a modern checkmark
  const drawCheckmark = (x: number, y: number) => {
    doc.setDrawColor(PURPLE[0], PURPLE[1], PURPLE[2]);
    doc.setLineWidth(1.2);
    doc.line(x, y + 2, x + 1.5, y + 4);
    doc.line(x + 1.5, y + 4, x + 4, y);
  };

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  let drewCoverImg = false;
  if (coverImg) {
    try {
      doc.addImage(coverImg, 'PNG', 0, 0, 210, 297, undefined, 'MEDIUM');
      drewCoverImg = true;
    } catch (e) {
      console.warn("Cover image addImage failed, drawing elegant fallback cover:", e);
    }
  }

  if (!drewCoverImg) {
    // Top right waves
    doc.setFillColor(243, 232, 255);
    doc.triangle(130, 0, 210, 0, 210, 80, 'F');
    doc.setFillColor(233, 213, 255);
    doc.triangle(155, 0, 210, 0, 210, 55, 'F');
    doc.setFillColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
    doc.triangle(185, 0, 210, 0, 210, 25, 'F');

    // Bottom left waves
    doc.setFillColor(243, 232, 255);
    doc.triangle(0, 210, 0, 297, 80, 297, 'F');
    doc.setFillColor(233, 213, 255);
    doc.triangle(0, 235, 0, 297, 55, 297, 'F');
    doc.setFillColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
    doc.triangle(0, 265, 0, 297, 25, 297, 'F');

    // Center Logo
    if (logoImg) {
      const maxWidth = 70;
      const maxHeight = 35;
      const ratio = logoImg.width && logoImg.height ? logoImg.width / logoImg.height : 1.275;
      let rW = maxWidth;
      let rH = rW / ratio;
      if (rH > maxHeight) {
        rH = maxHeight;
        rW = rH * ratio;
      }
      const startX = 105 - rW / 2;
      const startY = 85 - rH / 2;
      try {
        doc.addImage(logoImg, 'PNG', startX, startY, rW, rH, undefined, 'MEDIUM');
      } catch (e) {
        console.warn("Cover center logo addImage failed, using text fallback:", e);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(36);
        doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
        doc.text('PRINT FIELD', 105, 85, { align: 'center' });
      }
    } else {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(36);
      doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
      doc.text('PRINT FIELD', 105, 85, { align: 'center' });
    }

    // Cover Page Title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
    doc.text('CATALOGUE', 105, 125, { align: 'center' });

    // Subtitle pill/bar
    doc.setFillColor(PURPLE[0], PURPLE[1], PURPLE[2]);
    doc.roundedRect(45, 137, 120, 10, 2, 2, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text('PRINTING & CORPORATE GIFTING', 105, 143.5, { align: 'center' });

    // Bottom contact information bar
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text('www.printfield.in  |  +91-9606371222  |  aryan@printfield.in', 105, 260, { align: 'center' });
  }

  // Group cart items by category
  const categoriesMap: { [key: string]: any[] } = {};
  cartItems.forEach((item) => {
    const category = (item.category || 'General Products').trim();
    if (!categoriesMap[category]) {
      categoriesMap[category] = [];
    }
    categoriesMap[category].push(item);
  });

  const categories = Object.keys(categoriesMap).sort();

  // Pre-calculate page numbers for Table of Contents
  const tocItems: { title: string; pageNum: number }[] = [];
  let currentPageNum = 3;

  const catalogPages: {
    pageNum: number;
    categoryTitle: string;
    items: any[];
    layout: '2-per-page' | '4-per-page';
  }[] = [];

  categories.forEach((cat) => {
    const itemsInCategory = categoriesMap[cat];
    tocItems.push({
      title: cat,
      pageNum: currentPageNum
    });

    const itemsPerPage = 1; // 1 product per page for professional layout

    for (let i = 0; i < itemsInCategory.length; i += itemsPerPage) {
      const chunk = itemsInCategory.slice(i, i + itemsPerPage);
      catalogPages.push({
        pageNum: currentPageNum,
        categoryTitle: cat.toUpperCase(),
        items: chunk,
        layout: '2-per-page'
      });
      currentPageNum++;
    }
  });

  const lastPageNum = currentPageNum;

  // ==========================================
  // PAGE 2: TABLE OF CONTENTS
  // ==========================================
  doc.addPage();

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
  doc.text('TABLE OF CONTENTS', 20, 50);

  doc.setDrawColor(220, 210, 245);
  doc.setLineWidth(1);
  doc.line(20, 56, 190, 56);

  let tocY = 75;
  tocItems.forEach((item, index) => {
    const idxStr = String(index + 1).padStart(2, '0');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(PURPLE[0], PURPLE[1], PURPLE[2]);
    doc.text(idxStr + '.', 20, tocY);
    
    doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
    doc.text(item.title.toUpperCase(), 32, tocY);
    
    // Dot leaders
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(200, 200, 200);
    doc.text('. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', 100, tocY);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(PURPLE[0], PURPLE[1], PURPLE[2]);
    const pageStr = String(item.pageNum).padStart(2, '0');
    doc.text(pageStr, 185, tocY);
    
    // Soft divider line
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.5);
    doc.line(20, tocY + 8, 190, tocY + 8);
    
    tocY += 24;
  });

  // Always append Last Page (OUR SERVICES) in Table of Contents
  const lastIdxStr = String(tocItems.length + 1).padStart(2, '0');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(PURPLE[0], PURPLE[1], PURPLE[2]);
  doc.text(lastIdxStr + '.', 20, tocY);
  
  doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
  doc.text('OUR SERVICES & CONTACT', 32, tocY);
  
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(200, 200, 200);
  doc.text('. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .', 100, tocY);
  
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(PURPLE[0], PURPLE[1], PURPLE[2]);
  doc.text(String(lastPageNum).padStart(2, '0'), 185, tocY);

  // Soft divider line
  doc.setDrawColor(241, 245, 249);
  doc.setLineWidth(0.5);
  doc.line(20, tocY + 8, 190, tocY + 8);

  // Footer for Page 2
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, 275, 195, 275);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text('Email: aryan@printfield.in | Phone: +91-9606371222 | Address: Minivilla, Borewell Road whitefield-66', 15, 281);
  doc.text('Page 2', 195, 281, { align: 'right' });

  // ==========================================
  // DYNAMIC CATALOGUE PAGES - PROFESSIONAL LAYOUT
  // ==========================================
  // Color palette matching the reference design
  const WARM_BG = [245, 235, 220];       // warm beige/peach background
  const DARK_ACCENT = [30, 30, 30];      // near black for text
  const ORANGE_ACCENT = [210, 150, 90];  // warm orange/tan accent
  const WHITE = [255, 255, 255];
  const LIGHT_GRAY = [240, 240, 240];

  // Helper: draw rounded rect
  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, style: string = 'F') => {
    doc.roundedRect(x, y, w, h, r, r, style);
  };

  // Helper: draw printing method icon (simple circle with text)
  const drawPrintMethodIcon = (cx: number, cy: number, label: string) => {
    // Circle
    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.setDrawColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    doc.setLineWidth(0.4);
    doc.circle(cx, cy, 6, 'FD');
    // Label below
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    const lines = doc.splitTextToSize(label, 14);
    lines.forEach((line: string, i: number) => {
      doc.text(line, cx, cy + 8 + (i * 3), { align: 'center' });
    });
  };

  // Helper: draw feature icon (rounded square with label)
  const drawFeatureIcon = (cx: number, cy: number, label: string) => {
    doc.setFillColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    doc.roundedRect(cx - 8, cy - 6, 16, 12, 2, 2, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    const lines = doc.splitTextToSize(label, 12);
    lines.forEach((line: string, i: number) => {
      doc.text(line, cx, cy - 1 + (i * 3.5), { align: 'center' });
    });
  };

  catalogPages.forEach((page) => {
    doc.addPage();

    const item = page.items[0]; // First item on page (1 per page now)
    if (!item) return;

    // ===== FULL PAGE BACKGROUND =====
    doc.setFillColor(WARM_BG[0], WARM_BG[1], WARM_BG[2]);
    doc.rect(0, 0, 210, 297, 'F');

    // ===== LEFT SIDE - VERTICAL CATEGORY TEXT =====
    doc.setFillColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    doc.rect(0, 0, 18, 297, 'F');

    // Vertical category text
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    const catText = page.categoryTitle || 'PRODUCT';
    // Draw each letter vertically
    for (let i = 0; i < catText.length; i++) {
      doc.text(catText[i], 9, 100 + (i * 8), { align: 'center', angle: 90 });
    }

    // ===== TOP RIGHT - LOGO + PRODUCT NAME =====
    // Logo
    if (logoImg) {
      const maxW = 30;
      const maxH = 12;
      const ratio = logoImg.width && logoImg.height ? logoImg.width / logoImg.height : 1.275;
      let rW = maxW;
      let rH = rW / ratio;
      if (rH > maxH) { rH = maxH; rW = rH * ratio; }
      try {
        doc.addImage(logoImg, 'PNG', 25, 10, rW, rH, undefined, 'MEDIUM');
      } catch (e) {}
    }

    // Product Name (large bold)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    const displayName = showBrandName && item.brandName ? item.brandName : (item.name || 'PRODUCT').toUpperCase();
    doc.text(displayName.substring(0, 25), 130, 22);

    // Subtitle
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    doc.text(item.name || 'Product Name', 130, 30);

    // ===== MAIN PRODUCT IMAGE (large, centered) =====
    const imgX = 25;
    const imgY = 42;
    const imgW = 100;
    const imgH = 130;

    // White background for image area
    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.roundedRect(imgX, imgY, imgW, imgH, 3, 3, 'F');

    const productImg = productImagesMap[item.id];
    if (productImg) {
      try {
        const imgRatio = (productImg.width || 1) / (productImg.height || 1);
        const targetRatio = imgW / imgH;
        let rw = imgW - 4;
        let rh = imgH - 4;
        if (imgRatio > targetRatio) {
          rh = rw / imgRatio;
        } else {
          rw = rh * imgRatio;
        }
        const rx = imgX + (imgW - rw) / 2;
        const ry = imgY + (imgH - rh) / 2;
        doc.addImage(productImg, 'JPEG', rx, ry, rw, rh, undefined, 'MEDIUM');
      } catch (e) {
        drawCameraPlaceholder(imgX + imgW / 2, imgY + imgH / 2, item.name);
      }
    } else {
      drawCameraPlaceholder(imgX + imgW / 2, imgY + imgH / 2, item.name);
    }

    // ===== PRINTING METHODS (right side) =====
    const printMethods = ['ENGRAVE', 'SCREEN\nPRINTING', 'UV\nPRINTING', 'DTF\nSTICKER'];
    const pmStartX = 140;
    const pmStartY = 45;
    printMethods.forEach((method, i) => {
      drawPrintMethodIcon(pmStartX + 12, pmStartY + (i * 22), method);
    });

    // ===== PRODUCT SPECS TABLE =====
    const specY = 180;
    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.roundedRect(25, specY, 140, 12, 1, 1, 'F');
    doc.setDrawColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(25, specY, 140, 12, 1, 1, 'S');

    // Product code table header
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    doc.text(displayName.substring(0, 20), 30, specY + 8);

    // SKU/Code
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(item.sku || item.id?.substring(0, 8) || 'UG-001', 120, specY + 8);

    // Divider line in table
    doc.setDrawColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    doc.setLineWidth(0.3);
    doc.line(110, specY + 2, 110, specY + 10);

    // ===== BULLET POINT SPECS =====
    const bulletY = specY + 18;
    const specs = [];
    if (item.description) {
      const descLines = doc.splitTextToSize(item.description, 130);
      descLines.forEach((line: string) => specs.push(line));
    }
    if (item.category) specs.push(`Category: ${item.category}`);
    specs.push('Custom branding available');

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    specs.slice(0, 4).forEach((spec: string, i: number) => {
      // Bullet dot
      doc.setFillColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
      doc.circle(30, bulletY + (i * 5) + 1.5, 0.8, 'F');
      doc.text(spec, 34, bulletY + (i * 5) + 2);
    });

    // ===== COLOR VARIANTS (bottom) =====
    if (item.sizes && item.sizes.length > 0) {
      const varY = 240;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
      doc.text('AVAILABLE OPTIONS:', 30, varY);

      item.sizes.forEach((size: any, i: number) => {
        const sizeName = typeof size === 'string' ? size : size.name || size;
        const vx = 30 + (i * 30);
        // Small circle with color
        doc.setFillColor(LIGHT_GRAY[0], LIGHT_GRAY[1], LIGHT_GRAY[2]);
        doc.setDrawColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
        doc.setLineWidth(0.3);
        doc.circle(vx + 6, varY + 10, 5, 'FD');
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6);
        doc.text(sizeName.substring(0, 10), vx + 6, varY + 20, { align: 'center' });
      });
    }

    // ===== FEATURE ICONS (bottom left) =====
    const featY = 258;
    const features = ['NO BPA\nBPA Free', 'Eco\nFriendly', 'Recyclable'];
    features.forEach((feat, i) => {
      drawFeatureIcon(45 + (i * 25), featY, feat);
    });

    // ===== PRICE BADGE (bottom right) =====
    const priceToUse = typeof item.sellingPrice === 'number' ? item.sellingPrice : (item.price || 0);
    if (priceToUse > 0) {
      doc.setFillColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
      doc.roundedRect(145, 255, 50, 25, 3, 3, 'F');
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
      doc.text('MRP', 170, 263, { align: 'center' });
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`₹${Number(priceToUse).toLocaleString('en-IN')}`, 170, 274, { align: 'center' });
    }

    // ===== FOOTER =====
    doc.setDrawColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    doc.setLineWidth(0.3);
    doc.line(20, 290, 195, 290);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(DARK_ACCENT[0], DARK_ACCENT[1], DARK_ACCENT[2]);
    doc.text('PrintField  |  aryan@printfield.in  |  +91-9606371222', 25, 294);
    doc.text(`Page ${page.pageNum}`, 190, 294, { align: 'right' });
  });

  // ==========================================
  // PAGE: OUR SERVICES (LAST PAGE)
  // ==========================================
  doc.addPage();

  let drewLastPageImg = false;
  if (lastPageImg) {
    try {
      doc.addImage(lastPageImg, 'JPEG', 0, 0, 210, 297, undefined, 'MEDIUM');
      drewLastPageImg = true;
    } catch (e) {
      console.warn("Last page image addImage failed, drawing elegant fallback services page:", e);
    }
  }

  if (!drewLastPageImg) {
    // Draw header/footer for page
    drawPageHeaderFooter(lastPageNum, 'OUR SERVICES');

    // Title "OUR SERVICES" center
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
    doc.text('OUR SERVICES', 105, 48, { align: 'center' });

    doc.setDrawColor(PURPLE[0], PURPLE[1], PURPLE[2]);
    doc.setLineWidth(1.5);
    doc.line(75, 54, 135, 54);

    // Bullet Checklist with custom vector checkmarks
    const services = [
      'Custom Corporate Apparel & Uniforms',
      'Premium Office Stationery & Printing',
      'Promotional Tech & Corporate Giveaways',
      'Large Format Printing, Posters & Banners',
      'Signage, Display Boards & Hoardings',
      'Advanced Digital & Offset Print Solutions'
    ];

    let checkY = 70;
    services.forEach((service) => {
      // Vector checkmark
      drawCheckmark(45, checkY + 1.5);
      
      // Service Text
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      doc.text(service, 55, checkY + 5);

      checkY += 13;
    });

    // Gorgeous contact details box
    const boxX = 30;
    const boxY = 165;
    const boxW = 150;
    const boxH = 85;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240); // gray-200
    doc.setLineWidth(0.75);
    doc.roundedRect(boxX, boxY, boxW, boxH, 4, 4, 'FD');

    // PrintField Logo inside the box
    if (logoImg) {
      const maxWidth = 40;
      const maxHeight = 15;
      const ratio = logoImg.width && logoImg.height ? logoImg.width / logoImg.height : 1.275;
      let rW = maxWidth;
      let rH = rW / ratio;
      if (rH > maxHeight) {
        rH = maxHeight;
        rW = rH * ratio;
      }
      const startX = boxX + (boxW - rW) / 2;
      const startY = boxY + 6 + (maxHeight - rH) / 2;
      try {
        doc.addImage(logoImg, 'PNG', startX, startY, rW, rH, undefined, 'MEDIUM');
      } catch (e) {
        console.warn("Last page logo addImage failed, using text fallback:", e);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
        doc.text('PRINTFIELD', boxX + 75, boxY + 15, { align: 'center' });
      }
    } else {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
      doc.text('PRINTFIELD', boxX + 75, boxY + 15, { align: 'center' });
    }

    // Address and Contact Items
    const contactDetails = [
      { label: 'ADDRESS:', value: 'Minivilla, Borewell Road whitefield-66' },
      { label: 'PHONE:', value: '+91-9606371222' },
      { label: 'EMAIL:', value: 'aryan@printfield.in' },
      { label: 'WEB:', value: 'www.printfield.in' }
    ];

    let textY = boxY + 30;
    contactDetails.forEach((detail) => {
      // Label
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(DEEP_PURPLE[0], DEEP_PURPLE[1], DEEP_PURPLE[2]);
      doc.text(detail.label, boxX + 15, textY);

      // Value
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(TEXT_DARK[0], TEXT_DARK[1], TEXT_DARK[2]);
      doc.text(detail.value, boxX + 40, textY);

      textY += 11;
    });
  }

  // Save the customized portfolio/catalogue quote
  const dateStr = format(new Date(), 'yyyyMMdd_HHmmss');
  doc.save(`PrintField_Portfolio_Catalogue_${dateStr}.pdf`);
}

# filepath: local_backend/api/utils/pdf_generator.py
import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.units import inch

def generate_closing_report_pdf(session_data: dict, output_path: str):
    """
    Genera un reporte de cierre de caja en PDF usando reportlab.
    """
    # Asegurar que el directorio existe
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter

    # Margenes y Titulo
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, height - 1 * inch, "REPORTE DE CIERRE DE CAJA")
    
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2, height - 1.25 * inch, "XION POS - SISTEMA INMUTABLE")
    
    # Info de la Sesion
    y = height - 1.75 * inch
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y, "Información de la Sesión")
    y -= 20
    c.setFont("Helvetica", 10)
    c.drawString(1 * inch, y, f"Cajero: {session_data.get('user_name')}")
    c.drawString(4 * inch, y, f"Estado: {session_data.get('status', '').upper()}")
    y -= 15
    c.drawString(1 * inch, y, f"Apertura: {session_data.get('opening_time')}")
    c.drawString(4 * inch, y, f"Cierre: {session_data.get('closing_time')}")
    
    y -= 30
    c.line(1 * inch, y, 7.5 * inch, y)
    y -= 20
    
    # Totales
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y, "Resumen Financiero (USD)")
    y -= 20
    c.setFont("Helvetica", 10)
    c.drawString(1 * inch, y, "Fondo de Apertura:")
    c.drawRightString(7.5 * inch, y, f"$ {session_data.get('opening_balance_usd', 0.0):.2f}")
    y -= 15
    c.drawString(1 * inch, y, "Ventas Totales (Neto):")
    total_sales = session_data.get('total_sales_usd', 0.0)
    c.drawRightString(7.5 * inch, y, f"$ {total_sales:.2f}")
    y -= 15
    c.drawString(1 * inch, y, "Impuestos Totales:")
    c.drawRightString(7.5 * inch, y, f"$ {session_data.get('total_tax_usd', 0.0):.2f}")
    y -= 20
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(1 * inch, y, "TOTAL ESPERADO EN CAJA (Ventas + Fondo):")
    expected = session_data.get('opening_balance_usd', 0.0) + total_sales
    c.drawRightString(7.5 * inch, y, f"$ {expected:.2f}")
    y -= 15
    c.drawString(1 * inch, y, "TOTAL CONTADO (CIERRE):")
    c.drawRightString(7.5 * inch, y, f"$ {session_data.get('closing_balance_usd', 0.0):.2f}")
    
    diff = session_data.get('closing_balance_usd', 0.0) - expected
    y -= 20
    if abs(diff) > 0.001:
        c.setFillColor(colors.red if diff < 0 else colors.green)
        c.drawString(1 * inch, y, f"DIFERENCIA: {'Faltante' if diff < 0 else 'Sobrante'}")
        c.drawRightString(7.5 * inch, y, f"$ {diff:.2f}")
        c.setFillColor(colors.black)
    else:
        c.drawString(1 * inch, y, "DIFERENCIA:")
        c.drawRightString(7.5 * inch, y, "$ 0.00 (Equilibrado)")
    
    y -= 40
    c.line(1 * inch, y, 7.5 * inch, y)
    y -= 20
    
    # Desglose de Pagos
    c.setFont("Helvetica-Bold", 12)
    c.drawString(1 * inch, y, "Desglose por Método de Pago")
    y -= 20
    c.setFont("Helvetica", 10)
    payments = session_data.get('payments_summary', {})
    if not payments:
        c.drawString(1.2 * inch, y, "No se registraron pagos.")
        y -= 15
    else:
        for method, amount in payments.items():
            c.drawString(1.2 * inch, y, f"- {method}:")
            c.drawRightString(7.5 * inch, y, f"$ {amount:.2f}")
            y -= 15
            if y < 1 * inch:
                c.showPage()
                y = height - 1 * inch

    # Pie de pagina
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(width / 2, 0.5 * inch, f"Reporte generado automáticamente el {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    
    c.save()
    return output_path

def generate_delivery_note_pdf(note_data: dict, items: list, output_path: str, format_type: str = "80mm"):
    """
    Genera un PDF para Nota de Entrega o Prefactura.
    Soporta formatos: '58mm', '80mm', 'A4'.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Configuraciones por formato
    if format_type == "58mm":
        # Ancho 58mm ~ 2.28 inch (aprox 164 puntos)
        width = 164
        # Altura dinámica, empezamos con un alto base + items
        height = 300 + (len(items) * 30)
    elif format_type == "80mm":
        # Ancho 80mm ~ 3.14 inch (aprox 226 puntos)
        width = 226
        height = 350 + (len(items) * 30)
    else: # A4 / Letter por defecto
        width, height = letter

    c = canvas.Canvas(output_path, pagesize=(width, height))
    
    # Ajustes de fuentes y margenes según formato
    if format_type in ["58mm", "80mm"]:
        margin = 10
        font_title = 12 if format_type == "80mm" else 10
        font_normal = 8 if format_type == "80mm" else 7
        font_small = 7 if format_type == "80mm" else 6
        
        y = height - margin - 15
        
        # Cabecera
        c.setFont("Helvetica-Bold", font_title)
        c.drawCentredString(width / 2, y, note_data.get("store_name", "MI TIENDA"))
        y -= 12
        
        c.setFont("Helvetica", font_small)
        c.drawCentredString(width / 2, y, f"RIF: {note_data.get('store_rif', 'J-0000000')}")
        y -= 10
        
        # Aviso No Fiscal
        c.setFont("Helvetica-Bold", font_normal)
        c.drawCentredString(width / 2, y, "DOCUMENTO NO FISCAL")
        y -= 12
        
        doc_type_str = note_data.get('document_type', 'PREFACTURA')
        c.setFont("Helvetica-Bold", font_normal)
        c.drawCentredString(width / 2, y, f"{doc_type_str} Nro: {note_data.get('document_number', '000')}")
        y -= 15
        
        c.line(margin, y, width - margin, y)
        y -= 12
        
        # Datos del cliente
        c.setFont("Helvetica", font_normal)
        c.drawString(margin, y, f"Cliente: {note_data.get('client_name', 'Consumidor Final')}")
        y -= 10
        c.drawString(margin, y, f"Fecha: {note_data.get('date', '')}")
        y -= 15
        
        c.line(margin, y, width - margin, y)
        y -= 12
        
        # Items Header
        c.setFont("Helvetica-Bold", font_small)
        c.drawString(margin, y, "CANT | DESCRIPCION | TOTAL($)")
        y -= 10
        
        # Items List
        c.setFont("Helvetica", font_small)
        for item in items:
            desc = item.get("product_name", "")[:18] # Truncate for receipt
            qty = item.get("quantity", 0)
            total = item.get("total_price_usd", 0.0)
            c.drawString(margin, y, f"{qty} x {desc}")
            c.drawRightString(width - margin, y, f"${total:.2f}")
            y -= 10
            
        y -= 5
        c.line(margin, y, width - margin, y)
        y -= 12
        
        # Totales
        c.setFont("Helvetica-Bold", font_normal)
        c.drawString(margin, y, "TOTAL USD:")
        c.drawRightString(width - margin, y, f"$ {note_data.get('total_amount_usd', 0.0):.2f}")
        y -= 12
        c.drawString(margin, y, "TOTAL Bs:")
        c.drawRightString(width - margin, y, f"Bs {note_data.get('total_amount_bs', 0.0):.2f}")
        
        y -= 20
        c.setFont("Helvetica-Oblique", font_small)
        c.drawCentredString(width / 2, y, "VÁLIDO COMO NOTA DE ENTREGA / PRE-FACTURA")
        
    else:
        # A4 / Carta layout
        c.setFont("Helvetica-Bold", 16)
        doc_type_str = note_data.get('document_type', 'PREFACTURA')
        c.drawCentredString(width / 2, height - 1 * inch, f"{doc_type_str} (NO FISCAL)")
        
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2, height - 1.3 * inch, "DOCUMENTO NO FISCAL - VÁLIDO COMO NOTA DE ENTREGA / PRE-FACTURA")
        
        y = height - 2 * inch
        c.drawString(1 * inch, y, f"Cliente: {note_data.get('client_name', 'Consumidor Final')}")
        c.drawRightString(width - 1 * inch, y, f"Nro: {note_data.get('document_number', '000')}")
        y -= 20
        c.drawString(1 * inch, y, f"Fecha: {note_data.get('date', '')}")
        y -= 30
        
        c.line(1 * inch, y, width - 1 * inch, y)
        y -= 20
        
        # Items Header
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1 * inch, y, "DESCRIPCIÓN")
        c.drawString(4 * inch, y, "CANTIDAD")
        c.drawString(5.5 * inch, y, "PRECIO UNIT($)")
        c.drawRightString(width - 1 * inch, y, "TOTAL($)")
        y -= 20
        
        c.setFont("Helvetica", 10)
        for item in items:
            c.drawString(1 * inch, y, item.get("product_name", ""))
            c.drawString(4 * inch, y, str(item.get("quantity", 0)))
            c.drawString(5.5 * inch, y, f"${item.get('unit_price_usd', 0.0):.2f}")
            c.drawRightString(width - 1 * inch, y, f"${item.get('total_price_usd', 0.0):.2f}")
            y -= 20
            
            if y < 2 * inch:
                c.showPage()
                y = height - 1 * inch
                
        c.line(1 * inch, y, width - 1 * inch, y)
        y -= 30
        
        # Totales
        c.setFont("Helvetica-Bold", 12)
        c.drawString(5.5 * inch, y, "TOTAL USD:")
        c.drawRightString(width - 1 * inch, y, f"$ {note_data.get('total_amount_usd', 0.0):.2f}")
        y -= 20
        c.drawString(5.5 * inch, y, "TOTAL Bs:")
        c.drawRightString(width - 1 * inch, y, f"Bs {note_data.get('total_amount_bs', 0.0):.2f}")

    c.save()
    return output_path


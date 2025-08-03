import os
import logging
from datetime import datetime
import base64
import io
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, send_file
from werkzeug.middleware.proxy_fix import ProxyFix

# Import barcode and QR code libraries
try:
    import qrcode
    from qrcode.image.styledpil import StyledPilImage
    from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False

try:
    from barcode import Code128
    from barcode.writer import ImageWriter
    BARCODE_AVAILABLE = True
except ImportError:
    BARCODE_AVAILABLE = False

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create Flask app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# In-memory data storage
items_data = {}
transactions_data = []
next_item_id = 1
next_transaction_id = 1

# Initialize sample data for testing
def initialize_sample_data():
    """Initialize some sample items for testing"""
    global next_item_id
    
    if not items_data:  # Only add if no data exists
        sample_items = [
            {
                'id': 1,
                'kode': 'BRG001',
                'nama': 'Buku Tulis',
                'harga_awal': 3000,
                'harga_jual': 5000,
                'stok_awal': 50,
                'stok_akhir': 50,
                'profit': 0
            },
            {
                'id': 2,
                'kode': 'BRG002',
                'nama': 'Pulpen',
                'harga_awal': 2000,
                'harga_jual': 3500,
                'stok_awal': 100,
                'stok_akhir': 100,
                'profit': 0
            },
            {
                'id': 3,
                'kode': 'BRG003',
                'nama': 'Penggaris',
                'harga_awal': 5000,
                'harga_jual': 8000,
                'stok_awal': 30,
                'stok_akhir': 30,
                'profit': 0
            }
        ]
        
        for item in sample_items:
            items_data[item['id']] = item
        
        next_item_id = 4

        # Add sample transactions for testing
        global next_transaction_id, transactions_data
        if not transactions_data:  # Only add if no transactions exist
            sample_transactions = [
                {
                    'id': 1,
                    'timestamp': '2025-08-03 14:30:15',
                    'items': [
                        {
                            'kode': 'BRG001',
                            'nama': 'Buku Tulis',
                            'harga_awal': 3000,
                            'harga_jual': 5000,
                            'quantity': 2,
                            'subtotal': 10000
                        },
                        {
                            'kode': 'BRG002',
                            'nama': 'Pulpen',
                            'harga_awal': 2000,
                            'harga_jual': 3500,
                            'quantity': 3,
                            'subtotal': 10500
                        }
                    ],
                    'total': 20500,
                    'profit': 8500,
                    'payment_amount': 25000,
                    'change': 4500
                },
                {
                    'id': 2,
                    'timestamp': '2025-08-03 15:15:22',
                    'items': [
                        {
                            'kode': 'BRG003',
                            'nama': 'Penggaris',
                            'harga_awal': 5000,
                            'harga_jual': 8000,
                            'quantity': 1,
                            'subtotal': 8000
                        }
                    ],
                    'total': 8000,
                    'profit': 3000,
                    'payment_amount': 10000,
                    'change': 2000
                }
            ]
            
            transactions_data.extend(sample_transactions)
            next_transaction_id = 3

# Initialize sample data when app starts
initialize_sample_data()

# Sample admin credentials (in production, use proper authentication)
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"

def calculate_profit(harga_awal, harga_jual, quantity=1):
    """Calculate profit from selling items"""
    return (harga_jual - harga_awal) * quantity

def calculate_total_profit(harga_awal, harga_jual, stok_awal, stok_akhir):
    """Calculate total profit based on items sold"""
    items_sold = stok_awal - stok_akhir
    return (harga_jual - harga_awal) * items_sold

def get_item_by_code(kode):
    """Get item by its code"""
    for item in items_data.values():
        if item['kode'] == kode:
            return item
    return None

def update_item_profit(item):
    """Update profit for a single item based on sales"""
    item['profit'] = calculate_total_profit(item['harga_awal'], item['harga_jual'], 
                                          item['stok_awal'], item['stok_akhir'])
    return item

@app.route('/')
def index():
    """Home page with role selection"""
    return render_template('index.html')

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Admin login"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            session['user_role'] = 'admin'
            session['username'] = username
            flash('Login berhasil!', 'success')
            return redirect(url_for('admin_dashboard'))
        else:
            flash('Username atau password salah!', 'error')
    
    return render_template('admin/login.html')

@app.route('/admin/logout')
def admin_logout():
    """Admin logout"""
    session.pop('user_role', None)
    session.pop('username', None)
    flash('Logout berhasil!', 'success')
    return redirect(url_for('index'))

@app.route('/admin/dashboard')
def admin_dashboard():
    """Admin dashboard"""
    if session.get('user_role') != 'admin':
        flash('Akses ditolak! Login sebagai admin terlebih dahulu.', 'error')
        return redirect(url_for('admin_login'))
    
    # Calculate statistics
    total_items = len(items_data)
    total_transactions = len(transactions_data)
    total_revenue = sum(t['total'] for t in transactions_data)
    total_profit = sum(t['profit'] for t in transactions_data)
    
    # Update profit for each item based on sales
    for item in items_data.values():
        item['profit'] = calculate_total_profit(item['harga_awal'], item['harga_jual'], 
                                              item['stok_awal'], item['stok_akhir'])
    
    # Low stock items (less than 5)
    low_stock_items = [item for item in items_data.values() if item['stok_akhir'] < 5]
    
    stats = {
        'total_items': total_items,
        'total_transactions': total_transactions,
        'total_revenue': total_revenue,
        'total_profit': total_profit,
        'low_stock_count': len(low_stock_items)
    }
    
    return render_template('admin/dashboard.html', stats=stats, low_stock_items=low_stock_items)

@app.route('/admin/items')
def admin_items():
    """View all items"""
    if session.get('user_role') != 'admin':
        flash('Akses ditolak! Login sebagai admin terlebih dahulu.', 'error')
        return redirect(url_for('admin_login'))
    
    return render_template('admin/items.html', items=items_data.values())

@app.route('/generate_barcode/<code>')
def generate_barcode(code):
    """Generate barcode image"""
    try:
        # Force re-import to ensure libraries are available
        from barcode import Code128
        from barcode.writer import ImageWriter
        
        # Generate barcode
        code128 = Code128(code, writer=ImageWriter())
        buffer = io.BytesIO()
        code128.write(buffer)
        buffer.seek(0)
        
        return send_file(buffer, mimetype='image/png', as_attachment=False)
    except ImportError as e:
        app.logger.error(f"Barcode library import error: {e}")
        # Return a simple error image instead of JSON
        return "Barcode library not available", 404
    except Exception as e:
        app.logger.error(f"Error generating barcode: {e}")
        return f"Error generating barcode: {str(e)}", 500

@app.route('/generate_qrcode/<code>')
def generate_qrcode(code):
    """Generate QR code image"""
    try:
        # Force re-import to ensure libraries are available
        import qrcode
        
        # Generate QR code
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(code)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return send_file(buffer, mimetype='image/png', as_attachment=False)
    except ImportError as e:
        app.logger.error(f"QR code library import error: {e}")
        # Return a simple error message instead of JSON
        return "QR code library not available", 404
    except Exception as e:
        app.logger.error(f"Error generating QR code: {e}")
        return f"Error generating QR code: {str(e)}", 500

@app.route('/download_barcode/<code>')
def download_barcode(code):
    """Download barcode as file"""
    try:
        from barcode import Code128
        from barcode.writer import ImageWriter
        
        code128 = Code128(code, writer=ImageWriter())
        buffer = io.BytesIO()
        code128.write(buffer)
        buffer.seek(0)
        
        return send_file(buffer, mimetype='image/png', as_attachment=True, 
                        download_name=f'barcode_{code}.png')
    except ImportError as e:
        app.logger.error(f"Barcode library import error: {e}")
        return "Barcode library not available", 404
    except Exception as e:
        app.logger.error(f"Error downloading barcode: {e}")
        return f"Error downloading barcode: {str(e)}", 500

@app.route('/download_qrcode/<code>')
def download_qrcode(code):
    """Download QR code as file"""
    try:
        import qrcode
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(code)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return send_file(buffer, mimetype='image/png', as_attachment=True,
                        download_name=f'qrcode_{code}.png')
    except ImportError as e:
        app.logger.error(f"QR code library import error: {e}")
        return "QR code library not available", 404
    except Exception as e:
        app.logger.error(f"Error downloading QR code: {e}")
        return f"Error downloading QR code: {str(e)}", 500

@app.route('/admin/items/add', methods=['GET', 'POST'])
def admin_add_item():
    """Add new item"""
    if session.get('user_role') != 'admin':
        flash('Akses ditolak! Login sebagai admin terlebih dahulu.', 'error')
        return redirect(url_for('admin_login'))
    
    if request.method == 'POST':
        global next_item_id
        
        kode = request.form.get('kode', '')
        nama = request.form.get('nama', '')
        harga_awal = int(request.form.get('harga_awal', 0))
        harga_jual = int(request.form.get('harga_jual', 0))
        stok_awal = int(request.form.get('stok_awal', 0))
        
        # Check if code already exists
        if get_item_by_code(kode):
            flash('Kode barang sudah ada!', 'error')
            return render_template('admin/add_item.html')
        
        # Create new item (profit will be calculated based on actual sales)
        new_item = {
            'id': next_item_id,
            'kode': kode,
            'nama': nama,
            'harga_awal': harga_awal,
            'harga_jual': harga_jual,
            'stok_awal': stok_awal,
            'stok_akhir': stok_awal,  # Initially same as stok_awal
            'profit': 0  # No profit until items are sold
        }
        
        items_data[next_item_id] = new_item
        next_item_id += 1
        
        flash('Barang berhasil ditambahkan!', 'success')
        return redirect(url_for('admin_items'))
    
    return render_template('admin/add_item.html')

@app.route('/admin/items/edit/<int:item_id>', methods=['GET', 'POST'])
def admin_edit_item(item_id):
    """Edit existing item"""
    if session.get('user_role') != 'admin':
        flash('Akses ditolak! Login sebagai admin terlebih dahulu.', 'error')
        return redirect(url_for('admin_login'))
    
    item = items_data.get(item_id)
    if not item:
        flash('Barang tidak ditemukan!', 'error')
        return redirect(url_for('admin_items'))
    
    if request.method == 'POST':
        kode = request.form.get('kode', '')
        nama = request.form.get('nama', '')
        harga_awal = int(request.form.get('harga_awal', 0))
        harga_jual = int(request.form.get('harga_jual', 0))
        stok_akhir = int(request.form.get('stok_akhir', 0))
        
        # Check if code already exists for other items
        existing_item = get_item_by_code(kode)
        if existing_item and existing_item['id'] != item_id:
            flash('Kode barang sudah digunakan oleh barang lain!', 'error')
            return render_template('admin/edit_item.html', item=item)
        
        # Update item
        item['kode'] = kode
        item['nama'] = nama
        item['harga_awal'] = harga_awal
        item['harga_jual'] = harga_jual
        item['stok_akhir'] = stok_akhir
        # Update profit using the new function
        update_item_profit(item)
        
        flash('Barang berhasil diperbarui!', 'success')
        return redirect(url_for('admin_items'))
    
    return render_template('admin/edit_item.html', item=item)

@app.route('/admin/items/delete/<int:item_id>')
def admin_delete_item(item_id):
    """Delete item"""
    if session.get('user_role') != 'admin':
        flash('Akses ditolak! Login sebagai admin terlebih dahulu.', 'error')
        return redirect(url_for('admin_login'))
    
    if item_id in items_data:
        del items_data[item_id]
        flash('Barang berhasil dihapus!', 'success')
    else:
        flash('Barang tidak ditemukan!', 'error')
    
    return redirect(url_for('admin_items'))

@app.route('/admin/reports')
def admin_reports():
    """View reports"""
    if session.get('user_role') != 'admin':
        flash('Akses ditolak! Login sebagai admin terlebih dahulu.', 'error')
        return redirect(url_for('admin_login'))
    
    # Calculate daily sales
    daily_sales = {}
    for transaction in transactions_data:
        date = transaction['timestamp'].split()[0]  # Get date part
        if date not in daily_sales:
            daily_sales[date] = {'total': 0, 'profit': 0, 'count': 0}
        daily_sales[date]['total'] += transaction['total']
        daily_sales[date]['profit'] += transaction['profit']
        daily_sales[date]['count'] += 1
    
    # Top selling items
    item_sales = {}
    for transaction in transactions_data:
        for item in transaction['items']:
            kode = item['kode']
            if kode not in item_sales:
                item_sales[kode] = {'nama': item['nama'], 'quantity': 0, 'revenue': 0}
            item_sales[kode]['quantity'] += item['quantity']
            item_sales[kode]['revenue'] += item['subtotal']
    
    # Sort by quantity sold
    top_items = sorted(item_sales.items(), key=lambda x: x[1]['quantity'], reverse=True)[:10]
    
    return render_template('admin/reports.html', 
                         daily_sales=daily_sales, 
                         top_items=top_items,
                         transactions=transactions_data)

@app.route('/cashier')
def cashier_pos():
    """Cashier POS interface"""
    session['user_role'] = 'cashier'  # Simple role assignment for cashier
    return render_template('cashier/pos.html', items=list(items_data.values()))

@app.route('/cashier/search_item')
def search_item():
    """Search item by code or name"""
    query = request.args.get('q', '').lower()
    results = []
    
    for item in items_data.values():
        if (query in item['kode'].lower() or 
            query in item['nama'].lower()) and item['stok_akhir'] > 0:
            results.append(item)
    
    return jsonify(results)

@app.route('/cashier/process_sale', methods=['POST'])
def process_sale():
    """Process a sale transaction"""
    data = request.get_json()
    cart_items = data.get('items', [])
    payment_amount = data.get('payment_amount', 0)
    
    if not cart_items:
        return jsonify({'success': False, 'message': 'Keranjang kosong!'})
    
    global next_transaction_id
    transaction_items = []
    total_amount = 0
    total_profit = 0
    
    # Process each item in cart
    for cart_item in cart_items:
        kode = cart_item['kode']
        quantity = cart_item['quantity']
        
        # Find item in inventory
        item = get_item_by_code(kode)
        if not item:
            return jsonify({'success': False, 'message': f'Barang {kode} tidak ditemukan!'})
        
        # Check stock
        if item['stok_akhir'] < quantity:
            return jsonify({'success': False, 'message': f'Stok {item["nama"]} tidak mencukupi!'})
        
        # Calculate subtotal and profit
        subtotal = item['harga_jual'] * quantity
        profit = calculate_profit(item['harga_awal'], item['harga_jual'], quantity)
        
        # Update stock
        item['stok_akhir'] -= quantity
        
        # Update item profit after stock change
        update_item_profit(item)
        
        # Add to transaction items
        transaction_items.append({
            'kode': kode,
            'nama': item['nama'],
            'harga_jual': item['harga_jual'],
            'quantity': quantity,
            'subtotal': subtotal
        })
        
        total_amount += subtotal
        total_profit += profit
    
    # Calculate change
    change = payment_amount - total_amount if payment_amount >= total_amount else 0
    
    # Create transaction record
    transaction = {
        'id': next_transaction_id,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'items': transaction_items,
        'total': total_amount,
        'profit': total_profit,
        'payment_amount': payment_amount,
        'change': change
    }
    
    transactions_data.append(transaction)
    next_transaction_id += 1
    
    return jsonify({
        'success': True, 
        'message': 'Transaksi berhasil!',
        'transaction_id': transaction['id'],
        'total': total_amount,
        'payment_amount': payment_amount,
        'change': change,
        'timestamp': transaction['timestamp'],
        'items': transaction_items
    })

@app.route('/cashier/history')
def cashier_history():
    """View transaction history"""
    # Show last 50 transactions
    recent_transactions = transactions_data[-50:] if len(transactions_data) > 50 else transactions_data
    recent_transactions.reverse()  # Show newest first
    
    # Calculate summary statistics and add item count to each transaction
    total_transactions = len(recent_transactions)
    total_items_sold = 0
    total_revenue = 0
    total_profit = 0
    
    # Add item count to each transaction for easy display
    for transaction in recent_transactions:
        total_revenue += transaction['total']
        total_profit += transaction['profit']
        
        # Calculate item count for this transaction
        transaction_item_count = 0
        for item in transaction['items']:
            transaction_item_count += item['quantity']
            total_items_sold += item['quantity']
        
        # Add item count to transaction for template use
        transaction['item_count'] = transaction_item_count
    
    summary = {
        'total_transactions': total_transactions,
        'total_items_sold': total_items_sold,
        'total_revenue': total_revenue,
        'total_profit': total_profit
    }
    
    return render_template('cashier/history.html', 
                         transactions=recent_transactions,
                         summary=summary)



if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

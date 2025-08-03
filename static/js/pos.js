class POSSystem {
    constructor() {
        this.cart = [];
        this.searchTimeout = null;
        this.init();
    }

    init() {
        console.log('POSSystem initializing...');
        this.setupEventListeners();
        this.updateCartDisplay();
        console.log('POSSystem initialized successfully');
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.searchItems(e.target.value);
                }, 300);
            });
        } else {
            console.warn('Search input not found - search functionality disabled');
        }

        // Add to cart buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-to-cart') || e.target.closest('.add-to-cart')) {
                const button = e.target.classList.contains('add-to-cart') ? e.target : e.target.closest('.add-to-cart');
                const itemCard = button.closest('.item-card');
                const itemData = JSON.parse(itemCard.dataset.item);
                this.addToCart(itemData);
            }

            // Quantity controls
            if (e.target.classList.contains('quantity-increase')) {
                const kode = e.target.dataset.kode;
                this.updateQuantity(kode, 1);
            }

            if (e.target.classList.contains('quantity-decrease')) {
                const kode = e.target.dataset.kode;
                this.updateQuantity(kode, -1);
            }

            // Remove item
            if (e.target.classList.contains('remove-item') || e.target.closest('.remove-item')) {
                const button = e.target.classList.contains('remove-item') ? e.target : e.target.closest('.remove-item');
                const kode = button.dataset.kode;
                this.removeFromCart(kode);
            }
        });

        // Quantity input changes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('quantity-input')) {
                const kode = e.target.dataset.kode;
                const newQuantity = parseInt(e.target.value) || 0;
                this.setQuantity(kode, newQuantity);
            }
        });

        // Process payment
        const processPaymentBtn = document.getElementById('processPayment');
        if (processPaymentBtn) {
            processPaymentBtn.addEventListener('click', () => {
                this.processPayment();
            });
        }

        // Clear cart
        const clearCartBtn = document.getElementById('clearCart');
        if (clearCartBtn) {
            clearCartBtn.addEventListener('click', () => {
                this.clearCart();
            });
        }

        // Payment amount change listener
        const paymentAmountInput = document.getElementById('paymentAmount');
        if (paymentAmountInput) {
            paymentAmountInput.addEventListener('input', () => {
                this.calculateChange();
            });
        }

        // Print receipt buttons
        document.addEventListener('click', (e) => {
            if (e.target.id === 'printToPrinter') {
                this.printReceipt();
            }
            if (e.target.id === 'downloadPDF') {
                this.downloadReceiptPDF();
            }
        });
    }

    async searchItems(query) {
        const searchResults = document.getElementById('searchResults');
        const allItems = document.getElementById('allItems');

        if (!searchResults || !allItems) {
            console.error('Search elements not found');
            return;
        }

        if (!query.trim()) {
            searchResults.innerHTML = '';
            allItems.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`/cashier/search_item?q=${encodeURIComponent(query)}`);
            const items = await response.json();

            allItems.style.display = 'none';
            
            if (items.length === 0) {
                searchResults.innerHTML = `
                    <div class="col-12">
                        <div class="text-center text-muted py-3">
                            <i class="fas fa-search fa-2x mb-2"></i>
                            <p>Tidak ada barang yang ditemukan</p>
                        </div>
                    </div>
                `;
                return;
            }

            searchResults.innerHTML = items.map(item => `
                <div class="col-md-6 col-lg-4">
                    <div class="card item-card" data-item='${JSON.stringify(item)}'>
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h6 class="card-title mb-0">${item.nama}</h6>
                                <span class="badge bg-success">${item.stok_akhir}</span>
                            </div>
                            <p class="card-text">
                                <small class="text-muted">${item.kode}</small><br>
                                <strong>Rp ${item.harga_jual.toLocaleString('id-ID')}</strong>
                            </p>
                            <button class="btn btn-primary btn-sm w-100 add-to-cart">
                                <i class="fas fa-plus me-1"></i>
                                Tambah
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('Error searching items:', error);
            searchResults.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Terjadi kesalahan saat mencari barang
                    </div>
                </div>
            `;
        }
    }

    addToCart(item) {
        const existingItem = this.cart.find(cartItem => cartItem.kode === item.kode);

        if (existingItem) {
            if (existingItem.quantity < item.stok_akhir) {
                existingItem.quantity += 1;
                this.showNotification(`${item.nama} ditambahkan ke keranjang`, 'success');
            } else {
                this.showNotification(`Stok ${item.nama} tidak mencukupi`, 'warning');
                return;
            }
        } else {
            this.cart.push({
                kode: item.kode,
                nama: item.nama,
                harga_jual: item.harga_jual,
                stok_tersedia: item.stok_akhir,
                quantity: 1
            });
            this.showNotification(`${item.nama} ditambahkan ke keranjang`, 'success');
        }

        this.updateCartDisplay();
    }

    updateQuantity(kode, change) {
        const item = this.cart.find(cartItem => cartItem.kode === kode);
        if (!item) return;

        const newQuantity = item.quantity + change;

        if (newQuantity <= 0) {
            this.removeFromCart(kode);
            return;
        }

        if (newQuantity > item.stok_tersedia) {
            this.showNotification(`Stok ${item.nama} tidak mencukupi`, 'warning');
            return;
        }

        item.quantity = newQuantity;
        this.updateCartDisplay();
    }

    setQuantity(kode, quantity) {
        const item = this.cart.find(cartItem => cartItem.kode === kode);
        if (!item) return;

        if (quantity <= 0) {
            this.removeFromCart(kode);
            return;
        }

        if (quantity > item.stok_tersedia) {
            this.showNotification(`Stok ${item.nama} tidak mencukupi`, 'warning');
            // Reset to available stock
            item.quantity = item.stok_tersedia;
            this.updateCartDisplay();
            return;
        }

        item.quantity = quantity;
        this.updateCartDisplay();
    }

    removeFromCart(kode) {
        const itemIndex = this.cart.findIndex(cartItem => cartItem.kode === kode);
        if (itemIndex > -1) {
            const item = this.cart[itemIndex];
            this.cart.splice(itemIndex, 1);
            this.showNotification(`${item.nama} dihapus dari keranjang`, 'info');
            this.updateCartDisplay();
        }
    }

    clearCart() {
        if (this.cart.length === 0) return;

        if (confirm('Yakin ingin mengosongkan keranjang?')) {
            this.cart = [];
            this.updateCartDisplay();
            this.showNotification('Keranjang dikosongkan', 'info');
        }
    }

    updateCartDisplay() {
        const cartItems = document.getElementById('cartItems');
        const cartSummary = document.getElementById('cartSummary');
        const emptyCart = document.getElementById('emptyCart');

        if (!cartItems || !cartSummary) {
            console.error('Cart elements not found');
            return;
        }

        if (this.cart.length === 0) {
            if (emptyCart) {
                emptyCart.style.display = 'block';
            }
            cartSummary.classList.add('d-none');
            cartItems.innerHTML = `
                <div class="text-center text-muted py-4" id="emptyCart">
                    <i class="fas fa-shopping-cart fa-2x mb-2"></i>
                    <p>Keranjang kosong</p>
                    <small>Pilih barang untuk mulai transaksi</small>
                </div>
            `;
            return;
        }

        if (emptyCart) {
            emptyCart.style.display = 'none';
        }
        cartSummary.classList.remove('d-none');

        const cartHTML = this.cart.map(item => {
            const subtotal = item.harga_jual * item.quantity;
            return `
                <div class="cart-item">
                    <div class="cart-item-header">
                        <div>
                            <div class="cart-item-name">${item.nama}</div>
                            <div class="cart-item-code">${item.kode}</div>
                        </div>
                        <button class="remove-item" data-kode="${item.kode}" title="Hapus item">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <span>Rp ${item.harga_jual.toLocaleString('id-ID')}</span>
                        <span><strong>Rp ${subtotal.toLocaleString('id-ID')}</strong></span>
                    </div>
                    <div class="cart-item-controls">
                        <div class="quantity-control">
                            <button class="quantity-btn quantity-decrease" data-kode="${item.kode}">
                                <i class="fas fa-minus"></i>
                            </button>
                            <input type="number" class="quantity-input" data-kode="${item.kode}" 
                                   value="${item.quantity}" min="1" max="${item.stok_tersedia}">
                            <button class="quantity-btn quantity-increase" data-kode="${item.kode}">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                        <small class="text-muted">Stok: ${item.stok_tersedia}</small>
                    </div>
                </div>
            `;
        }).join('');

        cartItems.innerHTML = cartHTML;

        // Update totals
        const subtotal = this.cart.reduce((sum, item) => sum + (item.harga_jual * item.quantity), 0);
        const subtotalElement = document.getElementById('subtotal');
        const totalElement = document.getElementById('total');
        
        if (subtotalElement) {
            subtotalElement.textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
        }
        if (totalElement) {
            totalElement.textContent = `Rp ${subtotal.toLocaleString('id-ID')}`;
        }
    }

    calculateChange() {
        const paymentAmount = parseFloat(document.getElementById('paymentAmount')?.value || 0);
        const total = this.cart.reduce((sum, item) => sum + (item.harga_jual * item.quantity), 0);
        const change = paymentAmount - total;
        
        const changeDisplay = document.getElementById('changeDisplay');
        const changeAmount = document.getElementById('changeAmount');
        
        if (paymentAmount > 0 && changeDisplay) {
            if (change >= 0) {
                changeDisplay.className = 'mb-2';
                const alertDiv = changeDisplay.querySelector('.alert');
                alertDiv.className = 'alert alert-success mb-0';
                alertDiv.innerHTML = `<strong>Kembalian: Rp ${change.toLocaleString('id-ID')}</strong>`;
            } else {
                changeDisplay.className = 'mb-2';
                const alertDiv = changeDisplay.querySelector('.alert');
                alertDiv.className = 'alert alert-warning mb-0';
                alertDiv.innerHTML = `<strong>Kurang: Rp ${Math.abs(change).toLocaleString('id-ID')}</strong>`;
            }
        } else if (changeDisplay) {
            changeDisplay.className = 'd-none mb-2';
        }
    }

    async processPayment() {
        if (this.cart.length === 0) {
            this.showNotification('Keranjang kosong!', 'warning');
            return;
        }

        const paymentAmount = parseFloat(document.getElementById('paymentAmount')?.value || 0);
        const total = this.cart.reduce((sum, item) => sum + (item.harga_jual * item.quantity), 0);
        
        if (paymentAmount < total) {
            this.showNotification('Jumlah pembayaran kurang!', 'warning');
            return;
        }

        // Show loading state
        const processBtn = document.getElementById('processPayment');
        if (!processBtn) {
            console.error('Process payment button not found');
            return;
        }
        
        const originalText = processBtn.innerHTML;
        processBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Memproses...';
        processBtn.disabled = true;

        try {
            const response = await fetch('/cashier/process_sale', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    items: this.cart,
                    payment_amount: paymentAmount
                })
            });

            const result = await response.json();

            if (result.success) {
                // Show success modal
                this.showSuccessModal(result);
                
                // Clear cart and payment form
                this.cart = [];
                this.updateCartDisplay();
                document.getElementById('paymentAmount').value = '';
                this.calculateChange();
                
                this.showNotification('Transaksi berhasil!', 'success');
            } else {
                this.showNotification(result.message || 'Terjadi kesalahan!', 'error');
            }

        } catch (error) {
            console.error('Error processing payment:', error);
            this.showNotification('Terjadi kesalahan saat memproses pembayaran', 'error');
        } finally {
            // Restore button state
            processBtn.innerHTML = originalText;
            processBtn.disabled = false;
        }
    }

    showSuccessModal(result) {
        const modal = new bootstrap.Modal(document.getElementById('successModal'));
        
        // Update transaction summary
        const summaryContainer = document.getElementById('transactionSummary');
        if (summaryContainer) {
            summaryContainer.innerHTML = `
                <div class="text-start">
                    <p><strong>ID Transaksi:</strong> ${result.transaction_id}</p>
                    <p><strong>Total:</strong> Rp ${result.total.toLocaleString('id-ID')}</p>
                    <p><strong>Bayar:</strong> Rp ${(result.payment_amount || result.total).toLocaleString('id-ID')}</p>
                    <p><strong>Kembalian:</strong> Rp ${(result.change || 0).toLocaleString('id-ID')}</p>
                    <p><strong>Waktu:</strong> ${result.timestamp}</p>
                </div>
            `;
        }
        
        // Generate receipt preview
        this.generateReceiptPreview(result);
        
        modal.show();
    }

    generateReceiptPreview(result) {
        const receiptContainer = document.getElementById('receiptPreview');
        if (!receiptContainer) return;
        
        const currentDate = new Date().toLocaleDateString('id-ID');
        const currentTime = new Date().toLocaleTimeString('id-ID');
        
        let receiptHTML = `
<div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
    <h3 style="margin: 0; font-size: 16px;">TOKO SERBAADA</h3>
    <p style="margin: 0; font-size: 10px;">Jl. Contoh No. 123, Kota</p>
    <p style="margin: 0; font-size: 10px;">Telp: (021) 12345678</p>
</div>

<div style="margin-bottom: 10px;">
    <div style="display: flex; justify-content: space-between;">
        <span>Tanggal:</span>
        <span>${currentDate}</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
        <span>Waktu:</span>
        <span>${currentTime}</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
        <span>Kasir:</span>
        <span>Kasir 01</span>
    </div>
    <div style="display: flex; justify-content: space-between;">
        <span>No. Transaksi:</span>
        <span>${result.transaction_id}</span>
    </div>
</div>

<div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0;">
`;

        result.items.forEach(item => {
            receiptHTML += `
    <div>
        <div style="font-weight: bold;">${item.nama}</div>
        <div style="display: flex; justify-content: space-between;">
            <span>${item.quantity} x Rp ${item.harga_jual.toLocaleString('id-ID')}</span>
            <span>Rp ${(item.quantity * item.harga_jual).toLocaleString('id-ID')}</span>
        </div>
    </div>
`;
        });

        receiptHTML += `
</div>

<div style="margin-top: 10px;">
    <div style="display: flex; justify-content: space-between; font-size: 12px;">
        <span>Subtotal:</span>
        <span>Rp ${result.total.toLocaleString('id-ID')}</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px;">
        <span>TOTAL:</span>
        <span>Rp ${result.total.toLocaleString('id-ID')}</span>
    </div>
    <div style="display: flex; justify-content: space-between; margin-top: 10px;">
        <span>Bayar:</span>
        <span>Rp ${(result.payment_amount || result.total).toLocaleString('id-ID')}</span>
    </div>
    <div style="display: flex; justify-content: space-between; font-weight: bold;">
        <span>Kembalian:</span>
        <span>Rp ${(result.change || 0).toLocaleString('id-ID')}</span>
    </div>
</div>

<div style="text-align: center; margin-top: 20px; border-top: 1px dashed #000; padding-top: 10px;">
    <p style="margin: 0; font-size: 10px;">*** TERIMA KASIH ***</p>
    <p style="margin: 0; font-size: 10px;">Barang yang sudah dibeli tidak dapat dikembalikan</p>
</div>
        `;
        
        receiptContainer.innerHTML = receiptHTML;
    }

    printReceipt() {
        const receiptContent = document.getElementById('receiptPreview')?.innerHTML;
        if (!receiptContent) return;
        
        const printWindow = window.open('', '', 'width=300,height=600');
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Struk Pembayaran</title>
                    <style>
                        body { 
                            font-family: 'Courier New', monospace; 
                            font-size: 12px; 
                            margin: 0; 
                            padding: 10px;
                            width: 280px;
                        }
                        @media print {
                            body { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    ${receiptContent}
                </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }

    downloadReceiptPDF() {
        const receiptContent = document.getElementById('receiptPreview')?.innerHTML;
        if (!receiptContent) {
            alert('Struk belum tersedia untuk didownload');
            return;
        }

        // Create a new window for PDF generation
        const pdfWindow = window.open('', '', 'width=800,height=600');
        
        pdfWindow.document.write(`
            <html>
                <head>
                    <title>Struk Pembayaran - PDF</title>
                    <style>
                        body { 
                            font-family: 'Courier New', monospace; 
                            font-size: 12px; 
                            margin: 20px;
                            max-width: 300px;
                        }
                        @media print {
                            body { margin: 0; }
                            @page { size: A4; margin: 20mm; }
                        }
                    </style>
                </head>
                <body>
                    <h2>Struk Pembayaran</h2>
                    ${receiptContent}
                    <br><br>
                    <p><small>Generated on ${new Date().toLocaleString('id-ID')}</small></p>
                    
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                            }, 500);
                        }
                        
                        window.onafterprint = function() {
                            window.close();
                        }
                    </script>
                </body>
            </html>
        `);
        
        pdfWindow.document.close();
    }

    showNotification(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show position-fixed`;
        toast.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 300px;';
        
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}

// Initialize POS system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    try {
        window.pos = new POSSystem();
    } catch (error) {
        console.error('Error initializing POS system:', error);
    }
});

// Legacy print receipt function - no longer used
function printReceipt() {
    if (window.pos && window.pos.printReceipt) {
        window.pos.printReceipt();
    } else {
        window.print();
    }
}

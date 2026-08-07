/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    HAYEE INTERIOR                           ║
 * ║              Luxury E-Commerce Platform                     ║
 * ║              Frontend JavaScript v2.0                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

'use strict';

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
    API_BASE_URL: '/api',
    DEFAULT_PRODUCT_IMAGE: '/static/uploads/placeholder.png',
    CURRENCY: 'USD',
    LOCALE: 'en-US',
    CART_STORAGE_KEY: 'hayee_cart',
    WISHLIST_STORAGE_KEY: 'hayee_wishlist',
    SESSION_STORAGE_KEY: 'hayee_session',
    TOAST_DURATION: 3000,
    PRODUCTS_PER_PAGE: 12,
    DEBOUNCE_DELAY: 300,
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
class AppState {
    constructor() {
        this.cart = this.loadFromStorage(CONFIG.CART_STORAGE_KEY, []);
        this.wishlist = this.loadFromStorage(CONFIG.WISHLIST_STORAGE_KEY, []);
        this.user = null;
        this.token = localStorage.getItem('hayee_token');
        this.currentPage = this.detectPage();
        this.listeners = new Map();
    }
    
    loadFromStorage(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch {
            return defaultValue;
        }
    }
    
    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }
    
    addToCart(product, quantity = 1) {
        const existing = this.cart.find(item => item.product_id === product.id);
        if (existing) {
            existing.quantity += quantity;
        } else {
            this.cart.push({
                product_id: product.id,
                product: product,
                quantity: quantity,
            });
        }
        this.saveToStorage(CONFIG.CART_STORAGE_KEY, this.cart);
        this.notify('cart-updated', this.cart);
    }
    
    removeFromCart(productId) {
        this.cart = this.cart.filter(item => item.product_id !== productId);
        this.saveToStorage(CONFIG.CART_STORAGE_KEY, this.cart);
        this.notify('cart-updated', this.cart);
    }
    
    updateCartQuantity(productId, quantity) {
        const item = this.cart.find(item => item.product_id === productId);
        if (item) {
            item.quantity = Math.max(1, Math.min(quantity, item.product.inventory_count || 99));
            this.saveToStorage(CONFIG.CART_STORAGE_KEY, this.cart);
            this.notify('cart-updated', this.cart);
        }
    }
    
    get cartCount() {
        return this.cart.reduce((sum, item) => sum + item.quantity, 0);
    }
    
    get cartTotal() {
        return this.cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
    }
    
    toggleWishlist(product) {
        const index = this.wishlist.findIndex(item => item.id === product.id);
        if (index > -1) {
            this.wishlist.splice(index, 1);
            this.notify('wishlist-updated', { product, inWishlist: false });
        } else {
            this.wishlist.push(product);
            this.notify('wishlist-updated', { product, inWishlist: true });
        }
        this.saveToStorage(CONFIG.WISHLIST_STORAGE_KEY, this.wishlist);
    }
    
    isInWishlist(productId) {
        return this.wishlist.some(item => item.id === productId);
    }
    
    detectPage() {
        const path = window.location.pathname;
        if (path === '/' || path === '') return 'home';
        if (path === '/shop') return 'shop';
        if (path.startsWith('/product/')) return 'product';
        if (path === '/cart') return 'cart';
        if (path === '/wishlist') return 'wishlist';
        if (path === '/checkout') return 'checkout';
        if (path === '/account') return 'account';
        return 'other';
    }
    
    setUser(user, token) {
        this.user = user;
        this.token = token;
        if (token) {
            localStorage.setItem('hayee_token', token);
        } else {
            localStorage.removeItem('hayee_token');
        }
        this.notify('auth-changed', user);
    }
    
    logout() {
        this.setUser(null, null);
        localStorage.removeItem('hayee_token');
    }
    
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    
    notify(event, data) {
        const callbacks = this.listeners.get(event) || [];
        callbacks.forEach(cb => cb(data));
    }
}

// Initialize global state
const state = new AppState();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const Utils = {
    formatPrice(price) {
        return new Intl.NumberFormat(CONFIG.LOCALE, {
            style: 'currency',
            currency: CONFIG.CURRENCY,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(price);
    },
    
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString(CONFIG.LOCALE, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    },
    
    getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        for (const [key, value] of params) {
            result[key] = value;
        }
        return result;
    },
    
    buildUrlParams(obj) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(obj)) {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        }
        return params.toString();
    },
    
    getSlugFromPath() {
        const match = window.location.pathname.match(/\/product\/(.+)/);
        return match ? match[1] : null;
    },
    
    debounce(func, delay = CONFIG.DEBOUNCE_DELAY) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    },
    
    truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    },
    
    generateStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalf = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) stars += '<span class="star filled">★</span>';
        if (hasHalf) stars += '<span class="star filled">★</span>';
        for (let i = 0; i < emptyStars; i++) stars += '<span class="star">★</span>';
        return stars;
    },
    
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, CONFIG.TOAST_DURATION);
    },
    
    setCookie(name, value, days = 30) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
    },
    
    getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : null;
    },
};

// ============================================================================
// API SERVICE
// ============================================================================
const API = {
    async request(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };
        
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'An error occurred');
            }
            
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },
    
    get(endpoint, params = {}) {
        const query = Utils.buildUrlParams(params);
        return this.request(`${endpoint}${query ? '?' + query : ''}`);
    },
    
    post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    
    put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    
    delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE',
        });
    },
    
    // Product APIs
    async getProducts(params = {}) {
        return this.get('/products', params);
    },
    
    async getProduct(slug) {
        return this.get(`/products/${slug}`);
    },
    
    async getCategories() {
        return this.get('/categories');
    },
    
    // Cart APIs
    async getCart() {
        return this.get('/cart');
    },
    
    async addToCartAPI(productId, quantity) {
        return this.post('/cart/add', { product_id: productId, quantity });
    },
    
    async updateCartItem(itemId, quantity) {
        return this.put(`/cart/update/${itemId}`, { quantity });
    },
    
    async removeCartItem(itemId) {
        return this.delete(`/cart/remove/${itemId}`);
    },
    
    // Wishlist APIs
    async getWishlist() {
        return this.get('/wishlist');
    },
    
    async toggleWishlistAPI(productId) {
        return this.post(`/wishlist/toggle/${productId}`);
    },
    
    // Auth APIs
    async login(email, password) {
        return this.post('/auth/login', { email, password });
    },
    
    async register(data) {
        return this.post('/auth/register', data);
    },
    
    async getProfile() {
        return this.get('/auth/profile');
    },
    
    // Search
    async searchSuggestions(query) {
        return this.get('/search/suggestions', { q: query });
    },
    
    // Reviews
    async getReviews(slug) {
        return this.get(`/products/${slug}/reviews`);
    },
    
    async createReview(productId, data) {
        return this.post(`/products/${productId}/reviews`, data);
    },
};

// ============================================================================
// UI COMPONENTS
// ============================================================================
class UIComponents {
    
    // Create product card HTML
    static createProductCard(product) {
        const inWishlist = state.isInWishlist(product.id);
        const thumbnail = product.thumbnail_url || 
                         (product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : CONFIG.DEFAULT_PRODUCT_IMAGE);
        
        return `
            <article class="product-card" data-product-slug="${product.slug}" data-product-id="${product.id}">
                <div class="product-card-image">
                    <img src="${thumbnail}" alt="${product.title}" loading="lazy">
                    <div class="product-card-badges">
                        ${product.is_new_arrival ? '<span class="badge badge-new">New</span>' : ''}
                        ${product.is_bestseller ? '<span class="badge badge-bestseller">Bestseller</span>' : ''}
                        ${product.compare_at_price ? '<span class="badge badge-sale">Sale</span>' : ''}
                    </div>
                    <div class="product-card-actions">
                        <button class="product-card-quick-view" data-product-slug="${product.slug}">Quick View</button>
                        <button class="product-card-wishlist ${inWishlist ? 'active' : ''}" data-product-id="${product.id}">
                            ${inWishlist ? '♥' : '♡'}
                        </button>
                    </div>
                </div>
                <div class="product-card-info">
                    <span class="product-card-category">${product.category ? product.category.name : ''}</span>
                    <h3 class="product-card-title">${product.title}</h3>
                    <div class="product-card-rating">
                        <div class="stars">${Utils.generateStars(product.average_rating || 0)}</div>
                        <span class="rating-number">(${product.review_count || 0})</span>
                    </div>
                    <div class="product-card-pricing">
                        <span class="product-card-price">${Utils.formatPrice(product.price)}</span>
                        ${product.compare_at_price ? `<span class="product-card-compare-price">${Utils.formatPrice(product.compare_at_price)}</span>` : ''}
                    </div>
                </div>
            </article>
        `;
    }
    
    // Create cart item HTML
    static createCartItem(item, index) {
        const product = item.product;
        const thumbnail = product.thumbnail_url || 
                         (product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : CONFIG.DEFAULT_PRODUCT_IMAGE);
        
        return `
            <div class="cart-item" data-product-id="${product.id}">
                <div class="cart-item-image">
                    <img src="${thumbnail}" alt="${product.title}">
                </div>
                <div class="cart-item-details">
                    <h4>${product.title}</h4>
                    <span class="item-category">${product.category ? product.category.name : ''}</span>
                    <div class="cart-item-price">${Utils.formatPrice(product.price)}</div>
                </div>
                <div class="cart-item-actions">
                    <div class="cart-item-quantity">
                        <button class="qty-decrease" data-index="${index}">−</button>
                        <span>${item.quantity}</span>
                        <button class="qty-increase" data-index="${index}">+</button>
                    </div>
                    <button class="cart-item-remove" data-index="${index}">Remove</button>
                </div>
            </div>
        `;
    }
};

// ============================================================================
// PAGE CONTROLLERS
// ============================================================================

class HomePage {
    static async init() {
        await Promise.all([
            this.loadCategories(),
            this.loadFeaturedProducts(),
            this.loadBestsellers(),
        ]);
        this.setupNewsletter();
    }
    
    static async loadCategories() {
        const grid = document.getElementById('categories-grid');
        if (!grid) return;
        
        try {
            const data = await API.getCategories();
            const categories = data.categories || [];
            
            grid.innerHTML = categories.slice(0, 4).map(cat => `
                <a href="/shop?category=${cat.slug}" class="category-card">
                    <div class="category-card-image"></div>
                    <div class="category-card-overlay">
                        <h3>${cat.name}</h3>
                        <span>${cat.product_count} Products</span>
                    </div>
                </a>
            `).join('');
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }
    
    static async loadFeaturedProducts() {
        const grid = document.getElementById('featured-products-grid');
        if (!grid) return;
        
        try {
            const data = await API.getProducts({ featured: 'true', limit: 4 });
            const products = data.products || [];
            
            if (products.length === 0) {
                grid.innerHTML = '<p class="loading-spinner">No featured products available.</p>';
                return;
            }
            
            grid.innerHTML = products.map(p => UIComponents.createProductCard(p)).join('');
            this.attachProductCardListeners(grid);
        } catch (error) {
            grid.innerHTML = '<p class="loading-spinner">Failed to load products.</p>';
        }
    }
    
    static async loadBestsellers() {
        const grid = document.getElementById('bestsellers-grid');
        if (!grid) return;
        
        try {
            const data = await API.getProducts({ bestseller: 'true', limit: 4 });
            const products = data.products || [];
            
            if (products.length === 0) {
                grid.innerHTML = '<p class="loading-spinner">No bestsellers available.</p>';
                return;
            }
            
            grid.innerHTML = products.map(p => UIComponents.createProductCard(p)).join('');
            this.attachProductCardListeners(grid);
        } catch (error) {
            grid.innerHTML = '<p class="loading-spinner">Failed to load products.</p>';
        }
    }
    
    static attachProductCardListeners(container) {
        // Quick view buttons
        container.querySelectorAll('.product-card-quick-view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const slug = btn.dataset.productSlug;
                QuickView.open(slug);
            });
        });
        
        // Wishlist buttons
        container.querySelectorAll('.product-card-wishlist').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = parseInt(btn.dataset.productId);
                const card = btn.closest('.product-card');
                const product = {
                    id: productId,
                    title: card.querySelector('.product-card-title').textContent,
                    price: parseFloat(card.querySelector('.product-card-price').textContent.replace(/[^0-9.]/g, '')),
                    thumbnail_url: card.querySelector('.product-card-image img').src,
                };
                
                state.toggleWishlist(product);
                btn.classList.toggle('active');
                btn.textContent = state.isInWishlist(productId) ? '♥' : '♡';
                
                if (state.isInWishlist(productId)) {
                    Utils.showToast(`${product.title} added to wishlist`);
                } else {
                    Utils.showToast(`${product.title} removed from wishlist`);
                }
            });
        });
        
        // Card click navigation
        container.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const slug = card.dataset.productSlug;
                window.location.href = `/product/${slug}`;
            });
        });
    }
    
    static setupNewsletter() {
        const form = document.getElementById('newsletter-form');
        if (!form) return;
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = form.querySelector('input[type="email"]').value;
            Utils.showToast('Thank you for subscribing! Welcome to the Hayee Interior circle.');
            form.reset();
        });
    }
}

class ShopPage {
    static currentFilters = {};
    
    static async init() {
        this.loadCategoriesSidebar();
        this.setupFilters();
        this.loadProducts();
    }
    
    static async loadCategoriesSidebar() {
        const container = document.getElementById('sidebar-categories');
        if (!container) return;
        
        try {
            const data = await API.getCategories();
            const categories = data.categories || [];
            
            const urlParams = Utils.getUrlParams();
            const activeCategory = urlParams.category || '';
            
            container.innerHTML = `
                <li><a href="/shop" class="${!activeCategory ? 'active' : ''}">All Categories</a></li>
                ${categories.map(cat => `
                    <li>
                        <a href="/shop?category=${cat.slug}" class="${activeCategory === cat.slug ? 'active' : ''}">
                            ${cat.name}
                            <span class="category-count">${cat.product_count}</span>
                        </a>
                    </li>
                `).join('')}
            `;
        } catch (error) {
            console.error('Failed to load categories sidebar:', error);
        }
    }
    
    static setupFilters() {
        const sortSelect = document.getElementById('sort-select');
        const clearBtn = document.getElementById('clear-filters');
        const mobileFilterToggle = document.getElementById('mobile-filter-toggle');
        const sidebar = document.getElementById('shop-sidebar');
        
        // Sort
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                const [sort, order] = sortSelect.value.split('-');
                this.currentFilters.sort = sort;
                this.currentFilters.order = order;
                this.loadProducts();
            });
        }
        
        // Clear filters
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.currentFilters = {};
                window.location.href = '/shop';
            });
        }
        
        // Mobile filter toggle
        if (mobileFilterToggle && sidebar) {
            mobileFilterToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
            
            // Close sidebar when clicking outside
            document.addEventListener('click', (e) => {
                if (!sidebar.contains(e.target) && e.target !== mobileFilterToggle) {
                    sidebar.classList.remove('active');
                }
            });
        }
        
        // Initialize filters from URL
        const urlParams = Utils.getUrlParams();
        if (urlParams.category) this.currentFilters.category = urlParams.category;
        if (urlParams.featured) this.currentFilters.featured = urlParams.featured;
        if (urlParams.bestseller) this.currentFilters.bestseller = urlParams.bestseller;
        if (urlParams.new_arrival) this.currentFilters.new_arrival = urlParams.new_arrival;
    }
    
    static async loadProducts(page = 1) {
        const grid = document.getElementById('shop-products-grid');
        const countDisplay = document.getElementById('product-count-display');
        const pagination = document.getElementById('shop-pagination');
        
        if (!grid) return;
        
        grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading collection...</p></div>';
        
        try {
            const params = {
                ...this.currentFilters,
                page: page,
                limit: CONFIG.PRODUCTS_PER_PAGE,
            };
            
            const data = await API.getProducts(params);
            const products = data.products || [];
            
            if (products.length === 0) {
                grid.innerHTML = '<p class="loading-spinner">No products found matching your criteria.</p>';
                if (countDisplay) countDisplay.textContent = '0 products';
                if (pagination) pagination.innerHTML = '';
                return;
            }
            
            grid.innerHTML = products.map(p => UIComponents.createProductCard(p)).join('');
            HomePage.attachProductCardListeners(grid);
            
            if (countDisplay) {
                countDisplay.textContent = `${data.count} product${data.count !== 1 ? 's' : ''}`;
            }
            
            // Pagination
            if (pagination && data.pages > 1) {
                let pagHTML = '';
                if (data.has_prev) {
                    pagHTML += `<button data-page="${data.page - 1}">←</button>`;
                }
                for (let i = 1; i <= data.pages; i++) {
                    pagHTML += `<button data-page="${i}" class="${i === data.page ? 'active' : ''}">${i}</button>`;
                }
                if (data.has_next) {
                    pagHTML += `<button data-page="${data.page + 1}">→</button>`;
                }
                pagination.innerHTML = pagHTML;
                
                pagination.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const pageNum = parseInt(btn.dataset.page);
                        this.loadProducts(pageNum);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                });
            } else if (pagination) {
                pagination.innerHTML = '';
            }
        } catch (error) {
            grid.innerHTML = '<p class="loading-spinner">Failed to load products. Please try again.</p>';
        }
    }
}

class ProductPage {
    static async init() {
        const slug = Utils.getSlugFromPath();
        if (!slug) return;
        
        await this.loadProductDetail(slug);
    }
    
    static async loadProductDetail(slug) {
        try {
            const data = await API.getProduct(slug);
            const product = data.product;
            
            if (!product) {
                document.getElementById('product-detail-container').innerHTML = '<p>Product not found.</p>';
                return;
            }
            
            this.populateProductInfo(product);
            this.setupGallery(product);
            this.setupAccordion();
            this.setupAddToCart(product);
            this.setupWishlistToggle(product);
            this.loadReviews(slug);
            this.loadRelatedProducts(data.related_products || []);
            
        } catch (error) {
            console.error('Failed to load product:', error);
        }
    }
    
    static populateProductInfo(product) {
        document.title = `${product.title} | Hayee Interior`;
        
        document.querySelector('.product-category-label').textContent = product.category ? product.category.name : '';
        document.querySelector('.product-title').textContent = product.title;
        document.querySelector('.current-price').textContent = Utils.formatPrice(product.price);
        
        const comparePrice = document.querySelector('.compare-price');
        const discountBadge = document.querySelector('.discount-badge');
        if (product.compare_at_price) {
            comparePrice.textContent = Utils.formatPrice(product.compare_at_price);
            comparePrice.style.display = 'inline';
            discountBadge.style.display = 'inline';
            discountBadge.textContent = `Save ${Utils.formatPrice(product.compare_at_price - product.price)}`;
        } else {
            comparePrice.style.display = 'none';
            discountBadge.style.display = 'none';
        }
        
        document.querySelector('.product-short-desc').textContent = product.short_description || '';
        
        const starsContainer = document.querySelector('.product-rating-summary .stars');
        starsContainer.innerHTML = Utils.generateStars(product.average_rating || 0);
        document.querySelector('.rating-count').textContent = `(${product.review_count || 0} reviews)`;
        
        // Inventory status
        const inventoryEl = document.querySelector('.inventory-status');
        if (product.inventory_count > 5) {
            inventoryEl.innerHTML = '<span class="in-stock">✓ In Stock — Ready to Ship</span>';
        } else if (product.inventory_count > 0) {
            inventoryEl.innerHTML = `<span class="low-stock">⚡ Only ${product.inventory_count} left in stock</span>`;
        } else {
            inventoryEl.innerHTML = '<span class="out-of-stock">✗ Out of Stock</span>';
        }
        
        // Update quantity max
        const qtyInput = document.getElementById('product-quantity');
        if (qtyInput) {
            qtyInput.max = product.inventory_count || 1;
        }
        
        // Color swatch
        if (product.color && product.color_hex) {
            const swatch = document.querySelector('.color-swatch');
            if (swatch) swatch.style.backgroundColor = product.color_hex;
        }
    }
    
    static setupGallery(product) {
        const mainImage = document.getElementById('main-product-image');
        const thumbnails = document.querySelectorAll('.thumbnail');
        const zoomBtn = document.getElementById('gallery-zoom-btn');
        
        if (!mainImage) return;
        
        const images = product.image_urls || [];
        
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', () => {
                const imgUrl = thumb.dataset.imageUrl;
                mainImage.src = imgUrl;
                
                thumbnails.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
        
        // Zoom functionality
        if (zoomBtn) {
            zoomBtn.addEventListener('click', () => {
                // Open image in modal or new tab
                window.open(mainImage.src, '_blank');
            });
        }
    }
    
    static setupAccordion() {
        document.querySelectorAll('.accordion-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const content = toggle.nextElementSibling;
                const isOpen = content.classList.contains('open');
                
                // Close all
                document.querySelectorAll('.accordion-content').forEach(c => c.classList.remove('open'));
                document.querySelectorAll('.accordion-toggle').forEach(t => t.classList.remove('active'));
                
                // Open clicked
                if (!isOpen) {
                    content.classList.add('open');
                    toggle.classList.add('active');
                }
            });
        });
    }
    
    static setupAddToCart(product) {
        const addBtn = document.getElementById('add-to-cart-btn');
        const qtyInput = document.getElementById('product-quantity');
        const qtyMinus = document.getElementById('qty-minus');
        const qtyPlus = document.getElementById('qty-plus');
        
        if (!addBtn || !qtyInput) return;
        
        const updatePrice = () => {
            const qty = parseInt(qtyInput.value) || 1;
            const total = product.price * qty;
            const priceSpan = addBtn.querySelector('.btn-price');
            if (priceSpan) priceSpan.textContent = `— ${Utils.formatPrice(total)}`;
        };
        
        // Quantity controls
        if (qtyMinus) {
            qtyMinus.addEventListener('click', () => {
                const val = parseInt(qtyInput.value) || 1;
                if (val > 1) {
                    qtyInput.value = val - 1;
                    updatePrice();
                }
            });
        }
        
        if (qtyPlus) {
            qtyPlus.addEventListener('click', () => {
                const val = parseInt(qtyInput.value) || 1;
                const max = parseInt(qtyInput.max) || 99;
                if (val < max) {
                    qtyInput.value = val + 1;
                    updatePrice();
                }
            });
        }
        
        qtyInput.addEventListener('change', updatePrice);
        
        // Add to cart
        addBtn.addEventListener('click', async () => {
            const quantity = parseInt(qtyInput.value) || 1;
            
            if (state.token) {
                // Server-side cart
                try {
                    await API.addToCartAPI(product.id, quantity);
                    Utils.showToast(`${product.title} added to cart`);
                    updateCartUI();
                } catch (error) {
                    Utils.showToast('Failed to add to cart. Please try again.', 'error');
                }
            } else {
                // Client-side cart
                state.addToCart(product, quantity);
                Utils.showToast(`${product.title} added to cart`);
                updateCartUI();
            }
        });
    }
    
    static setupWishlistToggle(product) {
        const btn = document.getElementById('wishlist-toggle-btn');
        if (!btn) return;
        
        const updateBtn = () => {
            const inWishlist = state.isInWishlist(product.id);
            btn.classList.toggle('active', inWishlist);
            btn.querySelector('span').textContent = inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist';
            btn.querySelector('svg').style.fill = inWishlist ? 'currentColor' : 'none';
        };
        
        updateBtn();
        
        btn.addEventListener('click', () => {
            state.toggleWishlist(product);
            updateBtn();
            updateWishlistUI();
            
            if (state.isInWishlist(product.id)) {
                Utils.showToast(`${product.title} added to wishlist`);
            } else {
                Utils.showToast(`${product.title} removed from wishlist`);
            }
        });
    }
    
    static async loadReviews(slug) {
        const container = document.getElementById('reviews-container');
        if (!container) return;
        
        try {
            const data = await API.getReviews(slug);
            const reviews = data.reviews || [];
            
            if (reviews.length === 0) {
                container.innerHTML = '<p>No reviews yet. Be the first to review this product.</p>';
            } else {
                container.innerHTML = reviews.map(review => `
                    <div class="review-card">
                        <div class="review-header">
                            <div class="reviewer-info">
                                <div class="reviewer-avatar">${review.user_name ? review.user_name.charAt(0) : 'A'}</div>
                                <div>
                                    <div class="reviewer-name">${review.user_name || 'Anonymous'}</div>
                                    <div class="review-date">${Utils.formatDate(review.created_at)}</div>
                                </div>
                            </div>
                            <div class="review-rating">${Utils.generateStars(review.rating)}</div>
                        </div>
                        ${review.title ? `<h4 class="review-title">${review.title}</h4>` : ''}
                        <p class="review-comment">${review.comment}</p>
                    </div>
                `).join('');
            }
            
            // Show review form if logged in
            if (state.token) {
                document.getElementById('review-form-container').style.display = 'block';
                this.setupReviewForm(slug);
            }
        } catch (error) {
            container.innerHTML = '<p>Failed to load reviews.</p>';
        }
    }
    
    static setupReviewForm(slug) {
        const form = document.getElementById('review-form');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const rating = form.querySelector('input[name="rating"]:checked')?.value;
            const title = document.getElementById('review-title').value;
            const comment = document.getElementById('review-comment').value;
            
            if (!rating) {
                Utils.showToast('Please select a rating', 'error');
                return;
            }
            
            try {
                // Get product ID from slug
                const productData = await API.getProduct(slug);
                await API.createReview(productData.product.id, { rating, title, comment });
                Utils.showToast('Review submitted successfully!');
                form.reset();
                this.loadReviews(slug);
            } catch (error) {
                Utils.showToast('Failed to submit review. You may have already reviewed this product.', 'error');
            }
        });
    }
    
    static loadRelatedProducts(products) {
        const grid = document.getElementById('related-products-grid');
        if (!grid || !products.length) return;
        
        grid.innerHTML = products.map(p => UIComponents.createProductCard(p)).join('');
        HomePage.attachProductCardListeners(grid);
    }
}

class CartPage {
    static init() {
        this.renderCart();
        this.setupEventListeners();
    }
    
    static renderCart() {
        const cartItems = document.getElementById('cart-items');
        const cartSummary = document.getElementById('cart-summary');
        const emptyCart = document.getElementById('empty-cart');
        const cartLayout = document.getElementById('cart-layout');
        const cartCountDisplay = document.getElementById('cart-count-display');
        
        if (state.cart.length === 0) {
            if (cartLayout) cartLayout.style.display = 'none';
            if (emptyCart) emptyCart.style.display = 'block';
            if (cartCountDisplay) cartCountDisplay.textContent = '0 items';
            return;
        }
        
        if (cartLayout) cartLayout.style.display = 'grid';
        if (emptyCart) emptyCart.style.display = 'none';
        
        if (cartItems) {
            cartItems.innerHTML = state.cart.map((item, index) => 
                UIComponents.createCartItem(item, index)
            ).join('');
        }
        
        if (cartCountDisplay) {
            cartCountDisplay.textContent = `${state.cartCount} item${state.cartCount !== 1 ? 's' : ''}`;
        }
        
        // Update summary
        const subtotal = state.cartTotal;
        const shipping = subtotal > 2500 ? 0 : 199;
        const tax = subtotal * 0.085;
        const total = subtotal + shipping + tax;
        
        document.getElementById('cart-subtotal').textContent = Utils.formatPrice(subtotal);
        document.getElementById('cart-shipping').textContent = shipping === 0 ? 'Free' : Utils.formatPrice(shipping);
        document.getElementById('cart-tax').textContent = Utils.formatPrice(tax);
        document.getElementById('cart-total').textContent = Utils.formatPrice(total);
    }
    
    static setupEventListeners() {
        document.querySelectorAll('.qty-decrease').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const item = state.cart[index];
                if (item && item.quantity > 1) {
                    state.updateCartQuantity(item.product_id, item.quantity - 1);
                    this.renderCart();
                    this.setupEventListeners();
                    updateCartUI();
                }
            });
        });
        
        document.querySelectorAll('.qty-increase').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const item = state.cart[index];
                if (item) {
                    state.updateCartQuantity(item.product_id, item.quantity + 1);
                    this.renderCart();
                    this.setupEventListeners();
                    updateCartUI();
                }
            });
        });
        
        document.querySelectorAll('.cart-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const item = state.cart[index];
                if (item) {
                    state.removeFromCart(item.product_id);
                    this.renderCart();
                    this.setupEventListeners();
                    updateCartUI();
                    Utils.showToast(`${item.product.title} removed from cart`);
                }
            });
        });
    }
}

// ============================================================================
// QUICK VIEW MODAL
// ============================================================================
class QuickView {
    static modal = document.getElementById('quick-view-modal');
    static content = document.getElementById('quick-view-content');
    static closeBtn = document.getElementById('quick-view-close');
    
    static init() {
        if (!this.modal) return;
        
        this.closeBtn.addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });
    }
    
    static async open(slug) {
        try {
            const data = await API.getProduct(slug);
            const product = data.product;
            
            if (!product) return;
            
            const thumbnail = product.thumbnail_url || 
                             (product.image_urls && product.image_urls.length > 0 ? product.image_urls[0] : CONFIG.DEFAULT_PRODUCT_IMAGE);
            
            this.content.innerHTML = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div>
                        <img src="${thumbnail}" alt="${product.title}" style="width:100%; border-radius: 4px;">
                    </div>
                    <div>
                        <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #C9A96E;">${product.category ? product.category.name : ''}</span>
                        <h2 style="font-family: 'Cormorant Garamond', serif; font-size: 2rem; margin-bottom: 1rem;">${product.title}</h2>
                        <div style="font-size: 1.5rem; font-weight: 500; margin-bottom: 1rem;">${Utils.formatPrice(product.price)}</div>
                        <p style="color: #8B8178; margin-bottom: 1.5rem;">${product.short_description || Utils.truncateText(product.description, 200)}</p>
                        <a href="/product/${product.slug}" class="btn btn-primary btn-block">View Full Details</a>
                    </div>
                </div>
            `;
            
            this.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } catch (error) {
            Utils.showToast('Failed to load product details.', 'error');
        }
    }
    
    static close() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// ============================================================================
// SEARCH FUNCTIONALITY
// ============================================================================
class Search {
    static init() {
        const toggle = document.getElementById('search-toggle');
        const dropdown = document.getElementById('search-dropdown');
        const input = document.getElementById('search-input');
        const results = document.getElementById('search-results');
        const submit = document.getElementById('search-submit');
        
        if (!toggle || !dropdown) return;
        
        toggle.addEventListener('click', () => {
            dropdown.classList.toggle('active');
            if (dropdown.classList.contains('active')) {
                input.focus();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && e.target !== toggle) {
                dropdown.classList.remove('active');
            }
        });
        
        if (input) {
            input.addEventListener('input', Utils.debounce(async () => {
                const query = input.value.trim();
                if (query.length < 2) {
                    results.innerHTML = '';
                    return;
                }
                
                try {
                    const data = await API.searchSuggestions(query);
                    const suggestions = data.suggestions || {};
                    
                    let html = '';
                    
                    if (suggestions.products && suggestions.products.length > 0) {
                        html += '<div style="padding: 0.5rem 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8B8178;">Products</div>';
                        html += suggestions.products.map(p => `
                            <a href="/product/${p.slug}" style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; transition: background-color 0.2s;">
                                <img src="${p.thumbnail || CONFIG.DEFAULT_PRODUCT_IMAGE}" alt="${p.title}" style="width: 50px; height: 60px; object-fit: cover; border-radius: 2px;">
                                <div>
                                    <div style="font-weight: 500;">${p.title}</div>
                                    <div style="color: #8B8178; font-size: 0.875rem;">${Utils.formatPrice(p.price)}</div>
                                </div>
                            </a>
                        `).join('');
                    }
                    
                    if (suggestions.categories && suggestions.categories.length > 0) {
                        html += '<div style="padding: 0.5rem 1rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: #8B8178; border-top: 1px solid #eee;">Categories</div>';
                        html += suggestions.categories.map(c => `
                            <a href="/shop?category=${c.slug}" style="display: block; padding: 0.5rem 1rem;">
                                ${c.name}
                            </a>
                        `).join('');
                    }
                    
                    if (!html) {
                        html = '<p style="padding: 1rem; color: #8B8178;">No results found</p>';
                    }
                    
                    results.innerHTML = html;
                } catch (error) {
                    results.innerHTML = '<p style="padding: 1rem; color: #8B8178;">Search failed</p>';
                }
            }, CONFIG.DEBOUNCE_DELAY));
        }
        
        if (submit) {
            submit.addEventListener('click', () => {
                const query = input.value.trim();
                if (query) {
                    window.location.href = `/shop?search=${encodeURIComponent(query)}`;
                    dropdown.classList.remove('active');
                }
            });
        }
    }
}

// ============================================================================
// MOBILE MENU
// ============================================================================
class MobileMenu {
    static init() {
        const toggle = document.getElementById('mobile-menu-toggle');
        const menu = document.getElementById('mobile-menu');
        const overlay = document.getElementById('mobile-menu-overlay');
        const close = document.getElementById('mobile-menu-close');
        
        if (!toggle || !menu) return;
        
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            menu.classList.toggle('active');
            if (overlay) overlay.classList.toggle('active');
            document.body.style.overflow = menu.classList.contains('active') ? 'hidden' : '';
        });
        
        if (close) {
            close.addEventListener('click', () => {
                toggle.classList.remove('active');
                menu.classList.remove('active');
                if (overlay) overlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
        
        if (overlay) {
            overlay.addEventListener('click', () => {
                toggle.classList.remove('active');
                menu.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
        
        // Submenu toggles
        document.querySelectorAll('.mobile-submenu-toggle').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const submenu = link.nextElementSibling;
                submenu.classList.toggle('active');
            });
        });
    }
}

// ============================================================================
// GLOBAL UI UPDATES
// ============================================================================
function updateCartUI() {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.textContent = state.cartCount;
        cartCount.style.display = state.cartCount > 0 ? 'flex' : 'none';
    }
}

function updateWishlistUI() {
    const wishlistCount = document.getElementById('wishlist-count');
    if (wishlistCount) {
        wishlistCount.textContent = state.wishlist.length;
        wishlistCount.style.display = state.wishlist.length > 0 ? 'flex' : 'none';
    }
}

function updateAuthUI() {
    const guestMenu = document.getElementById('account-menu-guest');
    const userMenu = document.getElementById('account-menu-user');
    const userName = document.getElementById('account-user-name');
    
    if (state.user) {
        if (guestMenu) guestMenu.style.display = 'none';
        if (userMenu) userMenu.style.display = 'block';
        if (userName) userName.textContent = state.user.first_name || state.user.email;
    } else {
        if (guestMenu) guestMenu.style.display = 'block';
        if (userMenu) userMenu.style.display = 'none';
    }
}

// ============================================================================
// HEADER SCROLL EFFECT
// ============================================================================
function setupHeaderScroll() {
    const header = document.getElementById('site-header');
    if (!header) return;
    
    let lastScroll = 0;
    
    window.addEventListener('scroll', Utils.debounce(() => {
        const scrollY = window.scrollY;
        
        if (scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        lastScroll = scrollY;
    }, 100));
}

// ============================================================================
// ACCOUNT DROPDOWN
// ============================================================================
function setupAccountDropdown() {
    const toggle = document.getElementById('account-toggle');
    const menu = document.getElementById('account-menu');
    
    if (!toggle || !menu) return;
    
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.toggle('active');
    });
    
    document.addEventListener('click', () => {
        menu.classList.remove('active');
    });
    
    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            state.logout();
            updateAuthUI();
            Utils.showToast('You have been signed out.');
        });
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI components
    updateCartUI();
    updateWishlistUI();
    updateAuthUI();
    
    // Setup global features
    setupHeaderScroll();
    setupAccountDropdown();
    MobileMenu.init();
    Search.init();
    QuickView.init();
    
    // Initialize page-specific controllers
    switch (state.currentPage) {
        case 'home':
            HomePage.init();
            break;
        case 'shop':
            ShopPage.init();
            break;
        case 'product':
            ProductPage.init();
            break;
        case 'cart':
            CartPage.init();
            break;
        case 'wishlist':
            WishlistPage.init();
            break;
        case 'account':
            AccountPage.init();
            break;
    }
    
    // Listen for state changes
    state.on('cart-updated', () => updateCartUI());
    state.on('wishlist-updated', () => updateWishlistUI());
    state.on('auth-changed', () => updateAuthUI());
    
    // Check authentication on load
    if (state.token) {
        API.getProfile()
            .then(data => {
                state.setUser(data.user, state.token);
            })
            .catch(() => {
                state.logout();
            });
    }
});

class WishlistPage {
    static init() {
        this.renderWishlist();
    }
    
    static renderWishlist() {
        const grid = document.getElementById('wishlist-grid');
        const empty = document.getElementById('empty-wishlist');
        
        if (!grid) return;
        
        if (state.wishlist.length === 0) {
            grid.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }
        
        grid.style.display = 'grid';
        if (empty) empty.style.display = 'none';
        
        grid.innerHTML = state.wishlist.map(product => UIComponents.createProductCard(product)).join('');
        HomePage.attachProductCardListeners(grid);
    }
}

class AccountPage {
    static init() {
        this.setupTabs();
        
        if (state.user) {
            this.loadProfile();
            this.loadOrders();
            this.loadAccountWishlist();
        } else {
            // Show login/register form
            document.querySelector('.account-content').innerHTML = `
                <h2>Sign In</h2>
                <form id="login-form">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" id="login-email" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="login-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Sign In</button>
                </form>
                <p style="margin-top: 1rem;">Demo: client@example.com / Client@2024!</p>
            `;
            
            document.getElementById('login-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                
                try {
                    const data = await API.login(email, password);
                    state.setUser(data.user, data.token);
                    Utils.showToast('Welcome back!');
                    window.location.reload();
                } catch (error) {
                    Utils.showToast('Invalid credentials', 'error');
                }
            });
        }
    }
    
    static setupTabs() {
        document.querySelectorAll('.account-nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = link.dataset.tab;
                
                document.querySelectorAll('.account-nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                document.querySelectorAll('.account-tab').forEach(t => t.classList.remove('active'));
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });
    }
    
    static loadProfile() {
        document.getElementById('profile-first-name').value = state.user.first_name || '';
        document.getElementById('profile-last-name').value = state.user.last_name || '';
        document.getElementById('profile-email').value = state.user.email || '';
        document.getElementById('profile-phone').value = state.user.phone || '';
        
        document.getElementById('profile-form').addEventListener('submit', (e) => {
            e.preventDefault();
            Utils.showToast('Profile updated successfully!');
        });
    }
    
    static loadOrders() {
        const container = document.getElementById('orders-list');
        if (!container) return;
        container.innerHTML = '<p>No orders yet. <a href="/shop">Start shopping</a></p>';
    }
    
    static loadAccountWishlist() {
        const grid = document.getElementById('account-wishlist-grid');
        if (!grid) return;
        
        if (state.wishlist.length === 0) {
            grid.innerHTML = '<p>Your wishlist is empty.</p>';
            return;
        }
        
        grid.innerHTML = state.wishlist.map(p => UIComponents.createProductCard(p)).join('');
        HomePage.attachProductCardListeners(grid);
    }
}

console.log('✦ Hayee Interior - Luxury E-Commerce Platform Initialized ✦');
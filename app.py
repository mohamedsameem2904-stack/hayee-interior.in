"""
╔══════════════════════════════════════════════════════════════╗
║                    HAYEE INTERIOR                           ║
║              Luxury E-Commerce Platform                     ║
║         Production-Ready Flask Application                   ║
╚══════════════════════════════════════════════════════════════╝
"""

import os
import re
import json
import uuid
import hashlib
from datetime import datetime, timedelta
from functools import wraps
from io import BytesIO

from flask import (
    Flask, render_template, jsonify, request, 
    abort, session, redirect, url_for, flash, 
    send_from_directory, make_response
)
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_bcrypt import Bcrypt
import jwt
from PIL import Image, ImageDraw, ImageFont
from email_validator import validate_email, EmailNotValidError

# ============================================================================
# APP INITIALIZATION
# ============================================================================

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'hayee-interior-production-secret-2024!@#$%')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///hayee_interior.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_EXPIRATION_HOURS'] = 24
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload
app.config['UPLOAD_FOLDER'] = 'static/uploads'

# Initialize extensions
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Create upload directories
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'products'), exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'avatars'), exist_ok=True)

# ============================================================================
# DATABASE MODELS
# ============================================================================

class User(db.Model):
    """User model for authentication and profile management"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(80))
    last_name = db.Column(db.String(80))
    phone = db.Column(db.String(20))
    avatar = db.Column(db.String(500))
    is_admin = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    addresses = db.relationship('Address', backref='user', lazy=True, cascade='all, delete-orphan')
    orders = db.relationship('Order', backref='user', lazy=True)
    reviews = db.relationship('Review', backref='user', lazy=True)
    wishlist_items = db.relationship('Wishlist', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    
    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)
    
    def generate_token(self):
        payload = {
            'user_id': self.id,
            'email': self.email,
            'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS'])
        }
        return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'phone': self.phone,
            'avatar': self.avatar,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat()
        }

class Address(db.Model):
    """User shipping/billing addresses"""
    __tablename__ = 'addresses'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    label = db.Column(db.String(50))  # Home, Office, etc.
    full_name = db.Column(db.String(200))
    address_line1 = db.Column(db.String(200))
    address_line2 = db.Column(db.String(200))
    city = db.Column(db.String(100))
    state = db.Column(db.String(100))
    zip_code = db.Column(db.String(20))
    country = db.Column(db.String(100), default='United States')
    phone = db.Column(db.String(20))
    is_default = db.Column(db.Boolean, default=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'label': self.label,
            'full_name': self.full_name,
            'address_line1': self.address_line1,
            'address_line2': self.address_line2,
            'city': self.city,
            'state': self.state,
            'zip_code': self.zip_code,
            'country': self.country,
            'phone': self.phone,
            'is_default': self.is_default
        }

class Category(db.Model):
    """Product categories"""
    __tablename__ = 'categories'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(500))
    parent_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    
    # Relationships
    products = db.relationship('Product', backref='category_rel', lazy=True)
    subcategories = db.relationship('Category', backref=db.backref('parent', remote_side=[id]), lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'slug': self.slug,
            'description': self.description,
            'image_url': self.image_url,
            'parent_id': self.parent_id,
            'sort_order': self.sort_order,
            'product_count': len(self.products)
        }

class Product(db.Model):
    """Enhanced product model with comprehensive attributes"""
    __tablename__ = 'products'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(300), nullable=False)
    slug = db.Column(db.String(300), unique=True, nullable=False, index=True)
    sku = db.Column(db.String(50), unique=True, nullable=False)
    
    # Detailed descriptions
    short_description = db.Column(db.Text)
    description = db.Column(db.Text, nullable=False)
    features = db.Column(db.Text)  # JSON array of features
    care_instructions = db.Column(db.Text)
    
    # Pricing
    price = db.Column(db.Float, nullable=False)
    compare_at_price = db.Column(db.Float)
    cost_price = db.Column(db.Float)  # For internal use
    
    # Inventory
    inventory_count = db.Column(db.Integer, default=0)
    low_stock_threshold = db.Column(db.Integer, default=5)
    is_active = db.Column(db.Boolean, default=True)
    is_featured = db.Column(db.Boolean, default=False)
    is_bestseller = db.Column(db.Boolean, default=False)
    is_new_arrival = db.Column(db.Boolean, default=False)
    
    # Categorization
    category_id = db.Column(db.Integer, db.ForeignKey('categories.id'))
    tags = db.Column(db.Text)  # Comma-separated tags
    
    # Media
    image_urls = db.Column(db.Text)  # JSON array of URLs
    thumbnail_url = db.Column(db.String(500))
    video_url = db.Column(db.String(500))
    
    # Specifications
    dimensions = db.Column(db.String(300))
    dimensions_metric = db.Column(db.String(300))
    materials = db.Column(db.String(300))
    finishes = db.Column(db.String(300))
    color = db.Column(db.String(100))
    color_hex = db.Column(db.String(7))
    weight = db.Column(db.String(50))
    style = db.Column(db.String(100))
    room = db.Column(db.String(100))
    
    # Shipping
    shipping_weight = db.Column(db.Float)
    shipping_dimensions = db.Column(db.String(200))
    free_shipping = db.Column(db.Boolean, default=True)
    
    # SEO
    meta_title = db.Column(db.String(300))
    meta_description = db.Column(db.Text)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    reviews = db.relationship('Review', backref='product', lazy=True, cascade='all, delete-orphan')
    wishlisted_by = db.relationship('Wishlist', backref='product', lazy=True)
    
    @property
    def average_rating(self):
        if not self.reviews:
            return 0
        return round(sum(r.rating for r in self.reviews) / len(self.reviews), 1)
    
    @property
    def review_count(self):
        return len(self.reviews)
    
    @property
    def in_stock(self):
        return self.inventory_count > 0
    
    @property
    def is_low_stock(self):
        return 0 < self.inventory_count <= self.low_stock_threshold
    
    def to_dict(self, include_related=False):
        data = {
            'id': self.id,
            'title': self.title,
            'slug': self.slug,
            'sku': self.sku,
            'short_description': self.short_description,
            'description': self.description,
            'features': json.loads(self.features) if self.features else [],
            'care_instructions': self.care_instructions,
            'price': self.price,
            'compare_at_price': self.compare_at_price,
            'inventory_count': self.inventory_count,
            'in_stock': self.in_stock,
            'is_low_stock': self.is_low_stock,
            'is_active': self.is_active,
            'is_featured': self.is_featured,
            'is_bestseller': self.is_bestseller,
            'is_new_arrival': self.is_new_arrival,
            'category': self.category_rel.to_dict() if self.category_rel else None,
            'tags': self.tags.split(',') if self.tags else [],
            'image_urls': json.loads(self.image_urls) if self.image_urls else [],
            'thumbnail_url': self.thumbnail_url,
            'video_url': self.video_url,
            'dimensions': self.dimensions,
            'materials': self.materials,
            'finishes': self.finishes,
            'color': self.color,
            'color_hex': self.color_hex,
            'weight': self.weight,
            'style': self.style,
            'room': self.room,
            'free_shipping': self.free_shipping,
            'average_rating': self.average_rating,
            'review_count': self.review_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_related:
            data['reviews'] = [r.to_dict() for r in self.reviews[:5]]
            
        return data

class Review(db.Model):
    """Product reviews and ratings"""
    __tablename__ = 'reviews'
    
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1-5 stars
    title = db.Column(db.String(200))
    comment = db.Column(db.Text)
    is_verified_purchase = db.Column(db.Boolean, default=False)
    is_approved = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'rating': self.rating,
            'title': self.title,
            'comment': self.comment,
            'is_verified_purchase': self.is_verified_purchase,
            'user_name': f"{self.user.first_name} {self.user.last_name}" if self.user else "Anonymous",
            'user_avatar': self.user.avatar if self.user else None,
            'created_at': self.created_at.isoformat()
        }

class Wishlist(db.Model):
    """User wishlist/favorites"""
    __tablename__ = 'wishlists'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'product_id', name='unique_wishlist_item'),)

class Cart(db.Model):
    """Persistent shopping cart"""
    __tablename__ = 'carts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    session_id = db.Column(db.String(200), nullable=True, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    product = db.relationship('Product', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'product': self.product.to_dict(),
            'quantity': self.quantity,
            'subtotal': self.product.price * self.quantity
        }

class Order(db.Model):
    """Customer orders"""
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(20), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Order details
    status = db.Column(db.String(50), default='pending')  # pending, confirmed, shipped, delivered, cancelled
    subtotal = db.Column(db.Float, nullable=False)
    shipping_cost = db.Column(db.Float, default=0)
    tax = db.Column(db.Float, default=0)
    discount = db.Column(db.Float, default=0)
    total = db.Column(db.Float, nullable=False)
    
    # Shipping info
    shipping_address = db.Column(db.Text)  # JSON
    shipping_method = db.Column(db.String(100))
    tracking_number = db.Column(db.String(100))
    
    # Payment info
    payment_method = db.Column(db.String(50))
    payment_status = db.Column(db.String(50), default='pending')
    
    # Notes
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_number': self.order_number,
            'status': self.status,
            'subtotal': self.subtotal,
            'shipping_cost': self.shipping_cost,
            'tax': self.tax,
            'discount': self.discount,
            'total': self.total,
            'payment_method': self.payment_method,
            'payment_status': self.payment_status,
            'tracking_number': self.tracking_number,
            'items': [item.to_dict() for item in self.items],
            'created_at': self.created_at.isoformat()
        }

class OrderItem(db.Model):
    """Individual items within an order"""
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price_at_time = db.Column(db.Float, nullable=False)
    
    product = db.relationship('Product', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'product': self.product.to_dict() if self.product else None,
            'quantity': self.quantity,
            'price_at_time': self.price_at_time,
            'subtotal': self.price_at_time * self.quantity
        }

# ============================================================================
# AUTHENTICATION DECORATORS
# ============================================================================

def token_required(f):
    """Decorator to protect API routes with JWT authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'success': False, 'error': 'User not found'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'error': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    """Decorator for admin-only endpoints"""
    @wraps(f)
    @token_required
    def decorated(current_user, *args, **kwargs):
        if not current_user.is_admin:
            return jsonify({'success': False, 'error': 'Admin access required'}), 403
        return f(current_user, *args, **kwargs)
    
    return decorated

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def generate_order_number():
    """Generate unique order number"""
    timestamp = datetime.utcnow().strftime('%Y%m%d')
    unique_id = str(uuid.uuid4().hex[:6].upper())
    return f"HAY-{timestamp}-{unique_id}"

def generate_slug(title):
    """Generate URL-friendly slug from title"""
    slug = re.sub(r'[^\w\s-]', '', title.lower())
    slug = re.sub(r'[-\s]+', '-', slug).strip('-')
    return slug

def create_placeholder_image(width, height, text, color_scheme='luxury'):
    """Generate placeholder product images"""
    if color_scheme == 'luxury':
        colors = [
            (214, 207, 196, 255),  # Warm gray
            (232, 227, 222, 255),  # Light cream
            (196, 184, 170, 255),  # Taupe
            (180, 170, 160, 255),  # Greige
        ]
    else:
        colors = [(200, 200, 200, 255)]
    
    img = Image.new('RGBA', (width, height), colors[0])
    draw = ImageDraw.Draw(img)
    
    # Add subtle gradient effect
    for i in range(height):
        alpha = int(255 * (1 - i/height * 0.3))
        color = colors[0][:3] + (alpha,)
        draw.line([(0, i), (width, i)], fill=color)
    
    # Add centered text
    try:
        font_size = min(width, height) // 20
        font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', font_size)
    except:
        font = ImageFont.load_default()
    
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_position = ((width - text_bbox[2]) // 2, (height - text_bbox[3]) // 2)
    draw.text(text_position, text, fill=(100, 100, 100, 255), font=font)
    
    return img

# ============================================================================
# SEED DATA
# ============================================================================

def seed_database():
    """Populate database with comprehensive luxury product data"""
    
    if Product.query.first() is not None:
        return
    
    print("🌱 Seeding database with luxury products...")
    
    # Create categories
    categories = [
        Category(name='Seating', slug='seating', description='Luxurious sofas, chairs, and ottomans', sort_order=1),
        Category(name='Tables', slug='tables', description='Elegant dining, coffee, and accent tables', sort_order=2),
        Category(name='Lighting', slug='lighting', description='Statement chandeliers, lamps, and sconces', sort_order=3),
        Category(name='Storage', slug='storage', description='Sophisticated cabinets, credenzas, and shelves', sort_order=4),
        Category(name='Textiles', slug='textiles', description='Handcrafted rugs, pillows, and throws', sort_order=5),
        Category(name='Décor', slug='decor', description='Curated mirrors, art, and accessories', sort_order=6),
        Category(name='Outdoor', slug='outdoor', description='Refined outdoor furniture and accessories', sort_order=7),
    ]
    
    for cat in categories:
        db.session.add(cat)
    
    db.session.commit()
    
    # Create admin user
    admin = User(
        email='admin@hayeeinterior.com',
        first_name='Hayee',
        last_name='Admin',
        is_admin=True,
        is_active=True
    )
    admin.set_password('Admin@2024!')
    db.session.add(admin)
    
    # Create demo user
    demo_user = User(
        email='client@example.com',
        first_name='Sophia',
        last_name='Laurent',
        phone='+1-212-555-0127',
        is_admin=False
    )
    demo_user.set_password('Client@2024!')
    db.session.add(demo_user)
    
    db.session.commit()
    
    # Create luxury products
    products_data = [
        {
            'title': 'The Palermo Velvet Sofa',
            'category_slug': 'seating',
            'price': 5895.00,
            'compare_at_price': 7200.00,
            'inventory': 7,
            'featured': True,
            'bestseller': True,
            'features': [
                'Handcrafted Italian velvet upholstery',
                'Eight-way hand-tied spring system',
                'Solid maple frame with corner blocking',
                'Down-filled cushions with feather wrap',
                'Antique brass nailhead trim',
                'Customizable in 40+ fabrics'
            ],
            'dimensions': '96"W × 42"D × 34"H',
            'materials': 'Italian Velvet, Solid Maple, Brass, Down Feathers',
            'color': 'Anthracite',
            'color_hex': '#2C2C2C',
            'style': 'Modern Classic',
            'room': 'Living Room',
            'care': 'Professional cleaning recommended. Rotate cushions monthly. Avoid direct sunlight.'
        },
        {
            'title': 'Carrara Marble Cascade Dining Table',
            'category_slug': 'tables',
            'price': 8495.00,
            'compare_at_price': 10200.00,
            'inventory': 3,
            'featured': True,
            'bestseller': False,
            'new_arrival': True,
            'features': [
                'Single-slab Italian Carrara marble top',
                'Hand-selected and book-matched veining',
                'Sculptural brushed gold stainless steel base',
                'Seats 8-10 comfortably',
                'Each piece unique with natural variations',
                'Sealed with premium stone protectant'
            ],
            'dimensions': '120"W × 48"D × 30"H',
            'materials': 'Carrara Marble, Brushed Gold Stainless Steel',
            'color': 'White Marble with Grey Veining',
            'color_hex': '#F5F0EB',
            'style': 'Contemporary Luxury',
            'room': 'Dining Room',
            'care': 'Wipe spills immediately. Use coasters. Reseal annually with stone sealer.'
        },
        {
            'title': 'Aurora Crystal Rain Chandelier',
            'category_slug': 'lighting',
            'price': 12995.00,
            'compare_at_price': None,
            'inventory': 2,
            'featured': True,
            'bestseller': False,
            'features': [
                'Over 2,000 hand-cut Swarovski crystals',
                'Customizable LED color temperature',
                'Dimmable with smart home integration',
                'Suspended from hand-forged bronze frame',
                'Each crystal individually strung',
                'Includes professional installation consultation'
            ],
            'dimensions': '60"W × 60"D × 96"H (adjustable)',
            'materials': 'Swarovski Crystal, Bronze, Brass, LED System',
            'color': 'Crystal with Oil-Rubbed Bronze',
            'color_hex': '#3C2415',
            'style': 'Grand Traditional',
            'room': 'Dining Room / Foyer',
            'care': 'Dust with microfiber cloth. Professional cleaning annually.'
        },
        {
            'title': 'The Como Leather Lounge Chair',
            'category_slug': 'seating',
            'price': 3495.00,
            'compare_at_price': 4200.00,
            'inventory': 12,
            'featured': False,
            'bestseller': True,
            'features': [
                'Full-grain Italian leather',
                'Ergonomic design with lumbar support',
                'Solid walnut legs with brass ferrules',
                'Hand-stitched detailing',
                'Down-filled seat cushion',
                'Available in 8 leather colors'
            ],
            'dimensions': '34"W × 36"D × 38"H',
            'materials': 'Full-Grain Italian Leather, Solid Walnut, Brass',
            'color': 'Cognac',
            'color_hex': '#9A4D2F',
            'style': 'Mid-Century Modern',
            'room': 'Living Room / Study',
            'care': 'Condition leather every 6 months. Keep away from heat sources.'
        },
        {
            'title': 'Verdi Artisan Wool & Silk Rug',
            'category_slug': 'textiles',
            'price': 4295.00,
            'compare_at_price': None,
            'inventory': 5,
            'featured': True,
            'bestseller': False,
            'features': [
                'Hand-knotted with 100 knots per square inch',
                'Premium New Zealand wool with silk highlights',
                'Abstract expressionist design',
                'Natural vegetable dyes',
                'Each rug takes 6 months to create',
                'Custom sizes available'
            ],
            'dimensions': '9\' × 12\' (standard)',
            'materials': 'New Zealand Wool, Silk, Cotton Foundation',
            'color': 'Ivory, Charcoal, Gold',
            'color_hex': '#E8E3DE',
            'style': 'Transitional',
            'room': 'Living Room / Bedroom',
            'care': 'Vacuum without beater bar. Professional cleaning only. Rotate annually.'
        },
        {
            'title': 'The Modernist Credenza',
            'category_slug': 'storage',
            'price': 5295.00,
            'compare_at_price': 6500.00,
            'inventory': 4,
            'featured': True,
            'bestseller': False,
            'features': [
                'Quarter-sawn white oak with cerused finish',
                'Push-to-open doors with soft-close',
                'Adjustable interior shelving',
                'Floating appearance on steel legs',
                'Integrated cable management',
                'Custom hardware in brass or nickel'
            ],
            'dimensions': '84"W × 22"D × 32"H',
            'materials': 'Quarter-Sawn White Oak, Powder-Coated Steel, Brass',
            'color': 'Cerused Oak',
            'color_hex': '#C4B5A5',
            'style': 'Modern Minimalist',
            'room': 'Living Room / Media Room',
            'care': 'Dust with soft cloth. Avoid harsh chemicals. Use furniture wax annually.'
        },
        {
            'title': 'Sculptural Alabaster Table Lamp',
            'category_slug': 'lighting',
            'price': 1895.00,
            'compare_at_price': 2300.00,
            'inventory': 15,
            'featured': False,
            'bestseller': True,
            'features': [
                'Hand-carved Spanish alabaster body',
                'Each piece unique with natural veining',
                'Brushed brass accents and base',
                'Linen shade with gold lining',
                'Dimmable with touch sensor',
                'Includes designer LED bulb'
            ],
            'dimensions': '18"W × 18"D × 32"H',
            'materials': 'Spanish Alabaster, Brushed Brass, Belgian Linen',
            'color': 'Warm Alabaster',
            'color_hex': '#F5DEB3',
            'style': 'Organic Modern',
            'room': 'Bedroom / Living Room',
            'care': 'Dust gently. Avoid water exposure. Handle with care.'
        },
        {
            'title': 'Elysian Dining Chair Collection',
            'category_slug': 'seating',
            'price': 1895.00,
            'compare_at_price': None,
            'inventory': 20,
            'featured': False,
            'bestseller': True,
            'new_arrival': True,
            'features': [
                'Set of 2 chairs',
                'Channel-quilted top-grain leather',
                'Cantilevered solid ash frame',
                'Ergonomic curved backrest',
                'Brass foot caps',
                'Available in 5 leather finishes'
            ],
            'dimensions': '22"W × 24"D × 34"H (each)',
            'materials': 'Top-Grain Leather, Solid Ash, Brass',
            'color': 'Caramel',
            'color_hex': '#C68E58',
            'style': 'Scandinavian Luxury',
            'room': 'Dining Room',
            'care': 'Wipe spills immediately. Condition leather quarterly.'
        },
        {
            'title': 'Lumière Grand Wall Mirror',
            'category_slug': 'decor',
            'price': 3895.00,
            'compare_at_price': 4800.00,
            'inventory': 3,
            'featured': True,
            'bestseller': False,
            'features': [
                'Oversized beveled glass',
                'Hand-applied antiqued gold leaf frame',
                'French cleat mounting system included',
                'Heirloom-quality craftsmanship',
                'Custom sizing available',
                'Professional installation recommended'
            ],
            'dimensions': '48"W × 72"H × 3"D',
            'materials': 'Beveled Glass, Gold Leaf, Solid Wood Frame',
            'color': 'Antiqued Gold',
            'color_hex': '#CFB53B',
            'style': 'French Provincial',
            'room': 'Entry / Living Room',
            'care': 'Clean with ammonia-free glass cleaner. Dust frame with soft brush.'
        },
        {
            'title': 'Montecito Outdoor Lounge Set',
            'category_slug': 'outdoor',
            'price': 7295.00,
            'compare_at_price': 8900.00,
            'inventory': 6,
            'featured': True,
            'bestseller': False,
            'new_arrival': True,
            'features': [
                'Includes sofa, 2 chairs, and coffee table',
                'Solution-dyed acrylic fabric (UV resistant)',
                'Powder-coated aluminum frames',
                'Quick-dry foam cushions',
                'All-weather wicker detailing',
                '10-year frame warranty'
            ],
            'dimensions': 'Sofa: 84"W × 36"D × 32"H',
            'materials': 'Aluminum, All-Weather Wicker, Sunbrella Fabric',
            'color': 'Natural Linen',
            'color_hex': '#F5F0E6',
            'style': 'Coastal Luxury',
            'room': 'Patio / Garden',
            'care': 'Cover when not in use. Clean with mild soap and water.'
        },
        {
            'title': 'The Gallery Console Table',
            'category_slug': 'tables',
            'price': 2795.00,
            'compare_at_price': 3400.00,
            'inventory': 8,
            'featured': False,
            'bestseller': False,
            'features': [
                'Live-edge acacia wood top',
                'Geometric brass base',
                'Natural edge preserved',
                'Water-based matte finish',
                'Each table unique',
                'Adjustable levelers'
            ],
            'dimensions': '60"W × 18"D × 32"H',
            'materials': 'Acacia Wood, Solid Brass',
            'color': 'Natural Acacia',
            'color_hex': '#8B7355',
            'style': 'Organic Modern',
            'room': 'Entry / Hallway',
            'care': 'Dust regularly. Use coasters. Avoid direct sunlight.'
        },
        {
            'title': 'Celestial Pendant Light Cluster',
            'category_slug': 'lighting',
            'price': 3195.00,
            'compare_at_price': None,
            'inventory': 5,
            'featured': False,
            'bestseller': False,
            'new_arrival': True,
            'features': [
                'Cluster of 5 handblown glass pendants',
                'Adjustable heights',
                'Warm LED with dimming capability',
                'Brass canopy and fittings',
                'Each globe unique',
                'Custom configurations available'
            ],
            'dimensions': 'Varies by configuration (canopy: 36"L)',
            'materials': 'Handblown Glass, Brushed Brass, LED',
            'color': 'Smoke Grey Glass',
            'color_hex': '#8B8682',
            'style': 'Contemporary Artisan',
            'room': 'Kitchen / Dining',
            'care': 'Dust with microfiber. Professional cleaning for glass.'
        },
    ]
    
    for data in products_data:
        category = Category.query.filter_by(slug=data['category_slug']).first()
        
        # Generate placeholder images
        img = create_placeholder_image(800, 1000, data['title'][:30], 'luxury')
        img_filename = f"{generate_slug(data['title'])}.png"
        img_path = os.path.join(app.config['UPLOAD_FOLDER'], 'products', img_filename)
        img.save(img_path, 'PNG')
        
        # Create thumbnail
        thumb = create_placeholder_image(400, 500, data['title'][:20], 'luxury')
        thumb_filename = f"{generate_slug(data['title'])}_thumb.png"
        thumb_path = os.path.join(app.config['UPLOAD_FOLDER'], 'products', thumb_filename)
        thumb.save(thumb_path, 'PNG')
        
        product = Product(
            title=data['title'],
            slug=generate_slug(data['title']),
            sku=f"HAY-{category.name[:2].upper()}-{uuid.uuid4().hex[:4].upper()}",
            short_description=f"Exquisite {data['category_slug'].lower()} piece that embodies the Hayee Interior commitment to exceptional craftsmanship and timeless design.",
            description=f"""Experience the pinnacle of luxury with the {data['title']}. This exceptional {data['category_slug'].lower()} piece represents the perfect fusion of masterful craftsmanship and sophisticated design, brought to you exclusively by Hayee Interior.

Each {data['title']} is meticulously crafted by artisans who have dedicated their lives to perfecting their craft. Using only the finest materials sourced from around the world, our pieces are built to last generations while maintaining their timeless beauty.

The {data['title']} features {data['materials'].lower()}, carefully selected for both aesthetic appeal and enduring quality. The {data['color'].lower()} finish adds a touch of sophistication that complements any luxury interior.

At Hayee Interior, we believe that exceptional furniture should not only be beautiful but also functional. That's why we've designed every piece with both form and function in mind, ensuring that your investment brings joy and utility for years to come.""",
            features=json.dumps(data['features']),
            care_instructions=data['care'],
            price=data['price'],
            compare_at_price=data['compare_at_price'],
            inventory_count=data['inventory'],
            is_featured=data['featured'],
            is_bestseller=data['bestseller'],
            is_new_arrival=data.get('new_arrival', False),
            category_id=category.id,
            tags=f"{data['style']},{data['room']},{category.name},Luxury,{data['color']}",
            image_urls=json.dumps([f"/static/uploads/products/{img_filename}"]),
            thumbnail_url=f"/static/uploads/products/{thumb_filename}",
            dimensions=data['dimensions'],
            materials=data['materials'],
            color=data['color'],
            color_hex=data['color_hex'],
            style=data['style'],
            room=data['room'],
            free_shipping=True,
            meta_title=f"{data['title']} | Luxury {category.name} | Hayee Interior",
            meta_description=f"Shop the {data['title']} at Hayee Interior. {data['materials']}. {data['dimensions']}. Complimentary white glove delivery."
        )
        db.session.add(product)
    
    db.session.commit()
    print(f"✅ Database seeded successfully with {len(products_data)} luxury products")

# ============================================================================
# AUTH ROUTES
# ============================================================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        # Validate email
        try:
            valid = validate_email(data['email'])
            email = valid.email
        except EmailNotValidError:
            return jsonify({'success': False, 'error': 'Invalid email address'}), 400
        
        # Check existing user
        if User.query.filter_by(email=email).first():
            return jsonify({'success': False, 'error': 'Email already registered'}), 409
        
        # Validate password
        if len(data['password']) < 8:
            return jsonify({'success': False, 'error': 'Password must be at least 8 characters'}), 400
        
        # Create user
        user = User(
            email=email,
            first_name=data.get('first_name', ''),
            last_name=data.get('last_name', ''),
            phone=data.get('phone', '')
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Generate token
        token = user.generate_token()
        
        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'token': token,
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Authenticate user and return token"""
    try:
        data = request.get_json()
        
        user = User.query.filter_by(email=data['email']).first()
        
        if not user or not user.check_password(data['password']):
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
        
        if not user.is_active:
            return jsonify({'success': False, 'error': 'Account is deactivated'}), 403
        
        token = user.generate_token()
        
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'token': token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/auth/profile', methods=['GET'])
@token_required
def get_profile(current_user):
    """Get current user profile"""
    return jsonify({
        'success': True,
        'user': current_user.to_dict()
    })

# ============================================================================
# PRODUCT API ROUTES
# ============================================================================

@app.route('/api/products', methods=['GET'])
def get_products():
    """
    Comprehensive product listing with advanced filtering
    Query parameters:
    - category: Filter by category slug
    - featured: Filter featured products
    - bestseller: Filter bestseller products
    - new_arrival: Filter new arrivals
    - search: Search in title/description
    - min_price: Minimum price
    - max_price: Maximum price
    - style: Filter by style
    - room: Filter by room
    - sort: Sort field (price, title, created_at, rating)
    - order: Sort order (asc, desc)
    - page: Page number (default 1)
    - limit: Items per page (default 12)
    """
    try:
        # Base query
        query = Product.query.filter_by(is_active=True)
        
        # Category filter
        category = request.args.get('category')
        if category:
            cat = Category.query.filter_by(slug=category).first()
            if cat:
                # Include subcategories
                category_ids = [cat.id]
                for sub in cat.subcategories:
                    category_ids.append(sub.id)
                query = query.filter(Product.category_id.in_(category_ids))
        
        # Featured/Bestseller/New filters
        if request.args.get('featured') == 'true':
            query = query.filter_by(is_featured=True)
        if request.args.get('bestseller') == 'true':
            query = query.filter_by(is_bestseller=True)
        if request.args.get('new_arrival') == 'true':
            query = query.filter_by(is_new_arrival=True)
        
        # Search
        search = request.args.get('search')
        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    Product.title.ilike(search_term),
                    Product.description.ilike(search_term),
                    Product.short_description.ilike(search_term)
                )
            )
        
        # Price range
        min_price = request.args.get('min_price', type=float)
        if min_price is not None:
            query = query.filter(Product.price >= min_price)
        
        max_price = request.args.get('max_price', type=float)
        if max_price is not None:
            query = query.filter(Product.price <= max_price)
        
        # Style and room
        style = request.args.get('style')
        if style:
            query = query.filter(Product.style == style)
        
        room = request.args.get('room')
        if room:
            query = query.filter(Product.room == room)
        
        # Sorting
        sort = request.args.get('sort', 'created_at')
        order = request.args.get('order', 'desc')
        
        sort_fields = {
            'price': Product.price,
            'title': Product.title,
            'created_at': Product.created_at,
            'rating': None,  # Handled separately
        }
        
        if sort == 'rating':
            # Sort by average rating (requires post-processing)
            query = query.outerjoin(Review).group_by(Product.id).order_by(
                db.func.avg(Review.rating).desc() if order == 'desc' else db.func.avg(Review.rating).asc()
            )
        elif sort in sort_fields:
            sort_field = sort_fields[sort]
            query = query.order_by(sort_field.desc() if order == 'desc' else sort_field.asc())
        
        # Pagination
        page = request.args.get('page', 1, type=int)
        limit = min(request.args.get('limit', 12, type=int), 50)
        
        pagination = query.paginate(page=page, per_page=limit, error_out=False)
        
        return jsonify({
            'success': True,
            'count': pagination.total,
            'page': page,
            'pages': pagination.pages,
            'has_next': pagination.has_next,
            'has_prev': pagination.has_prev,
            'products': [p.to_dict() for p in pagination.items]
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<slug>', methods=['GET'])
def get_product(slug):
    """Get single product with full details"""
    product = Product.query.filter_by(slug=slug, is_active=True).first()
    
    if not product:
        return jsonify({'success': False, 'error': 'Product not found'}), 404
    
    # Get related products
    related = Product.query.filter(
        Product.category_id == product.category_id,
        Product.id != product.id,
        Product.is_active == True
    ).limit(4).all()
    
    return jsonify({
        'success': True,
        'product': product.to_dict(include_related=True),
        'related_products': [p.to_dict() for p in related]
    })

# ============================================================================
# CART API ROUTES
# ============================================================================

@app.route('/api/cart', methods=['GET'])
def get_cart():
    """Get cart contents"""
    session_id = request.cookies.get('session_id')
    user_id = None
    
    # Check for authenticated user
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token:
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = data['user_id']
        except:
            pass
    
    # Get cart items
    if user_id:
        cart_items = Cart.query.filter_by(user_id=user_id).all()
    elif session_id:
        cart_items = Cart.query.filter_by(session_id=session_id).all()
    else:
        cart_items = []
    
    subtotal = sum(item.product.price * item.quantity for item in cart_items)
    count = sum(item.quantity for item in cart_items)
    
    return jsonify({
        'success': True,
        'count': count,
        'subtotal': subtotal,
        'items': [item.to_dict() for item in cart_items]
    })

@app.route('/api/cart/add', methods=['POST'])
def add_to_cart():
    """Add item to cart"""
    data = request.get_json()
    product_id = data.get('product_id')
    quantity = data.get('quantity', 1)
    
    product = Product.query.get_or_404(product_id)
    
    if not product.in_stock:
        return jsonify({'success': False, 'error': 'Product out of stock'}), 400
    
    if quantity > product.inventory_count:
        return jsonify({'success': False, 'error': f'Only {product.inventory_count} available'}), 400
    
    # Get or create session
    session_id = request.cookies.get('session_id')
    if not session_id:
        session_id = str(uuid.uuid4())
    
    # Check for authenticated user
    user_id = None
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if token:
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user_id = data['user_id']
        except:
            pass
    
    # Check if product already in cart
    if user_id:
        cart_item = Cart.query.filter_by(user_id=user_id, product_id=product_id).first()
    else:
        cart_item = Cart.query.filter_by(session_id=session_id, product_id=product_id).first()
    
    if cart_item:
        cart_item.quantity += quantity
    else:
        cart_item = Cart(
            user_id=user_id,
            session_id=session_id,
            product_id=product_id,
            quantity=quantity
        )
        db.session.add(cart_item)
    
    db.session.commit()
    
    response = make_response(jsonify({
        'success': True,
        'message': f'{product.title} added to cart',
        'cart_item': cart_item.to_dict()
    }))
    
    if not request.cookies.get('session_id'):
        response.set_cookie('session_id', session_id, max_age=30*24*60*60)  # 30 days
    
    return response, 201

@app.route('/api/cart/update/<int:item_id>', methods=['PUT'])
def update_cart_item(item_id):
    """Update cart item quantity"""
    data = request.get_json()
    quantity = data.get('quantity', 1)
    
    cart_item = Cart.query.get_or_404(item_id)
    
    if quantity <= 0:
        db.session.delete(cart_item)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Item removed from cart'})
    
    if quantity > cart_item.product.inventory_count:
        return jsonify({'success': False, 'error': 'Requested quantity not available'}), 400
    
    cart_item.quantity = quantity
    db.session.commit()
    
    return jsonify({
        'success': True,
        'cart_item': cart_item.to_dict()
    })

@app.route('/api/cart/remove/<int:item_id>', methods=['DELETE'])
def remove_from_cart(item_id):
    """Remove item from cart"""
    cart_item = Cart.query.get_or_404(item_id)
    db.session.delete(cart_item)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Item removed from cart'})

# ============================================================================
# WISHLIST API ROUTES
# ============================================================================

@app.route('/api/wishlist', methods=['GET'])
@token_required
def get_wishlist(current_user):
    """Get user's wishlist"""
    wishlist_items = Wishlist.query.filter_by(user_id=current_user.id).all()
    return jsonify({
        'success': True,
        'count': len(wishlist_items),
        'items': [{
            'id': item.id,
            'product': item.product.to_dict(),
            'added_at': item.created_at.isoformat()
        } for item in wishlist_items]
    })

@app.route('/api/wishlist/toggle/<int:product_id>', methods=['POST'])
@token_required
def toggle_wishlist(current_user, product_id):
    """Toggle product in wishlist"""
    product = Product.query.get_or_404(product_id)
    
    existing = Wishlist.query.filter_by(
        user_id=current_user.id,
        product_id=product_id
    ).first()
    
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Removed from wishlist', 'in_wishlist': False})
    else:
        wishlist_item = Wishlist(user_id=current_user.id, product_id=product_id)
        db.session.add(wishlist_item)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Added to wishlist', 'in_wishlist': True})

# ============================================================================
# ORDER API ROUTES
# ============================================================================

@app.route('/api/orders', methods=['POST'])
@token_required
def create_order(current_user):
    """Create a new order"""
    try:
        data = request.get_json()
        
        # Get cart items
        cart_items = Cart.query.filter_by(user_id=current_user.id).all()
        if not cart_items:
            return jsonify({'success': False, 'error': 'Cart is empty'}), 400
        
        # Calculate totals
        subtotal = sum(item.product.price * item.quantity for item in cart_items)
        shipping = 0 if all(item.product.free_shipping for item in cart_items) else 199
        tax = round(subtotal * 0.085, 2)  # 8.5% tax rate
        total = subtotal + shipping + tax
        
        # Create order
        order = Order(
            order_number=generate_order_number(),
            user_id=current_user.id,
            subtotal=subtotal,
            shipping_cost=shipping,
            tax=tax,
            total=total,
            shipping_address=json.dumps(data.get('shipping_address', {})),
            payment_method=data.get('payment_method', 'credit_card'),
            notes=data.get('notes', '')
        )
        db.session.add(order)
        db.session.flush()
        
        # Create order items and update inventory
        for cart_item in cart_items:
            order_item = OrderItem(
                order_id=order.id,
                product_id=cart_item.product_id,
                quantity=cart_item.quantity,
                price_at_time=cart_item.product.price
            )
            db.session.add(order_item)
            
            # Update inventory
            cart_item.product.inventory_count -= cart_item.quantity
        
        # Clear cart
        Cart.query.filter_by(user_id=current_user.id).delete()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Order created successfully',
            'order': order.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/orders', methods=['GET'])
@token_required
def get_orders(current_user):
    """Get user's order history"""
    orders = Order.query.filter_by(user_id=current_user.id).order_by(Order.created_at.desc()).all()
    return jsonify({
        'success': True,
        'count': len(orders),
        'orders': [order.to_dict() for order in orders]
    })

# ============================================================================
# REVIEW API ROUTES
# ============================================================================

@app.route('/api/products/<slug>/reviews', methods=['GET'])
def get_product_reviews(slug):
    """Get reviews for a product"""
    product = Product.query.filter_by(slug=slug).first_or_404()
    reviews = Review.query.filter_by(product_id=product.id, is_approved=True).order_by(Review.created_at.desc()).all()
    
    return jsonify({
        'success': True,
        'average_rating': product.average_rating,
        'count': len(reviews),
        'reviews': [r.to_dict() for r in reviews]
    })

@app.route('/api/products/<int:product_id>/reviews', methods=['POST'])
@token_required
def create_review(current_user, product_id):
    """Create a product review"""
    try:
        data = request.get_json()
        
        # Check if already reviewed
        existing = Review.query.filter_by(
            user_id=current_user.id,
            product_id=product_id
        ).first()
        
        if existing:
            return jsonify({'success': False, 'error': 'You have already reviewed this product'}), 400
        
        review = Review(
            product_id=product_id,
            user_id=current_user.id,
            rating=data['rating'],
            title=data.get('title', ''),
            comment=data.get('comment', '')
        )
        
        db.session.add(review)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Review submitted successfully',
            'review': review.to_dict()
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# SEARCH & DISCOVERY
# ============================================================================

@app.route('/api/search/suggestions', methods=['GET'])
def search_suggestions():
    """Get search autocomplete suggestions"""
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify({'success': True, 'suggestions': []})
    
    products = Product.query.filter(
        Product.title.ilike(f'%{query}%'),
        Product.is_active == True
    ).limit(5).all()
    
    categories = Category.query.filter(
        Category.name.ilike(f'%{query}%')
    ).limit(3).all()
    
    suggestions = {
        'products': [{'title': p.title, 'slug': p.slug, 'price': p.price, 'thumbnail': p.thumbnail_url} for p in products],
        'categories': [{'name': c.name, 'slug': c.slug} for c in categories]
    }
    
    return jsonify({'success': True, 'suggestions': suggestions})

# ============================================================================
# CATEGORY ROUTES
# ============================================================================

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all categories with product counts"""
    categories = Category.query.filter_by(is_active=True).order_by(Category.sort_order).all()
    return jsonify({
        'success': True,
        'categories': [cat.to_dict() for cat in categories]
    })

# ============================================================================
# STATIC FILES & ASSETS
# ============================================================================

@app.route('/static/uploads/<path:filename>')
def uploaded_file(filename):
    """Serve uploaded files"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# ============================================================================
# FRONTEND ROUTES
# ============================================================================

@app.route('/')
def home():
    """Homepage"""
    return render_template('index.html', page='home')

@app.route('/shop')
def shop():
    """Shop page"""
    return render_template('index.html', page='shop')

@app.route('/product/<slug>')
def product_detail(slug):
    """Product detail page"""
    product = Product.query.filter_by(slug=slug, is_active=True).first_or_404()
    return render_template('index.html', page='product', product=product)

@app.route('/cart')
def cart_page():
    """Shopping cart page"""
    return render_template('index.html', page='cart')

@app.route('/wishlist')
def wishlist_page():
    """Wishlist page"""
    return render_template('index.html', page='wishlist')

@app.route('/account')
def account_page():
    """User account page"""
    return render_template('index.html', page='account')

@app.route('/checkout')
def checkout_page():
    """Checkout page"""
    return render_template('index.html', page='checkout')

# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'success': False, 'error': 'Endpoint not found'}), 404
    return render_template('index.html', page='404'), 404

@app.errorhandler(500)
def server_error(e):
    db.session.rollback()
    if request.path.startswith('/api/'):
        return jsonify({'success': False, 'error': 'Internal server error'}), 500
    return render_template('index.html', page='500'), 500

# ============================================================================
# APPLICATION STARTUP
# ============================================================================

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_database()
    
    print("""
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         ✦ HAYEE INTERIOR ✦                                  ║
║    Luxury E-Commerce Platform                                ║
║                                                              ║
║  📍 Homepage:  http://localhost:5000                          ║
║  🛍️  Shop:     http://localhost:5000/shop                     ║
║  📦 API:      http://localhost:5000/api/products              ║
║                                                              ║
║  👤 Demo User: client@example.com                            ║
║  🔑 Password:  Client@2024!                                  ║
║                                                              ║
║  👨‍💼 Admin:     admin@hayeeinterior.com                       ║
║  🔑 Password:  Admin@2024!                                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
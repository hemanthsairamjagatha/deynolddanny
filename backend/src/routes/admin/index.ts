// Admin routes barrel — imports and mounts all admin sub-routers
import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { adminAuth } from '../../middleware/adminAuth.js';
import dashboard from './dashboard.js';
import adminProducts from './products.js';
import adminInventory from './inventory.js';
import adminOrders from './orders.js';
import adminCustomers from './customers.js';
import adminCoupons from './coupons.js';
import adminUploads from './uploads.js';

const admin = new Hono<{ Bindings: Env }>();

// All admin routes require admin authentication
admin.use('*', adminAuth);

// Mount sub-routers
admin.route('/dashboard', dashboard);
admin.route('/products', adminProducts);
admin.route('/inventory', adminInventory);
admin.route('/orders', adminOrders);
admin.route('/customers', adminCustomers);
admin.route('/coupons', adminCoupons);
admin.route('/uploads', adminUploads);

// Health check for admin panel
admin.get('/ping', (c) => c.json({ success: true, data: { pong: true, role: c.get('userRole') } }));

export default admin;


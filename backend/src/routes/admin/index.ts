// Admin routes barrel — imports and mounts all admin sub-routers
import { Hono } from 'hono';
import type { Env } from '../../types/bindings.js';
import { adminAuth } from '../../middleware/adminAuth.js';

// Original routes
import dashboard from './dashboard.js';
import adminProducts from './products.js';
import adminInventory from './inventory.js';
import adminOrders from './orders.js';
import adminCustomers from './customers.js';
import adminCoupons from './coupons.js';
import adminUploads from './uploads.js';
import adminLogs from './logs.js';

// New routes (pre-existing files)
import brand from './brand.js';
import cms from './cms.js';
import navigation from './navigation.js';
import adminMedia from './media.js';
import adminCategories from './categories.js';
import adminCollections from './collections.js';
import returns from './returns.js';
import disputes from './disputes.js';
import adminPayments from './payments.js';
import reviews from './reviews.js';
import inquiries from './inquiries.js';
import sizeGuides from './sizeGuides.js';
import templates from './templates.js';

// New routes (files created by this task)
import settings from './settings.js';
import seo from './seo.js';
import security from './security.js';
import analyticsAdmin from './analyticsAdmin.js';
import newsletterAdmin from './newsletterAdmin.js';
import systemAdmin from './systemAdmin.js';

const admin = new Hono<{ Bindings: Env }>();

admin.use('*', adminAuth);

// Original mounts
admin.route('/dashboard', dashboard);
admin.route('/products', adminProducts);
admin.route('/inventory', adminInventory);
admin.route('/orders', adminOrders);
admin.route('/customers', adminCustomers);
admin.route('/coupons', adminCoupons);
admin.route('/uploads', adminUploads);
admin.route('/logs', adminLogs);

// New mounts
admin.route('/brand', brand);
admin.route('/cms', cms);
admin.route('/navigation', navigation);
admin.route('/media/library', adminMedia);
admin.route('/categories', adminCategories);
admin.route('/collections', adminCollections);
admin.route('/returns', returns);
admin.route('/disputes', disputes);
admin.route('/payments', adminPayments);
admin.route('/reviews', reviews);
admin.route('/inquiries', inquiries);
admin.route('/size-guides', sizeGuides);
admin.route('/templates', templates);
admin.route('/settings', settings);
admin.route('/seo', seo);
admin.route('/security', security);
admin.route('/analytics', analyticsAdmin);
admin.route('/newsletter', newsletterAdmin);
admin.route('/system', systemAdmin);

admin.get('/ping', (c) =>
  c.json({ success: true, data: { pong: true, role: c.get('userRole') } }),
);

export default admin;

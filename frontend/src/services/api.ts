import axios from 'axios';

// Prefer env override, fallback to localhost; use 127.0.0.1 to avoid IPv6 issues in packaged apps
export const API_BASE_URL =
  (process.env.REACT_APP_API_BASE_URL as string) || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Product API
export const productApi = {
  getAll: (params?: any) => api.get('/products', { params }),
  getById: (id: number) => api.get(`/products/${id}`),
  create: (data: any) => api.post('/products', data),
  update: (id: number, data: any) => api.put(`/products/${id}`, data),
  delete: (id: number) => api.delete(`/products/${id}`),
  updateStock: (id: number, data: any) => api.post(`/products/${id}/stock`, data),
  getMovements: (id: number) => api.get(`/products/${id}/movements`),
  getLowStock: () => api.get('/products/low-stock/'),
};

// Category API
export const categoryApi = {
  getAll: (params?: any) => api.get('/categories', { params }),
  getById: (id: number) => api.get(`/categories/${id}`),
  create: (data: any) => api.post('/categories', data),
  update: (id: number, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
  getProductsCount: (id: number) => api.get(`/categories/${id}/products-count`),
};

// Sales API
export const salesApi = {
  getAll: (params?: any) => api.get('/sales', { params }),
  getSales: () => api.get('/sales'),
  getById: (id: number) => api.get(`/sales/${id}`),
  create: (data: any) => api.post('/sales', data),
  cancel: (id: number) => api.delete(`/sales/${id}`),
  getTodaySummary: () => api.get('/sales/today/summary'),
  getMonthlySummary: (year?: number, month?: number) => 
    api.get('/sales/monthly/summary', { params: { year, month } }),
  downloadInvoice: (id: number) => api.get(`/sales/${id}/invoice`, { responseType: 'blob' }),
};

// Dashboard API
export const dashboardApi = {
  getKPIs: () => api.get('/dashboard/kpis'),
  getSalesChart: (days?: number) => api.get('/dashboard/sales-chart', { params: { days } }),
  getCategoryDistribution: () => api.get('/dashboard/category-distribution'),
  getLowStockProducts: (limit?: number) => 
    api.get('/dashboard/low-stock-products', { params: { limit } }),
  getRecentSales: (limit?: number) => 
    api.get('/dashboard/recent-sales', { params: { limit } }),
  getTopSellingProducts: (limit?: number) => 
    api.get('/dashboard/top-selling-products', { params: { limit } }),
  getSalesVsReturns: (period?: string) => 
    api.get('/dashboard/sales-vs-returns', { params: { period } }),
};

// Reports API
export const reportsApi = {
  generate: (data: any) => api.post('/reports/generate', data, {
    responseType: 'blob',
  }),
};

// Settings API
export const settingsApi = {
  getAll: () => api.get('/settings'),
  getDict: () => api.get('/settings/dict'),
  getByKey: (key: string) => api.get(`/settings/${key}`),
  create: (data: any) => api.post('/settings', data),
  update: (key: string, data: any) => api.put(`/settings/${key}`, data),
  updateBulk: (data: any) => api.put('/settings/bulk', data),
  delete: (key: string) => api.delete(`/settings/${key}`),
  backup: () => api.get('/settings/backup'),
  restore: (formData: FormData) => api.post('/settings/restore', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  createBackup: () => api.post('/settings/backup'),
  listBackups: () => api.get('/settings/backups/list'),
  restoreBackup: (filename: string) => api.post(`/settings/restore/${filename}`),
  reset: () => api.post('/settings/reset'),
  export: () => api.get('/settings/export/json'),
};

// Upload API
export const uploadApi = {
  uploadProductImage: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload/product-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// Returns API
export const returnsApi = {
  getReturns: (params?: any) => api.get('/returns', { params }),
  getById: (id: number) => api.get(`/returns/${id}`),
  createReturn: (data: any) => api.post('/returns', data),
  // Backend expects PUT and status as query param
  updateReturnStatus: (id: number, status: string) =>
    api.put(`/returns/${id}/status`, undefined, { params: { status } }),
  deleteReturn: (id: number) => api.delete(`/returns/${id}`),
  downloadInvoice: (id: number) => api.get(`/returns/${id}/invoice`, { responseType: 'blob' }),
};
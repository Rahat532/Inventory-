import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  LineElement,
  PointElement,
  Title, 
  Tooltip, 
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { dashboardApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Package, 
  DollarSign, 
  ShoppingCart, 
  AlertTriangle,
  TrendingUp,
  Users,
  Calendar,
  Eye,
  RefreshCw
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [chartPeriod, setChartPeriod] = useState('7');
  
  // Fetch dashboard data
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => dashboardApi.getKPIs().then(res => res.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: lowStockProducts, refetch: refetchLowStock } = useQuery({
    queryKey: ['dashboard', 'low-stock'],
    queryFn: () => dashboardApi.getLowStockProducts(10).then(res => res.data),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: recentSales, refetch: refetchSales } = useQuery({
    queryKey: ['dashboard', 'recent-sales'],
    queryFn: () => dashboardApi.getRecentSales(8).then(res => res.data),
    refetchInterval: 30000,
  });

  // Fetch sales chart data
  const { data: salesChartData, refetch: refetchSalesChart } = useQuery({
    queryKey: ['dashboard', 'sales-chart', chartPeriod],
    queryFn: () => dashboardApi.getSalesChart(parseInt(chartPeriod)).then(res => res.data),
    refetchInterval: 30000,
  });

  // Fetch category distribution
  const { data: categoryData, refetch: refetchCategory } = useQuery({
    queryKey: ['dashboard', 'category-distribution'],
    queryFn: () => dashboardApi.getCategoryDistribution().then(res => res.data),
    refetchInterval: 60000,
  });

  // Fetch sales vs returns comparison
  const { data: salesVsReturnsData, refetch: refetchSalesVsReturns } = useQuery({
    queryKey: ['dashboard', 'sales-vs-returns', chartPeriod],
    queryFn: () => dashboardApi.getSalesVsReturns(chartPeriod).then(res => res.data),
    refetchInterval: 30000,
  });

  // Process chart data
  const salesChartDisplay = {
    labels: salesChartData?.map((item: any) => {
      const date = new Date(item.date);
      if (chartPeriod === '1') {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else if (chartPeriod === '12') {
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    }) || [],
    datasets: [
      {
        label: 'Sales ($)',
        data: salesChartData?.map((item: any) => item.sales) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2,
      },
    ],
  };

  const categoryDistributionData = {
    labels: categoryData?.map((item: any) => item.category) || [],
    datasets: [
      {
        data: categoryData?.map((item: any) => item.count) || [],
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF'
        ],
        borderWidth: 2,
      },
    ],
  };

  const salesVsReturnsChartData = {
    labels: salesVsReturnsData?.map((item: any) => item.period) || [],
    datasets: [
      {
        label: 'Sales',
        data: salesVsReturnsData?.map((item: any) => item.sales) || [],
        fill: false,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.1,
      },
      {
        label: 'Returns',
        data: salesVsReturnsData?.map((item: any) => item.returns) || [],
        fill: false,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const refreshDashboard = () => {
    refetchKpis();
    refetchLowStock();
    refetchSales();
    refetchSalesChart();
    refetchCategory();
    refetchSalesVsReturns();
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add-product':
        navigate('/products');
        break;
      case 'create-sale':
        navigate('/sales');
        break;
      case 'generate-report':
        navigate('/reports');
        break;
      case 'backup-data':
        navigate('/settings');
        break;
      default:
        break;
    }
  };

  if (kpisLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your inventory management system</p>
        </div>
        <Button onClick={refreshDashboard} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* KPIs Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.total_products || 0}</div>
            <p className="text-xs opacity-80">Active inventory items</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Sales</CardTitle>
            <DollarSign className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis?.total_sales_today?.toFixed(2) || '0.00'}</div>
            <p className="text-xs opacity-80">{kpis?.total_sales_count_today || 0} transactions</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis?.total_revenue_this_month?.toFixed(2) || '0.00'}</div>
            <p className="text-xs opacity-80">This month's total</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis?.low_stock_count || 0}</div>
            <p className="text-xs opacity-80">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Sales Performance</CardTitle>
            <Select value={chartPeriod} onValueChange={setChartPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24h</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              <Bar data={salesChartDisplay} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: '300px' }}>
              {categoryData && categoryData.length > 0 ? (
                <Doughnut 
                  data={categoryDistributionData} 
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right' as const,
                      },
                    },
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No category data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales vs Returns Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sales vs Returns Comparison</CardTitle>
          <div className="text-sm text-muted-foreground">
            Period: {chartPeriod === '1' ? 'Last 24 hours' : 
                    chartPeriod === '7' ? 'Last 7 days' : 
                    chartPeriod === '30' ? 'Last 30 days' : 'Last 12 months'}
          </div>
        </CardHeader>
        <CardContent>
          <div style={{ height: '350px' }}>
            {salesVsReturnsData && salesVsReturnsData.length > 0 ? (
              <Line data={salesVsReturnsChartData} options={chartOptions} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading chart data...
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Recent Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentSales && recentSales.length > 0 ? (
                recentSales.map((sale: any) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{sale.sale_number}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(sale.created_at).toLocaleDateString()} • {sale.items_count} items
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        ${sale.final_amount.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  No recent sales
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {lowStockProducts && lowStockProducts.length > 0 ? (
                lowStockProducts.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg border-red-200 bg-red-50">
                    <div className="flex-1">
                      <div className="font-medium text-red-900">{product.name}</div>
                      <div className="text-sm text-red-600">
                        SKU: {product.sku} • {product.category_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-700">
                        {product.stock_quantity} left
                      </div>
                      <div className="text-xs text-red-500">
                        Min: {product.min_stock_level}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  All products are well stocked!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Users className="h-8 w-8 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold">156</div>
            <div className="text-sm text-muted-foreground">Active Customers</div>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">23</div>
            <div className="text-sm text-muted-foreground">Orders Today</div>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <Eye className="h-8 w-8 mx-auto mb-2 text-purple-500" />
            <div className="text-2xl font-bold">1.2k</div>
            <div className="text-sm text-muted-foreground">Page Views</div>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-orange-500" />
            <div className="text-2xl font-bold">+12%</div>
            <div className="text-sm text-muted-foreground">Growth</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => handleQuickAction('add-product')}>
              <Package className="h-4 w-4 mr-2" />
              Add New Product
            </Button>
            <Button variant="outline" onClick={() => handleQuickAction('create-sale')}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Create Sale
            </Button>
            <Button variant="outline" onClick={() => handleQuickAction('generate-report')}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button variant="outline" onClick={() => handleQuickAction('backup-data')}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Backup Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
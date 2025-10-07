import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, categoryApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  FileText, 
  Download, 
  Calendar, 
  TrendingUp, 
  Package, 
  DollarSign,
  BarChart3,
  FileSpreadsheet
} from 'lucide-react';

interface ReportConfig {
  type: string;
  format: 'pdf' | 'csv';
  start_date?: string;
  end_date?: string;
  category_id?: string;
}

const Reports: React.FC = () => {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [period, setPeriod] = useState<string>('30'); // 1,3,7,15,30, custom
  const [selectedFormat, setSelectedFormat] = useState<'pdf' | 'csv'>('csv');

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const computeRange = (p: string) => {
    if (p === 'custom') {
      return { start: '', end: todayStr };
    }
    const days = parseInt(p, 10);
    const end = new Date();
    const start = new Date(end);
    // Inclusive of today: last N days => start = today - (N-1)
    start.setDate(end.getDate() - (isNaN(days) ? 29 : Math.max(0, days - 1)));
    const toISODate = (dt: Date) => dt.toISOString().split('T')[0];
    return { start: toISODate(start), end: toISODate(end) };
  };

  // Fetch categories for filtering
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await categoryApi.getAll();
      return response.data;
    },
  });

  const reportTypes = [
    {
      id: 'sales',
      name: 'Sales Report',
      description: 'Detailed sales analysis with revenue breakdown',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      id: 'inventory',
      name: 'Inventory Report',
      description: 'Current stock levels and inventory valuation',
      icon: Package,
      color: 'text-blue-600'
    },
    {
      id: 'low_stock',
      name: 'Low Stock Alert',
      description: 'Products below minimum stock levels',
      icon: TrendingUp,
      color: 'text-red-600'
    },
    {
      id: 'product_performance',
      name: 'Product Performance',
      description: 'Best and worst performing products',
      icon: BarChart3,
      color: 'text-purple-600'
    }
  ];

  const handleGenerateReport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGenerating(true);

    try {
      const formData = new FormData(event.currentTarget);
      // Map UI type to backend report_type
      const reportTypeMap: Record<string, string> = {
        sales: 'sales',
        inventory: 'inventory',
        low_stock: 'low_stock',
        product_performance: 'sales',
      };

      const config: ReportConfig = {
        type: selectedReportType,
        format: formData.get('format') as 'pdf' | 'csv',
      };

      // Add date range if provided
      const startDate = formData.get('start_date') as string;
      const endDate = formData.get('end_date') as string;
      if (startDate) config.start_date = startDate;
      if (endDate) config.end_date = endDate;

      // Add category filter if provided
      const categoryId = formData.get('category_id') as string;
      if (categoryId && categoryId !== 'all') {
        config.category_id = categoryId;
      }

      // Generate the report
      const response = await reportsApi.generate({
        report_type: reportTypeMap[selectedReportType] || 'sales',
        start_date: config.start_date,
        end_date: config.end_date,
        format: config.format,
      });
      
      // Determine filename from Content-Disposition if present
      let filename = '';
      const cd = (response.headers as any)?.['content-disposition'] || (response.headers as any)?.['Content-Disposition'];
      if (cd && typeof cd === 'string') {
        const match = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
        const extracted = (match && (match[1] || match[2])) || '';
        if (extracted) filename = decodeURIComponent(extracted);
      }

      // Fallback filename by format
      const mappedExt = config.format === 'pdf' ? 'pdf' : 'csv';
      if (!filename) {
        filename = `${selectedReportType}_report_${new Date().toISOString().split('T')[0]}.${mappedExt}`;
      }

      // If CSV selected, force .csv extension even if server provided something else
      if (config.format === 'csv') {
        filename = filename.replace(/\.(xlsx|xls|pdf|excel)$/i, '.csv');
        if (!/\.csv$/i.test(filename)) {
          filename = filename + '.csv';
        }
      }

      // Create download link
      const blob = new Blob([response.data], { 
        type: config.format === 'pdf' ? 'application/pdf' : 'text/csv'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setIsGenerateDialogOpen(false);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const [dates, setDates] = useState<{ start: string; end: string }>(() => computeRange('30'));

  const isSalesLike = selectedReportType === 'sales' || selectedReportType === 'product_performance';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate and download business reports</p>
        </div>
      </div>

      {/* Report Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {reportTypes.map((reportType) => {
          const IconComponent = reportType.icon;
          return (
            <Card key={reportType.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-gray-100 ${reportType.color}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg">{reportType.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {reportType.description}
                </p>
                <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => {
                        setSelectedReportType(reportType.id);
                        setSelectedFormat('csv');
                        if (reportType.id === 'sales' || reportType.id === 'product_performance') {
                          setPeriod('30');
                          setDates(computeRange('30'));
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Generate
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => {
                setSelectedReportType('sales');
                setSelectedFormat('csv');
                setPeriod('1');
                setDates(computeRange('1'));
                setIsGenerateDialogOpen(true);
              }}
            >
              <FileText className="h-8 w-8 text-green-600" />
              <div className="text-center">
                <div className="font-medium">Today's Sales</div>
                <div className="text-sm text-muted-foreground">CSV Report</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => {
                setSelectedReportType('inventory');
                setSelectedFormat('csv');
                setIsGenerateDialogOpen(true);
              }}
            >
              <FileSpreadsheet className="h-8 w-8 text-blue-600" />
              <div className="text-center">
                <div className="font-medium">Current Inventory</div>
                <div className="text-sm text-muted-foreground">CSV Export</div>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className="h-auto p-4 flex flex-col items-center space-y-2"
              onClick={() => {
                setSelectedReportType('low_stock');
                setSelectedFormat('csv');
                setIsGenerateDialogOpen(true);
              }}
            >
              <TrendingUp className="h-8 w-8 text-red-600" />
              <div className="text-center">
                <div className="font-medium">Low Stock Alert</div>
                <div className="text-sm text-muted-foreground">CSV Report</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-green-600" />
                <div>
                  <div className="font-medium">Sales Report - November 2024</div>
                  <div className="text-sm text-muted-foreground">Generated on Nov 15, 2024</div>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">Inventory Report - October 2024</div>
                  <div className="text-sm text-muted-foreground">Generated on Oct 31, 2024</div>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>

            <div className="text-center py-4 text-sm text-muted-foreground">
              Generate your first report to see download history here
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generate Report Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Generate {reportTypes.find(r => r.id === selectedReportType)?.name}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleGenerateReport} className="space-y-4">
            <div>
              <Label htmlFor="format">Report Format</Label>
              <input type="hidden" name="format" value={selectedFormat} />
              <Select value={selectedFormat} onValueChange={(v: any) => setSelectedFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Excel compatible)</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isSalesLike && (
              <>
                <div>
                  <Label htmlFor="period">Period</Label>
                  <Select value={period} onValueChange={(val) => {
                    setPeriod(val);
                    const r = computeRange(val);
                    setDates(r);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Last 1 day</SelectItem>
                      <SelectItem value="3">Last 3 days</SelectItem>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="15">Last 15 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input 
                      id="start_date" 
                      name="start_date"
                      type="date" 
                      value={dates.start}
                      onChange={(e) => { setDates(d => ({ ...d, start: e.target.value })); setPeriod('custom'); }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <Input 
                      id="end_date" 
                      name="end_date"
                      type="date" 
                      value={dates.end}
                      onChange={(e) => { setDates(d => ({ ...d, end: e.target.value })); setPeriod('custom'); }}
                    />
                  </div>
                </div>
                {/* Hidden mirrors to ensure values are submitted by browsers that ignore controlled date inputs */}
                <input type="hidden" name="start_date" value={dates.start} />
                <input type="hidden" name="end_date" value={dates.end} />
              </>
            )}

            {selectedReportType !== 'low_stock' && (
              <div>
                <Label htmlFor="category_id">Category Filter (Optional)</Label>
                <Select name="category_id" defaultValue="all">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-blue-900">Report Information</div>
                  <div className="text-blue-700 mt-1">
                    {selectedReportType === 'sales' && 'Includes transaction details, revenue analysis, and payment methods.'}
                    {selectedReportType === 'inventory' && 'Shows current stock levels, product values, and category breakdown.'}
                    {selectedReportType === 'low_stock' && 'Lists products below minimum stock levels requiring attention.'}
                    {selectedReportType === 'product_performance' && 'Analyzes best and worst performing products by sales volume.'}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isGenerating} onClick={() => {
                // Ensure dates are included for sales-like reports
                if (isSalesLike) {
                  // nothing extra needed; inputs are controlled
                }
              }}>
                {isGenerating ? 'Generating...' : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
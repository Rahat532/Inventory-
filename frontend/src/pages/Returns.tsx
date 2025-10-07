import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { returnsApi, salesApi, settingsApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from '../components/ui/use-toast';
import { 
  RotateCcw, 
  Plus, 
  Search, 
  DollarSign,
  Package,
  AlertCircle,
  Printer
} from 'lucide-react';

interface ReturnItemDto {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  condition: string;
}

interface ReturnDto {
  id: number;
  return_number: string;
  original_sale_id?: number | null;
  total_amount: number;
  refund_method: string;
  reason?: string | null;
  status: string;
  created_at: string;
  processed_at?: string | null;
  return_items: ReturnItemDto[];
}

interface Sale {
  id: number;
  sale_number: string;
  total_amount: number;
  final_amount: number;
  created_at: string;
  sales_items: any[];
}

const Returns: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('');
  const [returnItems, setReturnItems] = useState<Array<{
    product_id: number;
    quantity: number;
    unit_price: number;
    condition: string;
  }>>([]);

  const queryClient = useQueryClient();

  // Fetch returns with filters
  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['returns', searchTerm, statusFilter],
    queryFn: async () => {
      const response = await returnsApi.getReturns({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      return response.data as ReturnDto[];
    },
  });

  // Fetch sales for creating returns
  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const response = await salesApi.getSales();
      return response.data as Sale[];
    },
    enabled: isCreateDialogOpen,
  });

  // Load currency symbol from settings
  const { data: settingsDict } = useQuery({
    queryKey: ['settings', 'dict', 'currency_symbol'],
    queryFn: async () => (await settingsApi.getDict()).data as Record<string, string>,
    staleTime: 60_000,
  });
  const currencySymbol = (settingsDict?.currency_symbol as string) || '$';

  // Get selected sale details
  const selectedSale = sales.find(sale => sale.id.toString() === selectedSaleId);

  // Create return mutation
  const createReturnMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await returnsApi.createReturn(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      // Ensure Dashboard KPIs/charts reflect the new return immediately
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && (q.queryKey as any[])[0] === 'dashboard',
      });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Return created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to create return",
        variant: "destructive",
      });
    },
  });

  // Update return status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await returnsApi.updateReturnStatus(id, status);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      // Returns can affect revenue, charts, and low stock; refresh Dashboard queries
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && (q.queryKey as any[])[0] === 'dashboard',
      });
      toast({
        title: "Success",
        description: "Return status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to update return status",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedSaleId('');
    setReturnReason('');
    setRefundMethod('');
    setReturnItems([]);
  };

  const handleCreateReturn = () => {
    if (!selectedSaleId || !returnReason || !refundMethod || returnItems.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields and add at least one item",
        variant: "destructive",
      });
      return;
    }

    createReturnMutation.mutate({
      original_sale_id: parseInt(selectedSaleId),
      reason: returnReason,
      refund_method: refundMethod,
      items: returnItems,
    });
  };

  const addReturnItem = (saleItem: any) => {
    const productId = saleItem.product_id ?? saleItem.product?.id;
    const existingItem = returnItems.find(item => item.product_id === productId);
    if (existingItem) {
      toast({
        title: "Error",
        description: "This item is already added to the return",
        variant: "destructive",
      });
      return;
    }

    setReturnItems([...returnItems, {
      product_id: productId,
      quantity: 1,
      unit_price: saleItem.unit_price,
      condition: 'good',
    }]);
  };

  const updateReturnItem = (productId: number, field: string, value: any) => {
    setReturnItems(returnItems.map(item => 
      item.product_id === productId 
        ? { ...item, [field]: value }
        : item
    ));
  };

  const removeReturnItem = (productId: number) => {
    setReturnItems(returnItems.filter(item => item.product_id !== productId));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredReturns = returns.filter(returnItem => {
    const matchesSearch = !searchTerm || 
      returnItem.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (returnItem.reason || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || returnItem.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading returns...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Returns Management</h1>
          <p className="text-muted-foreground">Manage product returns and refunds</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Return
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Return</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Sale Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sale">Select Sale</Label>
                  <Select value={selectedSaleId} onValueChange={setSelectedSaleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a sale" />
                    </SelectTrigger>
                    <SelectContent>
                      {sales.map((sale) => (
                        <SelectItem key={sale.id} value={sale.id.toString()}>
                          {sale.sale_number} - {currencySymbol} {sale.final_amount.toFixed(2)} 
                          ({new Date(sale.created_at).toLocaleDateString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="refund-method">Refund Method</Label>
                  <Select value={refundMethod} onValueChange={setRefundMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select refund method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Credit Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="store_credit">Store Credit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="reason">Return Reason</Label>
                <Input
                  id="reason"
                  placeholder="Enter reason for return"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>

              {/* Sale Items */}
              {selectedSale && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Sale Items</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSale.sales_items.map((item: any) => (
                          <TableRow key={item.product.id}>
                            <TableCell>{item.product.name}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{currencySymbol} {item.unit_price.toFixed(2)}</TableCell>
                            <TableCell>{currencySymbol} {item.total_price.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addReturnItem(item)}
                                disabled={returnItems.some(ri => ri.product_id === item.product.id)}
                              >
                                Add to Return
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Return Items */}
              {returnItems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Items to Return</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {returnItems.map((item) => {
                          const saleItem = selectedSale?.sales_items.find((si: any) => si.product.id === item.product_id);
                          return (
                            <TableRow key={item.product_id}>
                              <TableCell>{saleItem?.product.name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  max={saleItem?.quantity}
                                  value={item.quantity}
                                  onChange={(e) => updateReturnItem(item.product_id, 'quantity', parseInt(e.target.value))}
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell>
                                <Select value={item.condition} onValueChange={(value) => updateReturnItem(item.product_id, 'condition', value)}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="good">Good</SelectItem>
                                    <SelectItem value="damaged">Damaged</SelectItem>
                                    <SelectItem value="defective">Defective</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeReturnItem(item.product_id)}
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateReturn}
                  disabled={createReturnMutation.isPending}
                >
                  {createReturnMutation.isPending ? 'Creating...' : 'Create Return'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Search Returns</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by return number or sale number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Returns Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <RotateCcw className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{returns.length}</p>
                <p className="text-sm text-muted-foreground">Total Returns</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <AlertCircle className="h-8 w-8 text-yellow-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold">
                  {returns.filter(r => r.status === 'pending').length}
                </p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold">
                  {currencySymbol} {returns.filter(r => r.status === 'refunded')
                    .reduce((sum, r) => sum + (r.total_amount || 0), 0).toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground">Total Refunded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-2xl font-bold">
                  {returns.reduce((sum, r) => sum + (r.return_items?.length || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Items Returned</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle>Returns List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Sale ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Refund Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No returns found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReturns.map((returnItem) => (
                    <TableRow key={returnItem.id}>
                      <TableCell className="font-medium">
                        {returnItem.return_number}
                      </TableCell>
                      <TableCell>{returnItem.original_sale_id ?? '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(returnItem.status)}>
                          {returnItem.status.charAt(0).toUpperCase() + returnItem.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{returnItem.reason ?? '-'}</TableCell>
                      <TableCell>
                        {returnItem.refund_method.replace('_', ' ').toUpperCase()}
                      </TableCell>
                      <TableCell>{currencySymbol} {(returnItem.total_amount || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(returnItem.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {returnItem.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({
                                  id: returnItem.id,
                                  status: 'approved'
                                })}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateStatusMutation.mutate({
                                  id: returnItem.id,
                                  status: 'rejected'
                                })}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {returnItem.status === 'approved' && (
                            <Button
                              size="sm"
                              onClick={() => updateStatusMutation.mutate({
                                id: returnItem.id,
                                status: 'refunded'
                              })}
                            >
                              Process Refund
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const res = await returnsApi.downloadInvoice(returnItem.id);
                                const url = window.URL.createObjectURL(res.data);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `return_${returnItem.return_number}.pdf`;
                                a.click();
                                window.URL.revokeObjectURL(url);
                              } catch (e) {
                                console.error('Failed to download return invoice', e);
                                alert('Failed to download return invoice');
                              }
                            }}
                            title="Print Return"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Returns;
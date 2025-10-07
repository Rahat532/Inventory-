import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesApi, productApi } from '../services/api';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Plus, ShoppingCart, Minus, Trash2, Receipt, Search, Calendar, Printer } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  unit: string;
}

interface CartItem {
  product: Product;
  quantity: number;
  subtotal: number;
}

interface SaleItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: {
    id: number;
    name: string;
    sku: string;
    price: number;
    stock_quantity: number;
    image_url?: string | null;
  };
}

interface Sale {
  id: number;
  sale_number: string;
  total_amount: number;
  final_amount: number;
  payment_method: string;
  created_at: string;
  sales_items: SaleItem[];
}

const Sales: React.FC = () => {
  const [isNewSaleDialogOpen, setIsNewSaleDialogOpen] = useState(false);
  const [isSaleDetailsDialogOpen, setIsSaleDetailsDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('today');

  const queryClient = useQueryClient();

  // Fetch sales
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', searchTerm, dateFilter],
    queryFn: async () => {
      try {
        const params: any = {};
        if (searchTerm) params.search = searchTerm;
        if (dateFilter !== 'all') params.date_filter = dateFilter;
        const response = await salesApi.getAll(params);
        return response.data || []; // Ensure we always return an array
      } catch (error) {
        console.error('Failed to fetch sales:', error);
        return []; // Return empty array on error
      }
    },
  });

  // Fetch products for sale
  const { data: products = [] } = useQuery({
    queryKey: ['products', productSearchTerm],
    queryFn: async () => {
      try {
        const params: any = { is_active: true };
        if (productSearchTerm) params.search = productSearchTerm;
        const response = await productApi.getAll(params);
        return response.data || []; // Ensure we always return an array
      } catch (error) {
        console.error('Failed to fetch products:', error);
        return []; // Return empty array on error
      }
    },
    enabled: isNewSaleDialogOpen,
  });

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: (data: any) => salesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsNewSaleDialogOpen(false);
      setCart([]);
    },
  });

  const addToCart = (product: Product) => {
    const existingItem = (cart || []).find(item => item.product.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock_quantity) {
        alert(`Cannot add more items. Available stock: ${product.stock_quantity}`);
        return;
      }
      setCart((cart || []).map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * product.price }
          : item
      ));
    } else {
      if (product.stock_quantity < 1) {
        alert('Product is out of stock');
        return;
      }
      setCart([...(cart || []), {
        product,
        quantity: 1,
        subtotal: product.price
      }]);
    }
  };

  const updateCartQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = (cart || []).find(item => item.product.id === productId)?.product;
    if (product && newQuantity > product.stock_quantity) {
      alert(`Cannot exceed available stock: ${product.stock_quantity}`);
      return;
    }

    setCart((cart || []).map(item =>
      item.product.id === productId
        ? { ...item, quantity: newQuantity, subtotal: newQuantity * item.product.price }
        : item
    ));
  };

  const removeFromCart = (productId: number) => {
    setCart((cart || []).filter(item => item.product.id !== productId));
  };

  const getCartTotal = () => {
    return (cart || []).reduce((total, item) => total + item.subtotal, 0);
  };

  const handleCreateSale = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if ((cart || []).length === 0) {
      alert('Please add items to the cart');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const saleData = {
      payment_method: (formData.get('payment_method') as string) || 'cash',
      discount: 0,
      tax: 0,
      notes: undefined as string | undefined,
      items: (cart || []).map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.product.price
      })),
    };

    createSaleMutation.mutate(saleData);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const printInvoice = async (saleId: number, saleNumber: string) => {
    try {
      const res = await salesApi.downloadInvoice(saleId);
      downloadBlob(res.data, `invoice_${saleNumber}.pdf`);
    } catch (e) {
      console.error('Failed to download invoice', e);
      alert('Failed to download invoice');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading sales...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground">Process sales and view transaction history</p>
        </div>
        <Dialog open={isNewSaleDialogOpen} onOpenChange={setIsNewSaleDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Sale</DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Product Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Select Products</h3>
                
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="border rounded-md max-h-64 overflow-y-auto">
                  {products && products.length > 0 ? (
                    products.map((product: Product) => (
                      <div key={product.id} className="p-3 border-b last:border-b-0 hover:bg-gray-50">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">
                              SKU: {product.sku} | Stock: {product.stock_quantity} {product.unit}
                            </div>
                            <div className="text-sm font-medium text-green-600">
                              ${product.price.toFixed(2)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addToCart(product)}
                            disabled={product.stock_quantity === 0}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      No products found
                    </div>
                  )}
                </div>
              </div>

              {/* Shopping Cart */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Shopping Cart</h3>
                
                <div className="border rounded-md">
                  {cart.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2" />
                      <p>Cart is empty</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {(cart || []).map((item) => (
                        <div key={item.product.id} className="p-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium">{item.product.name}</div>
                              <div className="text-sm text-muted-foreground">
                                ${item.product.price.toFixed(2)} each
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => removeFromCart(item.product.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-right font-medium mt-2">
                            ${item.subtotal.toFixed(2)}
                          </div>
                        </div>
                      ))}
                      <div className="p-3 bg-gray-50">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>Total:</span>
                          <span>${getCartTotal().toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sale Details Form */}
                {(cart || []).length > 0 && (
                  <form onSubmit={handleCreateSale} className="space-y-4">
                    <div>
                      <Label htmlFor="customer_name">Customer Name</Label>
                      <Input 
                        id="customer_name" 
                        name="customer_name" 
                        placeholder="Walk-in Customer" 
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="customer_email">Customer Email</Label>
                      <Input 
                        id="customer_email" 
                        name="customer_email" 
                        type="email"
                        placeholder="customer@example.com (optional)"
                      />
                    </div>

                    <div>
                      <Label htmlFor="payment_method">Payment Method</Label>
                      <Select name="payment_method" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsNewSaleDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createSaleMutation.isPending}>
                        {createSaleMutation.isPending ? 'Processing...' : `Complete Sale ($${getCartTotal().toFixed(2)})`}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Sales</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by sale number, customer name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Label htmlFor="date-filter">Date Filter</Label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sales History ({sales.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales && sales.length > 0 ? (
                  sales.map((sale: Sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">
                        {sale.sale_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">Customer</div>
                          <div className="text-sm text-muted-foreground">—</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          {formatDate(sale.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sale.sales_items?.length || 0} item{(sale.sales_items?.length || 0) !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize">{sale.payment_method.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell className="font-medium">
                        ${Number((sale.final_amount ?? sale.total_amount) || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSale(sale);
                            setIsSaleDetailsDialogOpen(true);
                          }}
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                        <Button
                          className="ml-2"
                          variant="outline"
                          size="sm"
                          onClick={() => printInvoice(sale.id, sale.sale_number)}
                          title="Print Invoice"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {isLoading ? 'Loading sales...' : 'No sales found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {sales.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No sales found. Create your first sale to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sale Details Dialog */}
      <Dialog open={isSaleDetailsDialogOpen} onOpenChange={setIsSaleDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sale Number</Label>
                  <div className="font-medium">{selectedSale.sale_number}</div>
                </div>
                <div>
                  <Label>Date</Label>
                  <div className="font-medium">{formatDate(selectedSale.created_at)}</div>
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <div className="font-medium capitalize">
                    {selectedSale.payment_method.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div>
                <Label>Items</Label>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.sales_items?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.product?.name || item.product_id}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>${Number(item.unit_price).toFixed(2)}</TableCell>
                          <TableCell>${Number(item.total_price).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-3 border-t bg-gray-50">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span>${Number((selectedSale.final_amount ?? selectedSale.total_amount) || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setIsSaleDetailsDialogOpen(false)}>
                  Close
                </Button>
                {selectedSale && (
                  <Button
                    variant="outline"
                    onClick={() => printInvoice(selectedSale.id, selectedSale.sale_number)}
                  >
                    <Printer className="h-4 w-4 mr-2" /> Download Invoice
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sales;
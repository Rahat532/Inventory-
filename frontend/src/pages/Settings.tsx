import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
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
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  Save,
  Database,
  Palette,
  Bell,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { settingsApi } from '../services/api';

// Settings dictionary model from backend: keys and values are strings
type SettingsDict = Record<string, string>;

// Helper: map currency code to symbol for convenience
const currencySymbolMap: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: '$',
  AUD: '$',
  INR: '₹',
};

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  // Load settings dictionary from backend
  const { data: settingsDictResp, isLoading } = useQuery({
    queryKey: ['settings', 'dict'],
    queryFn: async () => {
      const res = await settingsApi.getDict();
      // API returns { key: value } where all values are strings
      return res.data as SettingsDict;
    },
  });

  // Derive convenient typed values from settings dict
  const settings = useMemo(() => {
    const d = settingsDictResp || {};
    return {
      company_name: d.company_name || 'My Company',
      company_address: d.company_address || '',
      company_phone: d.company_phone || '',
      company_email: d.company_email || '',
      company_tax_id: d.company_tax_id || '',
      invoice_footer_notes: d.invoice_footer_notes || '',
      currency: d.currency || 'USD',
      currency_symbol: d.currency_symbol || currencySymbolMap[d.currency || 'USD'] || '$',
      tax_rate: d.tax_rate ? parseFloat(d.tax_rate) : 0,
      low_stock_threshold: d.low_stock_threshold ? parseInt(d.low_stock_threshold) : 10,
      backup_frequency: d.backup_frequency || 'weekly',
      auto_backup: (d.auto_backup || 'false') === 'true',
      theme: d.theme || 'light',
      notifications_enabled: (d.notifications_enabled || 'false') === 'true',
    };
  }, [settingsDictResp]);

  // Update settings via bulk endpoint
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const res = await settingsApi.updateBulk(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'dict'] });
      alert('Settings updated successfully!');
    },
    onError: (e: any) => {
      alert(`Failed to update settings: ${e?.message || 'Unknown error'}`);
    },
  });

  // Create backup
  const backupMutation = useMutation({
    mutationFn: async () => {
      const res = await settingsApi.createBackup();
      return res.data as { message: string; backup_file: string; backup_path: string; created_at: string };
    },
    onSuccess: () => {
      setIsBackupDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['settings', 'backups'] });
      alert('Backup created successfully!');
    },
    onError: (e: any) => {
      alert(`Failed to create backup: ${e?.message || 'Unknown error'}`);
    },
  });

  // List backups
  const { data: backupsResp, isLoading: isBackupsLoading } = useQuery({
    queryKey: ['settings', 'backups'],
    queryFn: async () => {
      const res = await settingsApi.listBackups();
      return res.data as { backups: Array<{ filename: string; size: number; created_at: string; modified_at: string }> };
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (filename: string) => {
      const res = await settingsApi.restoreBackup(filename);
      return res.data;
    },
    onSuccess: () => {
      setIsRestoreDialogOpen(false);
      alert('Database restored successfully. Please restart the application.');
    },
    onError: (e: any) => {
      alert(`Failed to restore backup: ${e?.message || 'Unknown error'}`);
    },
  });

  const handleSaveSettings = (section: string) => (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data: Record<string, string> = {};

    if (section === 'general') {
      const currency = (formData.get('currency') as string) || 'USD';
      data.company_name = (formData.get('company_name') as string) || '';
      data.company_address = (formData.get('company_address') as string) || '';
      data.company_phone = (formData.get('company_phone') as string) || '';
      data.company_email = (formData.get('company_email') as string) || '';
      data.company_tax_id = (formData.get('company_tax_id') as string) || '';
      data.invoice_footer_notes = (formData.get('invoice_footer_notes') as string) || '';
      data.currency = currency;
      // keep currency_symbol in sync
      data.currency_symbol = currencySymbolMap[currency] || '$';
    } else if (section === 'inventory') {
      data.tax_rate = String(parseFloat((formData.get('tax_rate') as string) || '0') || 0);
      data.low_stock_threshold = String(parseInt((formData.get('low_stock_threshold') as string) || '0') || 0);
      data.backup_frequency = (formData.get('backup_frequency') as string) || (settings.backup_frequency || 'weekly');
      data.auto_backup = formData.get('auto_backup') === 'on' ? 'true' : 'false';
    } else if (section === 'appearance') {
      data.theme = (formData.get('theme') as string) || 'light';
    } else if (section === 'notifications') {
      data.notifications_enabled = formData.get('notifications_enabled') === 'on' ? 'true' : 'false';
    }

    updateSettingsMutation.mutate(data);
  };

  const lastBackup = useMemo(() => {
    const list = backupsResp?.backups || [];
    return list.length ? list[0] : undefined;
  }, [backupsResp]);

  const tabs = [
    { id: 'general', name: 'General', icon: SettingsIcon },
    { id: 'inventory', name: 'Inventory', icon: Database },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'backup', name: 'Backup & Restore', icon: Shield },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your inventory management system</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        activeTab === tab.id ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' : ''
                      }`}
                    >
                      <IconComponent className="h-4 w-4" />
                      <span className="text-sm font-medium">{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* General Settings */}
          {activeTab === 'general' && (
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings('general')} className="space-y-4">
                  <div>
                    <Label htmlFor="company_name">Business Name</Label>
                    <Input 
                      id="company_name" 
                      name="company_name" 
                      defaultValue={settings?.company_name || ''}
                      placeholder="Your Business Name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="company_address">Business Address</Label>
                    <Textarea 
                      id="company_address" 
                      name="company_address" 
                      defaultValue={settings?.company_address || ''}
                      placeholder="123 Business St, City, State 12345"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company_phone">Phone Number</Label>
                      <Input 
                        id="company_phone" 
                        name="company_phone" 
                        defaultValue={settings?.company_phone || ''}
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company_email">Email Address</Label>
                      <Input 
                        id="company_email" 
                        name="company_email" 
                        type="email"
                        defaultValue={settings?.company_email || ''}
                        placeholder="business@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="company_tax_id">Tax ID (e.g., VAT/GST/TIN)</Label>
                    <Input
                      id="company_tax_id"
                      name="company_tax_id"
                      defaultValue={settings?.company_tax_id || ''}
                      placeholder="Enter your tax identifier"
                    />
                  </div>

                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select name="currency" defaultValue={settings?.currency || 'USD'}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                        <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                        <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="invoice_footer_notes">Invoice Footer Notes</Label>
                    <Textarea
                      id="invoice_footer_notes"
                      name="invoice_footer_notes"
                      defaultValue={settings?.invoice_footer_notes || ''}
                      placeholder="Thank you for your business! Returns accepted within 30 days with receipt."
                      rows={3}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      This text appears at the bottom of printed invoices.
                    </p>
                  </div>

                  <Button type="submit" disabled={updateSettingsMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Inventory Settings */}
          {activeTab === 'inventory' && (
            <Card>
              <CardHeader>
                <CardTitle>Inventory Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings('inventory')} className="space-y-4">
                  <div>
                    <Label htmlFor="tax_rate">Default Tax Rate (%)</Label>
                    <Input 
                      id="tax_rate" 
                      name="tax_rate" 
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      defaultValue={settings?.tax_rate ?? 0}
                      placeholder="8.5"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Applied to sales calculations
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
                    <Input 
                      id="low_stock_threshold" 
                      name="low_stock_threshold" 
                      type="number"
                      min="0"
                      defaultValue={settings?.low_stock_threshold ?? 10}
                      placeholder="10"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Default minimum stock level for new products
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="backup_frequency">Backup Frequency</Label>
                      <Select name="backup_frequency" defaultValue={settings?.backup_frequency || 'weekly'}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="auto_backup"
                          name="auto_backup"
                          defaultChecked={settings?.auto_backup || false}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor="auto_backup">Enable Auto Backup</Label>
                      </div>
                    </div>
                  </div>

                  <Button type="submit" disabled={updateSettingsMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Appearance Settings */}
          {activeTab === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings('appearance')} className="space-y-4">
                  <div>
                    <Label htmlFor="theme">Theme</Label>
                    <Select name="theme" defaultValue={settings?.theme || 'light'}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="auto">Auto (System)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose your preferred color scheme
                    </p>
                  </div>

                  <Button type="submit" disabled={updateSettingsMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Notifications Settings */}
          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveSettings('notifications')} className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="notifications_enabled" 
                      name="notifications_enabled"
                      defaultChecked={settings?.notifications_enabled || false}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="notifications_enabled">Enable Notifications</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts for low stock, sales milestones, and system updates
                  </p>

                  <Button type="submit" disabled={updateSettingsMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateSettingsMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Database Backup</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Create a backup of your inventory database. This includes all products, categories, sales, and settings.
                    </p>
                    
                    <Dialog open={isBackupDialogOpen} onOpenChange={setIsBackupDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Download className="h-4 w-4 mr-2" />
                          Create Backup
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Database Backup</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <div className="flex items-start space-x-3">
                              <Database className="h-5 w-5 text-blue-600 mt-0.5" />
                              <div className="text-sm">
                                <div className="font-medium text-blue-900">Backup Information</div>
                                <div className="text-blue-700 mt-1">
                                  This will create a complete backup of your database including:
                                  <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>All products and categories</li>
                                    <li>Sales history and transactions</li>
                                    <li>Stock movement records</li>
                                    <li>System settings and preferences</li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsBackupDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={() => backupMutation.mutate()} disabled={backupMutation.isPending}>
                            {backupMutation.isPending ? 'Creating...' : 'Create Backup'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Database Restore</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-amber-50 p-4 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div className="text-sm">
                          <div className="font-medium text-amber-900">Warning</div>
                          <div className="text-amber-700 mt-1">
                            Restoring a backup will replace all current data. This action cannot be undone.
                            Make sure to create a backup of your current data before proceeding.
                          </div>
                        </div>
                      </div>
                    </div>
                    <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Upload className="h-4 w-4 mr-2" />
                          Restore from Backup
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Restore Database</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Choose a backup to restore</Label>
                            <div className="mt-2 max-h-60 overflow-auto border rounded-md">
                              {isBackupsLoading ? (
                                <div className="p-4 text-sm text-muted-foreground">Loading backups...</div>
                              ) : (
                                <ul className="divide-y">
                                  {(backupsResp?.backups || []).length === 0 && (
                                    <li className="p-4 text-sm text-muted-foreground">No backups found.</li>
                                  )}
                                  {(backupsResp?.backups || []).map((b) => (
                                    <li key={b.filename} className="p-3 flex items-center justify-between">
                                      <div className="text-sm">
                                        <div className="font-medium">{b.filename}</div>
                                        <div className="text-muted-foreground text-xs">{new Date(b.created_at).toLocaleString()}</div>
                                      </div>
                                      <Button size="sm" onClick={() => {
                                        if (window.confirm('Restoring will overwrite the current database. Continue?')) {
                                          restoreMutation.mutate(b.filename);
                                        }
                                      }}>Restore</Button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsRestoreDialogOpen(false)}>
                            Close
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Application Version:</span>
                      <span className="font-medium">1.0.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Database Version:</span>
                      <span className="font-medium">SQLite 3.x</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Backup:</span>
                      <span className="font-medium">{lastBackup ? new Date(lastBackup.created_at).toLocaleString() : 'Never'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button variant="outline" onClick={async () => {
                  if (window.confirm('Reset all settings to defaults?')) {
                    try {
                      await settingsApi.reset();
                      queryClient.invalidateQueries({ queryKey: ['settings', 'dict'] });
                      alert('Settings reset to defaults.');
                    } catch (e: any) {
                      alert(`Failed to reset settings: ${e?.message || 'Unknown error'}`);
                    }
                  }
                }}>Reset Settings</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
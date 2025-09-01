export enum ProductPermissions {
	PRODUCT_READ = 'product-read',
	PRODUCT_CREATE = 'product-create',
	PRODUCT_UPDATE = 'product-update',
	PRODUCT_DELETE = 'product-delete',
	PRODUCT_SEARCH = 'product-search',
}

export enum UserPermissions {
	USER_READ = 'user-read',
	USER_CREATE = 'user-create',
	USER_UPDATE = 'user-update',
	USER_DELETE = 'user-delete',
}

export enum CustomerPermissions {
	CUSTOMER_READ = 'customer-read',
	CUSTOMER_CREATE = 'customer-create',
	CUSTOMER_UPDATE = 'customer-update',
	CUSTOMER_DELETE = 'customer-delete',
	CUSTOMER_SEARCH = 'customer-search',
}

export enum BillingPermissions {
	BILLING_READ = 'billing-read',
	BILLING_CREATE = 'billing-create',
	BILLING_UPDATE = 'billing-update',
	BILLING_DELETE = 'billing-delete',
}

export enum QuotePermissions {
	QUOTE_READ = 'quote-read',
	QUOTE_CREATE = 'quote-create',
	QUOTE_UPDATE = 'quote-update',
	QUOTE_DELETE = 'quote-delete',
}

export enum PermissionPermissions {
	PERMISSION_READ = 'permission-read',
	PERMISSION_CREATE = 'permission-create',
	PERMISSION_UPDATE = 'permission-update',
	PERMISSION_DELETE = 'permission-delete',
}

export enum StockItemPermissions {
	STOCK_ITEM_READ = 'stock-item-read',
	STOCK_ITEM_CREATE = 'stock-item-create',
	STOCK_ITEM_UPDATE = 'stock-item-update',
	STOCK_ITEM_DELETE = 'stock-item-delete',
}

export enum TransactionPermissions {
	TRANSACTION_READ = 'transaction-read',
	TRANSACTION_CREATE = 'transaction-create',
	TRANSACTION_UPDATE = 'transaction-update',
	TRANSACTION_DELETE = 'transaction-delete',
}

export enum DashboardPermissions {
	DASHBOARD_READ = 'dashboard-read',
	DASHBOARD_CREATE = 'dashboard-create',
	DASHBOARD_UPDATE = 'dashboard-update',
	DASHBOARD_DELETE = 'dashboard-delete',
}

export enum CashSessionPermissions {
	CASH_SESSION_READ = 'cash-session-read',
	CASH_SESSION_CREATE = 'cash-session-create',
	CASH_SESSION_CLOSE = 'cash-session-close',
	CASH_SESSION_MOVEMENTS_READ = 'cash-session-movements-read',
	CASH_SESSION_MOVEMENTS_CREATE = 'cash-session-movements-create',
	CASH_SESSION_MOVEMENTS_ANNUL = 'cash-session-movements-annul',
}

export enum BankTransferPermissions {
	BANK_TRANSFER_MOVEMENTS_READ = 'bank-transfer-movements-read',
	BANK_TRANSFER_MOVEMENTS_CREATE = 'bank-transfer-movements-create',
	BANK_TRANSFER_MOVEMENTS_ANNUL = 'bank-transfer-movements-annul',
}

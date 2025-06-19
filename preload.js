const { contextBridge, ipcRenderer } = require('electron');

console.log("[Preload Process] Début du chargement de preload.js");

try {
    contextBridge.exposeInMainWorld('electronAPI', {
        // Authentication and navigation functions
        login: (credentials) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('login')");
            return ipcRenderer.invoke('login', credentials);
        },
        navigateToDashboard: () => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('navigateToDashboard')");
            return ipcRenderer.invoke('navigateToDashboard');
        },
        logout: () => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('logout')");
            return ipcRenderer.invoke('logout');
        },
        getLoggedInUserProfile: () => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('getLoggedInUserProfile')");
            return ipcRenderer.invoke('getLoggedInUserProfile');
        },
        updateAdminProfile: (profileData) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('updateAdminProfile')");
            return ipcRenderer.invoke('updateAdminProfile', profileData);
        },
        
        // Dashboard functions (stats, activities, chart)
        // L'appel ici reste getDashboardStats, main.js le redirigera si nécessaire
        getDashboardStats: () => { 
            console.log("[Preload Process] Calling ipcRenderer.invoke('getDashboardStats')");
            return ipcRenderer.invoke('getDashboardStats');
        },
        getRecentActivities: () => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('getRecentActivities')");
            return ipcRenderer.invoke('getRecentActivities');
        },
        getStockChartData: () => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('getStockChartData')");
            return ipcRenderer.invoke('getStockChartData');
        },

        // Product management functions (harmonisation des noms)
        getProducts: (categoryFilter) => { 
            console.log("[Preload Process] Calling ipcRenderer.invoke('products:getAll')");
            return ipcRenderer.invoke('products:getAll', categoryFilter); 
        },
        getProductById: (id) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('products:getById')");
            return ipcRenderer.invoke('products:getById', id);
        },
        addProduct: (productData) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('products:add')");
            return ipcRenderer.invoke('products:add', productData);
        },
        updateProduct: (productData) => { 
            console.log("[Preload Process] Calling ipcRenderer.invoke('products:update')");
            return ipcRenderer.invoke('products:update', productData);
        },
        deleteProduct: (id) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('products:delete')");
            return ipcRenderer.invoke('products:delete', id);
        },
        getProductsCategories: () => { 
            console.log("[Preload Process] Calling ipcRenderer.invoke('products:getCategories')");
            return ipcRenderer.invoke('products:getCategories');
        },

        // Supplier management functions (harmonisation des noms)
        getSuppliers: () => { 
            console.log("[Preload Process] Calling ipcRenderer.invoke('suppliers:getAll')");
            return ipcRenderer.invoke('suppliers:getAll');
        },
        getSupplierById: (id) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('suppliers:getById')");
            return ipcRenderer.invoke('suppliers:getById', id);
        },
        addSupplier: (supplierData) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('suppliers:add')");
            return ipcRenderer.invoke('suppliers:add', supplierData);
        },
        updateSupplier: (supplierData) => { 
            console.log("[Preload Process] Calling ipcRenderer.invoke('suppliers:update')");
            return ipcRenderer.invoke('suppliers:update', supplierData);
        },
        deleteSupplier: (id) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('suppliers:delete')");
            return ipcRenderer.invoke('suppliers:delete', id);
        },

        // User management functions (harmonisation des noms)
        getUsers: () => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('users:getAll')");
            return ipcRenderer.invoke('users:getAll');
        },
        getUserById: (id) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('users:getById')");
            return ipcRenderer.invoke('users:getById', id);
        },
        addUser: (userData) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('users:add')");
            return ipcRenderer.invoke('users:add', userData);
        },
        updateUser: (userData) => { 
            console.log("[Preload Process] Calling ipcRenderer.invoke('users:update')");
            return ipcRenderer.invoke('users:update', userData);
        },
        deleteUser: (id) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('users:delete')");
            return ipcRenderer.invoke('users:delete', id);
        },

        // Order management functions (harmonisation des noms)
        getOrders: () => { 
            console.log("[Preload Process] Calling ipcRenderer.invoke('orders:getAll')");
            return ipcRenderer.invoke('orders:getAll');
        },
        getOrderById: (id) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('orders:getById')");
            return ipcRenderer.invoke('orders:getById', id);
        },
        getOrderProducts: (orderId) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('orders:getProducts')"); 
            return ipcRenderer.invoke('orders:getProducts', orderId);
        },
        addOrder: (orderData) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('orders:add')");
            return ipcRenderer.invoke('orders:add', orderData);
        },
        updateOrder: (orderData) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('orders:update')");
            return ipcRenderer.invoke('orders:update', orderData);
        },
        deleteOrder: (id) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('orders:delete')");
            return ipcRenderer.invoke('orders:delete', id);
        },
        getAvailableOrderStatuses: () => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('orders:getStatuses')"); 
            return ipcRenderer.invoke('orders:getStatuses');
        },

        // Report handler (pas de changement)
        generateReport: (criteria) => {
            console.log("[Preload Process] Calling ipcRenderer.invoke('reports:generate')");
            return ipcRenderer.invoke('reports:generate', criteria);
        },

        // Renderer to main communication
        send: (channel, data) => {
            console.log(`[Preload Process] Calling ipcRenderer.send('${channel}')`);
            ipcRenderer.send(channel, data);
        },
        on: (channel, func) => {
            const validChannels = ['refresh-welcome-message']; 
            if (validChannels.includes(channel)) {
                ipcRenderer.removeAllListeners(channel); 
                ipcRenderer.on(channel, (event, ...args) => {
                    console.log(`[Preload Process] Receiving event '${channel}'`);
                    func(event, ...args);
                });
            } else {
                console.warn(`[Preload Process] Attempted to listen on unauthorized channel: ${channel}`);
            }
        }
    });
    console.log("[Preload Process] electronAPI exposed successfully in the main world.");
} catch (error) {
    console.error(`[Preload Process] Critical error exposing electronAPI: ${error.message}`);
}

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

let db; 
try {
    // Le chemin est basé sur votre structure: ./src/main/database/db.js
    db = require('./src/main/database/db'); 
    console.log("[Main Process] Module db.js chargé avec succès.");
} catch (error) {
    console.error(`[Main Process] ERREUR CRITIQUE: Impossible de charger db.js ou de se connecter à la base de données au démarrage: ${error.message}`);
    app.quit(); 
}

// CORRECTION IMPORTANTE ICI: Chemin vers auth.service.js
// D'après votre structure, c'est dans 'src/main/services/auth.service.js'
const authService = require(path.join(__dirname, 'src', 'main', 'services', 'auth.service')); 

let mainWindow; // Déclaration de la fenêtre principale
let currentLoggedInUser = null; // Variable pour stocker l'utilisateur connecté

/**
 * Crée la fenêtre principale de l'application.
 */
function createWindow() {
    if (mainWindow) {
        // Si la fenêtre existe déjà, se concentrer dessus plutôt que d'en créer une nouvelle.
        mainWindow.focus();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800, // Définir une largeur minimale
        minHeight: 600, // Définir une hauteur minimale
        frame: false, // Supprime la barre de titre native pour utiliser une barre personnalisée
        webPreferences: {
            contextIsolation: true, // Renforcé pour la sécurité
            nodeIntegration: false, // Désactivé pour la sécurité
            preload: path.join(__dirname, 'preload.js') // Charge le script preload
        }
    });

    // Charger la page de connexion au démarrage
    mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'views', 'auth', 'login.html'));

    // Ouvrir les outils de développement (à commenter ou supprimer en production)
    mainWindow.webContents.openDevTools();
}

// Quand l'application est prête, créer la fenêtre
app.whenReady().then(() => {
    createWindow();
});

// Gérer la fermeture de toutes les fenêtres (comportement macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Gérer l'activation de l'application (comportement macOS)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// =======================================================
// IPC Main Process Handlers (Gestionnaires du processus principal)
// =======================================================

// Gestionnaire de connexion
ipcMain.handle('login', async (event, credentials) => {
    console.log(`[Main Process] Tentative de connexion IPC pour: ${credentials.username}`);
    try {
        // Appelle le service d'authentification (authService) qui gère la logique DB et le rôle 'admin'
        const result = await authService.login(credentials.username, credentials.password);
        console.log("[Main Process] Résultat de l'authentification:", result);

        if (result.success) {
            // Connexion réussie et rôle admin confirmé
            currentLoggedInUser = result.user; // Stocke les informations de l'utilisateur connecté
            console.log(`[Main Process] Connexion réussie pour ${currentLoggedInUser.username}`);
            // Redirige vers le tableau de bord
            mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'views', 'dashboard.html'));
            // Vous pouvez envoyer les données de l'utilisateur au renderer si nécessaire
            // event.sender.send('login-success', currentLoggedInUser);
            return { success: true, user: currentLoggedInUser };
        } else {
            // Échec de connexion (mauvais identifiants, non admin, compte bloqué, etc.)
            console.warn(`[Main Process] Échec de connexion: ${result.message}`);
            return { success: false, error: result.message };
        }
    } catch (error) {
        console.error(`[Main Process] Erreur inattendue lors de la gestion de la connexion: ${error.message}`, error);
        // Retourne une erreur générique au renderer en cas d'erreur non capturée par auth.service.js
        return { success: false, error: "Une erreur interne est survenue lors de la connexion. Veuillez réessayer." };
    }
});

// Gestionnaire pour naviguer vers le tableau de bord (après connexion)
ipcMain.handle('navigateToDashboard', (event) => {
    if (currentLoggedInUser) {
        console.log("[Main Process] Redirection vers le tableau de bord.");
        mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'views', 'dashboard.html'));
        return { success: true };
    } else {
        console.warn("[Main Process] Tentative de navigation sans utilisateur connecté.");
        return { success: false, error: "Aucun utilisateur connecté." };
    }
});

// Gestionnaire de déconnexion
ipcMain.handle('logout', (event) => {
    console.log("[Main Process] Déconnexion de l'utilisateur.");
    currentLoggedInUser = null; // Réinitialise l'utilisateur connecté
    mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'views', 'auth', 'login.html')); // Redirige vers la page de connexion
    return { success: true };
});

// Gestionnaire pour récupérer le profil de l'utilisateur connecté
ipcMain.handle('getLoggedInUserProfile', async (event) => {
    console.log("[Main Process] Récupération du profil de l'utilisateur connecté.");
    if (currentLoggedInUser) {
        try {
            // Récupère les données les plus récentes de l'utilisateur depuis la DB
            const userProfile = await db.getUserById(currentLoggedInUser.idUser);
            if (userProfile.success) {
                currentLoggedInUser = userProfile.user; // Met à jour l'objet utilisateur global
                return { success: true, user: currentLoggedInUser };
            } else {
                console.warn(`[Main Process] Impossible de retrouver l'utilisateur ID ${currentLoggedInUser.idUser} dans la DB.`);
                return { success: false, error: "Profil utilisateur non trouvé." };
            }
        } catch (error) {
            console.error(`[Main Process] Erreur lors de la récupération du profil: ${error.message}`);
            return { success: false, error: "Erreur lors de la récupération du profil." };
        }
    } else {
        console.warn("[Main Process] Tentative de récupérer le profil sans utilisateur connecté.");
        return { success: false, error: "Aucun utilisateur connecté." };
    }
});

// Gestionnaire pour la mise à jour du profil administrateur
ipcMain.handle('updateAdminProfile', async (event, profileData) => {
    console.log(`[Main Process] Tentative de mise à jour du profil admin pour ID: ${profileData.idUser}`);
    try {
        const result = await db.updateUser(profileData);
        if (result.success) {
            // Si la mise à jour de la DB réussit, rafraîchissez l'objet currentLoggedInUser
            // en le récupérant à nouveau pour s'assurer qu'il est à jour.
            const updatedUserResult = await db.getUserById(profileData.idUser);
            if (updatedUserResult.success) {
                currentLoggedInUser = updatedUserResult.user;
                console.log("[Main Process] Profil admin mis à jour avec succès et user global rafraîchi.");
                return { success: true, message: "Profil mis à jour avec succès.", user: currentLoggedInUser };
            } else {
                console.error("[Main Process] Erreur lors du rafraîchissement de l'objet utilisateur après la mise à jour.");
                return { success: true, message: "Profil mis à jour, mais le rafraîchissement des données a échoué." };
            }
        } else {
            console.warn(`[Main Process] Échec de la mise à jour du profil: ${result.message}`);
            return { success: false, error: result.message };
        }
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la mise à jour du profil admin: ${error.message}`);
        return { success: false, error: `Erreur système lors de la mise à jour du profil: ${error.message}` };
    }
});


// Dashboard stats
ipcMain.handle('getDashboardStats', async () => {
    console.log("[Main Process] Récupération des statistiques du tableau de bord.");
    try {
        const stats = await db.getDashboardOverviewStats();
        return stats;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des stats: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('getRecentActivities', async () => {
    console.log("[Main Process] Récupération des activités récentes.");
    try {
        const activities = await db.getRecentActivities();
        return activities;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des activités récentes: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('getStockOverviewData', async () => { // Assurez-vous que cette fonction appelle la bonne DB function
    console.log("[Main Process] Récupération des données d'aperçu du stock pour graphique.");
    try {
        const stockData = await db.getStockChartData();
        return stockData;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des données de stock pour graphique: ${error.message}`);
        return { success: false, error: error.message };
    }
});


// Gestionnaires de produits
ipcMain.handle('products:getAll', async (event, categoryFilter) => {
    console.log(`[Main Process] Récupération de tous les produits (filtre: ${categoryFilter || 'aucun'}).`);
    try {
        const result = await db.getProducts(categoryFilter);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des produits: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('products:add', async (event, productData) => {
    console.log("[Main Process] Ajout d'un produit.");
    try {
        const result = await db.addProduct(productData);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de l'ajout du produit: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('products:delete', async (event, id) => {
    console.log(`[Main Process] Suppression du produit ID: ${id}.`);
    try {
        const result = await db.deleteProduct(id);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la suppression du produit ${id}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('products:getById', async (event, id) => {
    console.log(`[Main Process] Récupération du produit ID: ${id}.`);
    try {
        const result = await db.getProductById(id);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération du produit par ID ${id}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('products:update', async (event, productData) => {
    console.log(`[Main Process] Mise à jour du produit ID: ${productData.idProduit}.`);
    try {
        const result = await db.updateProduct(productData);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la mise à jour du produit ${productData.idProduit}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('products:getCategories', async () => {
    console.log("[Main Process] Récupération des catégories de produits.");
    try {
        const result = await db.getAvailableCategories();
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des catégories: ${error.message}`);
        return { success: false, error: error.message };
    }
});

// Gestionnaires de fournisseurs
ipcMain.handle('suppliers:getAll', async () => {
    console.log("[Main Process] Récupération de tous les fournisseurs.");
    try {
        const result = await db.getSuppliers();
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des fournisseurs: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('suppliers:add', async (event, supplierData) => {
    console.log("[Main Process] Ajout d'un fournisseur.");
    try {
        const result = await db.addSupplier(supplierData);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de l'ajout du fournisseur: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('suppliers:delete', async (event, id) => {
    console.log(`[Main Process] Suppression du fournisseur ID: ${id}.`);
    try {
        const result = await db.deleteSupplier(id);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la suppression du fournisseur ${id}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('suppliers:getById', async (event, id) => {
    console.log(`[Main Process] Récupération du fournisseur ID: ${id}.`);
    try {
        const result = await db.getSupplierById(id);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération du fournisseur par ID ${id}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('suppliers:update', async (event, supplierData) => {
    console.log(`[Main Process] Mise à jour du fournisseur ID: ${supplierData.idFournisseur}.`);
    try {
        const result = await db.updateSupplier(supplierData);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la mise à jour du fournisseur ${supplierData.idFournisseur}: ${error.message}`);
        return { success: false, error: error.message };
    }
});


// Gestionnaires de commandes
ipcMain.handle('orders:getAll', async () => {
    console.log("[Main Process] Récupération de toutes les commandes.");
    try {
        const result = await db.getOrdersWithProducts();
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des commandes: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('orders:add', async (event, orderData) => {
    console.log("[Main Process] Ajout d'une commande.");
    try {
        const result = await db.addOrder(orderData);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de l'ajout de la commande: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('orders:delete', async (event, id) => {
    console.log(`[Main Process] Suppression de la commande ID: ${id}.`);
    try {
        const result = await db.deleteOrder(id);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la suppression de la commande ${id}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('orders:getById', async (event, id) => {
    console.log(`[Main Process] Récupération de la commande ID: ${id}.`);
    try {
        const result = await db.getOrderById(id);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération de la commande par ID ${id}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('orders:update', async (event, orderData) => {
    console.log(`[Main Process] Mise à jour de la commande ID: ${orderData.idCommande}.`);
    try {
        const result = await db.updateOrder(orderData);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la mise à jour de la commande ${orderData.idCommande}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('orders:getProducts', async (event, idCommande) => { 
    console.log(`[Main Process] Récupération des produits pour la commande ${idCommande}.`);
    try {
        const result = await db.getOrderProducts(idCommande);
        return { success: true, products: result }; // S'assurer que le format de retour est cohérent
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des produits de la commande ${idCommande}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('orders:getStatuses', async () => { 
    console.log("[Main Process] Récupération des statuts de commande disponibles.");
    try {
        const result = await db.getAvailableOrderStatuses();
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des statuts de commande: ${error.message}`);
        return { success: false, error: error.message };
    }
});


// Gestionnaire de rapports
ipcMain.handle('reports:generate', async (event, criteria) => {
    console.log(`[Main Process] Tentative de génération du rapport pour les critères: ${JSON.stringify(criteria)}`);
    try {
        const result = await db.generateReport(criteria);
        return result;
    } catch (err) {
        console.error(`[Main Process] Erreur lors de la génération du rapport: ${err.message}`);
        return { success: false, error: err.message };
    }
});

// Écouteur pour rafraîchir le message de bienvenue (utilisé par updateUser)
ipcMain.on('refresh-welcome-message', (event, firstName) => {
    // Cette partie est généralement pour envoyer un message du main vers le renderer
    // Par exemple, si le nom de l'utilisateur change, on pourrait envoyer une mise à jour au dashboard.
    // Assurez-vous que le renderer écoute ce canal.
    console.log(`[Main Process] Rafraîchissement du message de bienvenue demandé pour: ${firstName}`);
    // Exemple d'envoi au renderer si le dashboard écoute 'update-welcome-message'
    // mainWindow.webContents.send('update-welcome-message', firstName);
});

// Gestionnaires d'utilisateurs (si l'admin peut gérer les utilisateurs)
ipcMain.handle('users:getAll', async () => {
    console.log("[Main Process] Récupération de tous les utilisateurs.");
    try {
        const result = await db.getUsers();
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération des utilisateurs: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('users:add', async (event, userData) => {
    console.log("[Main Process] Ajout d'un utilisateur.");
    try {
        const result = await db.addUser(userData);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de l'ajout de l'utilisateur: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('users:delete', async (event, id) => {
    console.log(`[Main Process] Suppression de l'utilisateur ID: ${id}.`);
    try {
        const result = await db.deleteUser(id);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la suppression de l'utilisateur ${id}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('users:getById', async (event, id) => {
    console.log(`[Main Process] Récupération de l'utilisateur ID: ${id}.`);
    try {
        const result = await db.getUserById(id);
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la récupération de l'utilisateur par ID ${id}: ${error.message}`);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('users:update', async (event, userData) => {
    console.log(`[Main Process] Mise à jour de l'utilisateur ID: ${userData.idUser}.`);
    try {
        // CORRECTION: Assurez-vous que 'updateUser' dans db.js gère le changement de rôle si nécessaire.
        // Ici, on utilise la fonction updateUser existante qui met à jour nom, prenom, email.
        // Si vous voulez changer le mot de passe ou le rôle, vous aurez besoin de fonctions DB dédiées.
        const result = await db.updateUser(userData); 
        return result;
    } catch (error) {
        console.error(`[Main Process] Erreur lors de la mise à jour de l'utilisateur ${userData.idUser}: ${error.message}`);
        return { success: false, error: error.message };
    }
});


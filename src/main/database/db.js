// src/main/database/db.js

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs'); // Importez bcryptjs ici
require('dotenv').config(); // Charge les variables d'environnement depuis le fichier .env

// Configuration du pool de connexions à la base de données MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST,           // Hôte de la base de données (depuis .env)
    user: process.env.DB_USER,             // Nom d'utilisateur MySQL (depuis .env)
    password: process.env.DB_PASSWORD,     // Mot de passe MySQL (depuis .env)
    database: process.env.DB_NAME,         // Nom de la base de données (depuis .env)
    waitForConnections: true,              // Le pool attendra-t-il si toutes les connexions sont utilisées ?
    connectionLimit: 10,                   // Nombre maximal de connexions simultanées dans le pool
    queueLimit: 0,                         // Nombre maximal de requêtes en file d'attente (0 = illimité)
    trace: true                            // Active le traçage des requêtes SQL pour le débogage
});

// Test de connexion initial au démarrage de l'application
pool.getConnection()
    .then(connection => {
        console.log("[DB] Connexion à la base de données réussie.");
        connection.release(); // Relâche la connexion immédiatement après le test
    })
    .catch(err => {
        // En cas d'échec de la connexion initiale, logguer l'erreur critique
        console.error("[DB] ERREUR CRITIQUE: Échec de la connexion à la base de données au démarrage:", err.message);
        // Vous pouvez décider de quitter l'application ici si la connexion à la DB est absolument essentielle.
        // process.exit(1); 
    });

/**
 * Exécute une requête SQL générique avec des paramètres sécurisés.
 * Cette fonction est le point d'entrée unique pour toutes les requêtes SQL.
 * Elle loggue la requête SQL et les paramètres pour faciliter le débogage.
 * Elle gère également la conversion des valeurs `undefined`, `NaN` ou chaînes vides en `NULL` pour la DB.
 * @param {string} sql - La requête SQL à exécuter.
 * @param {Array} params - Un tableau de paramètres à lier à la requête.
 * @returns {Promise<Array>} - Un tableau des lignes de résultats de la requête.
 * @throws {Error} - Propage les erreurs SQL pour une gestion supérieure (ex: dans les gestionnaires IPC).
 */
async function query(sql, params = []) {
    try {
        console.log("[Database - query] SQL:", sql);
        // Nettoie les paramètres : convertit les valeurs problématiques en NULL pour la base de données
        const sanitizedParams = params.map(param => {
            if (param === undefined || (typeof param === 'number' && isNaN(param)) || (typeof param === 'string' && param.trim() === '')) {
                return null;
            }
            return param;
        });
        console.log("[Database - query] Parameters:", sanitizedParams);
        const [rows] = await pool.execute(sql, sanitizedParams);
        return rows;
    } catch (error) {
        console.error(`[Database - query] Erreur d'exécution de la requête: ${sql}`, error);
        throw error; // Propage l'erreur pour qu'elle soit gérée par le code appelant
    }
}

/**
 * Authentifie un utilisateur en vérifiant son nom d'utilisateur et son mot de passe.
 * Gère les tentatives de connexion échouées et le verrouillage temporaire du compte pour la sécurité.
 * @param {string} username - Le nom d'utilisateur fourni.
 * @param {string} password - Le mot de passe fourni (qui sera comparé via bcrypt ou en clair).
 * @returns {Promise<Object>} - Un objet décrivant le résultat de l'authentification:
 * - `success`: `true` si la connexion est réussie, `false` sinon.
 * - `message`: Un message expliquant le résultat (succès, échec, compte verrouillé).
 * - `user`: (Optionnel) Un objet contenant les données de l'utilisateur connecté en cas de succès, incluant le rôle.
 */
async function authenticateUser(username, password) {
    let connection; 
    try {
        connection = await pool.getConnection(); 
        await connection.beginTransaction();     

        console.log(`[DB - authenticateUser] Tentative pour: ${username}`);

        // 1. Récupérer les informations de l'utilisateur (y compris les tentatives échouées et le verrouillage)
        const [users] = await connection.execute(
            'SELECT idUser, username, password, nom, prenom, role, failed_login_attempts, lockout_until FROM user_ WHERE username = ?',
            [username]
        );

        const user = users[0]; 
        console.log("[DB - authenticateUser] Utilisateur récupéré (masquant le mot de passe):", user ? { ...user, password: '***' } : 'Non trouvé');

        if (!user) {
            await connection.rollback(); 
            // Message générique pour ne pas divulguer si l'utilisateur existe ou non
            return { success: false, message: "Nom d'utilisateur ou mot de passe incorrect." };
        }

        // 2. Vérifier si le compte est actuellement verrouillé
        if (user.lockout_until && new Date() < new Date(user.lockout_until)) {
            const remainingTimeSeconds = Math.ceil((new Date(user.lockout_until).getTime() - new Date().getTime()) / 1000);
            const remainingMinutes = Math.floor(remainingTimeSeconds / 60);
            const remainingSeconds = remainingTimeSeconds % 60;
            
            let timeMessage = '';
            if (remainingMinutes > 0) timeMessage += `${remainingMinutes} minute(s)`;
            if (remainingSeconds > 0) {
                if (timeMessage !== '') timeMessage += ' et ';
                timeMessage += `${remainingSeconds} seconde(s)`;
            }
            if (timeMessage === '') timeMessage = 'un instant'; // Fallback pour les très courtes durées

            await connection.rollback();
            return { success: false, message: `Votre compte est temporairement bloqué. Veuillez réessayer dans ${timeMessage}.` };
        }

        // 3. Comparer le mot de passe (Utilise bcrypt ou la comparaison en clair pour la migration)
        let passwordValid = false;
        // Si le mot de passe dans la DB commence par '$2a$' (haché bcrypt)
        if (user.password && user.password.startsWith('$2a$')) { 
            passwordValid = await bcrypt.compare(password, user.password);
            console.log(`[DB - authenticateUser] bcrypt.compare résultat: ${passwordValid}`);
        } else { 
            // Pour les mots de passe en clair (à migrer vers haché)
            passwordValid = (password === user.password);
            console.warn(`[DB - authenticateUser] ATTENTION: Mot de passe en texte clair détecté pour ${username}.`);
            
            // *** OPTIONNEL: Hacher et mettre à jour le mot de passe ici si la connexion en clair réussit ***
            // Décommentez le bloc suivant si vous voulez migrer automatiquement les mots de passe
            /*
            if (passwordValid) {
                const hashedPassword = await bcrypt.hash(password, 10); // Hacher le mot de passe
                await connection.execute('UPDATE user_ SET password = ? WHERE idUser = ?', [hashedPassword, user.idUser]);
                console.log(`[DB - authenticateUser] Mot de passe de ${username} haché et mis à jour.`);
            }
            */
        }

        if (!passwordValid) {
            // Mot de passe incorrect : Incrémenter le compteur de tentatives échouées
            const MAX_FAILED_ATTEMPTS = 3;      
            const LOCKOUT_DURATION_MINUTES = 5; 

            const newAttempts = user.failed_login_attempts + 1;
            let lockoutUntil = null;
            let message = "Nom d'utilisateur ou mot de passe incorrect. ";

            if (newAttempts >= MAX_FAILED_ATTEMPTS) {
                lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
                message = `Votre compte sera bloqué pour ${LOCKOUT_DURATION_MINUTES} minutes suite à trop de tentatives échouées.`;
            } else {
                message += `Il vous reste ${MAX_FAILED_ATTEMPTS - newAttempts} tentative(s) avant le blocage.`;
            }

            await connection.execute(
                'UPDATE user_ SET failed_login_attempts = ?, lockout_until = ? WHERE idUser = ?',
                [newAttempts, lockoutUntil, user.idUser]
            );
            await connection.commit();
            console.log(`[DB - authenticateUser] Mot de passe incorrect. Tentatives restantes: ${MAX_FAILED_ATTEMPTS - newAttempts}`);
            return { success: false, message: message };
        }

        // Connexion réussie : Réinitialiser le compteur de tentatives et le statut de verrouillage
        await connection.execute(
            'UPDATE user_ SET failed_login_attempts = 0, lockout_until = NULL WHERE idUser = ?',
            [user.idUser]
        );
        await connection.commit(); 
        console.log("[DB - authenticateUser] Authentification réussie. Compteur de tentatives réinitialisé.");
        return {
            success: true,
            message: "Connexion réussie.",
            user: {
                idUser: user.idUser,
                username: user.username,
                firstName: user.prenom, 
                lastName: user.nom,
                role: user.role,
                // Assurez-vous que la colonne 'email' existe dans votre table 'user_' si vous la retournez
                // email: user.email 
            }
        };

    } catch (error) {
        if (connection) await connection.rollback(); 
        console.error(`[Database - authenticateUser] Erreur interne lors de l'authentification: ${error.message}`, error);
        // Message générique de sécurité pour l'utilisateur final
        return { success: false, message: "Une erreur interne est survenue lors de la connexion. Veuillez réessayer." };
    } finally {
        if (connection) connection.release(); 
    }
}

/**
 * Récupère les statistiques d'aperçu pour les cartes du tableau de bord.
 * @returns {Promise<Object>} Un objet contenant un booléen de succès et les données des statistiques.
 */
async function getDashboardOverviewStats() {
    try {
        // CORRECTION: Remplacé quantiteStock par quantite pour la table produit
        const totalProductsResult = await query('SELECT COUNT(idProduit) AS total FROM produit');
        const totalSuppliersResult = await query('SELECT COUNT(idFournisseur) AS total FROM fournisseur');
        // CORRECTION: Statut en attente et non en_cours
        const activeOrdersResult = await query("SELECT COUNT(idCommande) AS total FROM commande WHERE statut = 'en attente'"); 
        // CORRECTION: Remplacé quantiteStock par quantite pour la table produit
        const lowStockResult = await query('SELECT COUNT(idProduit) AS total FROM produit WHERE quantite < 10'); 

        return {
            success: true,
            data: {
                totalProducts: totalProductsResult[0].total,
                totalSuppliers: totalSuppliersResult[0].total,
                activeOrders: activeOrdersResult[0].total,
                lowStock: lowStockResult[0].total
            }
        };
    } catch (error) {
        console.error("[Database] Erreur lors de la récupération des statistiques d'aperçu du tableau de bord:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère les activités récentes pour le tableau de bord (commandes et achats).
 * @returns {Promise<Object>} Un objet contenant un booléen de succès et un tableau des activités récentes.
 */
async function getRecentActivities() { 
    try {
        const orderActivities = await query(`
            SELECT 
                idCommande AS id, 
                'Commande' AS type, 
                CONCAT('Nouvelle commande par ', u.username, ' (Statut: ', c.statut, ')') AS description, 
                c.created_at AS timestamp
            FROM commande c
            JOIN user_ u ON c.idUser = u.idUser
            ORDER BY c.created_at DESC
            LIMIT 5
        `);

        const purchaseActivities = await query(`
            SELECT 
                idAchat AS id, 
                'Achat' AS type, 
                CONCAT('Nouvel achat de ', prix, '€ chez ', f.nom) AS description, 
                a.created_at AS timestamp
            FROM achat a
            JOIN fournisseur f ON a.idFournisseur = f.idFournisseur
            ORDER BY a.created_at DESC
            LIMIT 5
        `);

        let allActivities = [...orderActivities, ...purchaseActivities];
        allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return { success: true, data: allActivities.slice(0, 10) };
    } catch (error) {
        console.error("[Database] Erreur lors de la récupération des activités récentes:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère les données de stock par produit pour le graphique d'aperçu.
 * @returns {Promise<Object>} Un objet contenant un booléen de succès et les données de stock formatées pour Chart.js.
 */
async function getStockChartData() {
    try {
        // CORRECTION: Remplacé nomProduit, quantiteStock par nom, quantite pour la table produit
        const products = await query('SELECT nom, quantite FROM produit ORDER BY nom ASC');
        
        const chartData = {
            labels: products.map(p => p.nom), 
            datasets: [{
                label: 'Quantité en Stock', 
                data: products.map(p => p.quantite),
                backgroundColor: 'rgba(0, 221, 255, 0.7)', 
                borderColor: 'rgba(0, 221, 255, 1)',
                borderWidth: 1
            }]
        };
        return { success: true, data: chartData };
    } catch (error) {
        console.error("[Database] Erreur lors de la récupération des données de graphique de stock:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Met à jour les informations d'un utilisateur.
 * @param {object} userData - Objet contenant les données à mettre à jour (idUser, nom, prenom, email).
 * @returns {Promise<object>} Un objet indiquant le succès de l'opération de mise à jour.
 */
async function updateUser(userData) {
    try {
        // CORRECTION: Assurez-vous que les noms de colonnes 'nom', 'prenom', 'email' sont corrects
        // Si 'email' n'existe pas dans user_, retirez-le ou ajoutez-le à votre schéma DB
        const result = await query(
            'UPDATE user_ SET nom = ?, prenom = ?, email = ? WHERE idUser = ?',
            [userData.lastName, userData.firstName, userData.email, userData.idUser]
        );
        return { success: result.affectedRows > 0, message: result.affectedRows > 0 ? 'Utilisateur mis à jour.' : 'Utilisateur non trouvé.' };
    } catch (error) {
        console.error(`[Database] Erreur lors de la mise à jour de l'utilisateur: ${error.message}`);
        throw error; 
    }
}

/**
 * Récupère tous les produits avec une option de filtrage par catégorie.
 * @param {string} categoryFilter - La catégorie sur laquelle filtrer. Si vide ou 'all', tous les produits sont retournés.
 * @returns {Promise<object>} Un objet contenant un booléen de succès et un tableau de produits.
 */
async function getProducts(categoryFilter) {
    try {
        // CORRECTION: Utiliser les noms de colonnes 'nom' et 'quantite' de la table 'produit'
        // et 'name' pour la table 'category'
        let sql = `
            SELECT p.idProduit, p.nom, p.quantite, p.prix, c.name AS categorie, p.created_at 
            FROM produit p
            LEFT JOIN category c ON p.idCategory = c.idCategory
        `;
        let params = [];
        if (categoryFilter && categoryFilter !== 'all') {
            sql += ' WHERE c.name = ?';
            params.push(categoryFilter);
        }
        sql += ' ORDER BY p.created_at DESC'; 
        const products = await query(sql, params);
        return { success: true, products: products };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération des produits: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère un seul produit par son ID.
 * @param {number} id - L'ID du produit à récupérer.
 * @returns {Promise<object>} Un objet contenant un booléen de succès et l'objet produit (ou null si non trouvé).
 */
async function getProductById(id) {
    try {
        // CORRECTION: Utiliser les noms de colonnes 'nom' et 'quantite' de la table 'produit'
        // et 'name' pour la table 'category'
        const [product] = await query(`
            SELECT p.idProduit, p.nom, p.quantite, p.prix, c.name AS categorie, p.idFournisseur 
            FROM produit p
            LEFT JOIN category c ON p.idCategory = c.idCategory
            WHERE p.idProduit = ?
        `, [id]);
        return { success: product ? true : false, product: product };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération du produit par ID: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Ajoute un nouveau produit à la base de données.
 * @param {object} productData - Les données du produit à insérer (nom, quantite, prix, idCategory, idFournisseur).
 * @returns {Promise<object>} Un objet indiquant le succès et l'ID auto-généré du nouveau produit.
 */
async function addProduct(productData) {
    try {
        const defaultFournisseurId = productData.idFournisseur || null; 
        // CORRECTION: Utiliser les noms de colonnes 'nom', 'quantite', 'idCategory' de la table 'produit'
        const result = await query('INSERT INTO produit (nom, quantite, prix, idCategory, idFournisseur) VALUES (?, ?, ?, ?, ?)', 
            [productData.nom, productData.quantite, productData.prix, productData.idCategory, defaultFournisseurId]);
        return { success: true, message: 'Produit ajouté avec succès.', id: result.insertId };
    } catch (error) {
        console.error(`[Database] Erreur lors de l'ajout du produit: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Met à jour les informations d'un produit existant.
 * @param {object} productData - Les données du produit à mettre à jour (idProduit, nom, quantite, prix, idCategory, idFournisseur).
 * @returns {Promise<object>} Un objet indiquant le succès de la mise à jour.
 */
async function updateProduct(productData) {
    try {
        // CORRECTION: Utiliser les noms de colonnes 'nom', 'quantite', 'idCategory' de la table 'produit'
        const result = await query(
            'UPDATE produit SET nom = ?, quantite = ?, prix = ?, idCategory = ?, idFournisseur = ? WHERE idProduit = ?',
            [productData.nom, productData.quantite, productData.prix, productData.idCategory, productData.idFournisseur, productData.idProduit]
        );
        return { success: result.affectedRows > 0, message: result.affectedRows > 0 ? 'Produit mis à jour.' : 'Produit non trouvé.' };
    } catch (error) {
        console.error(`[Database] Erreur lors de la mise à jour du produit: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Supprime un produit par son ID.
 * @param {number} id - L'ID du produit à supprimer.
 * @returns {Promise<object>} Un objet indiquant le succès de la suppression.
 */
async function deleteProduct(id) {
    try {
        const result = await query('DELETE FROM produit WHERE idProduit = ?', [id]);
        return { success: result.affectedRows > 0, message: result.affectedRows > 0 ? 'Produit supprimé.' : 'Produit non trouvé.' };
    } catch (error) {
        console.error(`[Database] Erreur lors de la suppression du produit: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère toutes les catégories de produits uniques et non vides.
 * @returns {Promise<object>} Un objet contenant un booléen de succès et un tableau de chaînes de catégories.
 */
async function getAvailableCategories() {
    try {
        // CORRECTION: Récupérer les catégories depuis la table 'category'
        const rows = await query('SELECT DISTINCT name FROM category ORDER BY name ASC');
        const categories = rows.map(row => row.name);
        return { success: true, categories: categories };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération des catégories: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère tous les fournisseurs.
 * @returns {Promise<object>} Un objet contenant un booléen de succès et un tableau de fournisseurs.
 */
async function getSuppliers() {
    try {
        // CORRECTION: Utiliser le nom de colonne 'nom' de la table 'fournisseur'
        const suppliers = await query('SELECT idFournisseur, nom, contact, adresse, created_at FROM fournisseur ORDER BY created_at DESC');
        return { success: true, suppliers: suppliers };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération des fournisseurs: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère un seul fournisseur par son ID.
 * @param {number} id - L'ID du fournisseur à récupérer.
 * @returns {Promise<object>} Un objet contenant un booléen de succès et l'objet fournisseur.
 */
async function getSupplierById(id) {
    try {
        // CORRECTION: Utiliser le nom de colonne 'nom' de la table 'fournisseur'
        const [supplier] = await query('SELECT idFournisseur, nom, contact, adresse FROM fournisseur WHERE idFournisseur = ?', [id]);
        return { success: supplier ? true : false, supplier: supplier };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération du fournisseur par ID: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Ajoute un nouveau fournisseur.
 * @param {object} supplierData - Les données du fournisseur à insérer (nom, contact, adresse).
 * @returns {Promise<object>} Un objet indiquant le succès et l'ID auto-généré du nouveau fournisseur.
 */
async function addSupplier(supplierData) {
    try {
        // CORRECTION: Utiliser le nom de colonne 'nom' de la table 'fournisseur'
        const result = await query('INSERT INTO fournisseur (nom, contact, adresse) VALUES (?, ?, ?)',
            [supplierData.nom, supplierData.contact, supplierData.adresse]);
        return { success: true, message: 'Fournisseur ajouté avec succès.', id: result.insertId };
    } catch (error) {
        console.error(`[Database] Erreur lors de l'ajout du fournisseur: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Met à jour les informations d'un fournisseur existant.
 * @param {object} supplierData - Les données du fournisseur à mettre à jour (idFournisseur, nom, contact, adresse).
 * @returns {Promise<object>} Un objet indiquant le succès de la mise à jour.
 */
async function updateSupplier(supplierData) {
    try {
        // CORRECTION: Utiliser le nom de colonne 'nom' de la table 'fournisseur'
        const result = await query(
            'UPDATE fournisseur SET nom = ?, contact = ?, adresse = ? WHERE idFournisseur = ?',
            [supplierData.nom, supplierData.contact, supplierData.adresse, supplierData.idFournisseur]
        );
        return { success: result.affectedRows > 0, message: result.affectedRows > 0 ? 'Fournisseur mis à jour.' : 'Fournisseur non trouvé.' };
    } catch (error) {
        console.error(`[Database] Erreur lors de la mise à jour du fournisseur: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Supprime un fournisseur par son ID.
 * @param {number} id - L'ID du fournisseur à supprimer.
 * @returns {Promise<object>} Un objet indiquant le succès de la suppression.
 */
async function deleteSupplier(id) {
    try {
        const result = await query('DELETE FROM fournisseur WHERE idFournisseur = ?', [id]);
        return { success: result.affectedRows > 0, message: result.affectedRows > 0 ? 'Fournisseur supprimé.' : 'Fournisseur non trouvé.' };
    } catch (error) {
        console.error(`[Database] Erreur lors de la suppression du fournisseur: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère tous les utilisateurs de la base de données (sans le mot de passe pour la sécurité).
 * @returns {Promise<object>} Un objet contenant un booléen de succès et un tableau d'utilisateurs.
 */
async function getUsers() {
    try {
        const users = await query('SELECT idUser, username, nom, prenom, role FROM user_ ORDER BY username ASC');
        return { success: true, users: users };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération des utilisateurs: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère un seul utilisateur par son ID (sans le mot de passe).
 * @param {number} id - L'ID de l'utilisateur à récupérer.
 * @returns {Promise<object>} Un objet contenant un booléen de succès et l'objet utilisateur.
 */
async function getUserById(id) {
    try {
        // CORRECTION: Assurez-vous que 'email' existe si vous le récupérez
        const [user] = await query('SELECT idUser, username, nom, prenom, role FROM user_ WHERE idUser = ?', [id]);
        return { success: user ? true : false, user: user };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération de l'utilisateur par ID: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Ajoute un nouvel utilisateur à la base de données.
 * @param {object} userData - Les données de l'utilisateur à insérer (username, password, role, nom, prenom, email).
 * @returns {Promise<object>} Un objet indiquant le succès et l'ID auto-généré du nouvel utilisateur.
 */
async function addUser(userData) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Hacher le mot de passe avant de l'insérer
        const hashedPassword = await bcrypt.hash(userData.password, 10); // 10 rounds de salage
        
        // CORRECTION: Assurez-vous que les noms de colonnes 'nom', 'prenom', 'email' sont corrects
        const result = await connection.execute('INSERT INTO user_ (username, password, role, nom, prenom, email) VALUES (?, ?, ?, ?, ?, ?)',
            [userData.username, hashedPassword, userData.role, userData.lastName, userData.firstName, userData.email]);
        
        await connection.commit();
        return { success: true, message: 'Utilisateur ajouté avec succès.', id: result.insertId };
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`[Database] Erreur lors de l'ajout de l'utilisateur: ${error.message}`);
        if (error.code === 'ER_DUP_ENTRY') { 
            return { success: false, error: 'Ce nom d\'utilisateur existe déjà.' };
        }
        return { success: false, error: error.message };
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Supprime un utilisateur par son ID.
 * @param {number} id - L'ID de l'utilisateur à supprimer.
 * @returns {Promise<object>} Un objet indiquant le succès de la suppression.
 */
async function deleteUser(id) {
    try {
        const result = await query('DELETE FROM user_ WHERE idUser = ?', [id]);
        return { success: result.affectedRows > 0, message: result.affectedRows > 0 ? 'Utilisateur supprimé.' : 'Utilisateur non trouvé.' };
    } catch (error) {
        console.error(`[Database] Erreur lors de la suppression de l'utilisateur: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère toutes les commandes, leurs produits associés et l'utilisateur qui les a passées.
 * @returns {Promise<object>} Un objet contenant un booléen de succès et un tableau de commandes détaillées.
 */
async function getOrdersWithProducts() {
    try {
        const orders = await query(`
            SELECT
                c.idCommande,
                c.idUser,
                u.username AS nom_utilisateur, 
                c.dateCommande,
                c.statut,
                (SELECT SUM(cp.quantite * cp.prix_unitaire) FROM commande_produits cp WHERE cp.idCommande = c.idCommande) AS total_commande
            FROM commande c
            JOIN user_ u ON c.idUser = u.idUser
            ORDER BY c.dateCommande DESC
        `);

        // Pour chaque commande, récupérer ses produits associés pour un affichage complet
        for (const order of orders) {
            const productsInOrder = await query(`
                SELECT
                    cp.idProduit,
                    p.nom AS nom_produit, -- CORRECTION: Utiliser 'nom' de la table 'produit'
                    cp.quantite AS quantite_produit_commande,
                    cp.prix_unitaire
                FROM commande_produits cp
                JOIN produit p ON cp.idProduit = p.idProduit
                WHERE cp.idCommande = ?
            `, [order.idCommande]);
            order.products = productsInOrder; 
        }
        
        return { success: true, orders: orders };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération des commandes avec produits: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère une seule commande par son ID, y compris tous ses produits.
 * @param {number} id - L'ID de la commande à récupérer.
 * @returns {Promise<object>} Un objet contenant un booléen de succès et l'objet commande détaillé.
 */
async function getOrderById(id) {
    try {
        const [order] = await query('SELECT idCommande, idUser, dateCommande, statut FROM commande WHERE idCommande = ?', [id]);
        if (order) {
            order.products = await getOrderProducts(id); // Récupère les produits associés
        }
        return { success: order ? true : false, order: order };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération de la commande par ID: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Récupère les produits spécifiques associés à une commande donnée.
 * @param {number} orderId - L'ID de la commande dont on veut récupérer les produits.
 * @returns {Promise<Array>} Un tableau des produits trouvés pour cette commande.
 */
async function getOrderProducts(orderId) {
    try {
        const products = await query(`
            SELECT cp.idProduit, p.nom AS nom_produit, cp.quantite, cp.prix_unitaire -- CORRECTION: Utiliser 'nom' de la table 'produit'
            FROM commande_produits cp
            JOIN produit p ON cp.idProduit = p.idProduit
            WHERE cp.idCommande = ?
        `, [orderId]);
        return products;
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération des produits de la commande ${orderId}: ${error.message}`);
        return []; // Retourne un tableau vide en cas d'erreur
    }
}

/**
 * Ajoute une nouvelle commande à la base de données.
 * Cette opération est transactionnelle pour assurer l'intégrité des données entre `commande` et `commande_produits`.
 * @param {object} orderData - Les données de la commande à ajouter (idUser, dateCommande, statut, products[]).
 * @returns {Promise<object>} Un objet indiquant le succès et l'ID de la nouvelle commande.
 */
async function addOrder(orderData) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction(); // Démarre la transaction

        const [orderResult] = await connection.execute(
            'INSERT INTO commande (idUser, dateCommande, statut, total) VALUES (?, ?, ?, ?)', // Ajout de 'total'
            [orderData.idUser, orderData.dateCommande, orderData.statut, orderData.total || 0] // Utilisation de orderData.total
        );
        const newOrderId = orderResult.insertId;

        if (orderData.products && orderData.products.length > 0) {
            for (const product of orderData.products) {
                const [productInfo] = await connection.execute('SELECT prix FROM produit WHERE idProduit = ?', [product.idProduit]);
                const prixUnitaire = productInfo.length > 0 ? productInfo[0].prix : 0; 

                await connection.execute(
                    'INSERT INTO commande_produits (idCommande, idProduit, quantite, prix_unitaire, created_at) VALUES (?, ?, ?, ?, NOW())', // Ajout de created_at
                    [newOrderId, product.idProduit, product.quantite, prixUnitaire]
                );
            }
        }

        await connection.commit(); // Valide la transaction
        return { success: true, message: 'Commande ajoutée avec succès.', id: newOrderId };
    } catch (error) {
        if (connection) await connection.rollback(); // Annule la transaction en cas d'erreur
        console.error(`[Database] Erreur lors de l'ajout de la commande: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        if (connection) connection.release(); // Relâche la connexion
    }
}

/**
 * Met à jour une commande existante, y compris ses produits.
 * Cette opération est transactionnelle. Les anciens produits sont supprimés et les nouveaux sont insérés.
 * @param {object} orderData - Les données de la commande à mettre à jour (idCommande, idUser, dateCommande, statut, products[]).
 * @returns {Promise<object>} Un objet indiquant le succès de la mise à jour.
 */
async function updateOrder(orderData) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const result = await connection.execute(
            'UPDATE commande SET idUser = ?, dateCommande = ?, statut = ?, total = ? WHERE idCommande = ?', // Ajout de 'total'
            [orderData.idUser, orderData.dateCommande, orderData.statut, orderData.total || 0, orderData.idCommande] // Utilisation de orderData.total
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return { success: false, message: 'Commande non trouvée.' };
        }

        await connection.execute('DELETE FROM commande_produits WHERE idCommande = ?', [orderData.idCommande]);

        if (orderData.products && orderData.products.length > 0) {
            for (const product of orderData.products) {
                const [productInfo] = await connection.execute('SELECT prix FROM produit WHERE idProduit = ?', [product.idProduit]);
                const prixUnitaire = productInfo.length > 0 ? productInfo[0].prix : 0;

                await connection.execute(
                    'INSERT INTO commande_produits (idCommande, idProduit, quantite, prix_unitaire, created_at) VALUES (?, ?, ?, ?, NOW())', // Ajout de created_at
                    [orderData.idCommande, product.idProduit, product.quantite, prixUnitaire]
                );
            }
        }

        await connection.commit();
        return { success: true, message: 'Commande mise à jour avec succès.' };
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`[Database] Erreur lors de la mise à jour de la commande: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Supprime une commande et tous ses produits associés.
 * Cette opération est transactionnelle pour garantir la suppression complète et propre.
 * @param {number} id - L'ID de la commande à supprimer.
 * @returns {Promise<object>} Un objet indiquant le succès de la suppression.
 */
async function deleteOrder(id) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Supprimer d'abord les produits associés à la commande pour éviter les contraintes de clé étrangère
        await connection.execute('DELETE FROM commande_produits WHERE idCommande = ?', [id]);
        
        // Puis supprimer la commande elle-même
        const result = await connection.execute('DELETE FROM commande WHERE idCommande = ?', [id]);
        
        await connection.commit();
        return { success: result.affectedRows > 0, message: result.affectedRows > 0 ? 'Commande supprimée.' : 'Commande non trouvée.' };
    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`[Database] Erreur lors de la suppression de la commande: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        if (connection) connection.release();
    }
}

/**
 * Récupère une liste statique des statuts de commande disponibles.
 * (Peut être remplacé par une requête DB si les statuts sont dynamiques).
 * @returns {Promise<object>} Un objet contenant un booléen de succès et un tableau de statuts.
 */
async function getAvailableOrderStatuses() {
    try {
        // CORRECTION: Assurez-vous que ces statuts correspondent à votre colonne ENUM dans la DB
        return { success: true, statuses: ['en attente', 'expediee', 'livree', 'annulee'] };
    } catch (error) {
        console.error(`[Database] Erreur lors de la récupération des statuts de commande: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Génère un rapport textuel basé sur le type spécifié.
 * @param {object} criteria - Les critères pour générer le rapport (actuellement, `criteria.type`).
 * @returns {Promise<object>} Un objet contenant un booléen de succès et la donnée du rapport sous forme de chaîne.
 */
async function generateReport(criteria) {
    try {
        let reportData = '';
        switch (criteria.type) {
            case 'stock':
                // CORRECTION: Utiliser les noms de colonnes 'nom' et 'quantite' de la table 'produit'
                const stockSummary = await query('SELECT nom AS nom, quantite AS quantite, prix FROM produit ORDER BY quantite ASC');
                reportData = 'Rapport de Stock:\n';
                stockSummary.forEach(p => {
                    reportData += ` - ${p.nom}: ${p.quantite} unités (Prix: ${p.prix}€)\n`;
                });
                break;
            case 'sales':
                const salesSummary = await query(`
                    SELECT 
                        p.nom AS nom_produit, -- CORRECTION: Utiliser 'nom' de la table 'produit'
                        SUM(cp.quantite) AS total_vendu,
                        SUM(cp.quantite * cp.prix_unitaire) AS revenu_total
                    FROM commande_produits cp
                    JOIN commande c ON cp.idCommande = c.idCommande
                    JOIN produit p ON cp.idProduit = p.idProduit
                    WHERE c.statut = 'livree' -- CORRECTION: Changer 'traite' à 'livree' si c'est le statut final de vente
                    GROUP BY p.nom
                    ORDER BY revenu_total DESC;
                `);
                reportData = 'Rapport de Ventes:\n';
                if (salesSummary.length > 0) {
                    salesSummary.forEach(s => {
                        reportData += ` - ${s.nom_produit}: ${s.total_vendu} unités vendues, ${s.revenu_total}€ de revenu\n`;
                    });
                } else {
                    reportData += 'Aucune donnée de vente traitée disponible.\n';
                }
                break;
            case 'suppliers':
                // CORRECTION: Utiliser le nom de colonne 'nom' de la table 'fournisseur'
                const allSuppliers = await query('SELECT idFournisseur, nom AS nom, contact, adresse FROM fournisseur ORDER BY nom ASC'); 
                reportData = 'Rapport Fournisseurs:\n';
                allSuppliers.forEach(s => {
                    reportData += ` - ${s.nom} (Contact: ${s.contact || 'N/A'}) - Adresse: ${s.adresse || 'N/A'}\n`;
                });
                break;
            case 'orders':
                const allOrders = await query(`
                    SELECT
                        c.idCommande,
                        u.username AS nom_utilisateur,
                        c.dateCommande,
                        c.statut,
                        c.total AS total_commande -- Utilise la colonne total de la table commande
                    FROM commande c
                    JOIN user_ u ON c.idUser = u.idUser
                    ORDER BY c.dateCommande DESC LIMIT 20
                `);
                reportData = 'Rapport Commandes (20 dernières):\n';
                allOrders.forEach(o => {
                    reportData += ` - Commande #${o.idCommande} par ${o.nom_utilisateur} (Date: ${new Date(o.dateCommande).toLocaleDateString()}, Statut: ${o.statut}, Total: ${o.total_commande || 0}€)\n`;
                });
                break;
            default:
                reportData = 'Type de rapport non reconnu.';
                break;
        }
        return { success: true, data: reportData };
    } catch (error) {
        console.error(`[Database] Erreur lors de la génération du rapport: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Exportation de toutes les fonctions pour les rendre accessibles depuis d'autres modules
module.exports = {
    query,
    authenticateUser,
    getDashboardOverviewStats,
    getRecentActivities, 
    getStockChartData,
    updateUser, 
    getProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,
    getAvailableCategories,
    getSuppliers,
    getSupplierById,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    getUsers,
    getUserById,
    addUser,
    deleteUser,
    getOrdersWithProducts,
    getOrderById,
    getOrderProducts,
    addOrder,
    updateOrder,
    deleteOrder,
    getAvailableOrderStatuses,
    generateReport
};

// src/renderer/js/auth/modules/core/dashboard.js

// Function to display the current date
function displayCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = today.toLocaleDateString('fr-FR', options);
    }
}

// Custom modal function instead of alert/confirm
function showCustomModal(message, onConfirm = null) {
    let modal = document.getElementById('customModal');
    let overlay = document.getElementById('modalOverlay');

    // Create modal elements if they don't exist
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customModal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%); /* Centrage horizontal et vertical */
            background-color: var(--primary-medium); /* Use CSS variable */
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            color: var(--text-light); /* Light text */
            text-align: center;
            max-width: 90vw; /* Responsive */
            width: 400px; /* Max width */
        `;
        document.body.appendChild(modal);
    }

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            z-index: 999;
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', () => {
            modal.style.display = 'none';
            overlay.style.display = 'none';
            if (onConfirm) { // If there's a confirm callback, simulate cancellation if overlay clicked
                onConfirm(false);
            }
        });
    }

    modal.innerHTML = `
        <p>${message}</p>
        <div style="display: flex; justify-content: center; gap: 10px;">
            <button id="modalConfirmBtn" style="padding: 8px 15px; border: none; border-radius: 5px; background-color: var(--success-color); color: white; cursor: pointer;">OK</button>
            ${onConfirm ? '<button id="modalCancelBtn" style="padding: 8px 15px; border: none; border-radius: 5px; background-color: var(--danger-color); color: white; cursor: pointer;">Annuler</button>' : ''}
        </div>
    `;

    modal.style.display = 'flex';
    document.getElementById('modalOverlay').style.display = 'block';

    document.getElementById('modalConfirmBtn').onclick = () => {
        modal.style.display = 'none';
        document.getElementById('modalOverlay').style.display = 'none';
        if (onConfirm) {
            onConfirm(true); // Confirmed
        }
    };

    if (onConfirm) {
        document.getElementById('modalCancelBtn').onclick = () => {
            modal.style.display = 'none';
            document.getElementById('modalOverlay').style.display = 'none';
            onConfirm(false); // Cancelled
        };
    }
}


// Assurez-vous d'avoir la fonction logout si vous utilisez le bouton de déconnexion
async function logout() {
    if (window.electronAPI && typeof window.electronAPI.logout === 'function') {
        try {
            const result = await window.electronAPI.logout();
            if (result.success) {
                // Rediriger vers la page de connexion ou une page d'accueil publique
                window.location.href = '../auth/login.html';
            } else {
                showCustomModal(`Erreur de déconnexion: ${result.error || 'Inconnue'}`);
            }
        } catch (error) {
            console.error('Erreur lors de l\'appel IPC de déconnexion:', error);
            showCustomModal('Erreur de communication avec l\'application lors de la déconnexion.');
        }
    } else {
        showCustomModal('Fonctionnalité de déconnexion non disponible.');
    }
}

// Fonction pour charger les statistiques du tableau de bord
async function loadDashboardStats() {
    console.log("[Dashboard Renderer] Appel de loadDashboardStats...");
    if (window.electronAPI && typeof window.electronAPI.getDashboardStats === 'function') {
        try {
            const result = await window.electronAPI.getDashboardStats();
            console.log("[Dashboard Renderer] Résultat de getDashboardStats:", result); // LOG IMPORTANT
            if (result.success && result.data) {
                document.getElementById('totalProducts').textContent = result.data.totalProducts;
                document.getElementById('totalOrders').textContent = result.data.totalOrders;
                document.getElementById('totalSuppliers').textContent = result.data.totalSuppliers;
                document.getElementById('lowStockProducts').textContent = result.data.lowStockProducts;
                document.getElementById('totalRevenue').textContent = `${parseFloat(result.data.totalRevenue || 0).toFixed(2)}€`; // Assurer que c'est un nombre valide
            } else {
                console.error('Failed to load dashboard stats:', result.error);
                showCustomModal(`Erreur de chargement des statistiques du tableau de bord: ${result.error || 'Inconnu'}`);
            }
        } catch (error) {
            console.error('Error calling IPC for getDashboardStats:', error);
            showCustomModal('Erreur de communication avec l\'application pour les statistiques.');
        }
    } else {
        showCustomModal('Fonctionnalité de statistiques du tableau de bord non disponible.');
    }
}

// Fonction pour charger les activités récentes et les 3 dernières commandes
async function loadRecentActivitiesAndLatestOrders() {
    const recentActivitiesList = document.getElementById('recentActivitiesList');
    const latestOrdersGrid = document.getElementById('latestOrdersGrid'); // Cible le nouveau conteneur des cartes de commandes

    if (!recentActivitiesList || !latestOrdersGrid) return;

    // Messages de chargement
    recentActivitiesList.innerHTML = '<li>Chargement des activités...</li>';
    latestOrdersGrid.innerHTML = `
        <div class="order-card section-card"><p>Chargement de la commande...</p></div>
        <div class="order-card section-card"><p>Chargement de la commande...</p></div>
        <div class="order-card section-card"><p>Chargement de la commande...</p></div>
    `;

    console.log("[Dashboard Renderer] Appel de loadRecentActivitiesAndLatestOrders...");

    if (window.electronAPI && typeof window.electronAPI.getRecentActivities === 'function') {
        try {
            const result = await window.electronAPI.getRecentActivities();
            console.log("[Dashboard Renderer] Résultat de getRecentActivities:", result); // LOG IMPORTANT

            if (result.success && result.data) {
                // Traitement des dernières produits ajoutés (Activités Récentes)
                recentActivitiesList.innerHTML = ''; // Nettoie le message de chargement
                if (result.data.latestProducts && result.data.latestProducts.length > 0) {
                    recentActivitiesList.innerHTML += '<li style="font-weight: bold; margin-bottom: 5px; color: var(--accent);">Derniers produits ajoutés:</li>';
                    result.data.latestProducts.forEach(product => {
                        const productDate = new Date(product.created_at);
                        const dateText = isNaN(productDate) ? 'N/A' : productDate.toLocaleDateString('fr-FR');
                        
                        recentActivitiesList.innerHTML += `
                            <li class="product-item">
                                <div class="details">
                                    <span class="name">${product.nom}</span>
                                    <span class="quantity-price">Quantité: <span>${product.quantite}</span>, Prix: <span>${parseFloat(product.prix || 0).toFixed(2)}€</span></span>
                                </div>
                                <span class="date">${dateText}</span>
                            </li>
                        `;
                    });
                } else {
                    recentActivitiesList.innerHTML = '<li>Aucune activité récente (produits) à afficher.</li>';
                }

                // Traitement des 3 dernières commandes pour les cartes individuelles
                latestOrdersGrid.innerHTML = ''; // Nettoie les messages de chargement des cartes
                if (result.data.latestOrders && result.data.latestOrders.length > 0) {
                    // Prenez seulement les 3 premières commandes
                    const ordersToShow = result.data.latestOrders.slice(0, 3); 

                    if (ordersToShow.length > 0) {
                        ordersToShow.forEach(order => {
                            const orderDate = new Date(order.dateCommande);
                            const dateText = isNaN(orderDate) ? 'N/A' : orderDate.toLocaleDateString('fr-FR');
                            const productDetails = order.produits && order.produits.length > 0
                                ? order.produits.map(p => `${p.nom} (x${p.quantite})`).join(', ')
                                : 'Aucun produit';
                            
                            // Calcul du total de la commande
                            const totalCommande = order.produits
                                .reduce((sum, prod) => sum + (parseFloat(prod.prix_unitaire || 0) * parseInt(prod.quantite || 0)), 0)
                                .toFixed(2);

                            latestOrdersGrid.innerHTML += `
                                <div class="order-card section-card">
                                    <div class="order-id">Commande #${order.idCommande}</div>
                                    <div class="order-date">${dateText}</div>
                                    <div class="order-status">Statut: <span class="status-badge status-${order.statut.toLowerCase().replace(/\s/g, '-')}" style="margin-right: 5px;">${order.statut}</span></div>
                                    <div class="order-products-summary">${productDetails}</div>
                                    <div class="order-total">${totalCommande}€</div>
                                </div>
                            `;
                        });
                    } else {
                        latestOrdersGrid.innerHTML = '<div class="order-card section-card" style="grid-column: span 3; text-align: center;"><p>Aucune commande récente à afficher.</p></div>';
                    }
                } else {
                    latestOrdersGrid.innerHTML = '<div class="order-card section-card" style="grid-column: span 3; text-align: center;"><p>Aucune commande récente à afficher.</p></div>';
                }

            } else {
                console.error('Failed to load recent activities/orders:', result.error);
                recentActivitiesList.innerHTML = `<li>Erreur: ${result.error || 'Impossible de charger les activités récentes.'}</li>`;
                latestOrdersGrid.innerHTML = `<div class="order-card section-card" style="grid-column: span 3; text-align: center;"><p>Erreur: ${result.error || 'Impossible de charger les commandes récentes.'}</p></div>`;
                showCustomModal(`Erreur de chargement des activités/commandes récentes: ${result.error || 'Inconnu'}`);
            }
        } catch (error) {
            console.error('Error calling IPC for getRecentActivities:', error);
            recentActivitiesList.innerHTML = '<li>Erreur de communication avec l\'application.</li>';
            latestOrdersGrid.innerHTML = `<div class="order-card section-card" style="grid-column: span 3; text-align: center;"><p>Erreur de communication avec l\'application.</p></div>`;
            showCustomModal('Erreur de communication avec l\'application pour les activités/commandes.');
        }
    } else {
        recentActivitiesList.innerHTML = '<li>API Electron non disponible.</li>';
        latestOrdersGrid.innerHTML = `<div class="order-card section-card" style="grid-column: span 3; text-align: center;"><p>Fonctionnalité d\'activités/commandes récentes non disponible.</p></div>`;
        showCustomModal('Fonctionnalité d\'activités/commandes récentes non disponible.');
    }
}

let stockChart; // Variable globale pour stocker l'instance du graphique

// Fonction pour charger les données du graphique de stock
async function loadStockChartData() {
    const chartCanvas = document.getElementById('stockChartCanvas');
    const chartMessage = document.getElementById('chartMessage');
    if (!chartCanvas || !chartMessage) return;

    chartMessage.style.display = 'block'; // Show loading message
    chartMessage.textContent = 'Chargement du graphique...';
    console.log("[Dashboard Renderer] Appel de loadStockChartData...");

    if (window.electronAPI && typeof window.electronAPI.getStockChartData === 'function') {
        try {
            const result = await window.electronAPI.getStockChartData();
            console.log("[Dashboard Renderer] Résultat de getStockChartData:", result); // LOG IMPORTANT
            if (result.success && result.data) {
                chartMessage.style.display = 'none'; // Hide loading message
                if (result.data.length > 0) {
                    const labels = result.data.map(item => item.categoryName || 'Inconnu');
                    const quantities = result.data.map(item => item.totalQuantity);

                    if (stockChart) {
                        stockChart.destroy(); // Détruire l'ancienne instance du graphique
                    }

                    const ctx = chartCanvas.getContext('2d');
                    stockChart = new Chart(ctx, { // Utiliser le contexte 2D
                        type: 'pie', // Ou 'bar', 'doughnut' etc.
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Quantité en Stock',
                                data: quantities,
                                backgroundColor: [
                                    'rgba(255, 99, 132, 0.8)',
                                    'rgba(54, 162, 235, 0.8)',
                                    'rgba(255, 206, 86, 0.8)',
                                    'rgba(75, 192, 192, 0.8)',
                                    'rgba(153, 102, 255, 0.8)',
                                    'rgba(255, 159, 64, 0.8)',
                                    'rgba(199, 199, 199, 0.8)',
                                    'rgba(83, 102, 255, 0.8)',
                                    'rgba(255, 99, 255, 0.8)'
                                ],
                                borderColor: [
                                    'rgba(255, 99, 132, 1)',
                                    'rgba(54, 162, 235, 1)',
                                    'rgba(255, 206, 86, 1)',
                                    'rgba(75, 192, 192, 1)',
                                    'rgba(153, 102, 255, 1)',
                                    'rgba(255, 159, 64, 1)',
                                    'rgba(199, 199, 199, 1)',
                                    'rgba(83, 102, 255, 1)',
                                    'rgba(255, 99, 255, 1)'
                                ],
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false, // Permet de définir une hauteur fixe
                            plugins: {
                                legend: {
                                    position: 'bottom', // Positionne la légende en bas
                                    labels: {
                                        color: '#FFFFFF' // Couleur du texte de la légende en blanc
                                    }
                                }
                            },
                            animation: { // Animation simple à l'affichage
                                animateRotate: true,
                                animateScale: true
                            }
                        }
                    });
                } else {
                    chartMessage.textContent = 'Aucune donnée de stock disponible pour le graphique.';
                    chartMessage.style.display = 'block';
                }
            } else {
                console.error('Failed to load stock chart data:', result.error);
                chartMessage.textContent = `Erreur: ${result.error || 'Impossible de charger les données du graphique.'}`;
                chartMessage.style.display = 'block';
                showCustomModal(`Erreur de chargement des données du graphique de stock: ${result.error || 'Inconnu'}`);
            }
        } catch (error) {
            console.error('Error calling IPC for getStockChartData:', error);
            chartMessage.textContent = 'Erreur de communication avec l\'application.';
            chartMessage.style.display = 'block';
            showCustomModal('Erreur de communication avec l\'application pour le graphique de stock.');
        }
    } else {
        chartMessage.textContent = 'API Electron non disponible.';
        chartMessage.style.display = 'block';
        showCustomModal('Fonctionnalité de graphique de stock non disponible.');
    }
}


// Exécuter au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    displayCurrentDate();
    loadDashboardStats();
    loadRecentActivitiesAndLatestOrders(); // Appeler cette fonction pour charger les deux listes
    loadStockChartData(); // Charger le graphique
});

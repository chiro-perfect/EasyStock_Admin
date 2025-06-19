// src/renderer/js/orders/list.js

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

// Fonctions de navigation (ajoutées pour cohérence)
function navigateToSettings() {
    window.location.href = '../admin/settings.html';
}

function navigateToDashboard() {
    window.location.href = '../admin/dashboard.html';
}


document.addEventListener('DOMContentLoaded', () => {
    displayCurrentDate();
    loadOrderStatusesForFilter(); // Load statuses for the filter dropdown first

    const orderSearchInput = document.getElementById('orderSearch');
    if (orderSearchInput) {
        orderSearchInput.addEventListener('keyup', (event) => {
            // Trim the search term to avoid issues with extra spaces
            loadOrders(event.target.value.trim(), document.getElementById('orderStatusFilter').value);
        });
    }

    const orderStatusFilter = document.getElementById('orderStatusFilter');
    if (orderStatusFilter) {
        orderStatusFilter.addEventListener('change', () => {
            loadOrders(document.getElementById('orderSearch').value.trim(), orderStatusFilter.value);
        });
    }

    // Add event listener for the reset filter button
    const resetFilterBtn = document.querySelector('.actions-bar .action-btn[onclick*="resetFilters"]');
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', resetFilters);
    }
});

async function loadOrders(searchTerm = '', statusFilter = 'all') {
    const ordersTableBody = document.getElementById('ordersTableBody');
    if (!ordersTableBody) {
        console.error("L'élément 'ordersTableBody' n'a pas été trouvé.");
        return;
    }

    ordersTableBody.innerHTML = '<tr><td colspan="6" class="loading-message">Chargement des commandes...</td></tr>';

    if (window.electronAPI && typeof window.electronAPI.getOrdersWithProducts === 'function') { 
        try {
            const result = await window.electronAPI.getOrdersWithProducts(searchTerm, statusFilter); 

            if (result.success && result.data) { 
                ordersTableBody.innerHTML = ''; // Clear loading message
                if (result.data.length > 0) {
                    result.data.forEach(order => {
                        const row = ordersTableBody.insertRow();
                        row.insertCell(0).textContent = order.idCommande;

                        const productsCell = row.insertCell(1);
                        productsCell.innerHTML = order.produits && order.produits.length > 0
                            ? order.produits.map(p => `${p.nom} (${p.prix_unitaire.toFixed(2)}€)`).join(', ') 
                            : 'Aucun produit';

                        const quantitiesCell = row.insertCell(2);
                        quantitiesCell.innerHTML = order.produits && order.produits.length > 0
                            ? order.produits.map(p => `${p.quantite}`).join(', ')
                            : 'N/A';

                        row.insertCell(3).textContent = new Date(order.dateCommande).toLocaleDateString('fr-FR');
                        
                        const statusCell = row.insertCell(4);
                        const statusBadge = document.createElement('span');
                        statusBadge.textContent = order.statut;
                        // Normalize status by removing spaces and hyphens, then using it as part of the class name
                        const normalizedStatus = order.statut.toLowerCase().replace(/[\s-]/g, '');
                        statusBadge.className = `status-badge status-${normalizedStatus}`;
                        statusCell.appendChild(statusBadge);

                        const actionsCell = row.insertCell(5);
                        actionsCell.className = 'actions';

                        const viewButton = document.createElement('button');
                        viewButton.className = 'action-btn info-btn';
                        viewButton.textContent = 'Voir/Modifier';
                        viewButton.dataset.id = order.idCommande;
                        viewButton.onclick = handleViewDetailsClick;
                        actionsCell.appendChild(viewButton);

                        const deleteButton = document.createElement('button');
                        deleteButton.className = 'action-btn delete-btn';
                        deleteButton.textContent = 'Supprimer';
                        deleteButton.dataset.id = order.idCommande;
                        deleteButton.onclick = handleDeleteClick;
                        actionsCell.appendChild(deleteButton);
                    });
                } else {
                    ordersTableBody.innerHTML = '<tr><td colspan="6" class="no-data-message">Aucune commande trouvée.</td></tr>';
                }
            } else {
                console.error('Failed to load orders:', result.error);
                ordersTableBody.innerHTML = `<tr><td colspan="6" class="error-message">Erreur: ${result.error || 'Impossible de charger les commandes.'}</td></tr>`;
                showCustomModal(`Erreur de chargement des commandes: ${result.error || 'Inconnu'}`); 
            }
        } catch (error) {
            console.error('Erreur d\'appel IPC pour getOrdersWithProducts:', error); 
            ordersTableBody.innerHTML = '<tr><td colspan="6" class="error-message">Erreur de communication avec l\'application.</td></tr>';
            showCustomModal('Erreur de communication avec l\'application lors du chargement des commandes.'); 
        }
    } else {
        ordersTableBody.innerHTML = '<tr><td colspan="6" class="error-message">API Electron non disponible.</td></tr>';
        showCustomModal('Fonctionnalité de chargement des commandes non disponible.'); 
    }
}

// Function to load available order statuses for the filter dropdown
async function loadOrderStatusesForFilter() {
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    if (!orderStatusFilter) return;

    orderStatusFilter.innerHTML = '<option value="all">Chargement des statuts...</option>';

    if (window.electronAPI && typeof window.electronAPI.getAvailableOrderStatuses === 'function') {
        try {
            const result = await window.electronAPI.getAvailableOrderStatuses();
            if (result.success && result.data && result.data.length > 0) {
                orderStatusFilter.innerHTML = '<option value="all">Tous les statuts</option>';
                result.data.forEach(status => { 
                    const option = document.createElement('option');
                    option.value = status; 
                    option.textContent = status.charAt(0).toUpperCase() + status.slice(1); // Mettre la première lettre en majuscule
                    orderStatusFilter.appendChild(option);
                });
                // After loading statuses, load orders with default filter
                loadOrders(document.getElementById('orderSearch').value.trim(), orderStatusFilter.value);
            } else {
                console.warn('No order statuses found or failed to load statuses:', result.error);
                orderStatusFilter.innerHTML = '<option value="all">Tous les statuts</option>'; 
                showCustomModal(`Aucun statut de commande trouvé ou échec du chargement des statuts: ${result.error || 'Inconnu'}`);
                loadOrders(); // Still try to load orders even if statuses failed
            }
        } catch (error) {
            console.error('Erreur d\'appel IPC pour getAvailableOrderStatuses:', error); 
            orderStatusFilter.innerHTML = '<option value="all">Erreur de chargement</option>'; 
            showCustomModal('Erreur de communication avec l\'application pour les statuts de commande.');
            loadOrders(); // Still try to load orders even if statuses failed
        }
    } else {
        console.error('Electron API pour les statuts de commande non disponible.');
        orderStatusFilter.innerHTML = '<option value="all">API non disponible</option>'; 
        showCustomModal('Fonctionnalité de chargement des statuts de commande non disponible.');
        loadOrders(); // Still try to load orders even if API is not available
    }
}


function handleViewDetailsClick(event) {
    const orderId = event.target.dataset.id;
    window.location.href = `../commandes/edit.html?id=${orderId}`;
}

async function handleDeleteClick(event) {
    const orderId = event.target.dataset.id;
    showCustomModal(`Êtes-vous sûr de vouloir supprimer la commande avec l'ID ${orderId} ?`, async (confirmed) => {
        if (confirmed) {
            if (window.electronAPI && typeof window.electronAPI.deleteOrder === 'function') {
                try {
                    const result = await window.electronAPI.deleteOrder(parseInt(orderId));
                    if (result.success) {
                        showCustomModal('Commande supprimée avec succès.');
                        loadOrders(); 
                    } else {
                        showCustomModal(`Erreur lors de la suppression: ${result.error || 'Inconnu'}`);
                    }
                } catch (error) {
                    console.error("Erreur d'appel IPC pour deleteOrder:", error);
                    showCustomModal("Erreur de communication avec l'application.");
                }
            } else {
                showCustomModal("Fonctionnalité de suppression non disponible.");
            }
        }
    });
}

// Function to reset filters and reload all products
// This function needs to be global or attached to window if called from inline HTML (onclick)
function resetFilters() {
    document.getElementById('orderSearch').value = ''; // Clear search input
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    if (orderStatusFilter) {
        orderStatusFilter.value = 'all'; // Set status filter to 'all'
    }
    loadOrders(); // Reload orders with no filters
}

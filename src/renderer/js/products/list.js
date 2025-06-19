// src/renderer/js/products/list.js

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

// Ensure the logout function exists if the logout button is used in the header
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
    loadProducts(); // Loads products on startup

    const productSearchInput = document.getElementById('productSearch');
    if (productSearchInput) {
        productSearchInput.addEventListener('keyup', (event) => {
            loadProducts(event.target.value, document.getElementById('productCategoryFilter').value); // Reloads products with the search term
        });
    }

    const productCategoryFilter = document.getElementById('productCategoryFilter');
    if (productCategoryFilter) {
        // Loads categories on filter startup
        loadCategoriesForFilter();
        productCategoryFilter.addEventListener('change', () => {
            loadProducts(productSearchInput.value, productCategoryFilter.value);
        });
    }
});

// Loads products and displays them in the table
async function loadProducts(searchTerm = '', categoryFilter = 'all') {
    const productsTableBody = document.getElementById('productsTableBody');
    if (!productsTableBody) {
        console.error("L'élément 'productsTableBody' n'a pas été trouvé.");
        return;
    }

    productsTableBody.innerHTML = '<tr><td colspan="7" class="loading-message">Chargement des produits...</td></tr>';

    if (window.electronAPI && typeof window.electronAPI.getProducts === 'function') {
        try {
            const result = await window.electronAPI.getProducts(searchTerm, categoryFilter);

            if (result.success && result.data) {
                productsTableBody.innerHTML = ''; // Clear loading message
                if (result.data.length > 0) {
                    result.data.forEach(product => {
                        const row = productsTableBody.insertRow();
                        row.insertCell(0).textContent = product.idProduit;
                        row.insertCell(1).textContent = product.nom;
                        row.insertCell(2).textContent = product.categoryName || 'N/A'; 
                        row.insertCell(3).textContent = product.quantite;
                        row.insertCell(4).textContent = `${product.prix.toFixed(2)}€`; 
                        
                        // Utilise 'created_at' au lieu de 'updated_at'
                        const createdAtDate = new Date(product.created_at);
                        row.insertCell(5).textContent = isNaN(createdAtDate.getTime()) ? 'N/A' : createdAtDate.toLocaleDateString('fr-FR'); // .getTime() pour vérifier Valid Date

                        const actionsCell = row.insertCell(6);
                        actionsCell.className = 'actions';

                        const editButton = document.createElement('button');
                        editButton.className = 'action-btn edit-btn';
                        editButton.textContent = 'Modifier';
                        editButton.dataset.id = product.idProduit;
                        editButton.onclick = handleEditClick;
                        actionsCell.appendChild(editButton);

                        const deleteButton = document.createElement('button');
                        deleteButton.className = 'action-btn delete-btn';
                        deleteButton.textContent = 'Supprimer';
                        deleteButton.dataset.id = product.idProduit;
                        deleteButton.onclick = handleDeleteClick;
                        actionsCell.appendChild(deleteButton);
                    });
                } else {
                    productsTableBody.innerHTML = '<tr><td colspan="7" class="no-data-message">Aucun produit trouvé.</td></tr>';
                }
            } else {
                console.error('Failed to load products:', result.error);
                productsTableBody.innerHTML = `<tr><td colspan="7" class="error-message">Erreur: ${result.error || 'Impossible de charger les produits.'}</td></tr>`;
                showCustomModal(`Erreur de chargement des produits: ${result.error || 'Inconnu'}`); 
            }
        } catch (error) {
            console.error('Erreur d\'appel IPC pour getProducts:', error); 
            productsTableBody.innerHTML = '<tr><td colspan="7" class="error-message">Erreur de communication avec l\'application.</td></tr>';
            showCustomModal('Erreur de communication avec l\'application lors du chargement des produits.'); 
        }
    } else {
        productsTableBody.innerHTML = '<tr><td colspan="7" class="error-message">API Electron non disponible.</td></tr>';
        showCustomModal('Fonctionnalité de chargement des produits non disponible.'); 
    }
}

// Loads categories for the filter dropdown
async function loadCategoriesForFilter() {
    const productCategoryFilter = document.getElementById('productCategoryFilter');
    if (!productCategoryFilter) return;

    productCategoryFilter.innerHTML = '<option value="all">Chargement des catégories...</option>';

    if (window.electronAPI && typeof window.electronAPI.getAvailableCategories === 'function') {
        try {
            const result = await window.electronAPI.getAvailableCategories();
            if (result.success && result.data && result.data.length > 0) {
                productCategoryFilter.innerHTML = '<option value="all">Toutes les catégories</option>';
                result.data.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.idCategory; 
                    option.textContent = category.name; 
                    productCategoryFilter.appendChild(option);
                });
            } else {
                console.warn('No categories found or failed to load categories:', result.error);
                productCategoryFilter.innerHTML = '<option value="all">Toutes les catégories</option>'; 
                showCustomModal(`Aucune catégorie trouvée ou échec du chargement des catégories: ${result.error || 'Inconnu'}`);
            }
        } catch (error) {
            console.error('Erreur d\'appel IPC pour getAvailableCategories:', error); 
            productCategoryFilter.innerHTML = '<option value="all">Erreur de chargement</option>'; 
            showCustomModal('Erreur de communication avec l\'application pour les catégories.');
        }
    } else {
        console.error('Electron API pour les catégories non disponible.');
        productCategoryFilter.innerHTML = '<option value="all">API non disponible</option>'; 
        showCustomModal('Fonctionnalité de chargement des catégories non disponible.');
    }
}

function handleEditClick(event) {
    const productId = event.target.dataset.id;
    window.location.href = `../produits/edit.html?id=${productId}`;
}

async function handleDeleteClick(event) {
    const productId = event.target.dataset.id;
    showCustomModal(`Êtes-vous sûr de vouloir supprimer le produit avec l'ID ${productId} ?`, async (confirmed) => {
        if (confirmed) {
            if (window.electronAPI && typeof window.electronAPI.deleteProduct === 'function') {
                try {
                    const result = await window.electronAPI.deleteProduct(parseInt(productId));
                    if (result.success) {
                        showCustomModal('Produit supprimé avec succès.');
                        loadProducts(); 
                    } else {
                        showCustomModal(`Erreur lors de la suppression: ${result.error || 'Inconnu'}`);
                    }
                } catch (error) {
                    console.error("Erreur d'appel IPC pour deleteProduct:", error);
                    showCustomModal("Erreur de communication avec l'application.");
                }
            } else {
                showCustomModal("Fonctionnalité de suppression non disponible.");
            }
        }
    });
}

// Function to reset filters and reload all products
function resetFilters() {
    document.getElementById('productSearch').value = '';
    document.getElementById('productCategoryFilter').value = 'all';
    loadProducts(); 
}

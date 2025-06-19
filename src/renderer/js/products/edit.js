// src/renderer/js/products/edit.js

// Fonction pour afficher la date actuelle
function displayCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = today.toLocaleDateString('fr-FR', options);
    }
}

// Custom modal function instead of alert/confirm
function showModal(message, onConfirm = null) {
    let modal = document.getElementById('customModal');
    let overlay = document.getElementById('modalOverlay');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customModal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: var(--primary-medium);
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            z-index: 1000;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            color: var(--text-light);
            text-align: center;
            max-width: 90%;
        `;
        document.body.appendChild(modal);

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
            if (onConfirm) {
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
            onConfirm(true);
        }
    };

    if (onConfirm) {
        document.getElementById('modalCancelBtn').onclick = () => {
            modal.style.display = 'none';
            document.getElementById('modalOverlay').style.display = 'none';
            onConfirm(false);
        };
    }
}


// Fonctions de navigation
function navigateToSettings() {
    window.location.href = '../admin/settings.html';
}

function navigateToDashboard() {
    window.location.href = '../admin/dashboard.html';
}


// Charge les catégories disponibles et les remplit dans le select
async function loadCategories(selectedCategoryId = null) {
    const productCategorySelect = document.getElementById('productCategory');
    if (!productCategorySelect) return;

    productCategorySelect.innerHTML = '<option value="">-- Sélectionnez une catégorie --</option>';

    if (window.electronAPI && typeof window.electronAPI.getAvailableCategories === 'function') {
        try {
            const result = await window.electronAPI.getAvailableCategories();
            if (result.success && result.data && result.data.length > 0) {
                result.data.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.idCategory;
                    option.textContent = category.name;
                    productCategorySelect.appendChild(option);
                });
                if (selectedCategoryId !== null && selectedCategoryId !== undefined) {
                    productCategorySelect.value = selectedCategoryId;
                }
            } else {
                console.error("Erreur lors du chargement des catégories:", result.error || "Aucune catégorie trouvée.");
                // Message utilisateur pour l'erreur de chargement initial
                showModal("Erreur: Impossible de charger les catégories de produits. " + (result.error || "Vérifiez la connexion."));
            }
        } catch (error) {
            console.error("Erreur d'appel IPC pour getAvailableCategories:", error);
            showModal("Erreur de communication avec l'application pour les catégories.");
        }
    } else {
        console.error("L'API Electron pour les catégories n'est pas disponible.");
        showModal("Fonctionnalité des catégories non disponible. L'API Electron est absente.");
    }
}

// Charge les fournisseurs disponibles et les remplit dans le select
async function loadSuppliers(selectedSupplierId = null) {
    const productSupplierSelect = document.getElementById('productSupplier');
    if (!productSupplierSelect) return;

    productSupplierSelect.innerHTML = '<option value="">-- Sélectionnez un fournisseur --</option>';

    if (window.electronAPI && typeof window.electronAPI.getSuppliers === 'function') {
        try {
            const result = await window.electronAPI.getSuppliers();
            if (result.success && result.data && result.data.length > 0) {
                result.data.forEach(supplier => {
                    const option = document.createElement('option');
                    option.value = supplier.idFournisseur;
                    option.textContent = supplier.nom;
                    productSupplierSelect.appendChild(option);
                });
                if (selectedSupplierId !== null && selectedSupplierId !== undefined) {
                    productSupplierSelect.value = selectedSupplierId;
                }
            } else {
                console.error("Erreur lors du chargement des fournisseurs:", result.error || "Aucun fournisseur trouvé.");
                 // Message utilisateur pour l'erreur de chargement initial
                showModal("Erreur: Impossible de charger les fournisseurs. " + (result.error || "Vérifiez la connexion."));
            }
        } catch (error) {
            console.error("Erreur d'appel IPC pour getSuppliers:", error);
            showModal("Erreur de communication avec l'application pour les fournisseurs.");
        }
    } else {
        console.error("L'API Electron pour les fournisseurs n'est pas disponible.");
        showModal("Fonctionnalité des fournisseurs non disponible. L'API Electron est absente.");
    }
}


document.addEventListener('DOMContentLoaded', async () => {
    displayCurrentDate(); 
    const editProductForm = document.getElementById('editProductForm');
    const formMessage = document.getElementById('formMessage');
    const productIdInput = document.getElementById('productId');
    const productNameInput = document.getElementById('productName');
    const productDescriptionInput = document.getElementById('productDescription'); 
    const productQuantityInput = document.getElementById('productQuantity');
    const productPriceInput = document.getElementById('productPrice');
    const productCategorySelect = document.getElementById('productCategory');
    const productSupplierSelect = document.getElementById('productSupplier');
    const productCreatedAtInput = document.getElementById('productCreatedAt'); // Champ pour la date de création

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');

    if (!productId) {
        showModal("ID de produit manquant pour l'édition. Redirection vers la liste des produits.");
        setTimeout(() => {
            window.location.href = './list.html';
        }, 2000);
        return;
    }

    productIdInput.value = productId; 

    // Tentative de chargement du produit par ID
    if (window.electronAPI && typeof window.electronAPI.getProductById === 'function') {
        try {
            const result = await window.electronAPI.getProductById(parseInt(productId));
            if (result.success && result.data && Object.keys(result.data).length > 0) { // Vérifie que l'objet n'est pas vide
                const product = result.data;
                productNameInput.value = product.nom || ''; // Ajout d'une valeur par défaut
                if (productDescriptionInput) {
                    productDescriptionInput.value = product.description || '';
                }
                productQuantityInput.value = product.quantite || 0; // Ajout d'une valeur par défaut
                productPriceInput.value = product.prix || 0; // Ajout d'une valeur par défaut

                // Affichage de la date de création
                if (productCreatedAtInput && product.created_at) {
                    const dateObj = new Date(product.created_at);
                    if (!isNaN(dateObj)) { // Vérifie si la date est valide
                        const yyyy = dateObj.getFullYear();
                        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const dd = String(dateObj.getDate()).padStart(2, '0');
                        productCreatedAtInput.value = `${yyyy}-${mm}-${dd}`;
                    } else {
                        productCreatedAtInput.value = 'Date invalide';
                    }
                } else if (productCreatedAtInput) {
                    productCreatedAtInput.value = 'N/A';
                }

                await loadCategories(product.idCategory);
                await loadSuppliers(product.idFournisseur);

            } else {
                showModal(`Produit non trouvé pour l'ID ${productId}. ${result.error || 'Vérifiez l\'ID.'}`);
                await loadCategories(); 
                await loadSuppliers();
            }
        } catch (error) {
            console.error("Erreur d'appel IPC pour getProductById:", error);
            showModal("Erreur de communication avec l'application lors du chargement du produit: " + (error.message || ""));
            await loadCategories();
            await loadSuppliers();
        }
    } else {
        console.error("L'API Electron pour les produits n'est pas disponible. (getProductById)");
        showModal("Fonctionnalité de modification de produit non disponible. L'API Electron est absente.");
        await loadCategories();
        await loadSuppliers();
    }

    if (editProductForm) {
        editProductForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const newName = productNameInput.value;
            const newDescription = productDescriptionInput ? productDescriptionInput.value : null; 
            const newQuantity = parseInt(productQuantityInput.value);
            const newPrice = parseFloat(productPriceInput.value);
            
            const newCategory = parseInt(productCategorySelect.value);
            const newSupplier = parseInt(productSupplierSelect.value);

            if (!newName || isNaN(newQuantity) || newQuantity < 0 || isNaN(newPrice) || newPrice < 0 || isNaN(newCategory) || isNaN(newSupplier)) {
                formMessage.textContent = "Veuillez remplir tous les champs obligatoires (Nom, Quantité, Prix, Catégorie et Fournisseur).";
                formMessage.style.color = 'red';
                return;
            }

            formMessage.textContent = "Mise à jour en cours...";
            formMessage.style.color = 'orange';

            const updatedProductData = {
                nom: newName,
                description: newDescription, 
                quantite: newQuantity,
                prix: newPrice,
                idCategory: newCategory, 
                idFournisseur: newSupplier 
            };

            console.log("[edit.js] Données du produit à envoyer pour mise à jour:", JSON.stringify(updatedProductData));

            if (window.electronAPI && typeof window.electronAPI.updateProduct === 'function') {
                try {
                    // CORRECTION ICI: Passer productId comme premier argument
                    const result = await window.electronAPI.updateProduct(parseInt(productId), updatedProductData);
                    if (result.success) {
                        formMessage.textContent = result.message || "Produit mis à jour avec succès !";
                        formMessage.style.color = 'green';
                    } else {
                        formMessage.textContent = result.error || "Erreur lors de la mise à jour du produit.";
                        formMessage.style.color = 'red';
                    }
                } catch (error) {
                    console.error("Erreur d'appel IPC pour updateProduct:", error);
                    formMessage.textContent = "Erreur de communication avec l'application. Détails: " + (error.message || error);
                    formMessage.style.color = 'red';
                }
            } else {
                formMessage.textContent = "Fonctionnalité de mise à jour non disponible (API Electron absente).";
                formMessage.style.color = 'red';
                console.error("L'API Electron pour la mise à jour des produits n'est pas disponible.");
            }

            setTimeout(() => {
                formMessage.textContent = '';
            }, 5000);
        });
    }
});

async function logout() {
    showModal('Êtes-vous sûr de vouloir vous déconnecter ?', async (confirmed) => {
        if (confirmed) {
            if (window.electronAPI && typeof window.electronAPI.logout === 'function') {
                await window.electronAPI.logout();
            } else {
                console.error("Impossible d'appeler la fonction de déconnexion.");
                showModal("La fonction de déconnexion n'est pas disponible.");
            }
        }
    });
}

// src/renderer/js/products/new.js

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

document.addEventListener('DOMContentLoaded', () => {
    displayCurrentDate(); 
    const newProductForm = document.getElementById('newProductForm');
    const formMessage = document.getElementById('formMessage');
    const productNameInput = document.getElementById('productName');
    const productQuantityInput = document.getElementById('productQuantity');
    const productPriceInput = document.getElementById('productPrice');
    const productCategorySelect = document.getElementById('productCategory'); 
    const productSupplierSelect = document.getElementById('productSupplier'); 
    const createdAtInput = document.getElementById('createdAt'); // Nouveau: champ date de création

    // Définir la date de création par défaut à aujourd'hui et la désactiver
    if (createdAtInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // Janvier est 0
        const dd = String(today.getDate()).padStart(2, '0');
        createdAtInput.value = `${yyyy}-${mm}-${dd}`;
        createdAtInput.disabled = true; // Rendre le champ non modifiable
    }

    // Charger les catégories et fournisseurs au démarrage du formulaire
    async function loadCategoriesAndSuppliersForForm() {
        if (!productCategorySelect || !productSupplierSelect) {
            console.error("[new.js] Éléments 'productCategory' ou 'productSupplier' non trouvés.");
            return;
        }

        productCategorySelect.innerHTML = '<option value="">-- Sélectionnez une catégorie --</option>';
        productSupplierSelect.innerHTML = '<option value="">-- Sélectionnez un fournisseur --</option>';

        if (window.electronAPI) {
            // Chargement des catégories
            if (typeof window.electronAPI.getAvailableCategories === 'function') {
                try {
                    const result = await window.electronAPI.getAvailableCategories();
                    if (result.success && result.data && result.data.length > 0) {
                        result.data.forEach(category => {
                            const option = document.createElement('option');
                            option.value = category.idCategory;
                            option.textContent = category.name;
                            productCategorySelect.appendChild(option);
                        });
                    } else {
                        console.error("[new.js] Erreur lors du chargement des catégories:", result.error || "Aucune catégorie trouvée.");
                    }
                } catch (error) {
                    console.error("[new.js] Erreur d'appel IPC pour getAvailableCategories:", error);
                }
            } else {
                console.error("[new.js] L'API Electron pour les catégories n'est pas disponible.");
            }

            // Chargement des fournisseurs
            if (typeof window.electronAPI.getSuppliers === 'function') {
                try {
                    const result = await window.electronAPI.getSuppliers();
                    if (result.success && result.data && result.data.length > 0) {
                        result.data.forEach(supplier => {
                            const option = document.createElement('option');
                            option.value = supplier.idFournisseur;
                            option.textContent = supplier.nom;
                            productSupplierSelect.appendChild(option);
                        });
                    } else {
                        console.error("[new.js] Erreur lors du chargement des fournisseurs:", result.error || "Aucun fournisseur trouvé.");
                    }
                } catch (error) {
                    console.error("[new.js] Erreur d'appel IPC pour getSuppliers:", error);
                }
            } else {
                console.error("[new.js] L'API Electron pour les fournisseurs n'est pas disponible.");
            }
        }
    }

    loadCategoriesAndSuppliersForForm();

    if (newProductForm) {
        newProductForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const productName = productNameInput.value;
            const productQuantity = parseInt(productQuantityInput.value);
            const productPrice = parseFloat(productPriceInput.value);
            
            let productCategory = parseInt(productCategorySelect.value); 
            let productSupplier = parseInt(productSupplierSelect.value);
            const createdAt = createdAtInput.value; // Récupérer la date de création

            // Convertir NaN en null pour les IDs de catégorie et de fournisseur si non sélectionnés
            productCategory = isNaN(productCategory) ? null : productCategory;
            productSupplier = isNaN(productSupplier) ? null : productSupplier;

            // Validation JavaScript additionnelle pour s'assurer que les champs obligatoires sont remplis
            if (!productName || isNaN(productQuantity) || productQuantity < 0 || isNaN(productPrice) || productPrice < 0 || productCategory === null || productSupplier === null || !createdAt) {
                formMessage.textContent = "Veuillez remplir tous les champs correctement (Nom, Quantité, Prix, Catégorie, Fournisseur et Date de Création sont obligatoires).";
                formMessage.style.color = 'red';
                return;
            }

            formMessage.textContent = "Ajout en cours...";
            formMessage.style.color = 'orange';

            const productData = {
                nom: productName,
                description: null, // Ajoutez explicitement la description comme NULL si elle n'est pas un champ de formulaire
                quantite: productQuantity,
                prix: productPrice,
                idCategory: productCategory, 
                idFournisseur: productSupplier,
                created_at: createdAt // Ajouter la date de création aux données
            };

            // LOG IMPORTANT: Affiche les données que le renderer va envoyer au main process
            console.log("[new.js] Données du produit à envoyer:", JSON.stringify(productData));

            if (window.electronAPI && typeof window.electronAPI.addProduct === 'function') {
                try {
                    const result = await window.electronAPI.addProduct(productData);
                    if (result.success) {
                        formMessage.textContent = result.message || "Produit ajouté avec succès !";
                        formMessage.style.color = 'green';
                        newProductForm.reset(); 
                        loadCategoriesAndSuppliersForForm(); // Recharger pour rafraîchir les listes déroulantes
                        // Réinitialiser et redésactiver la date après le reset du formulaire
                        if (createdAtInput) {
                            const today = new Date();
                            const yyyy = today.getFullYear();
                            const mm = String(today.getMonth() + 1).padStart(2, '0');
                            const dd = String(today.getDate()).padStart(2, '0');
                            createdAtInput.value = `${yyyy}-${mm}-${dd}`;
                            createdAtInput.disabled = true;
                        }
                    } else {
                        formMessage.textContent = result.error || "Erreur lors de l'ajout du produit.";
                        formMessage.style.color = 'red';
                    }
                } catch (error) {
                    console.error("[new.js] Erreur d'appel IPC pour addProduct:", error);
                    formMessage.textContent = "Erreur de communication avec l'application. Détails: " + (error.message || error); 
                    formMessage.style.color = 'red';
                }
            } else {
                console.error("[new.js] L'API Electron pour ajouter un produit n'est pas disponible.");
                formMessage.textContent = "Fonctionnalité d'ajout de produit non disponible.";
                formMessage.style.color = 'red';
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

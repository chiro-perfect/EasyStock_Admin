// src/renderer/js/orders/edit.js

// Variable globale pour stocker les produits de la commande en cours d'édition
let currentOrderProducts = []; 
let allAvailableProducts = []; // Pour stocker tous les produits disponibles du stock

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

// Fonction pour peupler le menu déroulant des statuts de commande
async function populateOrderStatusDropdown(selectedStatus = '') {
    const orderStatusSelect = document.getElementById('orderStatus');
    if (!orderStatusSelect) {
        console.error("Élément 'orderStatus' non trouvé.");
        return;
    }

    orderStatusSelect.innerHTML = '<option value="">Chargement des statuts...</option>';

    if (window.electronAPI && typeof window.electronAPI.getAvailableOrderStatuses === 'function') {
        try {
            const result = await window.electronAPI.getAvailableOrderStatuses();
            if (result.success && result.data && result.data.length > 0) {
                orderStatusSelect.innerHTML = ''; // Vider avant de populer
                result.data.forEach(status => {
                    const option = document.createElement('option');
                    option.value = status;
                    option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
                    if (status === selectedStatus) {
                        option.selected = true;
                    }
                    orderStatusSelect.appendChild(option);
                });
            } else {
                orderStatusSelect.innerHTML = '<option value="">Aucun statut disponible</option>';
                console.warn("Aucun statut disponible ou erreur lors du chargement des statuts:", result.error);
            }
        } catch (error) {
            console.error("Erreur d'appel IPC pour getAvailableOrderStatuses:", error);
            orderStatusSelect.innerHTML = '<option value="">Erreur de chargement des statuts</option>';
        }
    } else {
        orderStatusSelect.innerHTML = '<option value="">API Electron non disponible pour les statuts</option>';
    }
}

// Fonction pour peupler le menu déroulant des produits disponibles (pour l'ajout au panier)
async function populateProductDropdown(dropdownId = 'productIdToAdd') {
    const productIdSelect = document.getElementById(dropdownId);
    if (!productIdSelect) {
        console.error(`Élément '${dropdownId}' non trouvé pour le dropdown des produits.`);
        return;
    }

    productIdSelect.innerHTML = '<option value="">Chargement des produits...</option>';

    if (window.electronAPI && typeof window.electronAPI.getProducts === 'function') {
        try {
            const result = await window.electronAPI.getProducts();
            if (result.success && result.data && result.data.length > 0) {
                // IMPORTANT: Parse les prix en float dès le chargement
                allAvailableProducts = result.data.map(p => ({
                    ...p,
                    prix: parseFloat(p.prix) // Convertir le prix en nombre
                }));
                productIdSelect.innerHTML = '<option value="">Sélectionnez un produit</option>';
                allAvailableProducts.forEach(product => {
                    const option = document.createElement('option');
                    option.value = product.idProduit;
                    option.textContent = `${product.nom} (Stock: ${product.quantite}, Prix: ${product.prix.toFixed(2)}€)`;
                    productIdSelect.appendChild(option);
                });
            } else {
                productIdSelect.innerHTML = '<option value="">Aucun produit disponible</option>';
                console.warn("Aucun produit disponible ou erreur lors du chargement des produits:", result.error);
            }
        } catch (error) {
            console.error("Erreur d'appel IPC pour getProducts:", error);
            productIdSelect.innerHTML = '<option value="">Erreur de chargement des produits</option>';
        }
    } else {
        productIdSelect.innerHTML = '<option value="">API Electron non disponible pour les produits</option>';
    }
}

// Fonction pour rendre les produits de la commande dans la table du panier
function renderOrderProducts() {
    const orderProductsTableBody = document.getElementById('orderProductsTableBody');
    const cartTotalElement = document.getElementById('cartTotal');
    
    if (!orderProductsTableBody || !cartTotalElement) {
        console.error("Éléments du panier (orderProductsTableBody ou cartTotal) non trouvés dans le DOM.");
        return;
    }

    orderProductsTableBody.innerHTML = ''; // Vider le tableau

    let grandTotal = 0;

    if (currentOrderProducts.length === 0) {
        orderProductsTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--primary-light);">Aucun produit dans cette commande.</td></tr>';
    } else {
        currentOrderProducts.forEach((item, index) => {
            // Trouver les détails complets du produit via allAvailableProducts (si disponible)
            const productDetails = allAvailableProducts.find(p => p.idProduit === item.idProduit);
            // Si productDetails n'est pas trouvé, cela signifie que le produit était déjà dans la commande
            // et n'est peut-être plus dans le stock général (ex: supprimé)
            const productName = productDetails ? productDetails.nom : item.nom || `Produit ID: ${item.idProduit}`;
            const productPrice = parseFloat(productDetails ? productDetails.prix : item.prix_unitaire || 0);

            const subtotal = item.quantite * productPrice;
            grandTotal += subtotal;

            const row = orderProductsTableBody.insertRow();
            row.innerHTML = `
                <td>${productName}</td>
                <td>${productPrice.toFixed(2)} €</td>
                <td>
                    <div class="quantity-controls">
                        <button type="button" class="decrement-quantity" data-index="${index}">-</button>
                        <span class="quantity-display">${item.quantite}</span>
                        <button type="button" class="increment-quantity" data-index="${index}">+</button>
                    </div>
                </td>
                <td>${subtotal.toFixed(2)} €</td>
                <td>
                    <button type="button" class="remove-item-btn" data-index="${index}">Supprimer</button>
                </td>
            `;
        });
    }

    cartTotalElement.textContent = `Total de la commande : ${grandTotal.toFixed(2)} €`;

    // Attacher les listeners après le rendu
    attachCartEventListeners();
}

// Attacher les écouteurs d'événements pour le panier (incrément, décrément, suppression)
function attachCartEventListeners() {
    document.querySelectorAll('.increment-quantity').forEach(button => {
        button.removeEventListener('click', handleIncrementQuantity); // Supprime l'ancien écouteur pour éviter les doublons
        button.addEventListener('click', handleIncrementQuantity);
    });

    document.querySelectorAll('.decrement-quantity').forEach(button => {
        button.removeEventListener('click', handleDecrementQuantity); // Supprime l'ancien écouteur pour éviter les doublons
        button.addEventListener('click', handleDecrementQuantity);
    });

    document.querySelectorAll('.remove-item-btn').forEach(button => {
        button.removeEventListener('click', handleRemoveItem); // Supprime l'ancien écouteur pour éviter les doublons
        button.addEventListener('click', handleRemoveItem);
    });
}

function handleIncrementQuantity(event) {
    const index = parseInt(event.target.dataset.index);
    if (currentOrderProducts[index]) {
        const productInStock = allAvailableProducts.find(p => p.idProduit === currentOrderProducts[index].idProduit);
        if (productInStock && currentOrderProducts[index].quantite < productInStock.quantite) { // Vérifier stock réel
            currentOrderProducts[index].quantite++;
            renderOrderProducts();
        } else if (!productInStock) {
            showModal('Ce produit n\'est plus disponible en stock.');
        }
        else {
            showModal('Quantité maximale en stock atteinte !');
        }
    }
}

function handleDecrementQuantity(event) {
    const index = parseInt(event.target.dataset.index);
    if (currentOrderProducts[index] && currentOrderProducts[index].quantite > 1) {
        currentOrderProducts[index].quantite--;
        renderOrderProducts();
    } else if (currentOrderProducts[index] && currentOrderProducts[index].quantite === 1) {
        showModal('Voulez-vous supprimer ce produit de la commande ?', (confirmed) => {
            if (confirmed) {
                currentOrderProducts.splice(index, 1); // Supprimer l'élément
                renderOrderProducts();
            }
        });
    }
}

function handleRemoveItem(event) {
    const index = parseInt(event.target.dataset.index);
    showModal('Êtes-vous sûr de vouloir supprimer ce produit de la commande ?', (confirmed) => {
        if (confirmed) {
            currentOrderProducts.splice(index, 1);
            renderOrderProducts();
        }
    });
}


document.addEventListener('DOMContentLoaded', async () => {
    displayCurrentDate(); 

    const orderId = new URLSearchParams(window.location.search).get('id');
    if (!orderId) {
        showModal("ID de commande manquant. Redirection vers la liste des commandes.");
        setTimeout(() => {
            window.location.href = './list.html';
        }, 2000);
        return;
    }

    // Charger tous les produits disponibles en premier
    await populateProductDropdown('productIdToAdd'); 
    
    // Charger la commande à éditer
    if (window.electronAPI && typeof window.electronAPI.getOrderById === 'function' && typeof window.electronAPI.getOrderProducts === 'function') {
        try {
            const orderResult = await window.electronAPI.getOrderById(parseInt(orderId));
            const productsResult = await window.electronAPI.getOrderProducts(parseInt(orderId));

            if (orderResult.success && orderResult.data) {
                const order = orderResult.data;
                document.getElementById('orderId').value = order.idCommande;
                document.getElementById('orderUser').value = order.clientUsername || 'N/A';
                
                // Formater la date en 'YYYY-MM-DD' pour le champ input type="date"
                const orderDateInput = document.getElementById('orderDate');
                if (orderDateInput) {
                    const dateObj = new Date(order.dateCommande);
                    const yyyy = dateObj.getFullYear();
                    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const dd = String(dateObj.getDate()).padStart(2, '0');
                    orderDateInput.value = `${yyyy}-${mm}-${dd}`;
                }
                
                await populateOrderStatusDropdown(order.statut); // Pré-sélectionner le statut actuel
            } else {
                showModal(`Commande non trouvée pour l'ID ${orderId}. ${orderResult.error || ''}`);
                setTimeout(() => { window.location.href = './list.html'; }, 2000);
                return;
            }

            if (productsResult.success && productsResult.data) {
                currentOrderProducts = productsResult.data.map(p => ({
                    idProduit: p.idProduit,
                    nom: p.nom,
                    quantite: p.quantite,
                    prix_unitaire: parseFloat(p.prix_unitaire), // Assurer que c'est un nombre
                    stock_disponible: p.stock_disponible || 0 // Ajouter le stock disponible
                }));
                renderOrderProducts();
            } else {
                console.warn(`Aucun produit trouvé pour la commande ${orderId} ou erreur: ${productsResult.error || 'Inconnu'}`);
                currentOrderProducts = [];
                renderOrderProducts();
            }

        } catch (error) {
            console.error("Erreur lors du chargement de la commande ou de ses produits:", error);
            showModal("Erreur lors du chargement des détails de la commande.");
            setTimeout(() => { window.location.href = './list.html'; }, 2000);
        }
    } else {
        console.error("API Electron pour les commandes non disponible.");
        showModal("Fonctionnalité d'édition de commande non disponible.");
    }


    const editOrderForm = document.getElementById('editOrderForm');
    const formMessage = document.getElementById('formMessage');
    const addProductBtn = document.getElementById('addProductBtn');
    const productIdToAddSelect = document.getElementById('productIdToAdd');
    const productQuantityToAddInput = document.getElementById('productQuantityToAdd');
    const orderDateInput = document.getElementById('orderDate'); // Récupérer la référence à l'input date
    const orderStatusSelect = document.getElementById('orderStatus');

    // Gérer l'ajout de NOUVEAUX produits à la commande (via le sélecteur en bas)
    if (addProductBtn) {
        addProductBtn.addEventListener('click', () => {
            const selectedProductId = parseInt(productIdToAddSelect.value);
            const quantityToAdd = parseInt(productQuantityToAddInput.value);

            if (isNaN(selectedProductId) || !selectedProductId) {
                formMessage.textContent = "Veuillez sélectionner un produit à ajouter.";
                formMessage.classList.remove('success'); 
                formMessage.classList.add('error');
                formMessage.style.display = 'block';
                setTimeout(() => { formMessage.style.display = 'none'; }, 3000);
                return;
            }
            if (isNaN(quantityToAdd) || quantityToAdd <= 0) {
                formMessage.textContent = "Veuillez entrer une quantité valide (supérieure à 0) pour l'ajout.";
                formMessage.classList.remove('success'); 
                formMessage.classList.add('error');
                formMessage.style.display = 'block';
                setTimeout(() => { formMessage.style.display = 'none'; }, 3000);
                return;
            }

            const productDetails = allAvailableProducts.find(p => p.idProduit === selectedProductId);
            if (!productDetails) {
                formMessage.textContent = "Produit non trouvé dans le stock disponible.";
                formMessage.classList.remove('success'); 
                formMessage.classList.add('error');
                formMessage.style.display = 'block';
                setTimeout(() => { formMessage.style.display = 'none'; }, 3000);
                return;
            }

            // Vérifier le stock disponible
            const currentStock = productDetails.quantite;
            const existingItemInOrder = currentOrderProducts.find(item => item.idProduit === selectedProductId);
            const quantityAlreadyInOrder = existingItemInOrder ? existingItemInOrder.quantite : 0;

            if (quantityToAdd + quantityAlreadyInOrder > currentStock) {
                showModal(`Quantité demandée (${quantityToAdd + quantityAlreadyInOrder}) dépasse le stock disponible (${currentStock}) pour ${productDetails.nom}.`);
                formMessage.classList.remove('success'); 
                formMessage.classList.add('error');
                formMessage.style.display = 'block';
                setTimeout(() => { formMessage.style.display = 'none'; }, 5000);
                return;
            }


            if (existingItemInOrder) {
                existingItemInOrder.quantite += quantityToAdd;
            } else {
                currentOrderProducts.push({
                    idProduit: selectedProductId,
                    nom: productDetails.nom, 
                    quantite: quantityToAdd,
                    prix_unitaire: parseFloat(productDetails.prix) 
                });
            }
            renderOrderProducts();
            productIdToAddSelect.value = ""; // Réinitialiser la sélection de produit
            productQuantityToAddInput.value = "1"; // Réinitialiser la quantité à 1
            formMessage.textContent = "Produit ajouté à la commande !";
            formMessage.classList.remove('error'); 
            formMessage.classList.add('success');
            formMessage.style.display = 'block';
            setTimeout(() => { formMessage.style.display = 'none'; }, 2000);
        });
    }

    // Soumission du formulaire de mise à jour
    if (editOrderForm) {
        editOrderForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const orderIdVal = parseInt(document.getElementById('orderId').value);
            const orderDateVal = orderDateInput.value; // Lecture de la nouvelle valeur de la date
            const orderStatusVal = orderStatusSelect.value;

            if (isNaN(orderIdVal)) {
                formMessage.textContent = "ID de commande invalide.";
                formMessage.classList.remove('success');
                formMessage.classList.add('error');
                formMessage.style.display = 'block';
                setTimeout(() => { formMessage.style.display = 'none'; }, 3000);
                return;
            }
            if (!orderDateVal || !orderStatusVal) {
                formMessage.textContent = "Veuillez remplir la date et le statut de la commande.";
                formMessage.classList.remove('success');
                formMessage.classList.add('error');
                formMessage.style.display = 'block';
                setTimeout(() => { formMessage.style.display = 'none'; }, 3000);
                return;
            }
            if (currentOrderProducts.length === 0) {
                formMessage.textContent = "Veuillez ajouter au moins un produit à la commande.";
                formMessage.classList.remove('success');
                formMessage.classList.add('error');
                formMessage.style.display = 'block';
                setTimeout(() => { formMessage.style.display = 'none'; }, 3000);
                return;
            }

            formMessage.textContent = "Mise à jour de la commande en cours...";
            formMessage.classList.remove('success', 'error');
            formMessage.style.color = 'orange';
            formMessage.style.display = 'block';

            const orderData = {
                idCommande: orderIdVal,
                dateCommande: orderDateVal,
                statut: orderStatusVal,
                products: currentOrderProducts.map(item => ({
                    idProduit: item.idProduit,
                    quantite: item.quantite
                }))
            };

            console.log("[edit.js] Données de la commande à mettre à jour:", JSON.stringify(orderData, null, 2));

            if (window.electronAPI && typeof window.electronAPI.updateOrder === 'function') {
                try {
                    const result = await window.electronAPI.updateOrder(orderData);
                    if (result.success) {
                        formMessage.textContent = result.message || "Commande mise à jour avec succès !";
                        formMessage.classList.remove('error');
                        formMessage.classList.add('success');
                    } else {
                        formMessage.textContent = result.error || "Erreur lors de la mise à jour de la commande.";
                        formMessage.classList.remove('success');
                        formMessage.classList.add('error');
                    }
                } catch (error) {
                    console.error("Erreur d'appel IPC pour updateOrder:", error);
                    formMessage.textContent = "Erreur de communication avec l'application lors de la mise à jour.";
                    formMessage.classList.remove('success');
                    formMessage.classList.add('error');
                }
            } else {
                console.error("L'API Electron pour la mise à jour des commandes n'est pas disponible.");
                formMessage.textContent = "Fonctionnalité de mise à jour de commande non disponible.";
                formMessage.classList.remove('success');
                formMessage.classList.add('error');
            }

            setTimeout(() => {
                formMessage.style.display = 'none';
            }, 5000);
        });
    }
});

// Assurez-vous d'avoir la fonction logout si vous utilisez le bouton de déconnexion
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

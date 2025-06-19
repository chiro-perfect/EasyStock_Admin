const db = require('../database/db')

module.exports = {
  async getAllProducts() {
    const [products] = await db.query(`
      SELECT p.*, f.nom AS supplier_name 
      FROM produit p
      LEFT JOIN fournisseur f ON p.id_fournisseur = f.id
    `)
    return products
  },

  async createProduct(productData) {
    const result = await db.query(`
      INSERT INTO produit 
      (designation, quantite, prix, id_fournisseur)
      VALUES (?, ?, ?, ?)
    `, [productData.designation, productData.quantite, productData.prix, productData.id_fournisseur])
    
    return result.insertId
  }
}
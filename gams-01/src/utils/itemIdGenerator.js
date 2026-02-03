const { pool } = require('../config/database');

/**
 * Generate next available item ID in format GA-XXXX
 * @returns {Promise<string>} Next available item ID
 */
async function generateNextItemId() {
    try {
        const [maxIdResult] = await pool.execute(`
            SELECT item_id 
            FROM items 
            WHERE item_id REGEXP '^GA-[0-9]+$' 
            ORDER BY CAST(SUBSTRING(item_id, 4) AS UNSIGNED) DESC 
            LIMIT 1
        `);
        
        let nextNum = 1;
        if (maxIdResult.length > 0) {
            const maxId = maxIdResult[0].item_id;
            nextNum = parseInt(maxId.substring(3)) + 1;
        }
        
        return `GA-${nextNum.toString().padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating item ID:', error);
        return `GA-${Date.now().toString().slice(-4)}`;
    }
}

/**
 * Validate item ID format
 * @param {string} itemId - Item ID to validate
 * @returns {boolean} True if valid format
 */
function validateItemIdFormat(itemId) {
    if (!itemId || typeof itemId !== 'string') {
        return false;
    }
    const gaFormat = /^GA-\d{4}$/.test(itemId);
    const customFormat = itemId.length >= 3 && itemId.length <= 50;
    
    return gaFormat || customFormat;
}

/**
 * Check if item ID already exists
 * @param {string} itemId - Item ID to check
 * @returns {Promise<boolean>} True if exists
 */
async function itemIdExists(itemId) {
    try {
        const [result] = await pool.execute(
            'SELECT COUNT(*) as count FROM items WHERE item_id = ?',
            [itemId]
        );
        return result[0].count > 0;
    } catch (error) {
        console.error('Error checking item ID existence:', error);
        return false;
    }
}

module.exports = {
    generateNextItemId,
    validateItemIdFormat,
    itemIdExists
};
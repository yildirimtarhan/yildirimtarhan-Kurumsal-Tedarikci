
const mongoose = require('mongoose');
const path = require('path');
const Product = require('../models/Product');
const Package = require('../models/Package');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkData() {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI not found in .env');
        
        await mongoose.connect(uri);
        console.log('Connected to MongoDB');

        const products = await Product.find({});
        console.log(`\nTotal Products: ${products.length}`);
        products.forEach(p => console.log(` - ${p.name} (Category: "${p.category}", Active: ${p.isActive})`));
        
        const productCategories = [...new Set(products.map(p => p.category))];
        console.log('\nProduct Categories found:', productCategories);

        const eFaturaProducts = products.filter(p => p.category && (p.category.toLowerCase().includes('fatura') || p.category.toLowerCase().includes('kontor') || p.category.toLowerCase().includes('köntör')));
        console.log(`\nProducts with "fatura/kontör" in category: ${eFaturaProducts.length}`);
        eFaturaProducts.forEach(p => console.log(` - ${p.name} (Category: ${p.category})`));

        const packages = await Package.find({});
        console.log(`\nTotal Packages: ${packages.length}`);
        packages.forEach(p => console.log(` - ${p.name}`));

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkData();

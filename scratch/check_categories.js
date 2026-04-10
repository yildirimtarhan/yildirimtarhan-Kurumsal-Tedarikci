
const mongoose = require('mongoose');
const Product = require('./backend/models/Product');
const Package = require('./backend/models/Package');
require('dotenv').config();

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kurumsal-tedarikci');
        console.log('Connected to MongoDB');

        const products = await Product.find({});
        console.log(`Total Products: ${products.length}`);
        const productCategories = [...new Set(products.map(p => p.category))];
        console.log('Product Categories found:', productCategories);

        const eImzaProducts = products.filter(p => p.category && p.category.toLowerCase().includes('imza'));
        console.log(`Products with "imza" in category: ${eImzaProducts.length}`);
        eImzaProducts.forEach(p => console.log(` - ${p.name} (Category: ${p.category})`));

        const eFaturaProducts = products.filter(p => p.category && (p.category.toLowerCase().includes('fatura') || p.category.toLowerCase().includes('kontor') || p.category.toLowerCase().includes('köntör')));
        console.log(`Products with "fatura/kontör" in category: ${eFaturaProducts.length}`);
        eFaturaProducts.forEach(p => console.log(` - ${p.name} (Category: ${p.category})`));

        const packages = await Package.find({});
        console.log(`Total Packages: ${packages.length}`);
        packages.forEach(p => console.log(` - ${p.name}`));

        await mongoose.disconnect();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkData();

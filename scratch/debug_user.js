
const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const User = require('./backend/models/User');

async function debugUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const user = await User.findOne({ ad: /Metin/i });
        if (!user) {
            console.log("User Metin not found");
            return;
        }

        console.log("User found:", user.ad);
        console.log("Email:", user.email);
        console.log("Telefon:", user.telefon);
        console.log("Firma:", user.firma);
        console.log("Fatura Adresi:", JSON.stringify(user.faturaAdresi, null, 2));
        console.log("Teslimat Adresi:", JSON.stringify(user.teslimatAdresi, null, 2));
        console.log("Addresses Count:", user.addresses.length);
        if (user.addresses.length > 0) {
            console.log("First Address:", JSON.stringify(user.addresses[0], null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugUser();

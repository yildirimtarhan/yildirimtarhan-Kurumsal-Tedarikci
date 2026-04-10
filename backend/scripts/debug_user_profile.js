
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

async function debugUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const user = await User.findOne({ ad: 'METİN TÜRK' });
        if (!user) {
            console.log("User Metin not found");
            const allUsers = await User.find().limit(5);
            console.log("Sample users:", allUsers.map(u => u.ad));
            return;
        }

        console.log("User found:", user.ad);
        console.log("Email:", user.email);
        console.log("Telefon:", user.telefon || "EMPTY");
        console.log("Firma:", user.firma || "EMPTY");
        console.log("Fatura Adresi:", JSON.stringify(user.faturaAdresi, null, 2));
        console.log("Teslimat Adresi:", JSON.stringify(user.teslimatAdresi, null, 2));
        console.log("Addresses Array:", JSON.stringify(user.addresses, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugUser();

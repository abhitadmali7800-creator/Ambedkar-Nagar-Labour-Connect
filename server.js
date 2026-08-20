const express = require("express");
const path = require("path");
const Razorpay = require("razorpay");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/create-order", async (req, res) => {
    try {
        const amount = Number(req.body.amount);

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }

        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: "INR",
            receipt: "labar_" + Date.now()
        });

        res.json({
    success: true,
    order,
    key_id: process.env.RAZORPAY_KEY_ID
});

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Unable to create payment order"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
const express = require("express");
const path = require("path");
const Razorpay = require("razorpay");
const nodemailer = require("nodemailer");
require("dotenv").config();

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = express();
const PORT = 3000;

// ==========================================
// BASIC SETUP
// ==========================================

app.use(express.json());


// ==========================================
// HOME PAGE
// ==========================================
// MAIN URL पर Customer Panel खुलेगा

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// ==========================================
// STATIC FILES
// ==========================================
// CSS, JS, images और बाकी HTML files के लिए

app.use(express.static(__dirname));


// ==========================================
// RAZORPAY
// ==========================================

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


// ==========================================
// EMAIL TRANSPORTER
// ==========================================

const transporter = nodemailer.createTransport({
    service: "gmail",

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


// ==========================================
// FIREBASE ADMIN
// ==========================================

const serviceAccount = require("./firebase-service-account.json");

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();


// ==========================================
// CREATE RAZORPAY ORDER
// ==========================================

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

        console.error("RAZORPAY ORDER ERROR:", error);

        res.status(500).json({

            success: false,

            message: "Unable to create payment order"

        });

    }

});


// ==========================================
// SEND CUSTOMER OTP
// ==========================================

app.post("/api/send-work-otp", async (req, res) => {

    try {

        const customerEmail = req.body.customerEmail;

        if (!customerEmail) {

            return res.status(400).json({
                success: false,
                message: "Customer email is required"
            });

        }

        // 6 digit OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // OTP 10 minutes तक valid रहेगा
        const expiresAt = Date.now() + (10 * 60 * 1000);

        // Server memory में store
        global.workOTPs = global.workOTPs || {};

        global.workOTPs[customerEmail] = {
            otp: otp,
            expiresAt: expiresAt
        };

        await transporter.sendMail({

            from: process.env.EMAIL_USER,

            to: customerEmail,

            subject: "Your Work Start OTP",

            html: `
                <h2>Worker Verification OTP</h2>

                <p>Your OTP to start the work is:</p>

                <h1 style="
                    letter-spacing:5px;
                    font-size:32px;
                ">
                    ${otp}
                </h1>

                <p>
                    This OTP will expire in 10 minutes.
                </p>

                <p>
                    Do not share this OTP with anyone except
                    the worker present for your booked service.
                </p>
            `

        });

        res.json({

            success: true,

            message: "OTP sent successfully"

        });

    } catch (error) {

        console.error("OTP SEND ERROR:", error);

        res.status(500).json({

            success: false,

            message: "OTP sending failed"

        });

    }

});


// ==========================================
// VERIFY CUSTOMER OTP
// ==========================================

app.post("/api/verify-work-otp", (req, res) => {

    try {

        const customerEmail = req.body.customerEmail;

        const enteredOTP = String(
            req.body.otp || ""
        ).trim();

        if (!customerEmail || !enteredOTP) {

            return res.status(400).json({

                success: false,

                message: "Email and OTP are required"

            });

        }

        global.workOTPs = global.workOTPs || {};

        const savedData =
            global.workOTPs[customerEmail];

        if (!savedData) {

            return res.status(400).json({

                success: false,

                message: "OTP not found. Please send OTP first."

            });

        }

        // OTP expire check
        if (Date.now() > savedData.expiresAt) {

            delete global.workOTPs[customerEmail];

            return res.status(400).json({

                success: false,

                message: "OTP expired. Please send a new OTP."

            });

        }

        // OTP check
        if (enteredOTP !== savedData.otp) {

            return res.status(400).json({

                success: false,

                message: "Invalid OTP"

            });

        }

        // OTP verified होने के बाद delete
        delete global.workOTPs[customerEmail];

        res.json({

            success: true,

            message: "OTP verified successfully"

        });

    } catch (error) {

        console.error("OTP VERIFY ERROR:", error);

        res.status(500).json({

            success: false,

            message: "OTP verification failed"

        });

    }

});


// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {

    console.log(
        `Server running at http://localhost:${PORT}`
    );

});
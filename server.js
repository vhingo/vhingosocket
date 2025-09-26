// const express = require('express');

import db, { query } from "./db.js";
import express from "express";
import { Server } from 'socket.io';
const app = express();
const port = 4000;
const wifiIp = "192.168.1.4"
var server = app.listen(port, () => {
    console.log(`Server is running ${port}`);
});



app.get("/", (req, resp) => {
    resp.status(200).json("socket is running");
})

app.get("/api/data-fetch", async (req, resp) => {

    let queryForFetch = "SELECT * FROM vendorlocations WHERE 1";
    let response = await query(queryForFetch);
    console.log("response", response);
    resp.status(200).json(response);
})

app.post("/data-sent", async (req, resp) => {
    let value = [12, "allGood", '4:24 PM', 2, "USER"];
    let queryData = 'INSERT INTO chats (user_id, message, time,admin_id,sendername ) VALUES (?, ?, ?,?,?)';
    const result = await query(queryData, value);
    console.log("result", result);
})


const io = new Server(server, {
    cors: { origin: "*" }
});

io.on('connection', (socket) => {
    console.log("user is comming");
    socket.emit("userConnected", "Connected Successfully");

    //update code for
    socket.on("tracking", async (btnKaMsg) => {
    try {
        // 🧭 Extract data safely
        const room = btnKaMsg?.room;
        const longitude = btnKaMsg?.location?.longitude;
        const latitude = btnKaMsg?.location?.latitude;
        const tracking_status = btnKaMsg?.status ?? "";

        if (!room || !latitude || !longitude) {
        console.warn("Missing required tracking data:", btnKaMsg);
        return;
        }

        // 🧩 Update vendor location in DB
        const updateQuery = `
        UPDATE vendorlocations 
        SET latitude = ?, longitude = ?, tracking_status = ? 
        WHERE vendor_id = ?
        `;
        await query(updateQuery, [latitude, longitude, tracking_status, room]);
        console.log("✅ Result update successfully");

        // 🧠 Join room (safe)
        socket.join(room);
        socket.emit("room connected", `Room ${room} joined successfully`);
        console.log("📍 Location payload:", btnKaMsg);

        // 💬 Notify other users in room
        socket.to(room).emit("message received", btnKaMsg);

        // 🚀 Emit track location with acknowledgment (safe)
        io.to(room).emit("track location", btnKaMsg, (acknowledgment) => {
        if (acknowledgment && acknowledgment.success) {
            console.log("✅ Client acknowledged location update:", acknowledgment.message);
        } else {
            console.warn("⚠️ No acknowledgment or invalid response from client");
        }
        });

    } catch (error) {
        console.error("❌ Error in tracking event:", error);
    }
    });


    //for chats
    socket.on("setup", (socketId) => {
        console.log("setup userId", socketId);
        socket.join(socketId);
        socket.emit("connectedSocketId", socketId);
        console.log("connected User");
    })

    socket.on("sendmessage", async (btnKaMsg) => {
        const room = btnKaMsg.room;
        const user_id = btnKaMsg.user_id;
        const admin_id = btnKaMsg.admin_id;
        const vendor_id = btnKaMsg?.vendor_id;
        const time = btnKaMsg.time;
        const sendername = btnKaMsg.senderName;
        const message = btnKaMsg.message;
        console.log("vendorId", vendor_id);
        socket.join(room);
        try {
            if (user_id) {
                const values = [user_id, message, time, +admin_id, sendername];
                const insertQuery = 'INSERT INTO chats (user_id, message, time,admin_id,sendername ) VALUES (?, ?, ?,?,?)';
                const result = await query(insertQuery, values);
                console.log("result message add successfully");
            } else {
                const values = [vendor_id, message, time, +admin_id, sendername];
                const insertQuery = 'INSERT INTO chats (vendor_id, message, time,admin_id,sendername ) VALUES (?, ?, ?,?,?)';
                const result = await query(insertQuery, values);
                console.log("result message add successfully");
            }

        } catch (e) {
            console.log("error", e);
        }

        console.log("location", btnKaMsg);
        console.log(btnKaMsg.senderName === "USER");
        if (btnKaMsg.senderName === "ADMIN") {
            if (btnKaMsg?.vendor_id) {
                socket.in(vendor_id).emit("message received", btnKaMsg);
                socket.in(vendor_id).emit("getmessage", btnKaMsg);
            } else {
                socket.in(user_id).emit("message received", btnKaMsg);
                socket.in(user_id).emit("getmessage", btnKaMsg);
            }
        }
        if (btnKaMsg.senderName === "USER" || btnKaMsg.senderName === "VENDOR") {
            console.log("adminId", admin_id);
            socket.in(admin_id).emit("message received", btnKaMsg);
            socket.in(admin_id).emit("getmessage", btnKaMsg);
        }

    });
    //end chats

    socket.on('disconnect', (socket) => {
        console.log('Disconnect');
    });
});


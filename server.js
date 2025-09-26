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
        const room = btnKaMsg?.room;
        const { latitude, longitude } = btnKaMsg?.location || {};
        const tracking_status = btnKaMsg?.status || null;

        // Validate input
        if (!room || latitude === undefined || longitude === undefined) {
        console.warn("⚠️ Missing required tracking data:", btnKaMsg);
        return socket.emit("tracking-error", "Invalid tracking data received");
        }

        console.log("📍 Params:", { room, latitude, longitude, tracking_status });

        // ✅ Step 1: Update first
        const updateQuery = `
        UPDATE vendorlocations 
        SET latitude = ?, longitude = ?, tracking_status = ?
        WHERE vendor_id = ?
        `;
        const updateResult = await query(updateQuery, [latitude, longitude, tracking_status, room]);
        console.log("🔢 Update result:", updateResult);

        // ✅ Step 2: If no rows updated, insert new record
        if (updateResult.affectedRows === 0) {
        const insertQuery = `
            INSERT INTO vendorlocations (vendor_id, latitude, longitude, tracking_status)
            VALUES (?, ?, ?, ?)
        `;
        const insertResult = await query(insertQuery, [room, latitude, longitude, tracking_status]);
        console.log("✅ Insert result:", insertResult);
        }

        // ✅ Step 3: Join room and emit to clients
        socket.join(room);
        socket.emit("room connected", `✅ Joined room ${room}`);

        // Broadcast updated location to all clients in the room
        io.to(room).emit("track location", btnKaMsg);
        console.log(`📡 "track location" sent to room: ${room}`);
    } catch (e) {
        console.error("💥 Error in tracking handler:", e);
        socket.emit("tracking-error", "Server error while processing tracking data");
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

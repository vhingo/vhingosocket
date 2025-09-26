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
    const longitude = btnKaMsg?.location?.longitude;
    const latitude = btnKaMsg?.location?.latitude;
    const tracking_status = btnKaMsg?.status || null;

    if (!room || !latitude || !longitude) {
      console.warn("⚠️ Missing required tracking data:", btnKaMsg);
      return socket.emit("tracking-error", "Invalid tracking data received");
    }

    // 🧭 Step 1: Update DB
    const updateQuery = `
      UPDATE vendorlocations 
      SET latitude = ?, longitude = ?, tracking_status = ? 
      WHERE vendor_id = ?`;
    const result = await query(updateQuery, [latitude, longitude, tracking_status, room]);
    console.log("✅ Location updated successfully in DB for vendor:", room);

    // 🧭 Step 2: Join Room (if not already)
    socket.join(room);
    console.log(`🚪 Socket ${socket.id} joined room ${room}`);

    // Confirm to sender
    socket.emit("room connected", `✅ Joined room ${room}`);

    // Debug log incoming data
    console.log("📦 Received tracking data:", btnKaMsg);

    // Optional: Notify other clients in the room
    socket.to(room).emit("message received", btnKaMsg);

    // 🧭 Step 3: Check clients in room
    const clients = await io.in(room).fetchSockets();
    console.log(`👥 Room '${room}' has ${clients.length} connected clients`);
    clients.forEach(c => console.log("📡 Client ID in room:", c.id));

    if (clients.length === 0) {
      console.warn(`⚠️ No clients in room '${room}' to receive tracking data`);
      return;
    }

    // 🧭 Step 4: Emit event with acknowledgment
    console.log("🛰️ Sending 'track location' event:", btnKaMsg);

    io.timeout(5000).to(room).emit("track location", btnKaMsg, (err, responses) => {
      if (err) {
        console.error("⏰ Timeout error details:", err);
      } else if (responses && responses.length > 0) {
        console.log("✅ Received acknowledgments from clients:");
        responses.forEach((res, i) => console.log(`  Client ${i + 1}:`, res));
      } else {
        console.warn("⚠️ No acknowledgment responses received from clients");
      }
    });

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

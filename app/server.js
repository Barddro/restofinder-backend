// app/server.js
//import { processData, processRestoNums, getBestFoodTypeWant, devolve, devolveUseAPI, checkIfKeyExist, findKey, average } from "./lib/utils.js";
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors"); 
const utils = require("./lib/utils.js");
const mapUtils = require("./lib/maps.js");
require("dotenv").config();

const app = express();
const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    /*
    origin: [
    "http://localhost:3000", // Allow Next.js frontend
    "https://restofinder-backend-production.up.railway.app:8080"
    // add render dir
    ],
    */
    origin: [process.env.FRONTEND_URL],
    methods: ["GET", "POST"],
  },
});


const rooms = {}; // Stores active rooms
const roomsMap = {};

io.on("connection", (socket) => {
    console.log("A user connected", socket.id);
    roomsMap[socket.id] = null;

    
    // Host creates a room with a unique code
    socket.on("createRoom", () => {
        const roomCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        rooms[roomCode] = { 
            host: socket.id, 
            users: [], 
            clientState: {},
            roomState: 0, //0 = not started, 1 = in progress, 2 = finished
            questionNum: 0,
            restrictions: Array(4).fill(false),
            location: {},
            clientInput: [
                {}, //foodTypeWant
                {}, //foodTypeDontWant
                {}, // Distance
                {}, // PriceRange
                
            ],
            restaurants: [],
            /*restaurants: [
                {cuisine: numOfRestos},
                radius,
                priceLevel
            ]
            */

            restoData: [],
            restoVotes: [],

        };
        rooms[roomCode].clientState[socket.id] = 0
        roomsMap[socket.id] = roomCode;
        
        socket.join(roomCode);
        console.log(`Room created: ${roomCode}`);
        socket.emit("roomCreated", roomCode);

    });

    // User joins a room using a code
    socket.on("joinRoom", (roomCode) => {
        if (rooms[roomCode] && !rooms[roomCode].roomState) {
            socket.join(roomCode);
            rooms[roomCode].users.push(socket.id);
            rooms[roomCode].clientState[socket.id] = 0;
            console.log(`User ${socket.id} joined room ${roomCode}`);
            socket.emit("joinedRoom", roomCode);
            io.to(roomCode).emit("userJoined", socket.id);
            roomsMap[socket.id] = roomCode;
        } else if (rooms[roomCode].roomState) {
            socket.emit("error", "Room is already in progress");
        } else {
            socket.emit("error", "Room not found");
        }
    });

    socket.on("readyBegin", (roomCode, currentLocation, restrictions) => {

        rooms[roomCode].roomState = 1;
        console.log('Host location:', currentLocation); // Add this line
        rooms[roomCode].location = currentLocation;
        rooms[roomCode]["restrictions"] = restrictions;
        console.log("Host ready to begin room:", roomCode);
        io.to(roomCode).emit("begin");
    });

    socket.on("submitAnswer", (clientID, roomCode, answer) => {
        rooms[roomCode].clientState[clientID] = 1;

        console.log('answer submitted by ', clientID);
        console.log('current client state obj: ', rooms[roomCode].clientState);

        questionNum = rooms[roomCode].questionNum;
        rooms[roomCode].clientInput[questionNum][clientID] = answer;


        if (Object.values(rooms[roomCode].clientState).every(state => state === 1)) {
            console.log('all clients have submitted their answers: ', rooms[roomCode].clientInput);
            for(var key in rooms[roomCode].clientState) {
                rooms[roomCode].clientState[key] = 0;
            }

            rooms[roomCode].questionNum ++;
            console.log('ready to proceed to question ', rooms[roomCode].questionNum);
            io.to(roomCode).emit("readyProceed", rooms[roomCode].questionNum);

            if (rooms[roomCode].questionNum === 4) {
                console.log('ready to proceed to results');
                rooms[roomCode].roomState = 2;
                console.log(rooms[roomCode].clientInput);
                rooms[roomCode].restaurants = utils.processData(rooms[roomCode].clientInput, rooms[roomCode].users.length);
            }
        }
    });

    socket.on("loadedResultsPage", async (clientID, roomCode) => {
        rooms[roomCode].clientState[clientID] = 1;
        console.log('client ', clientID, ' has loaded results page');
        console.log('current client state obj: ', rooms[roomCode].clientState);

        if (Object.values(rooms[roomCode].clientState).every(state => state === 1)) {
            console.log('all clients have loaded results page: ');
            socket.removeAllListeners("loadedResultsPage");
            for(var key in rooms[roomCode].clientState) {
                rooms[roomCode].clientState[key] = 0;
            }

            try {
              const rawRestoData = [];
              const promises = [];
              
              for (const foodType of Object.keys(rooms[roomCode].restaurants[0])) {
                const numRestaurants = rooms[roomCode].restaurants[0][foodType];
                promises.push(
                  mapUtils.fetchMapsData(foodType, rooms[roomCode].location.lat, rooms[roomCode].location.lng, 
                                     rooms[roomCode].restaurants[1], rooms[roomCode].restaurants[2], numRestaurants)
                  .then(results => {
                    console.log(`Found ${results.length} restaurants for ${foodType}`);
                    if (results.length > 0) {
                      rawRestoData.push(...results);
                    }
                    return results;
                  })
                );
              }
              
              await Promise.all(promises);
              rooms[roomCode].restoData = rawRestoData;
//BREAKPOINT1->
              if (rawRestoData.length > 0) {
                rooms[roomCode].restoVotes = Array(rawRestoData.length).fill(0)
                io.to(roomCode).emit("restoQuery", rawRestoData);
              } else {
                // Fallback if no restaurants found
                io.to(roomCode).emit("noRestaurantsFound");
              }
            } catch (error) {
              console.error("Error fetching restaurant data:", error);
              io.to(roomCode).emit("error", "Failed to fetch restaurants");
            }
          }
        });

    socket.on("submitVote", (clientID, roomCode, restoNum) => {
        rooms[roomCode].clientState[clientID] = 1;

        console.log('vote submitted by ', clientID, ' for restaurant ', restoNum);
        console.log('current client state obj: ', rooms[roomCode].clientState);

//->BREAKPOINT1

        rooms[roomCode].restoVotes[restoNum]++;
        console.log("restaurant votes:")
        console.log(rooms[roomCode].restoVotes)

        if (Object.values(rooms[roomCode].clientState).every(state => state === 1)) {
            console.log('all clients have submitted their votes: ', rooms[roomCode].restoVotes);
            for(var key in rooms[roomCode].clientState) {
                rooms[roomCode].clientState[key] = 0;
            }

            newRestos = utils.processVotes(rooms[roomCode].restoData, rooms[roomCode].restoVotes);
            rooms[roomCode].restoVotes = Array(newRestos.length).fill(0)
            io.to(roomCode).emit("newVote", newRestos);
        }

    });

    socket.on("checkRoom", (roomCode, callback) => {
        // Check if the room exists
        const roomExists = io.sockets.adapter.rooms.has(roomCode);
        
        let roomState = null;

        if (roomExists && rooms[roomCode]) {
            roomState = rooms[roomCode].roomState;
        }

        callback(roomExists, roomState);
    });

    // Handle disconnections
    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);

        userSocket = socket.id
        userRoom = roomsMap[userSocket];

        // cleanup user input if game in progress
        if (userRoom && rooms[userRoom].roomState && rooms[userRoom].roomState >= 1) {

            console.log('starting user disconnect cleanup')

            delete rooms[userRoom].clientState[socket.id];

            if (rooms[userRoom].roomState === 1) {
                for (let i = 0; i < rooms[userRoom].clientInput.length; i++) {
                    delete rooms[userRoom].clientInput[i].userSocket;
                }
            }
        }

        delete roomsMap[socket.id];

        for (const [roomCode, room] of Object.entries(rooms)) {
            if (room.host === socket.id) { // close room on host disconnect
                io.to(roomCode).emit("roomClosed");
                delete rooms[roomCode];
                console.log(`Room ${roomCode} closed`);
            } else {
                room.users = room.users.filter(id => id !== socket.id);
                io.to(roomCode).emit("userLeft", socket.id);
            }
        }
    });
});


server.listen(PORT, () => console.log("Socket.IO server running on port {PORT}"));
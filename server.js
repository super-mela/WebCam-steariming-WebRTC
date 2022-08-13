const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const bodyParser = require('body-parser');
const webrtc = require("wrtc");
const cors = require('cors');
const path = require('path');
const fs = require('fs');

let senderStream;

var corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200 // For legacy browser support
}

app.use(cors(corsOptions));
app.use(express.static('public'));
app.use('/poster', express.static(path.join(__dirname, 'resource/poster')));
app.use('/backdrop', express.static('resource/backdrop'));
app.use('/videos', express.static('resource/videos'));
app.use('/profile_images', express.static('resource/profile_images'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post("/consumer", async ({ body }, res) => {
    const peer = new webrtc.RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.stunprotocol.org"
            }
        ]
    });
    const desc = new webrtc.RTCSessionDescription(body.sdp);
    await peer.setRemoteDescription(desc);
    senderStream.getTracks().forEach(track => peer.addTrack(track, senderStream));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    const payload = {
        sdp: peer.localDescription
    }

    res.json(payload);
});

app.post('/broadcast', async ({ body }, res) => {

    const peer = new webrtc.RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.stunprotocol.org"
            }
        ]
    });
    peer.ontrack = (e) => handleTrackEvent(e, peer);
    const desc = new webrtc.RTCSessionDescription(body.sdp);
    await peer.setRemoteDescription(desc);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    const payload = {
        sdp: peer.localDescription
    }

    res.json(payload);
});

app.get('/video', (res, req) => {

    const range = req.req.headers.range;
    const videoSize = fs.statSync(videoPath).size;

    const chunkSize = 1 * 1e+6;
    const start = Number(range.replace(/\D/g, ""));
    const end = Math.min(start * chunkSize, videoSize - 1);
    const contentLength = end - start + 1;

    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Range": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4"
    }

    res.res.writeHead(206, headers);

    const stream = fs.createReadStream(videoPath, { start, end })
    stream.pipe(res.res);
})

function handleTrackEvent(e, peer) {
    senderStream = e.streams[0];
};
let message = ''
io.on("connection", (socket) => {

    console.log("A user Connected")
    console.log('message: ' + socket.id);
    socket.on('liveEvent', (msg) => {

        message = msg;
        io.emit("liveEvent", { message: msg })
    });
    io.emit("liveEvent", { message: message })

    socket.on("disconnect", (data) => {
        console.log("A user disconnected" + (socket.id))
    });
});



server.listen(4001, () => console.log('server started'));
const SCALEDRONE_CHANNEL_ID = 'LfHgHvcMx3uFQQIu';
const ROOM_NAME = 'video-call-room';

// Initialize ScaleDrone
const drone = new ScaleDrone(SCALEDRONE_CHANNEL_ID);

// Room and peer connection variables
let room;
let peerConnection;
const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // STUN server
};

// Get video elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

// Get user media (camera and microphone)
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;

    // Join ScaleDrone room
    drone.on('open', error => {
      if (error) return console.error(error);
      room = drone.subscribe(ROOM_NAME);

      room.on('open', () => console.log('Connected to room'));
      room.on('members', members => {
        if (members.length > 2) return alert('Room is full');
        const isOfferer = members.length === 2;
        startWebRTC(isOfferer, stream);
      });
    });
  })
  .catch(error => console.error('Error accessing media devices.', error));

// Start WebRTC
function startWebRTC(isOfferer, stream) {
  peerConnection = new RTCPeerConnection(config);

  // Add stream to connection
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

  // Handle ICE candidates
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({ candidate: event.candidate });
    }
  };

  // Handle incoming streams
  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };

  // Signaling logic
  if (isOfferer) {
    peerConnection.onnegotiationneeded = () => {
      peerConnection.createOffer().then(localDescCreated).catch(console.error);
    };
  }

  room.on('data', (message, client) => {
    if (client.id === drone.clientId) return;

    if (message.sdp) {
      peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp))
        .then(() => {
          if (peerConnection.remoteDescription.type === 'offer') {
            peerConnection.createAnswer().then(localDescCreated).catch(console.error);
          }
        });
    } else if (message.candidate) {
      peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
  });

  function localDescCreated(desc) {
    peerConnection.setLocalDescription(desc)
      .then(() => sendMessage({ sdp: peerConnection.localDescription }))
      .catch(console.error);
  }
}

// Send message to ScaleDrone room
function sendMessage(message) {
  drone.publish({ room: ROOM_NAME, message });
}


import { useEffect, useRef, useState } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users, Copy, CheckCircle2, Share, MessageSquare, Send, X, Sparkles, Monitor, MonitorOff } from 'lucide-react';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080';
const RemoteVideo = ({ stream }: { stream: MediaStream }) => {
    const ref = useRef<HTMLVideoElement>(null);
  
    useEffect(() => {
      if (ref.current) ref.current.srcObject = stream;
    }, [stream]);
  
    return <video ref={ref} autoPlay playsInline />;
  };
  
type ChatMessage = {
  id: string;
  peerId: string;
  displayName: string;
  text: string;
  timestamp: number;
};

export const Room = ({
  localStream,
  roomId,
  displayName,
  onLeave,
}: {
  localStream: MediaStream;
  roomId: string;
  displayName: string;
  onLeave: () => void;
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const deviceRef = useRef<mediasoupClient.Device | null>(null);
  const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const producerToPeerMap = useRef<Map<string, string>>(new Map());
  const peerDisplayNames = useRef<Map<string, string>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const transcriptionRef = useRef<{ stop: () => void } | null>(null);

  // Screen share
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const screenProducerRef = useRef<mediasoupClient.types.Producer | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  // Map producerId → mediaTag so remote peers know what label to show
  const producerTagMap = useRef<Map<string, string>>(new Map());

  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<{
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    duration: string;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);


  //Transciption
  const startTranscription = (displayName: string) => {
    console.log("transcription started")
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
  
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = false; // only final results
    recognition.lang = 'en-US';
    recognition.onresult = (event:any) => {
      const text = event.results[event.results.length - 1][0].transcript.trim();
      if (!text) return;
      sendMessage({
        type: 'transcriptChunk',
        roomId,
        displayName,
        text,
        timestamp: Date.now(),
      });
    };
  
    let stopped = false;

    recognition.onend = () => {
      if (!stopped) {
        recognition.start();
      }
    };
    
    return {
      recognition,
      stop: () => {
        stopped = true;
        recognition.stop();
      }
    };
  };

  // chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatOpen]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendMessage({ type: 'chatMessage', roomId, text, displayName });
    setChatInput('');
  };

  const toggleChat = () => {
    setChatOpen(prev => !prev);
    setUnread(0);
  };
  const stopScreenShare = () => {
    screenProducerRef.current?.close();
    screenProducerRef.current = null;
    screenStream?.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    setScreenSharing(false);
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      stopScreenShare();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });

      const track = stream.getVideoTracks()[0];

      const sendTransport = sendTransportRef.current;
      if (!sendTransport) { stream.getTracks().forEach(t => t.stop()); return; }

      const producer = await sendTransport.produce({
        track,
        appData: { mediaTag: 'screen-video' },
      });

      screenProducerRef.current = producer;
      producerTagMap.current.set(producer.id, 'screen-video');
      setScreenStream(stream);
      setScreenSharing(true);

      // When the OS/browser "Stop sharing" button is clicked
      track.onended = () => stopScreenShare();

      // Mirror stream to the screen preview element
      if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') console.error('Screen share error:', err);
    }
  };
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const shareMeeting = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Join my EchoRTC Meeting',
          text: `Join my video meeting on EchoRTC! Meeting code: ${roomId}`,
          url: window.location.href,
        });
      } else {
        copyRoomId();
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };
  //  HELPERS 
  const sendMessage = (msg: object) => {
    socketRef.current?.send(JSON.stringify(msg));
  };

  //  TOGGLE CONTROLS 
  const toggleMute = () => {
    localStream.getAudioTracks().forEach(t => (t.enabled = !t.enabled));
    setMuted(prev => !prev);
  };

  const toggleCam = () => {
    localStream.getVideoTracks().forEach(t => (t.enabled = !t.enabled));
    setCamOff(prev => !prev);
  };

  const handleLeave = () => {
    transcriptionRef.current?.stop();
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    socketRef.current?.close();
    onLeave();
  };

  //  MAIN EFFECT 
  useEffect(() => {
    // show local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }

    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;

    //  SOCKET OPEN 
    socket.onopen = () => {
      console.log('socket connected');
      setStatus('Joining room...');
      sendMessage({ type: 'joinRoom', roomId,displayName });
    };

    //  SOCKET MESSAGES 
    socket.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      console.log('received:', message.type);

      switch (message.type) {

        // STEP 1 — load Device with router caps
        case 'routerRtpCapabilities':
          await handleRouterRtpCapabilities(message.rtpCapabilities);
          break;

        // STEP 2 — transport created by server, connect it
        case 'transportCreated':
          await handleTransportCreated(message);
          break;

        // STEP 3 — new producer from another peer, consume it
        case 'newProducer':
          await handleNewProducer(message.producerId, message.peerId, message.displayName, message.mediaTag);
          break;

        // STEP 4 — server created consumer, render it
        case 'consumed':
          await handleConsumed(message);
          break;

        case 'chatMessage':
          setMessages(prev => [...prev, message.message]);
          if (!chatOpen) setUnread(prev => prev + 1);
          break;

        case 'peerLeft':
          console.log('peer left:', message.peerId);
          setStatus('Other peer left');
          setRemoteStreams(prev => {
            const updated = new Map(prev);
            updated.delete(message.peerId);
            updated.delete(`${message.peerId}:screen`);
            return updated;
          });
          break;

        case 'existingProducers':
            for (const producer of message.producers) {
              await handleNewProducer(producer.producerId, producer.peerId, producer.displayName, producer.mediaTag);
            }
            break;

        case 'callSummary':
              setSummary(message.summary);
              setSummaryLoading(false); 
              break;

        default:
          break;
      }
    };

    socket.onerror = console.error;
    socket.onclose = () => console.log('socket closed');

    return () => {
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      socket.close();
    };
  }, [localStream, roomId]);

  //  HANDLER: ROUTER RTP CAPABILITIES 
  // Load the mediasoup Device — this tells the browser
  // what codecs the server supports
  const handleRouterRtpCapabilities = async (
    rtpCapabilities: mediasoupClient.types.RtpCapabilities
  ) => {
    const device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities: rtpCapabilities });
    deviceRef.current = device;

    console.log('device loaded');
    setStatus('Setting up transports...');

    // tell server our rtp capabilities
    sendMessage({
      type: 'rtpCapabilities',
      roomId,
      rtpCapabilities: device.rtpCapabilities,
    });

    // ask server to create send transport
    sendMessage({
      type: 'createTransport',
      roomId,
      direction: 'send',
    });
  };

  //  HANDLER: TRANSPORT CREATED 
  // Server created a transport — now we connect it
  const handleTransportCreated = async (message: any) => {
    const device = deviceRef.current;
    if (!device) return;

    const { direction, params } = message;

    if (direction === 'send') {
      // create send transport on client side
      const sendTransport = device.createSendTransport(params);
      sendTransportRef.current = sendTransport;

      // fired when transport needs to connect (first produce)
      sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          sendMessage({
            type: 'connectTransport',
            roomId,
            direction: 'send',
            dtlsParameters,
          });
          callback();
        } catch (err: any) {
          errback(err);
        }
      });

      // fired when transport is ready to produce
      sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const correlationId = crypto.randomUUID();

          sendMessage({
            type: 'produce',
            roomId,
            transportId: sendTransport.id,
            kind,
            rtpParameters,
            correlationId,
            appData,
          });

          // wait for the server to ack THIS specific produce via correlationId
          const socket = socketRef.current;
          if (!socket) return;

          const onProduced = (event: MessageEvent) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'produced' && msg.correlationId === correlationId) {
              socket.removeEventListener('message', onProduced);
              callback({ id: msg.producerId });
            }
          };
          socket.addEventListener('message', onProduced);

        } catch (err: any) {
          errback(err);
        }
      });

      // now produce audio + video tracks
      await produceLocalTracks(sendTransport);

      // ask server to create recv transport
      sendMessage({
        type: 'createTransport',
        roomId,
        direction: 'recv',
      });

    } else if (direction === 'recv') {
      // create recv transport on client side
      const recvTransport = device.createRecvTransport(params);
      recvTransportRef.current = recvTransport;

      recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          sendMessage({
            type: 'connectTransport',
            roomId,
            direction: 'recv',
            dtlsParameters,
          });
          callback();
        } catch (err: any) {
          errback(err);
        }
      });

      setStatus('Connected ✅');
      console.log('recv transport ready');
      const t = startTranscription(displayName);
      if (t) transcriptionRef.current = t;
    }
  };

  //  PRODUCE LOCAL TRACKS 
  const produceLocalTracks = async (
    sendTransport: mediasoupClient.types.Transport
  ) => {
    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];

    if (videoTrack) {
      await sendTransport.produce({ track: videoTrack });
      console.log('video producer created');
    }

    if (audioTrack) {
      await sendTransport.produce({ track: audioTrack });
      console.log('audio producer created');
    }
  };

  //  HANDLER: NEW PRODUCER 
  // Another peer started sending — ask server to let us consume it
  const handleNewProducer = async (
    producerId: string,
    peerId: string,
    displayName: string,
    mediaTag?: string | null,
  ) => {
    console.log('new producer, consuming:', producerId, 'from peer:', peerId, 'tag:', mediaTag);
    producerToPeerMap.current.set(producerId, peerId);
    peerDisplayNames.current.set(peerId, displayName);
    if (mediaTag) producerTagMap.current.set(producerId, mediaTag);
    sendMessage({
      type: 'consume',
      roomId,
      producerId,
    });
  };

  //  HANDLER: CONSUMED 
  // Server created a consumer — render the remote track
  const handleConsumed = async (message: any) => {
    const recvTransport = recvTransportRef.current;
    if (!recvTransport) return;

    const consumer = await recvTransport.consume({
      id: message.consumerId,
      producerId: message.producerId,
      kind: message.kind,
      rtpParameters: message.rtpParameters,
    });
  
    const peerId = producerToPeerMap.current.get(message.producerId);
    if (!peerId) {
      console.warn('Unknown peer for producer', message.producerId);
      return;
    }

    // Use peerId:screen key for screen-share tracks, plain peerId for camera/audio
    const isScreen = message.mediaTag === 'screen-video';
    const streamKey = isScreen ? `${peerId}:screen` : peerId;

    setRemoteStreams(prev => {
      const updated = new Map(prev);
      const existing = updated.get(streamKey);
      // Always create a NEW MediaStream so React sees a reference change
      // and RemoteVideo's useEffect re-fires to re-attach srcObject.
      const newStream = new MediaStream([
        ...(existing ? existing.getTracks() : []),
        consumer.track,
      ]);
      updated.set(streamKey, newStream);
      return updated;
    });
  };

  //  RENDER
  // Screen-share awareness — drives presentation mode
  const screenKeys = Array.from(remoteStreams.keys()).filter(k => k.endsWith(':screen'));
  const hasAnyScreenShare = screenSharing || screenKeys.length > 0;

  // Pinned = local screen (priority) OR first remote screen
  const pinnedIsLocal = screenSharing && !!screenStream;
  const pinnedRemoteKey = !pinnedIsLocal && screenKeys.length > 0 ? screenKeys[0] : null;
  const pinnedRemoteStream = pinnedRemoteKey ? remoteStreams.get(pinnedRemoteKey) ?? null : null;
  const pinnedLabel = pinnedIsLocal
    ? '\uD83D\uDDA5 Your Screen'
    : pinnedRemoteKey
      ? `\uD83D\uDDA5 ${peerDisplayNames.current.get(pinnedRemoteKey.replace(':screen', '')) ?? 'Peer'}'s Screen`
      : '';

  // Sidebar: camera entries + any non-pinned secondary screens
  const cameraEntries = Array.from(remoteStreams.entries()).filter(([k]) => !k.endsWith(':screen'));
  const secondaryScreenEntries = (
    pinnedRemoteKey ? screenKeys.slice(1) : screenKeys
  ).map(k => [k, remoteStreams.get(k)!] as [string, MediaStream]);

  // Normal grid mode vars
  const totalParticipants = remoteStreams.size + 1;
  const gridClass = totalParticipants === 1 ? 'grid-1'
                  : totalParticipants === 2 ? 'grid-2'
                  : totalParticipants <= 4 ? 'grid-4'
                  : 'grid-auto';

  return (
    <div className="room-container">
      <div className="room-header">
        <div className="room-title">
          EchoRTC
          <span className="badge">{status}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Users size={18} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{remoteStreams.size + 1}</span>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '8px 12px', fontSize: '14px' }}
              onClick={copyRoomId}
              title="Copy Room ID"
            >
              {copied ? <CheckCircle2 size={16} color="var(--success)" /> : <Copy size={16} />}
              {copied ? 'Copied' : roomId}
            </button>

            <button 
              className="btn btn-primary" 
              style={{ padding: '8px 16px', fontSize: '14px' }}
              onClick={shareMeeting}
              title="Share Meeting"
            >
              <Share size={16} /> Share
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {hasAnyScreenShare ? (
          /* ── PRESENTATION MODE: pinned screen + sidebar ── */
          <div className="presentation-layout" style={{ flex: 1 }}>

            {/* Pinned main screen */}
            <div className="presentation-main">
              <div className="video-card presentation-pinned">
                {pinnedIsLocal && screenStream ? (
                  <video
                    ref={el => {
                      screenVideoRef.current = el;
                      if (el && screenStream) el.srcObject = screenStream;
                    }}
                    autoPlay muted playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
                  />
                ) : pinnedRemoteStream ? (
                  <RemoteVideo stream={pinnedRemoteStream} />
                ) : null}
                <div className="participant-name presentation-label">{pinnedLabel}</div>
              </div>
            </div>

            {/* Sidebar strip */}
            <div className="presentation-sidebar">
              {/* Local camera */}
              <div className="video-card sidebar-tile local">
                <video ref={localVideoRef} autoPlay muted playsInline />
                <div className="participant-name">You {muted && '(Muted)'}</div>
              </div>

              {/* Remote cameras */}
              {cameraEntries.map(([key, stream]) => (
                <div className="video-card sidebar-tile" key={key}>
                  <RemoteVideo stream={stream} />
                  <div className="participant-name">
                    {peerDisplayNames.current.get(key) ?? `Participant ${key.substring(0, 4)}`}
                  </div>
                </div>
              ))}

              {/* Secondary screen shares (not pinned) */}
              {secondaryScreenEntries.map(([key, stream]) => {
                const pid = (key as string).replace(':screen', '');
                return (
                  <div className="video-card sidebar-tile" key={key as string}>
                    <RemoteVideo stream={stream} />
                    <div className="participant-name">
                      \uD83D\uDDA5 {peerDisplayNames.current.get(pid) ?? 'Peer'}'s Screen
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── NORMAL GRID MODE ── */
          <div className={`video-grid ${gridClass}`} style={{ flex: 1 }}>
            <div className="video-card local">
              <video ref={localVideoRef} autoPlay muted playsInline />
              <div className="participant-name">You {muted && '(Muted)'}</div>
            </div>

            {cameraEntries.map(([key, stream]) => (
              <div className="video-card" key={key}>
                <RemoteVideo stream={stream} />
                <div className="participant-name">
                  {peerDisplayNames.current.get(key) ?? `Participant ${key.substring(0, 4)}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat panel */}
        {chatOpen && (
          <div style={{
            width: '320px',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            borderLeft: '1px solid var(--glass-border)',
            borderRadius: '0 0 0 12px',
          }}>
            {/* Chat header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--glass-border)',
            }}>
              <span style={{ fontWeight: 600, fontSize: '15px' }}>Chat</span>
              <button
                onClick={toggleChat}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              {messages.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
                  No messages yet. Say hi!
                </p>
              )}
              {messages.map((msg) => {
                const isMe = msg.displayName === displayName && msg.peerId !== undefined;
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      {msg.displayName} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div style={{
                      background: isMe ? 'var(--accent-1)' : 'rgba(255,255,255,0.08)',
                      color: 'var(--text-primary)',
                      borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: '8px 12px',
                      fontSize: '14px',
                      maxWidth: '240px',
                      wordBreak: 'break-word',
                      lineHeight: '1.4',
                    }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--glass-border)',
              display: 'flex', gap: '8px', alignItems: 'center',
            }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                placeholder="Send a message..."
                maxLength={2000}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: 'var(--font-main)',
                }}
              />
              <button
                onClick={sendChat}
                disabled={!chatInput.trim()}
                style={{
                  background: chatInput.trim() ? 'var(--accent-1)' : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: '8px',
                  padding: '8px 10px', cursor: chatInput.trim() ? 'pointer' : 'default',
                  color: 'white', display: 'flex', alignItems: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

        {summary && (
            <div style={{
             position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)',
             display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>
          <div style={{
            background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)', borderRadius: '16px',
            padding: '32px', maxWidth: '480px', width: '90%',
          }}>
            <h2 style={{ marginBottom: '16px' }}>Meeting summary</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>{summary.summary}</p>
        
            {summary.keyPoints.length > 0 && <>
              <h3 style={{ marginBottom: '8px', fontSize: '14px' }}>Key points</h3>
              <ul style={{ marginBottom: '16px', paddingLeft: '20px' }}>
                {summary.keyPoints.map((p, i) => <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{p}</li>)}
              </ul>
            </>}

            {summary.actionItems.length > 0 && <>
              <h3 style={{ marginBottom: '8px', fontSize: '14px' }}>Action items</h3>
              <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
                {summary.actionItems.map((a, i) => <li key={i} style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{a}</li>)}
              </ul>
            </>}
            
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleLeave}>
              Close and leave
            </button>
          </div>
        </div>
          )}
      <div className="controls-bar">
        <button 
          className={`btn ${muted ? 'danger' : ''} ${!muted ? 'active' : ''}`}
          onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        
        <button 
          className={`btn ${camOff ? 'danger' : ''} ${!camOff ? 'active' : ''}`}
          onClick={toggleCam}
          title={camOff ? "Turn on camera" : "Turn off camera"}
        >
          {camOff ? <VideoOff size={24} /> : <Video size={24} />}
        </button>
        <button
        className="btn"
        onClick={() => sendMessage({ type: 'generateSummary', roomId })}
        title="Generate meeting summary">
       <Sparkles size={24} />
        </button>
        <button
          className={`btn ${chatOpen ? 'active' : ''}`}
          onClick={toggleChat}
          title="Chat"
          style={{ position: 'relative' }}
        >
          <MessageSquare size={24} />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: '4px', right: '4px',
              background: 'var(--accent-2)',
              color: 'white', borderRadius: '999px',
              fontSize: '10px', fontWeight: 700,
              padding: '1px 5px', minWidth: '16px',
              textAlign: 'center', lineHeight: '14px',
            }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <button
          className={`btn ${screenSharing ? 'danger' : ''} ${!screenSharing ? 'active' : ''}`}
          onClick={toggleScreenShare}
          title={screenSharing ? 'Stop sharing screen' : 'Share screen'}
        >
          {screenSharing ? <MonitorOff size={24} /> : <Monitor size={24} />}
        </button>
        <button 
          className="btn danger leave"
          onClick={handleLeave}
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
};
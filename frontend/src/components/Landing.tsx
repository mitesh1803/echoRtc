import { useEffect, useRef, useState } from "react";
import { Room } from "./Room";
import { Video, Users, Sparkles } from "lucide-react";

export const Landing = () => {
    const [id, setId] = useState<string>('');
    const [displayName, setDisplayName] = useState<string>('');
    const [joined, setJoined] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [loading, setLoading] = useState(true);

    const videoRef = useRef<HTMLVideoElement>(null);

    // GET CAMERA
    const getCam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            setLocalStream(stream);
            setLoading(false);

            // Note: srcObject is now assigned in the useEffect below when the video element mounts.
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    // RUN ON MOUNT
    useEffect(() => {
        getCam();
    }, []);

    // SET VIDEO STREAM WHEN MOUNTED
    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
        }
    }, [localStream, loading, joined]);

    // LOADING
    if (loading) {
        return (
            <div className="app-container">
                <div className="glass-panel" style={{ textAlign: 'center', padding: '60px' }}>
                    <div className="btn-pulse" style={{ display: 'inline-block', padding: '16px', borderRadius: '50%', background: 'var(--accent-glow)', marginBottom: '24px' }}>
                        <Video size={32} color="var(--accent)" />
                    </div>
                    <h2 style={{ marginBottom: '8px' }}>Initializing Camera...</h2>
                    <p>Please allow access to your camera and microphone</p>
                </div>
            </div>
        );
    }

    // JOIN SCREEN
    if (!joined) {
        return (
            <div className="landing-container">
                <div className="landing-content">
                    <div className="landing-badge">
                        <Sparkles size={16} color="#d8b4fe" /> <span>Next-Gen Video Conferencing</span>
                    </div>
                    <h1 className="landing-title">EchoRTC</h1>
                    <p className="landing-subtitle">Crystal clear video meetings, built for modern teams with ultra-low latency.</p>

                    <div className="glass-panel" style={{ padding: '32px' }}>
                        <div className="join-options">
                            <input
                                type="text"
                                className="input-field"
                                placeholder="Your name..."
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                style={{ width: '100%', padding: '14px 16px', fontSize: '15px', marginBottom: '16px' }}
                                maxLength={40}
                            />
                            <button
                                className="btn btn-primary btn-pulse"
                                style={{ width: '100%', padding: '16px', fontSize: '18px', fontWeight: 600, display: 'flex', justifyContent: 'center' }}
                                onClick={() => {
                                    const roomId = crypto.randomUUID().substring(0, 8);
                                    setId(roomId);
                                    setJoined(true);
                                }}
                            >
                                <Video size={22} />
                                Create Meeting
                            </button>
                            
                            <div className="divider">or join with code</div>
                            
                            <div className="join-input-group">
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Enter meeting code..."
                                    value={id}
                                    onChange={(e) => setId(e.target.value)}
                                    style={{ flex: 1, padding: '16px', fontSize: '16px' }}
                                />
                                <button
                                    className="btn btn-secondary"
                                    disabled={!id.trim()}
                                    onClick={() => setJoined(true)}
                                    style={{ padding: '0 24px', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}
                                >
                                    <Users size={20} />
                                    Join
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="landing-preview-container">
                    <div className="landing-preview">
                        {localStream ? (
                            <video autoPlay muted playsInline ref={videoRef} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b' }}>
                                <p style={{ color: 'var(--danger)' }}>Camera access denied</p>
                            </div>
                        )}
                        <div className="landing-preview-overlay">
                            <div className="dot"></div>
                            Live Preview
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ROOM
    return (
        <Room
            localStream={localStream!}
            roomId={id}
            displayName={displayName.trim() || 'Anonymous'}
            onLeave={() => {
                localStream?.getTracks().forEach(t => t.stop());
                setLocalStream(null);
                setJoined(false);
                setId('');
                // Request camera again when returning to landing
                getCam();
            }}
        />
    );
};
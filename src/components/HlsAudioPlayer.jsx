import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Play, Pause, Volume2, AlertCircle } from "lucide-react";

export default function HlsAudioPlayer({ audioInfo }) {
  const audioRef = useRef(null);
  const hlsRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [currentPiece, setCurrentPiece] = useState(-1);

  useEffect(() => {
    setError("");
    setPlaying(false);
    setCurrentPiece(-1);
    const audio = audioRef.current;
    if (!audio || !audioInfo?.m3u8) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = audioInfo.m3u8;
    } else if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(audioInfo.m3u8);
      hls.attachMedia(audio);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setError("真题原声流暂不可用（可能是网络或防盗链限制），仍可点击下方题干和听力原文句划词背单词。");
        }
      });
      hlsRef.current = hls;
    } else {
      setError("当前浏览器不支持 HLS 音频播放。");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [audioInfo]);

  if (!audioInfo?.m3u8) {
    return (
      <div className="audio-banner muted">
        <Volume2 size={16} />
        <span>本套试卷暂无独立音频流（同年份第1/2套通常共用或附带音频），可直接对下方听力题干、选项与关键原文进行划词背词。</span>
      </div>
    );
  }

  const jumpToPiece = (piece, idx) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = piece.start;
    audio.play().then(() => setPlaying(true)).catch(() => {});
    setCurrentPiece(idx);
  };

  return (
    <div className="audio-panel">
      <div className="audio-top-row">
        <div className="audio-title">
          <Volume2 size={16} />
          <span>{audioInfo.label} 听力原声</span>
        </div>
        <audio
          ref={audioRef}
          controls
          className="audio-native"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
      </div>
      {error && (
        <div className="audio-err">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      {audioInfo.pieces?.length > 0 && (
        <div className="audio-pieces">
          {audioInfo.pieces.map((p, idx) => (
            <button
              key={idx}
              className={`piece-chip ${currentPiece === idx && playing ? "active" : ""}`}
              onClick={() => jumpToPiece(p, idx)}
            >
              {currentPiece === idx && playing ? <Pause size={12} /> : <Play size={12} />}
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

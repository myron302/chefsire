import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Radio, MicOff, Mic, VideoOff, Video, Users } from "lucide-react";

interface GoLiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GoLiveModal({ open, onOpenChange }: GoLiveModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState("");
  const [viewerCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setError("");
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setError("Camera/microphone access denied. Please allow access and try again.");
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setIsLive(false);
    };
  }, [open]);

  const toggleMic = () => {
    streamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !micOn;
    });
    setMicOn((prev) => !prev);
  };

  const toggleCam = () => {
    streamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !camOn;
    });
    setCamOn((prev) => !prev);
  };

  const endLive = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsLive(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) endLive(); else onOpenChange(true); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black text-white border-none">
        <div className="relative aspect-[9/16] max-h-[80vh] w-full bg-black flex items-center justify-center">
          {error ? (
            <p className="text-red-400 text-sm px-6 text-center">{error}</p>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          )}

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
            <DialogHeader>
              <DialogTitle className="text-white text-base">
                {isLive ? (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    LIVE
                  </span>
                ) : "Go Live"}
              </DialogTitle>
            </DialogHeader>
            {isLive && (
              <span className="flex items-center gap-1 text-sm bg-black/40 px-2 py-1 rounded-full">
                <Users className="w-3 h-3" />
                {viewerCount}
              </span>
            )}
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center gap-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex gap-4">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={`rounded-full border ${micOn ? "border-white/40 text-white" : "border-red-500 text-red-500"} hover:bg-white/20`}
                onClick={toggleMic}
              >
                {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={`rounded-full border ${camOn ? "border-white/40 text-white" : "border-red-500 text-red-500"} hover:bg-white/20`}
                onClick={toggleCam}
              >
                {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
            </div>

            {!isLive ? (
              <Button
                type="button"
                className="w-48 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full"
                onClick={() => setIsLive(true)}
                disabled={!!error}
              >
                <Radio className="w-4 h-4 mr-2" />
                Start Live
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-48 border-white text-white hover:bg-white/20 rounded-full"
                onClick={endLive}
              >
                End Live
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

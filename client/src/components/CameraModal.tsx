import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Circle, Square, RotateCcw, Check, X, SwitchCamera } from "lucide-react";

interface CameraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (dataUrl: string, type: "image" | "video") => void;
}

type Mode = "idle" | "recording" | "preview";

export default function CameraModal({ open, onOpenChange, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<Mode>("idle");
  const [capturedUrl, setCapturedUrl] = useState("");
  const [capturedType, setCapturedType] = useState<"image" | "video">("image");
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = async (facing: "user" | "environment") => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError("Camera access denied. Please allow access and try again.");
    }
  };

  useEffect(() => {
    if (!open) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      recorderRef.current = null;
      chunksRef.current = [];
      setCapturedUrl("");
      setMode("idle");
      setError("");
      setRecordingSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    startCamera(facingMode);
  }, [open]);

  const flipCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startCamera(next);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.92);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCapturedUrl(url);
    setCapturedType("image");
    setMode("preview");
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCapturedUrl(url);
      setCapturedType("video");
      setMode("preview");
    };
    recorder.start(100);
    recorderRef.current = recorder;
    setMode("recording");
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  };

  const retake = () => {
    setCapturedUrl("");
    setMode("idle");
    setRecordingSeconds(0);
    startCamera(facingMode);
  };

  const confirm = () => {
    onCapture(capturedUrl, capturedType);
    onOpenChange(false);
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-black text-white border-none">
        <div className="relative aspect-[9/16] max-h-[85vh] w-full bg-black flex items-center justify-center">
          {error ? (
            <p className="text-red-400 text-sm px-6 text-center">{error}</p>
          ) : mode === "preview" ? (
            capturedType === "video" ? (
              <video
                ref={previewRef}
                src={capturedUrl}
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img src={capturedUrl} alt="Captured" className="w-full h-full object-cover" />
            )
          ) : (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
            <DialogHeader>
              <DialogTitle className="text-white text-base">
                {mode === "preview"
                  ? capturedType === "video"
                    ? "Video preview"
                    : "Photo preview"
                  : mode === "recording"
                  ? <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />Recording {formatTime(recordingSeconds)}</span>
                  : "Camera"}
              </DialogTitle>
            </DialogHeader>
            {mode !== "preview" && mode !== "recording" && (
              <Button type="button" size="icon" variant="ghost" className="text-white hover:bg-white/20" onClick={flipCamera}>
                <SwitchCamera className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center items-center gap-8 bg-gradient-to-t from-black/80 to-transparent">
            {mode === "preview" ? (
              <>
                <Button type="button" size="icon" variant="ghost" className="rounded-full border border-white/40 text-white hover:bg-white/20 w-12 h-12" onClick={retake}>
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <Button type="button" size="icon" className="rounded-full bg-white text-black hover:bg-white/90 w-16 h-16" onClick={confirm}>
                  <Check className="w-6 h-6" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="rounded-full border border-white/40 text-white hover:bg-white/20 w-12 h-12" onClick={() => onOpenChange(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </>
            ) : mode === "recording" ? (
              <Button type="button" size="icon" className="rounded-full bg-red-600 hover:bg-red-700 w-16 h-16" onClick={stopRecording}>
                <Square className="w-6 h-6 fill-white text-white" />
              </Button>
            ) : (
              <>
                <Button type="button" size="icon" variant="ghost" className="rounded-full border border-white/40 text-white hover:bg-white/20 w-12 h-12" onClick={takePhoto}>
                  <Camera className="w-5 h-5" />
                </Button>
                <Button type="button" size="icon" className="rounded-full border-4 border-white bg-transparent hover:bg-white/10 w-16 h-16" onClick={startRecording}>
                  <Circle className="w-8 h-8 fill-red-500 text-red-500" />
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

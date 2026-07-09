"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

export type UploadStage =
  | "idle"
  | "selected"
  | "uploading"
  | "processing"
  | "complete"
  | "error";

export type UploadMetadata = {
  fileId: string;
  key: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
};

export type MediaLabel = {
  name?: string;
  confidence?: number;
};

export type MediaResult = {
  fileId: string;
  bucket?: string;
  objectKey?: string;
  originalFileName?: string;
  status?: string;
  uploadedAt?: string;
  processedAt?: string;
  labels?: MediaLabel[];
  fileSize?: number;
};

type WebSocketMessage = {
  type?: string;
  payload?: MediaResult;
};

export function useUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");
  const [status, setStatus] = useState("Choose a JPG or PNG image to begin.");
  const [metadata, setMetadata] = useState<UploadMetadata | null>(null);
  const [result, setResult] = useState<MediaResult | null>(null);
  const [history, setHistory] = useState<MediaResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const activeFileIdRef = useRef<string | null>(null);

  const progressLabel = useMemo(() => {
    if (stage === "complete") return "Upload Complete";
    if (stage === "processing") return "Processing";
    if (stage === "uploading") return "Uploading";
    if (stage === "error") return "Needs Attention";
    if (stage === "selected") return "Ready to Upload";
    return "Ready";
  }, [stage]);

  useEffect(() => {
    void fetchHistory();
  }, []);

  useEffect(() => {
    const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

    if (!websocketUrl) {
      console.warn("NEXT_PUBLIC_WEBSOCKET_URL is not configured.");
      return;
    }

    const socket = new WebSocket(websocketUrl);

    socket.onopen = () => {
      console.log("MandVision WebSocket connected.");
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;

        if (message.type !== "MEDIA_PROCESSED" || !message.payload) {
          return;
        }

        const activeFileId = activeFileIdRef.current;

        if (activeFileId && message.payload.fileId !== activeFileId) {
          setHistory((currentHistory) => upsertHistoryItem(currentHistory, message.payload!));
          return;
        }

        setResult(message.payload);
        setHistory((currentHistory) => upsertHistoryItem(currentHistory, message.payload!));
        setStage("complete");
        setStatus("Processing complete. Rekognition labels received in real time.");
      } catch (error) {
        console.error("Failed to parse WebSocket message", error);
      }
    };

    socket.onerror = (error) => {
      console.error("MandVision WebSocket error", error);
    };

    socket.onclose = () => {
      console.log("MandVision WebSocket disconnected.");
    };

    return () => {
      socket.close();
    };
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setMetadata(null);
    setResult(null);
    activeFileIdRef.current = null;

    if (!selectedFile) {
      setPreviewUrl(null);
      setStage("idle");
      setStatus("Choose a JPG or PNG image to begin.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(URL.createObjectURL(selectedFile));
    setStage("selected");
    setStatus("Image selected. Ready for secure upload.");
  }

  async function handleUpload() {
    if (!file) {
      setStatus("Please select an image first.");
      setStage("error");
      return;
    }

    const supportedTypes = ["image/jpeg", "image/png"];

    if (!supportedTypes.includes(file.type)) {
      setStatus("Unsupported image format. Please upload a JPG or PNG file.");
      setStage("error");
      return;
    }

    try {
      setUploading(true);
      setStage("uploading");
      setStatus("Requesting secure upload URL...");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("NEXT_PUBLIC_API_URL is not configured.");
      }

      const presignResponse = await fetch(`${apiUrl}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
        }),
      });

      if (!presignResponse.ok) throw new Error("Could not get upload URL");

      const { uploadUrl, fileId, key } = await presignResponse.json();
      activeFileIdRef.current = fileId;

      setStatus("Uploading image directly to S3...");

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");

      const uploadedAt = new Date().toISOString();

      setMetadata({
        fileId,
        key,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt,
      });

      setStage("processing");
      setStatus("Upload complete. MandVision is processing your image with Rekognition.");

      void pollForResults(fileId);
    } catch (error) {
      console.error(error);
      setStage("error");
      setStatus("Something went wrong during upload. Please try again.");
    } finally {
      setUploading(false);
    }
  }
  const [selectedHistoryItem, setSelectedHistoryItem] =
    useState<MediaResult | null>(null);

  function selectHistoryItem(item: MediaResult) {
    activeFileIdRef.current = item.fileId;
    setResult(item);
    setMetadata({
      fileId: item.fileId,
      key: item.objectKey || "",
      fileName: item.originalFileName || item.fileId,
      fileSize: item.fileSize || 0,
      uploadedAt: item.uploadedAt || item.processedAt || new Date().toISOString(),
    });
    setStage(item.status === "PROCESSED" ? "complete" : "processing");
    setStatus(
      item.status === "PROCESSED"
        ? "Loaded previous processed result from upload history."
        : "Loaded previous upload from history. Processing may still be pending."
    );
  }

  async function fetchHistory() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) return;

      const response = await fetch(`${apiUrl}/media/`);

      if (!response.ok) return;

      const data = (await response.json()) as { items?: MediaResult[] };
      setHistory(data.items || []);
    } catch (error) {
      console.error("Could not fetch upload history", error);
    }
  }

  async function pollForResults(fileId: string) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      setStage("error");
      setStatus("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }

    for (let attempt = 1; attempt <= 8; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const response = await fetch(`${apiUrl}/media/${fileId}`);

      if (response.ok) {
        const mediaResult = (await response.json()) as MediaResult;
        setResult(mediaResult);
        setHistory((currentHistory) => upsertHistoryItem(currentHistory, mediaResult));

        if (mediaResult.status === "PROCESSED") {
          setStage("complete");
          setStatus("Processing complete. Rekognition labels are ready.");
          return;
        }
      }

      setStatus(`Processing image... checking results (${attempt}/8)`);
    }

    setStage("processing");
    setStatus("Still processing. Refresh or upload another image in a moment.");
  }

  return {
    file,
    previewUrl,
    stage,
    status,
    metadata,
    result,
    history,
    uploading,
    progressLabel,
    handleFileChange,
    handleUpload,
    fetchHistory,
    selectHistoryItem,
    selectedHistoryItem,
    setSelectedHistoryItem,
  };
}

function upsertHistoryItem(items: MediaResult[], nextItem: MediaResult) {
  const withoutDuplicate = items.filter((item) => item.fileId !== nextItem.fileId);
  return [nextItem, ...withoutDuplicate];
}